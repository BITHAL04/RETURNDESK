/**
 * Every API response uses one envelope:
 *   success: { "success": true,  "data": ..., "meta"?: ... }
 *   failure: { "success": false, "error": { "code", "message", "details"? } }
 */
import { ZodError } from "zod";
import { AppError, errors, type ErrorCode, type ErrorDetails } from "../errors";

export type ApiFailure = {
  success: false;
  error: { code: ErrorCode; message: string; details?: ErrorDetails };
};

export function ok<T>(data: T, init?: { status?: number; meta?: unknown }) {
  const body: Record<string, unknown> = { success: true, data };
  if (init?.meta !== undefined) body.meta = init.meta;
  return Response.json(body, { status: init?.status ?? 200 });
}

export function fail(error: AppError) {
  const body: ApiFailure = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };
  return Response.json(body, { status: error.status });
}

export function zodToAppError(error: ZodError): AppError {
  const details = error.issues.map((issue) => ({
    field: issue.path.join(".") || null,
    message: issue.message,
  }));
  const first = details[0];
  const message = first?.field
    ? `${first.field}: ${first.message}`
    : (first?.message ?? "Invalid input.");
  return errors.validation(message, details);
}

/** Walks a driver error's cause chain looking for a Postgres SQLSTATE. */
function findPgError(error: unknown): { code: string; constraint?: string } | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const candidate = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (typeof candidate.code === "string" && /^[0-9A-Z]{5}$/.test(candidate.code)) {
      return {
        code: candidate.code,
        constraint: typeof candidate.constraint === "string" ? candidate.constraint : undefined,
      };
    }
    current = candidate.cause;
  }
  return undefined;
}

/**
 * Maps database refusals to API errors. The service layer normally rejects these
 * cases first with richer messages; this mapping covers races (two agents acting
 * at once) where the database constraint or trigger is the one that fires.
 */
export function databaseToAppError(error: unknown): AppError | undefined {
  const pg = findPgError(error);
  if (!pg) return undefined;
  switch (pg.code) {
    case "23505":
      if (pg.constraint === "return_requests_one_live_per_order_item")
        return errors.duplicateLive();
      return undefined;
    case "RD001":
      return new AppError(409, "INVALID_STATUS_TRANSITION", "That status change is not allowed.");
    case "RD002":
    case "RD006":
      return new AppError(409, "REQUEST_LOCKED", "This request has been decided and is locked.");
    case "RD003":
      return errors.notFound();
    case "23514":
      if (pg.constraint === "return_requests_removable_status")
        return new AppError(
          409,
          "REQUEST_NOT_REMOVABLE",
          "Only Open or Rejected requests can be removed.",
        );
      if (pg.constraint?.startsWith("return_requests_re"))
        return new AppError(
          422,
          "RESOLUTION_REQUIRED",
          "The resolution and refund amount are not valid for this status.",
        );
      return undefined;
    default:
      return undefined;
  }
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) return fail(error);
  if (error instanceof ZodError) return fail(zodToAppError(error));
  const mapped = databaseToAppError(error);
  if (mapped) return fail(mapped);
  console.error("[api] unexpected error", error);
  return fail(
    new AppError(500, "INTERNAL_ERROR", "Something went wrong on our side. Please try again."),
  );
}

/** Parses a JSON body, turning malformed JSON into a 400 rather than a 500. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw errors.invalidJson();
  }
}

/** Wraps a route handler so every thrown error becomes a consistent JSON error response. */
export function handler<C>(fn: (request: Request, context: C) => Promise<Response>) {
  return async (request: Request, context: C): Promise<Response> => {
    try {
      return await fn(request, context);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
