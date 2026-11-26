"use client";

import { ArrowLeft, FileSearch, Lock, Mail, Package, Phone, Receipt, User } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { ReasonTag, StatusBadge } from "@/components/ui/badges";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useRequest, type RequestDetail as Detail } from "@/hooks/use-request";
import { RESOLUTION_LABELS } from "@/lib/domain/constants";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { ActivityTimeline } from "./activity-timeline";
import { LifecycleStepper } from "./lifecycle-stepper";
import { RequestActions } from "./request-actions";

export function RequestDetail({ id }: { id: string }) {
  const { state, refresh, setState } = useRequest(id);

  if (state.kind === "loading") return <DetailSkeleton />;
  if (state.kind === "not-found")
    return (
      <Card>
        <EmptyState
          icon={FileSearch}
          title="Request not found"
          description="It may have been removed from the desk, or the link is wrong."
          action={
            <Link
              href="/requests"
              className="text-sm font-medium text-brand hover:text-brand-hover"
            >
              Back to all requests
            </Link>
          }
        />
      </Card>
    );
  if (state.kind === "error")
    return (
      <Card>
        <ErrorState message={state.message} onRetry={refresh} />
      </Card>
    );

  const request = state.request;
  const locked = !request.actions.canEditDetails;

  return (
    <div>
      <Link
        href="/requests"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> All requests
      </Link>

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-[22px] font-semibold tracking-tight text-ink sm:text-2xl">
              {request.reference}
            </h1>
            <motion.span
              key={request.status}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              <StatusBadge status={request.status} className="text-[13px]" />
            </motion.span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {request.customerName} · raised {formatDateTime(request.createdAt)}
          </p>
        </div>
        <RequestActions request={request} onChanged={refresh} />
      </div>

      <Card className="mb-5 px-4 py-4 sm:px-6">
        <LifecycleStepper status={request.status} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div className="space-y-5">
          {locked && (
            <div className="flex gap-3 rounded-xl border border-line bg-surface-muted px-4 py-3 text-[13px] text-ink-muted">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                This request has been decided, so customer and item details are locked. Notes can
                still be added.
              </p>
            </div>
          )}
          <InfoCard icon={User} title="Customer">
            <Row label="Name" value={request.customerName} />
            <Row
              label="Email"
              value={
                <a
                  href={`mailto:${request.customerEmail}`}
                  className="inline-flex items-center gap-1.5 text-brand hover:underline"
                >
                  <Mail className="size-3.5" />
                  {request.customerEmail}
                </a>
              }
            />
            <Row
              label="Phone"
              value={
                request.customerPhone ? (
                  <a
                    href={`tel:${request.customerPhone}`}
                    className="inline-flex items-center gap-1.5 hover:underline"
                  >
                    <Phone className="size-3.5 text-ink-muted" />
                    {request.customerPhone}
                  </a>
                ) : (
                  <span className="text-ink-faint">Not provided</span>
                )
              }
            />
          </InfoCard>
          <InfoCard icon={Package} title="Order & item">
            <Row label="Order ID" value={<span className="font-mono">{request.orderId}</span>} />
            <Row label="Item" value={request.itemName} />
            <Row label="SKU" value={<span className="font-mono">{request.itemSku}</span>} />
            <Row label="Quantity" value={request.quantity} />
            <Row label="Reason" value={<ReasonTag reason={request.reason} />} />
          </InfoCard>
          <InfoCard icon={Receipt} title="Decision">
            <Row label="Status" value={<StatusBadge status={request.status} />} />
            <Row
              label="Resolution"
              value={
                request.resolution ? (
                  RESOLUTION_LABELS[request.resolution]
                ) : (
                  <span className="text-ink-faint">
                    {request.status === "REJECTED" ? "None — rejected" : "Decided on approval"}
                  </span>
                )
              }
            />
            {request.resolution === "REFUND" && (
              <Row
                label="Refund"
                value={
                  <span className="font-semibold tabular-nums">
                    {formatMoney(request.refundAmount)}
                  </span>
                }
              />
            )}
            <Row label="Last updated" value={formatDateTime(request.updatedAt)} />
          </InfoCard>
        </div>

        <ActivityTimeline
          requestId={request.id}
          notes={request.notes}
          history={request.history}
          onNoteAdded={(note) =>
            setState({
              kind: "ready",
              request: { ...request, notes: [...request.notes, note] } satisfies Detail,
            })
          }
        />
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
        <Icon className="size-4 text-ink-muted" aria-hidden />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <dl className="divide-y divide-line px-5">{children}</dl>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-ink [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading request">
      <Skeleton className="mb-4 h-4 w-24" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 mb-6 h-4 w-72" />
      <Card className="mb-5 p-5">
        <Skeleton className="h-10 w-full" />
      </Card>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.35fr]">
        <div className="space-y-5">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </Card>
          ))}
        </div>
        <Card className="space-y-4 p-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-14 flex-1" />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
