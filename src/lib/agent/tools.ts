import 'server-only';

import { tool, type InferUITools, type UIDataTypes, type UIMessage } from 'ai';
import { and, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db';
import { capturedItems, conversations, followUpType, followUps, retailers } from '@/db/schema';
import type { CatalogueEntry } from '@/lib/catalogue';
import { priceLine } from '@/lib/pricing';

const GENERIC_SHOP_WORDS = new Set([
  'shop',
  'store',
  'stores',
  'kirana',
  'general',
  'provision',
  'provisions',
  'traders',
  'trader',
  'mart',
  'super',
  'brothers',
  'the',
  'and',
]);

export function createTools(conversationId: string, catalogue: CatalogueEntry[]) {
  const findProduct = (sku: string) => catalogue.find((p) => p.sku.toLowerCase() === sku.trim().toLowerCase());

  return {
    identifyRetailer: tool({
      description:
        'Look up the retailer by phone number or shop name and link them to this call. Use as soon as the retailer gives either.',
      inputSchema: z.object({
        phone: z.string().optional().describe('Phone number as spoken, digits only if possible'),
        shopName: z.string().optional().describe('Shop name as spoken'),
      }),
      execute: async ({ phone, shopName }) => {
        const digits = phone?.replace(/\D/g, '').slice(-10);
        // Spoken names come with extras ("Sharma Kirana Store, Kothrud"): every distinctive word must match
        // the shop, owner, area or town.
        const words = (shopName ?? '')
          .toLowerCase()
          .split(/[^\p{L}\p{N}]+/u)
          .filter((w) => w.length > 2 && !GENERIC_SHOP_WORDS.has(w));
        const nameMatch = words.length
          ? and(
              ...words.map((w) =>
                or(
                  ilike(retailers.shopName, `%${w}%`),
                  ilike(retailers.ownerName, `%${w}%`),
                  ilike(retailers.area, `%${w}%`),
                  ilike(retailers.town, `%${w}%`),
                ),
              ),
            )
          : undefined;
        const conditions = [digits && digits.length === 10 ? eq(retailers.phone, digits) : undefined, nameMatch].filter(
          (c) => c !== undefined,
        );

        const matches = conditions.length ? await db.select().from(retailers).where(or(...conditions)).limit(5) : [];

        if (matches.length === 1) {
          const [retailer] = matches;
          await db.update(conversations).set({ retailerId: retailer.id, retailerName: null }).where(eq(conversations.id, conversationId));
          return { status: 'found' as const, retailer };
        }
        if (matches.length > 1) {
          return {
            status: 'multiple' as const,
            candidates: matches.map((r) => ({ shopName: r.shopName, area: r.area, town: r.town })),
            hint: 'Ask which one, or ask for their phone number.',
          };
        }
        if (shopName) {
          await db.update(conversations).set({ retailerName: shopName.trim() }).where(eq(conversations.id, conversationId));
        }
        return { status: 'not_found' as const, hint: 'Treat them as a new retailer lead and continue helping.' };
      },
    }),

    recordItem: tool({
      description:
        'Record an order enquiry line (kind "order", with quantity) or product interest (kind "interest", quantity optional). Calling again for the same SKU replaces the previous line.',
      inputSchema: z.object({
        sku: z.string().describe('SKU from the catalogue'),
        kind: z.enum(['order', 'interest']),
        quantity: z.number().int().positive().optional(),
        unit: z.enum(['cases', 'units']).optional().describe('Defaults to cases'),
        note: z.string().optional(),
      }),
      execute: async ({ sku, kind, quantity, unit = 'cases', note }) => {
        const product = findProduct(sku);
        if (!product) return { status: 'error' as const, message: `Unknown SKU ${sku}. Use a SKU from the catalogue.` };
        if (kind === 'order' && !quantity) {
          return { status: 'error' as const, message: 'Ask the retailer for a quantity before recording an order line.' };
        }

        const priced = quantity ? priceLine(product, quantity, unit, product.schemes) : null;
        const values = {
          conversationId,
          productId: product.id,
          kind,
          quantity: quantity ?? null,
          unit: quantity ? unit : null,
          schemeId: priced?.scheme?.id ?? null,
          estimatedValue: priced?.net ?? null,
          freeCases: priced?.freeCases || null,
          note: note ?? null,
          updatedAt: new Date(),
        };
        await db
          .insert(capturedItems)
          .values(values)
          .onConflictDoUpdate({ target: [capturedItems.conversationId, capturedItems.productId], set: values });

        return {
          status: 'recorded' as const,
          sku: product.sku,
          product: `${product.name} ${product.packSize}`,
          kind,
          quantity: quantity ?? null,
          unit: quantity ? unit : null,
          gross: priced?.gross ?? null,
          discount: priced?.discount ?? 0,
          estimatedValue: priced?.net ?? null,
          freeCases: priced?.freeCases ?? 0,
          scheme: priced?.scheme?.title ?? null,
          stockStatus: product.stockStatus,
        };
      },
    }),

    removeItem: tool({
      description: 'Remove a previously recorded product line when the retailer cancels it.',
      inputSchema: z.object({ sku: z.string() }),
      execute: async ({ sku }) => {
        const product = findProduct(sku);
        if (!product) return { status: 'error' as const, message: `Unknown SKU ${sku}.` };
        await db
          .delete(capturedItems)
          .where(and(eq(capturedItems.conversationId, conversationId), eq(capturedItems.productId, product.id)));
        return { status: 'removed' as const, sku: product.sku, product: `${product.name} ${product.packSize}` };
      },
    }),

    recordFollowUp: tool({
      description: 'Record a follow-up the retailer needs: callback, sales rep visit, samples, credit/payment query or complaint.',
      inputSchema: z.object({
        type: z.enum(followUpType.enumValues),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('YYYY-MM-DD, if a date was mentioned'),
        notes: z.string().describe('What needs to happen, in one sentence'),
      }),
      execute: async ({ type, dueDate, notes }) => {
        const [row] = await db
          .insert(followUps)
          .values({ conversationId, type, dueDate: dueDate ?? null, notes })
          .returning();
        return { status: 'recorded' as const, id: row.id, type, dueDate: row.dueDate, notes };
      },
    }),

    endCall: tool({
      description: 'End the call after you have said goodbye. Call it in the same turn as your goodbye.',
      inputSchema: z.object({ reason: z.string().optional() }),
      execute: async () => ({ status: 'ended' as const }),
    }),
  };
}

export type AgentTools = ReturnType<typeof createTools>;
export type AgentUIMessage = UIMessage<unknown, UIDataTypes, InferUITools<AgentTools>>;
