import type { NoteRow, RequestEventRow, ReturnRequestRow } from "@/db/schema";
import { availableActions } from "@/lib/domain/lifecycle";

/** The public shape of a return request. Internal columns (deletedAt) are never exposed. */
export function toRequestDto(row: ReturnRequestRow) {
  return {
    id: row.id,
    reference: row.reference,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    orderId: row.orderId,
    itemSku: row.itemSku,
    itemName: row.itemName,
    quantity: row.quantity,
    reason: row.reason,
    status: row.status,
    resolution: row.resolution,
    /** Decimal string ("49.99") so money never passes through a float. */
    refundAmount: row.refundAmount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    actions: availableActions(row.status),
  };
}
export type RequestDto = ReturnType<typeof toRequestDto>;

export function toNoteDto(row: NoteRow) {
  return {
    id: row.id,
    requestId: row.requestId,
    author: row.author,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}
export type NoteDto = ReturnType<typeof toNoteDto>;

export function toEventDto(row: RequestEventRow) {
  return {
    id: row.id,
    type: row.type,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    changes: row.changes,
    createdAt: row.createdAt.toISOString(),
  };
}
export type EventDto = ReturnType<typeof toEventDto>;
