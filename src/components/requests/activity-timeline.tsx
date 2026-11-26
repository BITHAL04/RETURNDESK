"use client";

import {
  ArrowRight,
  FilePlus2,
  History,
  Lock,
  MessageSquare,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/field";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import {
  RESOLUTION_LABELS,
  REASON_LABELS,
  type Resolution,
  type ReturnReason,
} from "@/lib/domain/constants";
import type { EventDto, NoteDto } from "@/server/requests/serialize";
import { cn, formatDateTime, formatMoney, formatRelative, initials } from "@/lib/utils";

type Entry =
  { kind: "note"; at: string; note: NoteDto } | { kind: "event"; at: string; event: EventDto };

const FIELD_LABELS: Record<string, string> = {
  customerName: "Customer name",
  customerEmail: "Email",
  customerPhone: "Phone",
  orderId: "Order ID",
  itemSku: "Item SKU",
  itemName: "Item name",
  quantity: "Quantity",
  reason: "Reason",
};

function display(field: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "reason") return REASON_LABELS[value as ReturnReason] ?? String(value);
  return String(value);
}

const AUTHOR_KEY = "returndesk.noteAuthor";
function rememberedAuthor() {
  try {
    return typeof window === "undefined" ? "" : (window.localStorage.getItem(AUTHOR_KEY) ?? "");
  } catch {
    return "";
  }
}

/** Notes and audit events merged into one chronological feed. Notes are append-only. */
export function ActivityTimeline({
  requestId,
  notes,
  history,
  onNoteAdded,
}: {
  requestId: string;
  notes: NoteDto[];
  history: EventDto[];
  onNoteAdded: (note: NoteDto) => void;
}) {
  const [author, setAuthor] = useState(rememberedAuthor);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entries: Entry[] = [
    ...notes.map((note) => ({ kind: "note" as const, at: note.createdAt, note })),
    ...history.map((event) => ({ kind: "event" as const, at: event.createdAt, event })),
  ].sort((a, b) => a.at.localeCompare(b.at) || (a.kind === "event" ? -1 : 1));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!author.trim() || !body.trim()) {
      setError("Add your name and a note before posting.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data } = await apiFetch<NoteDto>(`/api/requests/${requestId}/notes`, {
        method: "POST",
        json: { author, body },
      });
      try {
        window.localStorage.setItem(AUTHOR_KEY, author.trim());
      } catch {
        /* storage unavailable: the name just won't be remembered */
      }
      setBody("");
      onNoteAdded(data);
      toast.success("Note added");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "The note could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <History className="size-4 text-ink-muted" aria-hidden />
          <h2 className="text-sm font-semibold">Activity</h2>
        </div>
        <span className="text-[12.5px] text-ink-faint">
          {notes.length} {notes.length === 1 ? "note" : "notes"} · {history.length} events
        </span>
      </div>

      <ol className="relative px-5 pt-5">
        <span aria-hidden className="absolute top-6 bottom-2 left-[35px] w-px bg-line" />
        {entries.map((entry, i) => (
          <motion.li
            key={entry.kind === "note" ? entry.note.id : entry.event.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className="relative flex gap-3 pb-5"
          >
            {entry.kind === "note" ? (
              <NoteItem note={entry.note} />
            ) : (
              <EventItem event={entry.event} />
            )}
          </motion.li>
        ))}
      </ol>

      <form onSubmit={submit} className="border-t border-line bg-surface-muted/60 p-4 sm:p-5">
        <label
          htmlFor="note-body"
          className="mb-2 flex items-center gap-2 text-[13px] font-medium text-ink-soft"
        >
          <MessageSquare className="size-4 text-ink-muted" aria-hidden /> Add a note
        </label>
        <Textarea
          id="note-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What happened, what you checked, what's next…"
          maxLength={5000}
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(e);
          }}
        />
        <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Your name"
            aria-label="Your name"
            maxLength={80}
            className="sm:max-w-52"
          />
          <p className="flex-1 text-[12px] text-ink-faint">
            Notes are permanent and can&apos;t be edited or deleted.
          </p>
          <Button type="submit" loading={saving} disabled={!body.trim()}>
            <Send className="size-4" /> Post note
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-[13px] text-danger">
            {error}
          </p>
        )}
      </form>
    </Card>
  );
}

