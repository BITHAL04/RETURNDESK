import { expect } from "vitest";
import { Pool } from "pg";
import * as collection from "@/app/api/requests/route";
import * as item from "@/app/api/requests/[id]/route";
import * as transitions from "@/app/api/requests/[id]/transitions/route";
import * as notesRoute from "@/app/api/requests/[id]/notes/route";
import * as statsRoute from "@/app/api/stats/route";

export const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });

/** Empties all tables between tests. TRUNCATE bypasses the row-level delete guards by design. */
export async function resetDatabase() {
  await pool.query(
    "TRUNCATE notes, request_events, return_requests; ALTER SEQUENCE return_request_reference_seq RESTART",
  );
}

type Json = Record<string, unknown>;
export type ApiResult = {
  status: number;
  body: Json & { success: boolean; data?: any; error?: any; meta?: any };
};

async function toResult(response: Response): Promise<ApiResult> {
  expect(response.headers.get("content-type")).toContain("application/json");
  return { status: response.status, body: await response.json() };
}

function jsonRequest(method: string, url: string, body?: unknown) {
  return new Request(`http://test.local${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

export const api = {
  list: (qs = "") =>
    collection.GET(jsonRequest("GET", `/api/requests${qs}`), undefined).then(toResult),
  create: (body: unknown) =>
    collection.POST(jsonRequest("POST", "/api/requests", body), undefined).then(toResult),
  get: (id: string) => item.GET(jsonRequest("GET", `/api/requests/${id}`), ctx(id)).then(toResult),
  update: (id: string, body: unknown) =>
    item.PATCH(jsonRequest("PATCH", `/api/requests/${id}`, body), ctx(id)).then(toResult),
  remove: (id: string) =>
    item.DELETE(jsonRequest("DELETE", `/api/requests/${id}`), ctx(id)).then(toResult),
  transition: (id: string, body: unknown) =>
    transitions
      .POST(jsonRequest("POST", `/api/requests/${id}/transitions`, body), ctx(id))
      .then(toResult),
  addNote: (id: string, body: unknown) =>
    notesRoute.POST(jsonRequest("POST", `/api/requests/${id}/notes`, body), ctx(id)).then(toResult),
  notes: (id: string) =>
    notesRoute.GET(jsonRequest("GET", `/api/requests/${id}/notes`), ctx(id)).then(toResult),
  stats: () => statsRoute.GET(jsonRequest("GET", "/api/stats"), undefined).then(toResult),
};

let counter = 0;
export function newRequest(overrides: Json = {}) {
  counter++;
  return {
    customerName: "Priya Nair",
    customerEmail: "priya@example.com",
    customerPhone: "+91 98450 11872",
    orderId: `ORD-${1000 + counter}`,
    itemSku: `SKU-${counter}`,
    itemName: "Stoneware Mug",
    quantity: 1,
    reason: "DAMAGED",
    ...overrides,
  };
}

/** Creates a request and walks it to the given status through the real API. */
export async function createInStatus(
  status: "OPEN" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "COMPLETED",
  overrides: Json = {},
) {
  const created = await api.create(newRequest(overrides));
  expect(created.status).toBe(201);
  const id: string = created.body.data.id;
  const steps: Record<string, Json[]> = {
    OPEN: [],
    IN_REVIEW: [{ to: "IN_REVIEW" }],
    APPROVED: [{ to: "IN_REVIEW" }, { to: "APPROVED", resolution: "REPLACEMENT" }],
    REJECTED: [{ to: "IN_REVIEW" }, { to: "REJECTED" }],
    COMPLETED: [
      { to: "IN_REVIEW" },
      { to: "APPROVED", resolution: "STORE_CREDIT" },
      { to: "COMPLETED" },
    ],
  };
  for (const step of steps[status]) {
    const res = await api.transition(id, step);
    expect(res.status).toBe(200);
  }
  return id;
}
