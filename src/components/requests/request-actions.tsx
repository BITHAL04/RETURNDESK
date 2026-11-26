"use client";

import {
  ArrowRight,
  Ban,
  CheckCircle2,
  PackageCheck,
  Pencil,
  PlayCircle,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import {
  RESOLUTIONS,
  RESOLUTION_LABELS,
  STATUS_LABELS,
  type RequestStatus,
  type Resolution,
} from "@/lib/domain/constants";
import type { RequestDto } from "@/server/requests/serialize";
import { cn } from "@/lib/utils";

type Pending = null | "approve" | "reject" | "complete" | "remove";

const RESOLUTION_HINTS: Record<Resolution, string> = {
  REFUND: "Return money to the customer",
  REPLACEMENT: "Ship a new unit of the item",
  STORE_CREDIT: "Credit the customer's account",
};

function errorMessage(error: unknown) {
  return error instanceof ApiClientError
    ? error.message
    : "Something went wrong. Please try again.";
}

/**
 * Renders only the actions the server says are legal (request.actions), and
 * reports the server's reason if it still refuses (e.g. someone else acted first).
 */
export function RequestActions({
  request,
  onChanged,
}: {
  request: RequestDto;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [amount, setAmount] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const { transitions, canEditDetails, canRemove } = request.actions;
  const can = (s: RequestStatus) => transitions.includes(s);

  const close = () => {
    if (busy) return;
    setPending(null);
    setDialogError(null);
  };

  async function transition(
    to: RequestStatus,
    extra?: { resolution: Resolution; refundAmount?: string },
  ) {
    setBusy(true);
    setDialogError(null);
    try {
      await apiFetch(`/api/requests/${request.id}/transitions`, {
        method: "POST",
        json: { to, ...extra },
      });
      toast.success(`${request.reference} moved to ${STATUS_LABELS[to]}`);
      setPending(null);
      onChanged();
    } catch (error) {
      if (pending) setDialogError(errorMessage(error));
      else toast.error("Status not changed", { description: errorMessage(error) });
      if (error instanceof ApiClientError && error.status === 409) onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setDialogError(null);
    try {
      await apiFetch(`/api/requests/${request.id}`, { method: "DELETE" });
      toast.success(`${request.reference} removed from the desk`, {
        description: "The record and its notes are kept.",
      });
      router.push("/requests");
      router.refresh();
    } catch (error) {
      setDialogError(errorMessage(error));
      setBusy(false);
    }
  }

  const amountInvalid = resolution === "REFUND" && !(Number(amount) > 0);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {can("IN_REVIEW") && (
          <Button loading={busy && !pending} onClick={() => transition("IN_REVIEW")}>
            <PlayCircle className="size-4" /> Start review
          </Button>
        )}
        {can("APPROVED") && (
          <Button
            onClick={() => {
              setResolution(null);
              setAmount("");
              setPending("approve");
            }}
          >
            <CheckCircle2 className="size-4" /> Approve
          </Button>
        )}
        {can("REJECTED") && (
          <Button variant="secondary" onClick={() => setPending("reject")}>
            <Ban className="size-4" /> Reject
          </Button>
        )}
        {can("COMPLETED") && (
          <Button onClick={() => setPending("complete")}>
            <PackageCheck className="size-4" /> Mark completed
          </Button>
        )}
        {canEditDetails && (
          <Link
            href={`/requests/${request.id}/edit`}
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink shadow-card hover:bg-surface-muted"
          >
            <Pencil className="size-4" /> Edit
          </Link>
        )}
        {canRemove && (
          <Button variant="danger-ghost" onClick={() => setPending("remove")}>
            <Trash2 className="size-4" /> Remove
          </Button>
        )}
      </div>

      <Dialog
        open={pending === "approve"}
        onOpenChange={(o) => !o && close()}
        title={`Approve ${request.reference}`}
        description="Choose how this return will be resolved. Customer and item details lock once approved."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!resolution || amountInvalid) return;
            void transition("APPROVED", {
              resolution,
              ...(resolution === "REFUND" ? { refundAmount: amount } : {}),
            });
          }}
          className="space-y-4"
        >
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink-soft">Resolution</legend>
            <div className="grid gap-2">
              {RESOLUTIONS.map((r) => (
                <label
                  key={r}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                    resolution === r
                      ? "border-brand bg-brand-soft/60 ring-1 ring-brand"
                      : "border-line hover:border-line-strong",
                  )}
                >
                  <input
                    type="radio"
                    name="resolution"
                    value={r}
                    checked={resolution === r}
                    onChange={() => setResolution(r)}
                    className="size-4 accent-[var(--color-brand)]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">
                      {RESOLUTION_LABELS[r]}
                    </span>
                    <span className="block text-[12.5px] text-ink-muted">
                      {RESOLUTION_HINTS[r]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {resolution === "REFUND" && (
            <Field
              label="Refund amount (USD)"
              error={amount && amountInvalid ? "Enter an amount greater than zero." : undefined}
              hint="Up to 2 decimal places."
            >
              {(a) => (
                <Input
                  {...a}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  autoFocus
                />
              )}
            </Field>
          )}
          {dialogError && (
            <p
              role="alert"
              className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-rose-800"
            >
              {dialogError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!resolution || amountInvalid}>
              Approve request <ArrowRight className="size-4" />
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={pending === "reject"}
        onClose={close}
        title={`Reject ${request.reference}?`}
        description="Rejected is a final status: the request can't be reopened, and its details will be locked. A new request can be raised for the same item afterwards."
        confirmLabel="Reject request"
        tone="danger"
        busy={busy}
        error={dialogError}
        onConfirm={() => transition("REJECTED")}
      />
      <ConfirmDialog
        open={pending === "complete"}
        onClose={close}
        title={`Complete ${request.reference}?`}
        description="Confirm the resolution has been delivered to the customer. Completed is a final status."
        confirmLabel="Mark completed"
        busy={busy}
        error={dialogError}
        onConfirm={() => transition("COMPLETED")}
      />
      <ConfirmDialog
        open={pending === "remove"}
        onClose={close}
        title={`Remove ${request.reference} from the desk?`}
        description="It will disappear from the list and can no longer be opened. Nothing is destroyed: the record, its notes and its history stay in the database."
        confirmLabel="Remove request"
        tone="danger"
        busy={busy}
        error={dialogError}
        onConfirm={remove}
      />
    </>
  );
}

function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  busy,
  error,
  tone = "primary",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  busy: boolean;
  error: string | null;
  tone?: "primary" | "danger";
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      description={description}
    >
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-rose-800"
        >
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          loading={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
