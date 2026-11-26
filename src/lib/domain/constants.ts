/**
 * Single source of truth for ReturnDesk's enumerations and their display labels.
 * Shared by the database schema, server validation and the UI.
 */

export const REQUEST_STATUSES = ["OPEN", "IN_REVIEW", "APPROVED", "REJECTED", "COMPLETED"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const RETURN_REASONS = [
  "DAMAGED",
  "WRONG_ITEM",
  "SIZE_ISSUE",
  "NOT_AS_DESCRIBED",
  "CHANGED_MIND",
] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export const RESOLUTIONS = ["REFUND", "REPLACEMENT", "STORE_CREDIT"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export const REQUEST_EVENT_TYPES = [
  "CREATED",
  "DETAILS_UPDATED",
  "STATUS_CHANGED",
  "REMOVED",
] as const;

export const STATUS_LABELS: Record<RequestStatus, string> = {
  OPEN: "Open",
  IN_REVIEW: "In Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
};

export const REASON_LABELS: Record<ReturnReason, string> = {
  DAMAGED: "Damaged",
  WRONG_ITEM: "Wrong Item",
  SIZE_ISSUE: "Size Issue",
  NOT_AS_DESCRIBED: "Not As Described",
  CHANGED_MIND: "Changed Mind",
};

export const RESOLUTION_LABELS: Record<Resolution, string> = {
  REFUND: "Refund",
  REPLACEMENT: "Replacement",
  STORE_CREDIT: "Store Credit",
};
