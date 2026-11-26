/**
 * ReturnDesk business logic. Every rule is enforced here, on the server, inside
 * a transaction that row-locks the request (SELECT ... FOR UPDATE), so two
 * agents acting on the same request at once are serialised rather than racing.
 * PostgreSQL constraints and triggers back each rule up (see src/db/schema.ts).
 */
import { db } from "@/db/client";
import { notes, returnRequests, type ReturnRequestRow } from "@/db/schema";
import { canTransition, allowedTransitions, isDecided, isRemovable } from "@/lib/domain/lifecycle";
import {
  REQUEST_STATUSES,
  RETURN_REASONS,
  type RequestStatus,
  type ReturnReason,
} from "@/lib/domain/constants";
import { errors } from "@/lib/errors";
import { databaseToAppError } from "@/lib/api/response";
import type {
  CreateNoteInput,
  CreateRequestInput,
  ListQuery,
  TransitionInput,
  UpdateRequestInput,
} from "@/lib/validation/requests";
import { eq } from "drizzle-orm";
import * as repo from "./repository";
import { toEventDto, toNoteDto, toRequestDto } from "./serialize";

/** Unique-index violations surface from the driver; turn them into the friendly 409. */
async function withDuplicateMapping<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const mapped = databaseToAppError(error);
    if (mapped?.code === "DUPLICATE_LIVE_REQUEST") throw mapped;
    throw error;
  }
}

async function lockVisible(tx: repo.Executor, id: string): Promise<ReturnRequestRow> {
  const row = await repo.findVisibleById(tx, id, true);
  if (!row) throw errors.notFound();
  return row;
}

export async function createRequest(input: CreateRequestInput) {
  return withDuplicateMapping(() =>
    db.transaction(async (tx) => {
      // Rule 3. Checked first for a helpful message naming the existing request;
      // the partial unique index still decides if two creates race.
      const duplicate = await repo.findLiveDuplicate(tx, input.orderId, input.itemSku);
      if (duplicate) throw errors.duplicateLive(duplicate.reference);

      const [row] = await tx.insert(returnRequests).values(input).returning();
      await repo.insertEvent(tx, { requestId: row.id, type: "CREATED", toStatus: row.status });
      return toRequestDto(row);
    }),
  );
}

