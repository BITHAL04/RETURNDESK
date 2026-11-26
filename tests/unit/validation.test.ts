import { describe, expect, it } from "vitest";
import {
  createRequestSchema,
  listQuerySchema,
  searchParamsToObject,
  transitionSchema,
  updateRequestSchema,
} from "@/lib/validation/requests";

const valid = {
  customerName: "  Aarav Sharma ",
  customerEmail: "Aarav@Example.com",
  orderId: "ORD-1001",
  itemSku: "SKU-1",
  itemName: "Mug",
  quantity: 2,
  reason: "DAMAGED",
};

describe("createRequestSchema", () => {
  it("normalises valid input", () => {
    const parsed = createRequestSchema.parse(valid);
    expect(parsed.customerName).toBe("Aarav Sharma");
    expect(parsed.customerEmail).toBe("aarav@example.com");
    expect(parsed.customerPhone).toBeNull();
  });

  it("rejects a client-supplied reference", () => {
    expect(createRequestSchema.safeParse({ ...valid, reference: "RD-000001" }).success).toBe(false);
  });

  it.each([
    ["quantity", 0],
    ["quantity", 1.5],
    ["reason", "BROKEN"],
    ["customerEmail", "not-an-email"],
    ["customerName", "   "],
    ["orderId", "ORD 1"],
  ])("rejects invalid %s", (field, value) => {
    expect(createRequestSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });
});

describe("updateRequestSchema", () => {
  it("requires at least one field", () => {
    expect(updateRequestSchema.safeParse({}).success).toBe(false);
  });
  it("rejects status changes through edit", () => {
    expect(updateRequestSchema.safeParse({ status: "APPROVED" }).success).toBe(false);
  });
});

describe("transitionSchema", () => {
  it("normalises refund amounts to 2 decimals", () => {
    expect(
      transitionSchema.parse({ to: "APPROVED", resolution: "REFUND", refundAmount: "12.5" })
        .refundAmount,
    ).toBe("12.50");
  });
  it.each(["abc", "1.999", 1e12])("rejects malformed amount %s", (amount) => {
    expect(transitionSchema.safeParse({ to: "APPROVED", refundAmount: amount }).success).toBe(
      false,
    );
  });
});

describe("listQuerySchema", () => {
  const parse = (qs: string) =>
    listQuerySchema.safeParse(searchParamsToObject(new URLSearchParams(qs)));

  it("applies defaults", () => {
    expect(parse("").data).toMatchObject({
      page: 1,
      pageSize: 20,
      sort: "createdAt",
      order: "desc",
    });
  });
  it("accepts repeated and comma-separated filters", () => {
    expect(parse("status=OPEN,IN_REVIEW&status=OPEN&reason=DAMAGED").data).toMatchObject({
      status: ["OPEN", "IN_REVIEW"],
      reason: ["DAMAGED"],
    });
  });
  it.each(["sort=password", "page=0", "pageSize=500", "status=LOST", "order=sideways", "foo=1"])(
    "rejects %s",
    (qs) => expect(parse(qs).success).toBe(false),
  );
});
