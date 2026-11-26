/**
 * Application errors carry an HTTP status and a stable, machine-readable code.
 *
 * Status code policy:
 *   400 VALIDATION_ERROR / INVALID_JSON  – the payload or query is malformed
 *   404 REQUEST_NOT_FOUND                – unknown or removed request
 *   409 conflicts with the request's current state or with another request
 *       (INVALID_STATUS_TRANSITION, REQUEST_LOCKED, REQUEST_NOT_REMOVABLE,
 *        DUPLICATE_LIVE_REQUEST, CONCURRENT_MODIFICATION)
 *   422 RESOLUTION_REQUIRED / INVALID_REFUND_AMOUNT – well-formed but
 *       semantically invalid decision data
 *   405 METHOD_NOT_ALLOWED               – the route exists but not for this HTTP method
 *   500 INTERNAL_ERROR                   – unexpected; details are logged, never returned
 */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_JSON"
  | "REQUEST_NOT_FOUND"
  | "INVALID_STATUS_TRANSITION"
  | "REQUEST_LOCKED"
  | "REQUEST_NOT_REMOVABLE"
  | "DUPLICATE_LIVE_REQUEST"
  | "CONCURRENT_MODIFICATION"
  | "RESOLUTION_REQUIRED"
  | "INVALID_REFUND_AMOUNT"
  | "ROUTE_NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL_ERROR";

export type ErrorDetails = Record<string, unknown> | Array<Record<string, unknown>>;

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorDetails,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errors = {
  validation: (message: string, details?: ErrorDetails) =>
    new AppError(400, "VALIDATION_ERROR", message, details),
  invalidJson: () => new AppError(400, "INVALID_JSON", "The request body must be valid JSON."),
  notFound: () => new AppError(404, "REQUEST_NOT_FOUND", "Return request not found."),
  invalidTransition: (from: string, to: string, allowed: readonly string[]) =>
    new AppError(
      409,
      "INVALID_STATUS_TRANSITION",
      allowed.length
        ? `A request cannot move from ${from} to ${to}. Allowed next statuses: ${allowed.join(", ")}.`
        : `A request cannot move from ${from} to ${to}. ${from} is a final status.`,
      { from, to, allowed: [...allowed] },
    ),
  locked: (status: string) =>
    new AppError(
      409,
      "REQUEST_LOCKED",
      `This request is ${status}. Customer and item details can no longer be edited, but notes can still be added.`,
      { status },
    ),
  notRemovable: (status: string) =>
    new AppError(
      409,
      "REQUEST_NOT_REMOVABLE",
      `Only Open or Rejected requests can be removed. This request is ${status}.`,
      { status },
    ),
  duplicateLive: (existingReference?: string) =>
    new AppError(
      409,
      "DUPLICATE_LIVE_REQUEST",
      existingReference
        ? `There is already a live request (${existingReference}) for this item on this order. It must be Rejected or Completed before a new one can be raised.`
        : "There is already a live request for this item on this order.",
      existingReference ? { existingReference } : undefined,
    ),
  concurrentModification: () =>
    new AppError(
      409,
      "CONCURRENT_MODIFICATION",
      "This request was changed by someone else. Refresh and try again.",
    ),
  resolutionRequired: () =>
    new AppError(
      422,
      "RESOLUTION_REQUIRED",
      "A request can only be approved with a resolution: Refund, Replacement or Store Credit.",
    ),
  invalidRefundAmount: (message: string) => new AppError(422, "INVALID_REFUND_AMOUNT", message),
};
