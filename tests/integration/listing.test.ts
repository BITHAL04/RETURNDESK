import { beforeAll, describe, expect, it } from "vitest";
import { api, createInStatus, resetDatabase, type ApiResult } from "./helpers";

type Row = {
  reference: string;
  customerName: string;
  status: string;
  reason: string;
  quantity: number;
};
const rows = (res: ApiResult): Row[] => res.body.data;

beforeAll(async () => {
  await resetDatabase();
  const people = ["Aarav Sharma", "Priya Nair", "Liam O'Connor", "Sofia Martinez", "Kenji 50%"];
  const reasons = ["DAMAGED", "WRONG_ITEM", "SIZE_ISSUE", "NOT_AS_DESCRIBED", "CHANGED_MIND"];
  const statuses = ["OPEN", "IN_REVIEW", "APPROVED", "REJECTED", "COMPLETED"] as const;
  for (let i = 0; i < 25; i++) {
    await createInStatus(statuses[i % 5], {
      customerName: people[i % 5],
      customerEmail: `person${i}@example.com`,
      orderId: `ORD-${5000 + i}`,
      reason: reasons[Math.floor(i / 5)],
      quantity: (i % 4) + 1,
    });
  }
});

describe("GET /api/requests", () => {
  it("paginates with metadata", async () => {
    const res = await api.list("?pageSize=10&page=3");
    expect(res.status).toBe(200);
    expect(rows(res)).toHaveLength(5);
    expect(res.body.meta).toEqual({ page: 3, pageSize: 10, total: 25, totalPages: 3 });
  });

  it("pages do not overlap", async () => {
    const all = new Set<string>();
    for (const page of [1, 2, 3]) {
      for (const r of rows(await api.list(`?pageSize=10&page=${page}`))) all.add(r.reference);
    }
    expect(all.size).toBe(25);
  });

  it("searches customer name, order id and reference case-insensitively", async () => {
    expect(rows(await api.list("?q=priya")).every((r) => r.customerName === "Priya Nair")).toBe(
      true,
    );
    expect(rows(await api.list("?q=priya"))).toHaveLength(5);
    expect(rows(await api.list("?q=ord-5007"))).toHaveLength(1);
    expect(rows(await api.list("?q=RD-000012"))[0].reference).toBe("RD-000012");
    expect(rows(await api.list("?q=person3@"))).toHaveLength(1);
  });

  it("treats LIKE wildcards in search literally", async () => {
    expect(rows(await api.list("?q=50%25")).every((r) => r.customerName === "Kenji 50%")).toBe(
      true,
    );
    expect(rows(await api.list("?q=%25"))).toHaveLength(5);
  });

  it("filters by multiple statuses and reasons together with search", async () => {
    const res = await api.list("?status=OPEN,REJECTED&reason=DAMAGED&reason=WRONG_ITEM");
    expect(rows(res).every((r) => ["OPEN", "REJECTED"].includes(r.status))).toBe(true);
    expect(rows(res).every((r) => ["DAMAGED", "WRONG_ITEM"].includes(r.reason))).toBe(true);
    expect(res.body.meta.total).toBe(4);

    const combined = await api.list("?q=aarav&status=OPEN&pageSize=2");
    expect(combined.body.meta.total).toBe(5);
    expect(rows(combined)).toHaveLength(2);
  });

  it("sorts by whitelisted fields in both directions", async () => {
    const asc = rows(await api.list("?sort=reference&order=asc&pageSize=100")).map(
      (r) => r.reference,
    );
    expect(asc).toEqual([...asc].sort());
    const desc = rows(await api.list("?sort=quantity&order=desc&pageSize=100")).map(
      (r) => r.quantity,
    );
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    const names = rows(await api.list("?sort=customerName&order=asc&pageSize=100")).map(
      (r) => r.customerName,
    );
    expect(names[0]).toBe("Aarav Sharma");
  });

  it("returns an empty page with total 0 when nothing matches", async () => {
    const res = await api.list("?q=nobody-at-all");
    expect(res.status).toBe(200);
    expect(rows(res)).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it.each([
    "?sort=deleted_at",
    "?sort=id;drop",
    "?page=0",
    "?page=abc",
    "?pageSize=101",
    "?status=LOST",
    "?unknown=1",
  ])("rejects invalid query %s with 400", async (qs) => {
    const res = await api.list(qs);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