function Dot({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 border-surface",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Time({ iso }: { iso: string }) {
  return (
    <time
      dateTime={iso}
      title={formatDateTime(iso)}
      className="text-[12px] whitespace-nowrap text-ink-faint"
    >
      {formatRelative(iso)}
    </time>
  );
}

function NoteItem({ note }: { note: NoteDto }) {
  return (
    <>
      <Dot className="bg-brand-soft text-[10.5px] font-semibold text-brand">
        {initials(note.author)}
      </Dot>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-[13px]">
            <span className="font-medium text-ink">{note.author}</span>
            <span className="text-ink-muted"> added a note</span>
          </p>
          <Time iso={note.createdAt} />
        </div>
        <div className="mt-1.5 rounded-xl rounded-tl-sm border border-line bg-surface px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-ink-soft shadow-card [overflow-wrap:anywhere]">
          {note.body}
        </div>
      </div>
    </>
  );
}

function EventItem({ event }: { event: EventDto }) {
  if (event.type === "CREATED") {
    return (
      <>
        <Dot className="bg-sky-50 text-sky-600">
          <FilePlus2 className="size-3.5" />
        </Dot>
        <Line text="Request raised" iso={event.createdAt} />
      </>
    );
  }
  if (event.type === "REMOVED") {
    return (
      <>
        <Dot className="bg-rose-50 text-rose-600">
          <Trash2 className="size-3.5" />
        </Dot>
        <Line text="Removed from the desk" iso={event.createdAt} />
      </>
    );
  }
  if (event.type === "DETAILS_UPDATED") {
    const changes = Object.entries(event.changes ?? {});
    return (
      <>
        <Dot className="bg-amber-50 text-amber-600">
          <Pencil className="size-3.5" />
        </Dot>
        <div className="min-w-0 flex-1">
          <Line text="Details corrected" iso={event.createdAt} />
          <ul className="mt-1.5 space-y-1 text-[12.5px] text-ink-muted">
            {changes.map(([field, c]) => (
              <li key={field} className="[overflow-wrap:anywhere]">
                <span className="text-ink-soft">{FIELD_LABELS[field] ?? field}:</span>{" "}
                <span className="line-through decoration-ink-faint/60">
                  {display(field, c.from)}
                </span>
                <ArrowRight className="mx-1 inline size-3" />
                <span className="font-medium text-ink">{display(field, c.to)}</span>
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  }
  const resolution = event.changes?.resolution?.to as Resolution | undefined;
  const refund = event.changes?.refundAmount?.to as string | undefined;
  return (
    <>
      <Dot className="bg-indigo-50 text-brand">
        {event.toStatus === "APPROVED" || event.toStatus === "REJECTED" ? (
          <Lock className="size-3.5" />
        ) : (
          <ArrowRight className="size-3.5" />
        )}
      </Dot>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-muted">
            Status changed
            {event.fromStatus && <StatusBadge status={event.fromStatus} />}
            <ArrowRight className="size-3" />
            {event.toStatus && <StatusBadge status={event.toStatus} />}
          </p>
          <Time iso={event.createdAt} />
        </div>
        {resolution && (
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Resolution:{" "}
            <span className="font-medium text-ink">{RESOLUTION_LABELS[resolution]}</span>
            {refund && (
              <>
                {" "}
                · Refund <span className="font-medium text-ink">{formatMoney(refund)}</span>
              </>
            )}
          </p>
        )}
      </div>
    </>
  );
}

function Line({ text, iso }: { text: string; iso: string }) {
  return (
    <div className="flex min-h-8 flex-1 flex-wrap items-center justify-between gap-x-3">
      <p className="text-[13px] text-ink-muted">{text}</p>
      <Time iso={iso} />
    </div>
  );
}