export async function listRequests(query: ListQuery) {
  const { rows, total } = await repo.listRequests(db, query);
  return {
    items: rows.map(toRequestDto),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function getRequestDetail(id: string) {
  const row = await repo.findVisibleById(db, id);
  if (!row) throw errors.notFound();
  const [noteRows, eventRows] = await Promise.all([
    repo.listNotes(db, id),
    repo.listEvents(db, id),
  ]);
  return {
    ...toRequestDto(row),
    notes: noteRows.map(toNoteDto),
    history: eventRows.map(toEventDto),
  };
}

const EDITABLE_FIELDS = [
  "customerName",
  "customerEmail",
  "customerPhone",
  "orderId",
  "itemSku",
  "itemName",
  "quantity",
  "reason",
] as const;

export async function updateRequest(id: string, input: UpdateRequestInput) {
  return withDuplicateMapping(() =>
    db.transaction(async (tx) => {
      const current = await lockVisible(tx, id);
      // Rule 4: decided requests are locked (notes are a separate resource and stay open).
      if (isDecided(current.status)) throw errors.locked(current.status);

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      const patch: Partial<Pick<ReturnRequestRow, (typeof EDITABLE_FIELDS)[number]>> = {};
      for (const field of EDITABLE_FIELDS) {
        const next = input[field];
        if (next !== undefined && next !== current[field]) {
          changes[field] = { from: current[field], to: next };
          Object.assign(patch, { [field]: next });
        }
      }
      if (Object.keys(changes).length === 0) return toRequestDto(current);

      if (patch.orderId !== undefined || patch.itemSku !== undefined) {
        const duplicate = await repo.findLiveDuplicate(
          tx,
          patch.orderId ?? current.orderId,
          patch.itemSku ?? current.itemSku,
          current.id,
        );
        if (duplicate) throw errors.duplicateLive(duplicate.reference);
      }

      const [row] = await tx
        .update(returnRequests)
        .set(patch)
        .where(eq(returnRequests.id, id))
        .returning();
      await repo.insertEvent(tx, { requestId: id, type: "DETAILS_UPDATED", changes });
      return toRequestDto(row);
    }),
  );
}

/** Rule 2: validates the decision data that accompanies a transition. */
function decisionFor(to: RequestStatus, input: TransitionInput) {
  const resolution = input.resolution ?? null;
  const refundAmount = input.refundAmount ?? null;

  if (to !== "APPROVED") {
    if (resolution !== null || refundAmount !== null) {
      throw errors.validation(
        "A resolution and refund amount can only be provided when approving a request.",
      );
    }
    return null;
  }
  if (!resolution) throw errors.resolutionRequired();
  if (resolution === "REFUND") {
    if (refundAmount === null)
      throw errors.invalidRefundAmount(
        "A refund amount is required when the resolution is Refund.",
      );
    if (Number(refundAmount) <= 0)
      throw errors.invalidRefundAmount("The refund amount must be greater than zero.");
  } else if (refundAmount !== null) {
    throw errors.invalidRefundAmount(
      "A refund amount can only be recorded when the resolution is Refund.",
    );
  }
  return { resolution, refundAmount };
}

export async function transitionRequest(id: string, input: TransitionInput) {
  return db.transaction(async (tx) => {
    const current = await lockVisible(tx, id);
    // Rule 1: only legal lifecycle moves.
    if (!canTransition(current.status, input.to)) {
      throw errors.invalidTransition(current.status, input.to, allowedTransitions(current.status));
    }
    const decision = decisionFor(input.to, input);

    const [row] = await tx
      .update(returnRequests)
      .set({ status: input.to, ...(decision ?? {}) })
      .where(eq(returnRequests.id, id))
      .returning();
    await repo.insertEvent(tx, {
      requestId: id,
      type: "STATUS_CHANGED",
      fromStatus: current.status,
      toStatus: input.to,
      changes: decision
        ? {
            resolution: { from: null, to: decision.resolution },
            ...(decision.refundAmount
              ? { refundAmount: { from: null, to: decision.refundAmount } }
              : {}),
          }
        : null,
    });
    return toRequestDto(row);
  });
}

export async function removeRequest(id: string) {
  return db.transaction(async (tx) => {
    const current = await lockVisible(tx, id);
    // Rule 5: soft delete only, and only from OPEN or REJECTED.
    if (!isRemovable(current.status)) throw errors.notRemovable(current.status);

    const [row] = await tx
      .update(returnRequests)
      .set({ deletedAt: new Date() })
      .where(eq(returnRequests.id, id))
      .returning({
        id: returnRequests.id,
        reference: returnRequests.reference,
        deletedAt: returnRequests.deletedAt,
      });
    await repo.insertEvent(tx, {
      requestId: id,
      type: "REMOVED",
      fromStatus: current.status,
      toStatus: current.status,
    });
    return { id: row.id, reference: row.reference, removedAt: row.deletedAt!.toISOString() };
  });
}

export async function addNote(requestId: string, input: CreateNoteInput) {
  return db.transaction(async (tx) => {
    // Notes are allowed in every status, including decided ones. Locking the
    // parent row keeps a note from landing on a request being removed concurrently.
    await lockVisible(tx, requestId);
    const [row] = await tx
      .insert(notes)
      .values({ requestId, ...input })
      .returning();
    return toNoteDto(row);
  });
}

export async function listNotes(requestId: string) {
  const request = await repo.findVisibleById(db, requestId);
  if (!request) throw errors.notFound();
  return (await repo.listNotes(db, requestId)).map(toNoteDto);
}

export async function getStats() {
  const [byStatus, byReason, refundTotal, recent] = await Promise.all([
    repo.statusCounts(db),
    repo.reasonCounts(db),
    repo.refundTotals(db),
    repo.recentRequests(db, 6),
  ]);
  const statusCounts = Object.fromEntries(REQUEST_STATUSES.map((s) => [s, 0])) as Record<
    RequestStatus,
    number
  >;
  for (const { status, count } of byStatus) statusCounts[status] = count;
  const reasonCounts = Object.fromEntries(RETURN_REASONS.map((r) => [r, 0])) as Record<
    ReturnReason,
    number
  >;
  for (const { reason, count } of byReason) reasonCounts[reason] = count;
  return {
    total: byStatus.reduce((sum, r) => sum + r.count, 0),
    byStatus: statusCounts,
    byReason: reasonCounts,
    refundTotal,
    recent: recent.map(toRequestDto),
  };
}
