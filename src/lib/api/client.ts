/**
 * Browser-side API client. Every UI action goes through the real HTTP API, and
 * server refusals surface as ApiClientError carrying the server's code and message.
 */
import type { ErrorCode } from "../errors";

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | "NETWORK_ERROR",
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }

  /** Field-level messages from a 400 VALIDATION_ERROR, keyed by field name. */
  fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const d of this.details as Array<{ field?: string | null; message?: string }>) {
      if (d.field && d.message && !out[d.field]) out[d.field] = d.message;
    }
    return out;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<{ data: T; meta?: unknown }> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError(
      0,
      "NETWORK_ERROR",
      "Could not reach the server. Check your connection and try again.",
    );
  }

  let body: {
    success?: boolean;
    data?: T;
    meta?: unknown;
    error?: { code: ErrorCode; message: string; details?: unknown };
  };
  try {
    body = await response.json();
  } catch {
    throw new ApiClientError(
      response.status,
      "INTERNAL_ERROR",
      `Unexpected response from the server (${response.status}).`,
    );
  }

  if (!response.ok || !body.success) {
    throw new ApiClientError(
      response.status,
      body.error?.code ?? "INTERNAL_ERROR",
      body.error?.message ?? "The request failed.",
      body.error?.details,
    );
  }
  return { data: body.data as T, meta: body.meta };
}
