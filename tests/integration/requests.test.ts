import { beforeEach, describe, expect, it } from "vitest";
import { api, createInStatus, newRequest, pool, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

describe("POST /api/requests", () => {
  it("creates a request with a system-generated reference and persists it", async () => {
    const res = await api.create(newRequest());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reference).toMatch(/^RD-\d{6}$/);
    expect(res.body.data.status).toBe("OPEN");
    expect(res.body.data.actions).toMatchObject({ transitions: ["IN_REVIEW"], canRemove: true });

    const { rows } = await pool.query(
      "SELECT reference, status FROM return_requests WHERE id = $1",
      [res.body.data.id],
    );
    expect(rows[0]).toEqual({ reference: res.body.data.reference, status: "OPEN" });
  });

  it("refuses a client-supplied reference or status", async () => {
    for (const extra of [{ reference: "RD-999999" }, { status: "APPROVED" }]) {
      const res = await api.create(newRequest(extra));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it.each([
    ["missing fields", {}],
    ["bad quantity", newRequest({ quantity: 0 })],
    ["bad reason", newRequest({ reason: "BORED" })],
    ["bad email", newRequest({ customerEmail: "nope" })],
  ])("returns 400 for %s with field details", async (_label, body) => {
    const res = await api.create(body);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await api.create("{not json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("generates unique references under concurrent creation", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => api.create(newRequest())));
    const refs = results.map((r) => r.body.data.reference);
    expect(new Set(refs).size).toBe(10);
  });
});

describe("rule 1: status lifecycle", () => {
  it("walks the full happy path", async () => {
    const id = await createInStatus("COMPLETED");
    const res = await api.get(id);
    expect(res.body.data.status).toBe("COMPLETED");
    expect(res.body.data.history.map((e: { toStatus: string }) => e.toStatus)).toEqual([
      "OPEN",
      "IN_REVIEW",
      "APPROVED",
      "COMPLETED",
    ]);
  });

  it.each([
    ["OPEN", "COMPLETED"],
    ["OPEN", "APPROVED"],
    ["OPEN", "REJECTED"],
    ["IN_REVIEW", "COMPLETED"],
    ["IN_REVIEW", "OPEN"],
    ["APPROVED", "REJECTED"],
    ["APPROVED", "IN_REVIEW"],
    ["REJECTED", "IN_REVIEW"],
    ["REJECTED", "COMPLETED"],
    ["COMPLETED", "OPEN"],
    ["COMPLETED", "APPROVED"],
  ] as const)("refuses %s -> %s with 409", async (from, to) => {
    const id = await createInStatus(from);
    const res = await api.transition(id, {
      to,
      ...(to === "APPROVED" ? { resolution: "REPLACEMENT" } : {}),
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    expect((await api.get(id)).body.data.status).toBe(from);
  });

  it("serialises concurrent transitions so only one wins", async () => {
    const id = await createInStatus("IN_REVIEW");
    const [a, b] = await Promise.all([
      api.transition(id, { to: "APPROVED", resolution: "REPLACEMENT" }),
      api.transition(id, { to: "REJECTED" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });
});

describe("rule 2: approval needs a resolution", () => {
  it("refuses approval without a resolution (422)", async () => {
    const id = await createInStatus("IN_REVIEW");
    const res = await api.transition(id, { to: "APPROVED" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("RESOLUTION_REQUIRED");
  });

  it.each([undefined, 0, "-5"])("refuses a refund with amount %s (422)", async (refundAmount) => {
    const id = await createInStatus("IN_REVIEW");
    const res = await api.transition(id, { to: "APPROVED", resolution: "REFUND", refundAmount });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_REFUND_AMOUNT");
  });

  it.each(["REPLACEMENT", "STORE_CREDIT"])(
    "refuses a refund amount with %s (422)",
    async (resolution) => {
      const id = await createInStatus("IN_REVIEW");
      const res = await api.transition(id, { to: "APPROVED", resolution, refundAmount: 10 });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("INVALID_REFUND_AMOUNT");
    },
  );

  it("approves a refund with a positive amount stored as an exact decimal", async () => {
    const id = await createInStatus("IN_REVIEW");
    const res = await api.transition(id, {
      to: "APPROVED",
      resolution: "REFUND",
      refundAmount: "49.9",
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: "APPROVED",
      resolution: "REFUND",
      refundAmount: "49.90",
    });
  });

  it("refuses a resolution on a non-approval transition", async () => {
    const id = await createInStatus("IN_REVIEW");
    const res = await api.transition(id, { to: "REJECTED", resolution: "REFUND", refundAmount: 5 });
    expect(res.status).toBe(400);
  });
});

describe("rule 3: one live request per order item", () => {
  it("refuses a duplicate live request, case-insensitively, naming the existing one", async () => {
    const first = await api.create(newRequest({ orderId: "ORD-77", itemSku: "MUG-1" }));
    const dup = await api.create(newRequest({ orderId: "ord-77", itemSku: "mug-1" }));
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("DUPLICATE_LIVE_REQUEST");
    expect(dup.body.error.details.existingReference).toBe(first.body.data.reference);
  });

  it.each(["IN_REVIEW", "APPROVED"] as const)(
    "still blocks while the first is %s",
    async (status) => {
      await createInStatus(status, { orderId: "ORD-88", itemSku: "SKU-X" });
      expect((await api.create(newRequest({ orderId: "ORD-88", itemSku: "SKU-X" }))).status).toBe(
        409,
      );
    },
  );

  it.each(["REJECTED", "COMPLETED"] as const)(
    "allows a new request once the first is %s",
    async (status) => {
      await createInStatus(status, { orderId: "ORD-99", itemSku: "SKU-Y" });
      expect((await api.create(newRequest({ orderId: "ORD-99", itemSku: "SKU-Y" }))).status).toBe(
        201,
      );
    },
  );

  it("allows a new request after the first was removed", async () => {
    const id = await createInStatus("OPEN", { orderId: "ORD-55", itemSku: "SKU-Z" });
    await api.remove(id);
    expect((await api.create(newRequest({ orderId: "ORD-55", itemSku: "SKU-Z" }))).status).toBe(
      201,
    );
  });

  it("lets exactly one of many concurrent duplicates through (partial unique index)", async () => {
    const body = newRequest({ orderId: "ORD-RACE", itemSku: "SKU-RACE" });
    const results = await Promise.all(Array.from({ length: 8 }, () => api.create(body)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(7);
    for (const r of results.filter((x) => x.status === 409)) {
      expect(r.body.error.code).toBe("DUPLICATE_LIVE_REQUEST");
    }
  });

  it("refuses an edit that would create a duplicate", async () => {
    await api.create(newRequest({ orderId: "ORD-1", itemSku: "A" }));
    const other = await api.create(newRequest({ orderId: "ORD-1", itemSku: "B" }));
    const res = await api.update(other.body.data.id, { itemSku: "A" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_LIVE_REQUEST");
  });
});

describe("rule 4: locked once decided", () => {
  it("allows editing undecided requests and records the change in history", async () => {
    const id = await createInStatus("IN_REVIEW");
    const res = await api.update(id, { customerName: "Priya N.", quantity: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ customerName: "Priya N.", quantity: 3 });
    const history = (await api.get(id)).body.data.history;
    expect(history.at(-1)).toMatchObject({
      type: "DETAILS_UPDATED",
      changes: {
        customerName: { from: "Priya Nair", to: "Priya N." },
        quantity: { from: 1, to: 3 },
      },
    });
  });

  it.each(["APPROVED", "REJECTED", "COMPLETED"] as const)(
    "refuses customer and item edits once %s",
    async (status) => {
      const id = await createInStatus(status);
      for (const patch of [
        { customerEmail: "new@example.com" },
        { itemName: "Other" },
        { quantity: 2 },
      ]) {
        const res = await api.update(id, patch);
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("REQUEST_LOCKED");
      }
      expect((await api.get(id)).body.data.actions.canEditDetails).toBe(false);
    },
  );
});

describe("rule 5: removal is a soft delete", () => {
  it.each(["OPEN", "REJECTED"] as const)(
    "removes a %s request but keeps the row, notes and history",
    async (status) => {
      const id = await createInStatus(status);
      await pool.query(
        "INSERT INTO notes (request_id, author, body) VALUES ($1, 'Sam', 'Keep me')",
        [id],
      );

      const res = await api.remove(id);
      expect(res.status).toBe(200);
      expect(res.body.data.removedAt).toBeTruthy();

      expect((await api.get(id)).status).toBe(404);
      expect((await api.list()).body.data.map((r: { id: string }) => r.id)).not.toContain(id);

      const { rows } = await pool.query("SELECT deleted_at FROM return_requests WHERE id = $1", [
        id,
      ]);
      expect(rows[0].deleted_at).not.toBeNull();
      const notes = await pool.query("SELECT count(*)::int AS n FROM notes WHERE request_id = $1", [
        id,
      ]);
      expect(notes.rows[0].n).toBe(1);
      const events = await pool.query("SELECT type FROM request_events WHERE request_id = $1", [
        id,
      ]);
      expect(events.rows.map((e) => e.type)).toContain("REMOVED");
    },
  );

  it.each(["IN_REVIEW", "APPROVED", "COMPLETED"] as const)(
    "refuses to remove a %s request",
    async (status) => {
      const id = await createInStatus(status);
      const res = await api.remove(id);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("REQUEST_NOT_REMOVABLE");
      expect((await api.get(id)).status).toBe(200);
    },
  );

  it("treats a removed request as gone for every operation", async () => {
    const id = await createInStatus("OPEN");
    await api.remove(id);
    expect((await api.update(id, { itemName: "x" })).status).toBe(404);
    expect((await api.transition(id, { to: "IN_REVIEW" })).status).toBe(404);
    expect((await api.remove(id)).status).toBe(404);
  });

  it("refuses physical deletion at the database level", async () => {
    const id = await createInStatus("OPEN");
    await expect(pool.query("DELETE FROM return_requests WHERE id = $1", [id])).rejects.toThrow(
      /never physically deleted/,
    );
  });
});

describe("GET /api/requests/:id", () => {
  it("returns 404 for unknown and malformed ids", async () => {
    for (const id of ["00000000-0000-4000-8000-000000000000", "not-a-uuid"]) {
      const res = await api.get(id);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("REQUEST_NOT_FOUND");
    }
  });
});
