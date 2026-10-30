CREATE TYPE "public"."conversation_status" AS ENUM('active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."follow_up_type" AS ENUM('callback', 'visit', 'samples', 'credit', 'complaint', 'other');--> statement-breakpoint
CREATE TYPE "public"."item_kind" AS ENUM('order', 'interest');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('en', 'hi');--> statement-breakpoint
CREATE TYPE "public"."outcome" AS ENUM('order_enquiry', 'interested', 'follow_up', 'not_interested', 'no_outcome');--> statement-breakpoint
CREATE TYPE "public"."quantity_unit" AS ENUM('cases', 'units');--> statement-breakpoint
CREATE TYPE "public"."scheme_type" AS ENUM('percent_off', 'flat_off', 'free_cases');--> statement-breakpoint
CREATE TYPE "public"."stock_status" AS ENUM('in_stock', 'low_stock', 'out_of_stock');--> statement-breakpoint
CREATE TABLE "captured_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"product_id" integer NOT NULL,
	"kind" "item_kind" NOT NULL,
	"quantity" integer,
	"unit" "quantity_unit",
	"scheme_id" integer,
	"estimated_value" numeric(12, 2),
	"free_cases" integer,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "captured_items_conversationId_productId_unique" UNIQUE("conversation_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retailer_id" integer,
	"retailer_name" text,
	"language" "language" NOT NULL,
	"status" "conversation_status" DEFAULT 'active' NOT NULL,
	"outcome" "outcome",
	"summary" text,
	"next_steps" text,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "follow_ups" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"type" "follow_up_type" NOT NULL,
	"due_date" date,
	"notes" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"category" text NOT NULL,
	"pack_size" text NOT NULL,
	"units_per_case" integer NOT NULL,
	"mrp" numeric(12, 2) NOT NULL,
	"ptr" numeric(12, 2) NOT NULL,
	"stock_status" "stock_status" NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "retailers" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_name" text NOT NULL,
	"owner_name" text NOT NULL,
	"phone" text NOT NULL,
	"town" text NOT NULL,
	"area" text NOT NULL,
	"language" "language" DEFAULT 'en' NOT NULL,
	CONSTRAINT "retailers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "schemes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"type" "scheme_type" NOT NULL,
	"product_id" integer,
	"category" text,
	"min_cases" integer NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"valid_until" date NOT NULL,
	CONSTRAINT "schemes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "captured_items" ADD CONSTRAINT "captured_items_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_items" ADD CONSTRAINT "captured_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_items" ADD CONSTRAINT "captured_items_scheme_id_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schemes" ADD CONSTRAINT "schemes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;