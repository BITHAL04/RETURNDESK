/**
 * The request lifecycle (business rules 1, 4 and 5), expressed once and used by
 * both the server (to enforce) and the API responses (to tell the UI which
 * actions are legal). The database triggers mirror these rules as a backstop.
 */
import type { RequestStatus } from "./constants";

/** Rule 1: the only legal transitions. REJECTED and COMPLETED are final. */
const TRANSITIONS: Readonly<Record<RequestStatus, readonly RequestStatus[]>> = {
  OPEN: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["COMPLETED"],
  REJECTED: [],
  COMPLETED: [],
};

export function allowedTransitions(from: RequestStatus): readonly RequestStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

function isFinal(status: RequestStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Rule 4: once decided, customer and item details are locked. */
const DECIDED: readonly RequestStatus[] = ["APPROVED", "REJECTED", "COMPLETED"];
export function isDecided(status: RequestStatus): boolean {
  return DECIDED.includes(status);
}

/** Rule 3: rejected and completed requests no longer count as live. */
export function isLive(status: RequestStatus): boolean {
  return !isFinal(status);
}

/** Rule 5: only OPEN and REJECTED requests may be removed. */
const REMOVABLE: readonly RequestStatus[] = ["OPEN", "REJECTED"];
export function isRemovable(status: RequestStatus): boolean {
  return REMOVABLE.includes(status);
}

/** Everything the UI needs to offer only legal actions, computed on the server. */
export function availableActions(status: RequestStatus) {
  return {
    transitions: allowedTransitions(status),
    canEditDetails: !isDecided(status),
    canRemove: isRemovable(status),
    canAddNote: true,
  };
}
