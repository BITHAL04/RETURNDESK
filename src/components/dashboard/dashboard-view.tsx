"use client";

import { ArrowRight, CircleDollarSign, Clock, Inbox, PackageCheck, Plus } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { STATUS_STYLES, StatusBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/states";
import {
  REASON_LABELS,
  REQUEST_STATUSES,
  RETURN_REASONS,
  STATUS_LABELS,
  type RequestStatus,
  type ReturnReason,
} from "@/lib/domain/constants";
import type { RequestDto } from "@/server/requests/serialize";
import { cn, formatMoney, formatRelative, initials } from "@/lib/utils";

export type DashboardStats = {
  total: number;
  byStatus: Record<RequestStatus, number>;
  byReason: Record<ReturnReason, number>;
  refundTotal: string;
  recent: RequestDto[];
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: typeof Inbox;
  href: string;
  tone: string;
}) {
  return (
    <motion.div variants={item}>
      <Link href={href} className="group block h-full">
        <Card className="h-full p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-line-strong group-hover:shadow-raised sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-muted">{label}</span>
            <span className={cn("grid size-8 place-items-center rounded-lg", tone)}>
              <Icon className="size-4" aria-hidden />
            </span>
          </div>
          <div className="mt-3 text-[26px] font-semibold tracking-tight text-ink tabular-nums">
            {value}
          </div>
          <p className="mt-1 text-[12.5px] text-ink-faint">{hint}</p>
        </Card>
      </Link>
    </motion.div>
  );
}

export function DashboardView({ stats }: { stats: DashboardStats }) {
  const { byStatus } = stats;
  const awaiting = byStatus.OPEN + byStatus.IN_REVIEW;
  const maxReason = Math.max(1, ...RETURN_REASONS.map((r) => stats.byReason[r]));

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Active requests"
          value={stats.total}
          hint="Across every status"
          icon={Inbox}
          href="/requests"
          tone="bg-brand-soft text-brand"
        />
        <StatCard
          label="Needs attention"
          value={awaiting}
          hint={`${byStatus.OPEN} open · ${byStatus.IN_REVIEW} in review`}
          icon={Clock}
          href="/requests?status=OPEN&status=IN_REVIEW"
          tone="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="Awaiting completion"
          value={byStatus.APPROVED}
          hint="Approved, not yet closed"
          icon={PackageCheck}
          href="/requests?status=APPROVED"
          tone="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label="Refunds approved"
          value={formatMoney(stats.refundTotal)}
          hint="Approved and completed"
          icon={CircleDollarSign}
          href="/requests?status=APPROVED&status=COMPLETED"
          tone="bg-sky-50 text-sky-700"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <motion.div variants={item} className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader
              title="Status distribution"
              description="Where every active request sits in the lifecycle"
            />
            <div className="p-5">
              <div
                className="flex h-2.5 overflow-hidden rounded-full bg-black/[0.04]"
                role="img"
                aria-label="Requests by status"
              >
                {REQUEST_STATUSES.map((s) =>
                  byStatus[s] ? (
                    <motion.div
                      key={s}
                      className={cn(
                        STATUS_STYLES[s].dot,
                        "h-full first:rounded-l-full last:rounded-r-full",
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${(byStatus[s] / Math.max(stats.total, 1)) * 100}%` }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    />
                  ) : null,
                )}
              </div>
              <ul className="mt-5 grid gap-1 sm:grid-cols-2">
                {REQUEST_STATUSES.map((s) => (
                  <li key={s}>
                    <Link
                      href={`/requests?status=${s}`}
                      className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm hover:bg-black/[0.03]"
                    >
                      <span className="flex items-center gap-2.5 text-ink-soft">
                        <span className={cn("size-2 rounded-full", STATUS_STYLES[s].dot)} />
                        {STATUS_LABELS[s]}
                      </span>
                      <span className="font-medium tabular-nums text-ink">
                        {byStatus[s]}
                        <span className="ml-1.5 text-xs font-normal text-ink-faint">
                          {stats.total ? Math.round((byStatus[s] / stats.total) * 100) : 0}%
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader title="Return reasons" description="Why customers are sending items back" />
            <ul className="space-y-3.5 p-5">
              {RETURN_REASONS.map((r) => (
                <li key={r}>
                  <Link href={`/requests?reason=${r}`} className="group block">
                    <div className="mb-1.5 flex justify-between text-[13px]">
                      <span className="text-ink-soft group-hover:text-ink">{REASON_LABELS[r]}</span>
                      <span className="font-medium tabular-nums text-ink">{stats.byReason[r]}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-black/[0.05]">
                      <motion.div
                        className="h-full rounded-full bg-brand/80 group-hover:bg-brand"
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.byReason[r] / maxReason) * 100}%` }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={item}>
        <Card>
          <CardHeader
            title="Recent requests"
            description="The latest returns raised on the desk"
            action={
              <Link
                href="/requests"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:text-brand-hover"
              >
                View all <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {stats.recent.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No requests yet"
              description="When an agent raises a return request it will show up here."
              action={
                <Link
                  href="/requests/new"
                  className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-hover"
                >
                  <Plus className="size-4" /> New request
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {stats.recent.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/requests/${r.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">
                      {initials(r.customerName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{r.customerName}</p>
                      <p className="truncate text-[12.5px] text-ink-muted">
                        <span className="font-mono">{r.reference}</span> · {r.itemName}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={r.status} />
                      <span className="text-[11.5px] text-ink-faint">
                        {formatRelative(r.createdAt)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
