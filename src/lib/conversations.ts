import 'server-only';

import { asc, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  capturedItems,
  conversations,
  followUps,
  products,
  retailers,
  schemes,
  type Language,
} from '@/db/schema';
import { greeting } from '@/lib/agent/prompt';
import type { AgentUIMessage } from '@/lib/agent/tools';

export async function createConversation({ retailerId, language }: { retailerId: number | null; language: Language }) {
  const retailer = retailerId ? await db.query.retailers.findFirst({ where: eq(retailers.id, retailerId) }) : null;
  const opening: AgentUIMessage = {
    id: `greeting-${crypto.randomUUID()}`,
    role: 'assistant',
    parts: [{ type: 'text', text: greeting(language, retailer ?? null) }],
  };
  const [row] = await db
    .insert(conversations)
    .values({ retailerId: retailer?.id ?? null, language, messages: [opening] })
    .returning();
  return row;
}

export async function getConversation(id: string) {
  return db.query.conversations.findFirst({ where: eq(conversations.id, id) });
}

export async function saveMessages(id: string, messages: AgentUIMessage[]) {
  await db.update(conversations).set({ messages }).where(eq(conversations.id, id));
}

export async function getCapturedItems(conversationId: string) {
  return db
    .select({ item: capturedItems, product: products, scheme: schemes })
    .from(capturedItems)
    .innerJoin(products, eq(capturedItems.productId, products.id))
    .leftJoin(schemes, eq(capturedItems.schemeId, schemes.id))
    .where(eq(capturedItems.conversationId, conversationId))
    .orderBy(asc(capturedItems.id));
}

export async function getFollowUps(conversationId: string) {
  return db.select().from(followUps).where(eq(followUps.conversationId, conversationId)).orderBy(asc(followUps.id));
}

export async function getConversationDetail(id: string) {
  const conversation = await getConversation(id);
  if (!conversation) return null;
  const [retailer, items, followUpRows] = await Promise.all([
    conversation.retailerId ? db.query.retailers.findFirst({ where: eq(retailers.id, conversation.retailerId) }) : null,
    getCapturedItems(id),
    getFollowUps(id),
  ]);
  return { conversation, retailer: retailer ?? null, items, followUps: followUpRows };
}

export async function listConversations() {
  const itemTotals = db
    .select({
      conversationId: capturedItems.conversationId,
      orderLines: sql<number>`count(*) filter (where ${capturedItems.kind} = 'order')`.mapWith(Number).as('order_lines'),
      interestLines: sql<number>`count(*) filter (where ${capturedItems.kind} = 'interest')`.mapWith(Number).as('interest_lines'),
      value: sql<number>`coalesce(sum(${capturedItems.estimatedValue}), 0)`.mapWith(Number).as('value'),
    })
    .from(capturedItems)
    .groupBy(capturedItems.conversationId)
    .as('item_totals');

  const followUpCounts = db
    .select({
      conversationId: followUps.conversationId,
      count: sql<number>`count(*)`.mapWith(Number).as('follow_up_count'),
    })
    .from(followUps)
    .groupBy(followUps.conversationId)
    .as('follow_up_counts');

  return db
    .select({
      id: conversations.id,
      status: conversations.status,
      outcome: conversations.outcome,
      language: conversations.language,
      startedAt: conversations.startedAt,
      endedAt: conversations.endedAt,
      shopName: sql<string | null>`coalesce(${retailers.shopName}, ${conversations.retailerName})`,
      town: retailers.town,
      orderLines: sql<number>`coalesce(${itemTotals.orderLines}, 0)`.mapWith(Number),
      interestLines: sql<number>`coalesce(${itemTotals.interestLines}, 0)`.mapWith(Number),
      value: sql<number>`coalesce(${itemTotals.value}, 0)`.mapWith(Number),
      followUps: sql<number>`coalesce(${followUpCounts.count}, 0)`.mapWith(Number),
    })
    .from(conversations)
    .leftJoin(retailers, eq(conversations.retailerId, retailers.id))
    .leftJoin(itemTotals, eq(itemTotals.conversationId, conversations.id))
    .leftJoin(followUpCounts, eq(followUpCounts.conversationId, conversations.id))
    .orderBy(desc(conversations.startedAt));
}
