/**
 * Seeds ReturnDesk with 34 realistic return requests covering every status,
 * every reason and every resolution, plus notes and a consistent audit history.
 *
 *   npm run db:seed
 *
 * Idempotent: each sample request is identified by its order ID + item SKU.
 * Requests that already exist are skipped, so rerunning never duplicates data.
 * Rows are inserted directly in their final state (INSERT does not fire the
 * lifecycle trigger), but every row still has to satisfy the CHECK constraints,
 * and each one gets a history that walks the legal lifecycle to that state.
 */
import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { createPool } from "../src/db/client";
import * as schema from "../src/db/schema";
import type { RequestStatus, Resolution, ReturnReason } from "../src/db/schema";

const { returnRequests, notes, requestEvents } = schema;

const customers = [
  { name: "Aarav Sharma", email: "aarav.sharma@example.com", phone: "+91 98100 22345" },
  { name: "Priya Nair", email: "priya.nair@example.com", phone: "+91 98450 11872" },
  { name: "Liam O'Connor", email: "liam.oconnor@example.com", phone: null },
  { name: "Sofia Martínez", email: "sofia.martinez@example.com", phone: "+34 612 345 678" },
  { name: "Rohan Gupta", email: "rohan.gupta@example.com", phone: "+91 99870 44123" },
  { name: "Emma Thompson", email: "emma.thompson@example.com", phone: "+44 7700 900123" },
  { name: "Kenji Watanabe", email: "kenji.watanabe@example.com", phone: null },
  { name: "Ananya Iyer", email: "ananya.iyer@example.com", phone: "+91 90040 55671" },
  { name: "Noah Becker", email: "noah.becker@example.com", phone: "+49 151 2345 6789" },
  { name: "Fatima Khan", email: "fatima.khan@example.com", phone: "+91 98201 33456" },
  { name: "Olivia Brown", email: "olivia.brown@example.com", phone: null },
  { name: "Vikram Singh", email: "vikram.singh@example.com", phone: "+91 97111 80022" },
];

const items = [
  { sku: "TS-CTN-BLK-M", name: "Organic Cotton Tee – Black, M", price: "24.00" },
  { sku: "SNK-RUN-42", name: "Trail Runner Sneakers – EU 42", price: "89.99" },
  { sku: "MUG-CER-350", name: "Stoneware Mug 350 ml", price: "14.50" },
  { sku: "HP-WL-ANC", name: "Wireless ANC Headphones", price: "149.00" },
  { sku: "JKT-DWN-L", name: "Packable Down Jacket – L", price: "129.00" },
  { sku: "BAG-LTH-TOTE", name: "Leather Tote Bag", price: "110.00" },
  { sku: "LMP-DSK-OAK", name: "Oak Desk Lamp", price: "59.00" },
  { sku: "BTL-STL-750", name: "Insulated Steel Bottle 750 ml", price: "29.00" },
  { sku: "JNS-SLM-32", name: "Slim Fit Jeans – W32", price: "64.00" },
  { sku: "KBD-MECH-TKL", name: "Mechanical Keyboard TKL", price: "119.00" },
];

const reasons: ReturnReason[] = [
  "DAMAGED",
  "WRONG_ITEM",
  "SIZE_ISSUE",
  "NOT_AS_DESCRIBED",
  "CHANGED_MIND",
];

const resolutions: Resolution[] = ["REFUND", "REPLACEMENT", "STORE_CREDIT"];

/** 34 requests: 8 open, 7 in review, 7 approved, 6 rejected, 6 completed. */
const statusPlan: RequestStatus[] = [
  ...Array<RequestStatus>(8).fill("OPEN"),
  ...Array<RequestStatus>(7).fill("IN_REVIEW"),
  ...Array<RequestStatus>(7).fill("APPROVED"),
  ...Array<RequestStatus>(6).fill("REJECTED"),
  ...Array<RequestStatus>(6).fill("COMPLETED"),
];

