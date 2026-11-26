import { CheckCircle2, CircleDot, Clock, PackageCheck, XCircle } from "lucide-react";
import {
  REASON_LABELS,
  STATUS_LABELS,
  type RequestStatus,
  type ReturnReason,
} from "@/lib/domain/constants";
import { cn } from "@/lib/utils";

/** Status is the most important thing to read at a glance, so each has a colour, an icon and a label. */
export const STATUS_STYLES: Record<
  RequestStatus,
  { className: string; dot: string; icon: typeof Clock }
> = {
  OPEN: { className: "bg-sky-50 text-sky-700 ring-sky-600/15", dot: "bg-sky-500", icon: CircleDot },
  IN_REVIEW: {
    className: "bg-amber-50 text-amber-800 ring-amber-600/20",
    dot: "bg-amber-500",
    icon: Clock,
  },
  APPROVED: {
    className: "bg-indigo-50 text-indigo-700 ring-indigo-600/15",
    dot: "bg-indigo-500",
    icon: CheckCircle2,
  },
  REJECTED: {
    className: "bg-rose-50 text-rose-700 ring-rose-600/15",
    dot: "bg-rose-500",
    icon: XCircle,
  },
  COMPLETED: {
    className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
    dot: "bg-emerald-500",
    icon: PackageCheck,
  },
};

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const { className: tone, icon: Icon } = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function ReasonTag({ reason }: { reason: ReturnReason }) {
  return (
    <span className="inline-flex items-center rounded-md border border-line bg-surface-muted px-1.5 py-0.5 text-xs whitespace-nowrap text-ink-soft">
      {REASON_LABELS[reason]}
    </span>
  );
}
