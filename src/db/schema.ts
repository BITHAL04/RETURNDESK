/**
 * ReturnDesk data model.
 *
 * Business rules that can be expressed declaratively are enforced here as real
 * PostgreSQL constraints, so the database refuses bad data even if a bug slips
 * past the service layer:
 *
 *  - Rule 2: CHECK constraints tie resolution and refund amount together.
 *  - Rule 3: a partial unique index allows only one live request per order item.
 *  - Rule 5: a CHECK constraint allows only OPEN/REJECTED rows to be soft-deleted.
 *
 * Rules 1 and 4 (legal transitions, locked details) and note immutability are
 * enforced by triggers in a hand-written migration (see drizzle/0001_*.sql).
 */
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const requestStatus = pgEnum("request_status", [
  "OPEN",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
]);

export const returnReason = pgEnum("return_reason", [
  "DAMAGED",
  "WRONG_ITEM",
  "SIZE_ISSUE",
  "NOT_AS_DESCRIBED",
  "CHANGED_MIND",
]);

export const resolution = pgEnum("resolution", ["REFUND", "REPLACEMENT", "STORE_CREDIT"]);

export const requestEventType = pgEnum("request_event_type", [
  "CREATED",
  "DETAILS_UPDATED",
  "STATUS_CHANGED",
  "REMOVED",
]);

/** Backs the human-readable reference. Sequences never hand out the same value twice, even under concurrency. */
export const referenceSequence = pgSequence("return_request_reference_seq", {
  startWith: 1,
  increment: 1,
});

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });

export const returnRequests = pgTable(
  "return_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: varchar("reference", { length: 20 })
      .notNull()
      .unique()
      .default(sql`('RD-' || lpad(nextval('return_request_reference_seq')::text, 6, '0'))`),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    customerEmail: varchar("customer_email", { length: 254 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 32 }),
    orderId: varchar("order_id", { length: 64 }).notNull(),
    itemSku: varchar("item_sku", { length: 64 }).notNull(),
    itemName: varchar("item_name", { length: 200 }).notNull(),
    quantity: integer("quantity").notNull(),
    reason: returnReason("reason").notNull(),
    status: requestStatus("status").notNull().default("OPEN"),
    resolution: resolution("resolution"),
    refundAmount: numeric("refund_amount", { precision: 10, scale: 2 }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    deletedAt: timestamptz("deleted_at"),
  },
  (t) => [
    index("return_requests_status_idx").on(t.status),
    index("return_requests_reason_idx").on(t.reason),
    index("return_requests_created_at_idx").on(t.createdAt),
    // Rule 3: one live request per order item. Closed or removed requests do not count.
    uniqueIndex("return_requests_one_live_per_order_item")
      .on(sql`lower(${t.orderId})`, sql`lower(${t.itemSku})`)
      .where(sql`${t.status} NOT IN ('REJECTED', 'COMPLETED') AND ${t.deletedAt} IS NULL`),
    // Trigram indexes keep "contains" search (ILIKE '%term%') fast.
    index("return_requests_customer_name_trgm").using("gin", sql`${t.customerName} gin_trgm_ops`),
    index("return_requests_customer_email_trgm").using("gin", sql`${t.customerEmail} gin_trgm_ops`),
    index("return_requests_order_id_trgm").using("gin", sql`${t.orderId} gin_trgm_ops`),
    index("return_requests_reference_trgm").using("gin", sql`${t.reference} gin_trgm_ops`),
    check("return_requests_quantity_range", sql`${t.quantity} BETWEEN 1 AND 1000`),
    check(
      "return_requests_required_text",
      sql`btrim(${t.customerName}) <> '' AND btrim(${t.customerEmail}) <> '' AND btrim(${t.orderId}) <> '' AND btrim(${t.itemSku}) <> '' AND btrim(${t.itemName}) <> ''`,
    ),
    // Rule 2: a resolution exists exactly when the request is APPROVED or COMPLETED.
    check(
      "return_requests_resolution_matches_status",
      sql`(${t.status} IN ('APPROVED', 'COMPLETED')) = (${t.resolution} IS NOT NULL)`,
    ),
    // Rule 2: refunds need a positive amount; other resolutions record no amount.
    check(
      "return_requests_refund_amount_matches_resolution",
      sql`(${t.resolution} = 'REFUND' AND ${t.refundAmount} > 0) OR (${t.resolution} IS DISTINCT FROM 'REFUND' AND ${t.refundAmount} IS NULL)`,
    ),
    // Rule 5: only OPEN or REJECTED requests may be soft-deleted.
    check(
      "return_requests_removable_status",
      sql`${t.deletedAt} IS NULL OR ${t.status} IN ('OPEN', 'REJECTED')`,
    ),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => returnRequests.id, { onDelete: "restrict" }),
    author: varchar("author", { length: 80 }).notNull(),
    body: text("body").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("notes_request_id_created_at_idx").on(t.requestId, t.createdAt),
    check("notes_body_not_blank", sql`btrim(${t.body}) <> '' AND length(${t.body}) <= 5000`),
    check("notes_author_not_blank", sql`btrim(${t.author}) <> ''`),
  ],
);

export const requestEvents = pgTable(
  "request_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => returnRequests.id, { onDelete: "restrict" }),
    type: requestEventType("type").notNull(),
    fromStatus: requestStatus("from_status"),
    toStatus: requestStatus("to_status"),
    /** For DETAILS_UPDATED: { field: { from, to } } for each changed field. */
    changes: jsonb("changes").$type<Record<string, { from: unknown; to: unknown }>>(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("request_events_request_id_created_at_idx").on(t.requestId, t.createdAt)],
);

export type ReturnRequestRow = typeof returnRequests.$inferSelect;
export type NoteRow = typeof notes.$inferSelect;
export type RequestEventRow = typeof requestEvents.$inferSelect;
export type RequestStatus = (typeof requestStatus.enumValues)[number];
export type ReturnReason = (typeof returnReason.enumValues)[number];
export type Resolution = (typeof resolution.enumValues)[number];
