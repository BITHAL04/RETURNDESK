/**
 * Data access for return requests. All filtering, searching, sorting and paging
 * is translated into SQL here; nothing is filtered in application memory.
 */
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { Database } from "@/db/client";
import { notes, requestEvents, returnRequests } from "@/db/schema";
import type { ListQuery, SortField } from "@/lib/validation/requests";

/** A transaction handle or the root database: both expose the same query API. */
export type Executor = Pick<Database, "select" | "insert" | "update" | "execute">;

const notRemoved = isNull(returnRequests.deletedAt);

/** Fetches a visible (not removed) request. `lock` takes a row lock for the rest of the transaction. */
export async function findVisibleById(executor: Executor, id: string, lock = false) {
  const query = executor
    .select()
    .from(returnRequests)
    .where(and(eq(returnRequests.id, id), notRemoved))
    .limit(1);
  const rows = lock ? await query.for("update") : await query;
  return rows[0];
}

/** Finds a live request for the same order item (rule 3), optionally ignoring one request. */
export async function findLiveDuplicate(
  executor: Executor,
  orderId: string,
  itemSku: string,
  excludeId?: string,
) {
  const rows = await executor
    .select({ id: returnRequests.id, reference: returnRequests.reference })
    .from(returnRequests)
    .where(
      and(
        sql`lower(${returnRequests.orderId}) = lower(${orderId})`,
        sql`lower(${returnRequests.itemSku}) = lower(${itemSku})`,
        notInArray(returnRequests.status, ["REJECTED", "COMPLETED"]),
        notRemoved,
        excludeId ? sql`${returnRequests.id} <> ${excludeId}` : undefined,
      ),
    )
    .limit(1);
  return rows[0];
}

const sortColumns: Record<SortField, AnyPgColumn> = {
  createdAt: returnRequests.createdAt,
  updatedAt: returnRequests.updatedAt,
  reference: returnRequests.reference,
  customerName: returnRequests.customerName,
  status: returnRequests.status,
  quantity: returnRequests.quantity,
};

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
function likePattern(term: string) {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function listWhere(query: ListQuery): SQL | undefined {
  const conditions: Array<SQL | undefined> = [notRemoved];
  if (query.q) {
    const pattern = likePattern(query.q);
    conditions.push(
      or(
        ilike(returnRequests.reference, pattern),
        ilike(returnRequests.customerName, pattern),
        ilike(returnRequests.customerEmail, pattern),
        ilike(returnRequests.orderId, pattern),
      ),
    );
  }
  if (query.status.length) conditions.push(inArray(returnRequests.status, query.status));
  if (query.reason.length) conditions.push(inArray(returnRequests.reason, query.reason));
  return and(...conditions);
}

export async function listRequests(executor: Executor, query: ListQuery) {
  const where = listWhere(query);
  const direction = query.order === "asc" ? asc : desc;
  const [rows, [{ total }]] = await Promise.all([
    executor
      .select()
      .from(returnRequests)
      .where(where)
      // The id tiebreaker makes paging stable when many rows share a sort value.
      .orderBy(direction(sortColumns[query.sort]), direction(returnRequests.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    executor.select({ total: count() }).from(returnRequests).where(where),
  ]);
  return { rows, total };
}

export async function listNotes(executor: Executor, requestId: string) {
  return executor
    .select()
    .from(notes)
    .where(eq(notes.requestId, requestId))
    .orderBy(asc(notes.createdAt), asc(notes.id));
}

export async function listEvents(executor: Executor, requestId: string) {
  return executor
    .select()
    .from(requestEvents)
    .where(eq(requestEvents.requestId, requestId))
    .orderBy(asc(requestEvents.createdAt), asc(requestEvents.id));
}

export async function insertEvent(executor: Executor, event: typeof requestEvents.$inferInsert) {
  await executor.insert(requestEvents).values(event);
}

export async function statusCounts(executor: Executor) {
  return executor
    .select({ status: returnRequests.status, count: count() })
    .from(returnRequests)
    .where(notRemoved)
    .groupBy(returnRequests.status);
}

export async function reasonCounts(executor: Executor) {
  return executor
    .select({ reason: returnRequests.reason, count: count() })
    .from(returnRequests)
    .where(notRemoved)
    .groupBy(returnRequests.reason);
}

export async function refundTotals(executor: Executor) {
  const [row] = await executor
    .select({
      total: sql<string>`coalesce(sum(${returnRequests.refundAmount}), 0)::numeric(12,2)::text`,
    })
    .from(returnRequests)
    .where(and(notRemoved, inArray(returnRequests.status, ["APPROVED", "COMPLETED"])));
  return row.total;
}

export async function recentRequests(executor: Executor, limit: number) {
  return executor
    .select()
    .from(returnRequests)
    .where(notRemoved)
    .orderBy(desc(returnRequests.createdAt), desc(returnRequests.id))
    .limit(limit);
}
