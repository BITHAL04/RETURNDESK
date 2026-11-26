import { describe, expect, it } from "vitest";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/domain/constants";
import {
  availableActions,
  canTransition,
  isDecided,
  isLive,
  isRemovable,
} from "@/lib/domain/lifecycle";

const legal: Array<[RequestStatus, RequestStatus]> = [
  ["OPEN", "IN_REVIEW"],
  ["IN_REVIEW", "APPROVED"],
  ["IN_REVIEW", "REJECTED"],
  ["APPROVED", "COMPLETED"],
];

describe("status lifecycle (rule 1)", () => {
  it.each(legal)("allows %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  const illegal = REQUEST_STATUSES.flatMap((from) =>
    REQUEST_STATUSES.map((to) => [from, to] as [RequestStatus, RequestStatus]),
  ).filter(([f, t]) => !legal.some(([lf, lt]) => lf === f && lt === t));

  it.each(illegal)("refuses %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it("treats REJECTED and COMPLETED as final", () => {
    expect(availableActions("REJECTED").transitions).toEqual([]);
    expect(availableActions("COMPLETED").transitions).toEqual([]);
  });
});

describe("derived rules", () => {
  it("locks details once decided (rule 4)", () => {
    expect(REQUEST_STATUSES.filter(isDecided)).toEqual(["APPROVED", "REJECTED", "COMPLETED"]);
    expect(availableActions("APPROVED").canEditDetails).toBe(false);
    expect(availableActions("IN_REVIEW").canEditDetails).toBe(true);
  });

  it("counts only non-final requests as live (rule 3)", () => {
    expect(REQUEST_STATUSES.filter(isLive)).toEqual(["OPEN", "IN_REVIEW", "APPROVED"]);
  });

  it("allows removal only for OPEN and REJECTED (rule 5)", () => {
    expect(REQUEST_STATUSES.filter(isRemovable)).toEqual(["OPEN", "REJECTED"]);
  });

  it("always allows notes", () => {
    for (const s of REQUEST_STATUSES) expect(availableActions(s).canAddNote).toBe(true);
  });
});
