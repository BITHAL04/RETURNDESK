CREATE TYPE "public"."request_event_type" AS ENUM('CREATED', 'DETAILS_UPDATED', 'STATUS_CHANGED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."resolution" AS ENUM('REFUND', 'REPLACEMENT', 'STORE_CREDIT');--> statement-breakpoint
CREATE TYPE "public"."return_reason" AS ENUM('DAMAGED', 'WRONG_ITEM', 'SIZE_ISSUE', 'NOT_AS_DESCRIBED', 'CHANGED_MIND');--> statement-breakpoint
CREATE SEQUENCE "public"."return_request_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"author" varchar(80) NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notes_body_not_blank" CHECK (btrim("notes"."body") <> '' AND length("notes"."body") <= 5000),
	CONSTRAINT "notes_author_not_blank" CHECK (btrim("notes"."author") <> '')
);
--> statement-breakpoint
CREATE TABLE "request_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"type" "request_event_type" NOT NULL,
	"from_status" "request_status",
	"to_status" "request_status",
	"changes" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(20) DEFAULT ('RD-' || lpad(nextval('return_request_reference_seq')::text, 6, '0')) NOT NULL,
	"customer_name" varchar(120) NOT NULL,
	"customer_email" varchar(254) NOT NULL,
	"customer_phone" varchar(32),
	"order_id" varchar(64) NOT NULL,
	"item_sku" varchar(64) NOT NULL,
	"item_name" varchar(200) NOT NULL,
	"quantity" integer NOT NULL,
	"reason" "return_reason" NOT NULL,
	"status" "request_status" DEFAULT 'OPEN' NOT NULL,
	"resolution" "resolution",
	"refund_amount" numeric(10, 2),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "return_requests_reference_unique" UNIQUE("reference"),
	CONSTRAINT "return_requests_quantity_range" CHECK ("return_requests"."quantity" BETWEEN 1 AND 1000),
	CONSTRAINT "return_requests_required_text" CHECK (btrim("return_requests"."customer_name") <> '' AND btrim("return_requests"."customer_email") <> '' AND btrim("return_requests"."order_id") <> '' AND btrim("return_requests"."item_sku") <> '' AND btrim("return_requests"."item_name") <> ''),
	CONSTRAINT "return_requests_resolution_matches_status" CHECK (("return_requests"."status" IN ('APPROVED', 'COMPLETED')) = ("return_requests"."resolution" IS NOT NULL)),
	CONSTRAINT "return_requests_refund_amount_matches_resolution" CHECK (("return_requests"."resolution" = 'REFUND' AND "return_requests"."refund_amount" > 0) OR ("return_requests"."resolution" IS DISTINCT FROM 'REFUND' AND "return_requests"."refund_amount" IS NULL)),
	CONSTRAINT "return_requests_removable_status" CHECK ("return_requests"."deleted_at" IS NULL OR "return_requests"."status" IN ('OPEN', 'REJECTED'))
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_request_id_return_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."return_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_events" ADD CONSTRAINT "request_events_request_id_return_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."return_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_request_id_created_at_idx" ON "notes" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "request_events_request_id_created_at_idx" ON "request_events" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "return_requests_status_idx" ON "return_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "return_requests_reason_idx" ON "return_requests" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "return_requests_created_at_idx" ON "return_requests" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "return_requests_one_live_per_order_item" ON "return_requests" USING btree (lower("order_id"),lower("item_sku")) WHERE "return_requests"."status" NOT IN ('REJECTED', 'COMPLETED') AND "return_requests"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "return_requests_customer_name_trgm" ON "return_requests" USING gin ("customer_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "return_requests_customer_email_trgm" ON "return_requests" USING gin ("customer_email" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "return_requests_order_id_trgm" ON "return_requests" USING gin ("order_id" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "return_requests_reference_trgm" ON "return_requests" USING gin ("reference" gin_trgm_ops);