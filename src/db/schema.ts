import type { UIMessage } from 'ai';
import { sql } from 'drizzle-orm';
import { date, integer, jsonb, numeric, pgEnum, pgTable, serial, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const stockStatus = pgEnum('stock_status', ['in_stock', 'low_stock', 'out_of_stock']);
export const schemeType = pgEnum('scheme_type', ['percent_off', 'flat_off', 'free_cases']);
export const language = pgEnum('language', ['en', 'hi']);
export const conversationStatus = pgEnum('conversation_status', ['active', 'completed']);
export const outcome = pgEnum('outcome', ['order_enquiry', 'interested', 'follow_up', 'not_interested', 'no_outcome']);
export const itemKind = pgEnum('item_kind', ['order', 'interest']);
export const quantityUnit = pgEnum('quantity_unit', ['cases', 'units']);
export const followUpType = pgEnum('follow_up_type', ['callback', 'visit', 'samples', 'credit', 'complaint', 'other']);

const money = () => numeric({ precision: 12, scale: 2, mode: 'number' });

export const products = pgTable('products', {
  id: serial().primaryKey(),
  sku: text().notNull().unique(),
  name: text().notNull(),
  brand: text().notNull(),
  category: text().notNull(),
  packSize: text().notNull(),
  unitsPerCase: integer().notNull(),
  mrp: money().notNull(),
  // Price to retailer, per unit.
  ptr: money().notNull(),
  stockStatus: stockStatus().notNull(),
  // Colloquial / Hindi names retailers may use ("aata", "chai patti").
  aliases: text().array().notNull().default(sql`'{}'::text[]`),
  description: text().notNull(),
});

export const schemes = pgTable('schemes', {
  id: serial().primaryKey(),
  code: text().notNull().unique(),
  title: text().notNull(),
  description: text().notNull(),
  type: schemeType().notNull(),
  // A scheme targets one product, or every product in a category.
  productId: integer().references(() => products.id),
  category: text(),
  minCases: integer().notNull(),
  // percent_off: percent; flat_off: rupees per minCases block; free_cases: free cases per minCases block.
  value: numeric({ precision: 10, scale: 2, mode: 'number' }).notNull(),
  validUntil: date({ mode: 'string' }).notNull(),
});

export const retailers = pgTable('retailers', {
  id: serial().primaryKey(),
  shopName: text().notNull(),
  ownerName: text().notNull(),
  phone: text().notNull().unique(),
  town: text().notNull(),
  area: text().notNull(),
  language: language().notNull().default('en'),
});

export const conversations = pgTable('conversations', {
  id: uuid().primaryKey().defaultRandom(),
  retailerId: integer().references(() => retailers.id),
  // Shop name as spoken, when the retailer is not in our records.
  retailerName: text(),
  language: language().notNull(),
  status: conversationStatus().notNull().default('active'),
  outcome: outcome(),
  summary: text(),
  nextSteps: text(),
  messages: jsonb().$type<UIMessage[]>().notNull().default([]),
  startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp({ withTimezone: true }),
});

export const capturedItems = pgTable(
  'captured_items',
  {
    id: serial().primaryKey(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    productId: integer()
      .notNull()
      .references(() => products.id),
    kind: itemKind().notNull(),
    quantity: integer(),
    unit: quantityUnit(),
    schemeId: integer().references(() => schemes.id),
    estimatedValue: money(),
    freeCases: integer(),
    note: text(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.conversationId, t.productId)],
);

export const followUps = pgTable('follow_ups', {
  id: serial().primaryKey(),
  conversationId: uuid()
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  type: followUpType().notNull(),
  dueDate: date({ mode: 'string' }),
  notes: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type Product = typeof products.$inferSelect;
export type Scheme = typeof schemes.$inferSelect;
export type Retailer = typeof retailers.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type CapturedItem = typeof capturedItems.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;
export type Language = (typeof language.enumValues)[number];
export type Outcome = (typeof outcome.enumValues)[number];
export type FollowUpType = (typeof followUpType.enumValues)[number];