const pathTo: Record<RequestStatus, RequestStatus[]> = {
  OPEN: ["OPEN"],
  IN_REVIEW: ["OPEN", "IN_REVIEW"],
  APPROVED: ["OPEN", "IN_REVIEW", "APPROVED"],
  REJECTED: ["OPEN", "IN_REVIEW", "REJECTED"],
  COMPLETED: ["OPEN", "IN_REVIEW", "APPROVED", "COMPLETED"],
};

const noteTemplates: Partial<Record<RequestStatus, string[]>> = {
  OPEN: ["Customer emailed photos of the item; attached to the order in the store admin."],
  IN_REVIEW: [
    "Asked the warehouse to confirm the batch number before deciding.",
    "Customer confirmed the packaging was intact on arrival.",
  ],
  APPROVED: ["Return label sent to the customer. Waiting for the parcel to be scanned."],
  REJECTED: ["Outside the 30-day return window and the item shows signs of use."],
  COMPLETED: ["Item received and inspected. Resolution issued to the customer."],
};

const HOUR = 60 * 60 * 1000;

function buildPlan() {
  const now = Date.now();
  return statusPlan.map((status, i) => {
    const customer = customers[i % customers.length];
    const item = items[(i * 3) % items.length];
    const reason = reasons[i % reasons.length];
    const resolution =
      status === "APPROVED" || status === "COMPLETED" ? resolutions[i % resolutions.length] : null;
    const quantity = (i % 3) + 1;
    const refundAmount =
      resolution === "REFUND" ? (Number(item.price) * quantity).toFixed(2) : null;
    // Spread creation over the last ~40 days, interleaving statuses so recent activity looks realistic.
    // 13 is coprime with 34, so every request gets a distinct slot.
    const createdAt = new Date(now - (((i * 13) % statusPlan.length) + 1) * 27 * HOUR);
    return {
      status,
      resolution,
      refundAmount,
      createdAt,
      values: {
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        orderId: `ORD-${(24051 + i * 7).toString()}`,
        itemSku: item.sku,
        itemName: item.name,
        quantity,
        reason,
      },
      withNotes: i % 2 === 0 || status === "REJECTED",
    };
  });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = createPool(url);
  const db = drizzle(pool, { schema });
  let created = 0;
  let skipped = 0;

  try {
    // Insert oldest first so sequence-generated references increase with creation time.
    const plan = buildPlan().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const entry of plan) {
      await db.transaction(async (tx) => {
        const existing = await tx
          .select({ id: returnRequests.id })
          .from(returnRequests)
          .where(
            and(
              eq(returnRequests.orderId, entry.values.orderId),
              eq(returnRequests.itemSku, entry.values.itemSku),
            ),
          )
          .limit(1);
        if (existing.length > 0) {
          skipped++;
          return;
        }

        const path = pathTo[entry.status];
        const updatedAt = new Date(entry.createdAt.getTime() + (path.length - 1) * 5 * HOUR);
        const [row] = await tx
          .insert(returnRequests)
          .values({
            ...entry.values,
            status: entry.status,
            resolution: entry.resolution,
            refundAmount: entry.refundAmount,
            createdAt: entry.createdAt,
            updatedAt,
          })
          .returning({ id: returnRequests.id });

        await tx.insert(requestEvents).values([
          { requestId: row.id, type: "CREATED", toStatus: "OPEN", createdAt: entry.createdAt },
          ...path.slice(1).map((toStatus, step) => ({
            requestId: row.id,
            type: "STATUS_CHANGED" as const,
            fromStatus: path[step],
            toStatus,
            createdAt: new Date(entry.createdAt.getTime() + (step + 1) * 5 * HOUR),
          })),
        ]);

        if (entry.withNotes) {
          const bodies = path.flatMap((s) => noteTemplates[s] ?? []).slice(0, 3);
          await tx.insert(notes).values(
            bodies.map((body, n) => ({
              requestId: row.id,
              author: n % 2 === 0 ? "Maya (Support)" : "Arjun (Support)",
              body,
              createdAt: new Date(entry.createdAt.getTime() + (n * 5 + 2) * HOUR),
            })),
          );
        }
        created++;
      });
    }
    console.log(`Seed complete: ${created} created, ${skipped} already present.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
