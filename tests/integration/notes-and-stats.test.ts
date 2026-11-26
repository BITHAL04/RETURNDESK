import { beforeEach, describe, expect, it } from "vitest";
import { api, createInStatus, pool, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

describe("notes", () => {
  it.each(["OPEN", "IN_REVIEW", "APPROVED", "REJECTED", "COMPLETED"] as const)(
    "can be added while %s, including after a decision",
    async (status) => {
      const id = await createInStatus(status);
      const res = await api.addNote(id, { author: "Maya", body: `Checked while ${status}` });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ author: "Maya", body: `Checked while ${status}` });
    },
  );

  it("are listed in the order they were written, on the request and on the notes endpoint", async () => {
    const id = await createInStatus("OPEN");
    for (const body of ["first", "second", "third"])
      await api.addNote(id, { author: "Maya", body });
    const listed = (await api.notes(id)).body.data.map((n: { body: string }) => n.body);
    expect(listed).toEqual(["first", "second", "third"]);
    expect((await api.get(id)).body.data.notes.map((n: { body: string }) => n.body)).toEqual(
      listed,
    );
  });

  it("reject blank content", async () => {
    const id = await createInStatus("OPEN");
    const res = await api.addNote(id, { author: "Maya", body: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("cannot be added to removed or unknown requests", async () => {
    const id = await createInStatus("OPEN");
    await api.remove(id);
    expect((await api.addNote(id, { author: "Maya", body: "hi" })).status).toBe(404);
  });

  it("are immutable at the database level", async () => {
    const id = await createInStatus("OPEN");
    const note = await api.addNote(id, { author: "Maya", body: "original" });
    await expect(
      pool.query("UPDATE notes SET body = 'edited' WHERE id = $1", [note.body.data.id]),
    ).rejects.toThrow(/append-only/);
    await expect(
      pool.query("DELETE FROM notes WHERE id = $1", [note.body.data.id]),
    ).rejects.toThrow(/append-only/);
    expect((await api.notes(id)).body.data[0].body).toBe("original");
  });
});

describe("GET /api/stats", () => {
  it("counts visible requests by status and reason and totals refunds", async () => {
    await createInStatus("OPEN", { reason: "SIZE_ISSUE" });
    const removed = await createInStatus("OPEN");
    await api.remove(removed);
    const refunded = await createInStatus("IN_REVIEW");
    await api.transition(refunded, { to: "APPROVED", resolution: "REFUND", refundAmount: "10.25" });

    const res = await api.stats();
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      total: 2,
      byStatus: { OPEN: 1, APPROVED: 1, IN_REVIEW: 0 },
      byReason: { SIZE_ISSUE: 1, DAMAGED: 1, WRONG_ITEM: 0 },
      refundTotal: "10.25",
    });
    expect(res.body.data.recent).toHaveLength(2);
  });
});
