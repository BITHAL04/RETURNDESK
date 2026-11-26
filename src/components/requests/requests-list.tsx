"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  Inbox,
  Plus,
  Search,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ReasonTag, STATUS_STYLES, StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import {
  REASON_LABELS,
  REQUEST_STATUSES,
  RETURN_REASONS,
  STATUS_LABELS,
  type RequestStatus,
} from "@/lib/domain/constants";
import type { SortField } from "@/lib/validation/requests";
import type { RequestDto } from "@/server/requests/serialize";
import { cn, formatDate, formatRelative } from "@/lib/utils";

type Meta = { page: number; pageSize: number; total: number; totalPages: number };
type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; items: RequestDto[]; meta: Meta };

const PAGE_SIZES = [10, 20, 50];

export function RequestsList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // The URL is the source of truth for filters, so views are shareable and survive refresh.
  const statuses = params.getAll("status") as RequestStatus[];
  const reason = params.get("reason") ?? "";
  const sort = (params.get("sort") ?? "createdAt") as SortField;
  const order = (params.get("order") ?? "desc") as "asc" | "desc";
  const page = Number(params.get("page") ?? "1");
  const pageSize = Number(params.get("pageSize") ?? "20");

  const [search, setSearch] = useState(params.get("q") ?? "");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const update = useCallback(
    (changes: Record<string, string | string[] | null>, resetPage = true) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        next.delete(key);
        if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
        else if (value) next.set(key, value);
      }
      if (resetPage) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  // Push the debounced search term into the URL (one request after typing pauses).
  useEffect(() => {
    if ((params.get("q") ?? "") !== debouncedSearch) update({ q: debouncedSearch || null });
  }, [debouncedSearch, params, update]);

  const queryString = useMemo(() => {
    const qs = new URLSearchParams();
    const q = params.get("q");
    if (q) qs.set("q", q);
    statuses.forEach((s) => qs.append("status", s));
    if (reason) qs.set("reason", reason);
    qs.set("sort", sort);
    qs.set("order", order);
    qs.set("page", String(page));
    qs.set("pageSize", String(pageSize));
    return qs.toString();
  }, [params, statuses, reason, sort, order, page, pageSize]);

  // Each fetch is tagged with the query it answered. While a newer query is in
  // flight the previous rows stay on screen under a progress bar instead of flashing.
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${queryString}#${reloadKey}`;
  const [result, setResult] = useState<{ key: string; state: State } | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<RequestDto[]>(`/api/requests?${queryString}`)
      .then(({ data, meta }) => {
        if (!cancelled)
          setResult({ key: requestKey, state: { kind: "ready", items: data, meta: meta as Meta } });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof ApiClientError ? error.message : "Could not load requests.";
        setResult({ key: requestKey, state: { kind: "error", message } });
      });
    return () => {
      cancelled = true;
    };
  }, [queryString, requestKey]);

  const fetching = result?.key !== requestKey;
  const state: State =
    !result || (fetching && result.state.kind === "error") ? { kind: "loading" } : result.state;

  const hasFilters = Boolean(params.get("q") || statuses.length || reason);
  const toggleStatus = (s: RequestStatus) =>
    update({ status: statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s] });
  const setSort = (field: SortField) =>
    update({ sort: field, order: sort === field && order === "desc" ? "asc" : "desc" }, false);

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, email, order ID or reference…"
              aria-label="Search requests"
              className="pl-9"
              maxLength={100}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-ink-faint hover:bg-black/5 hover:text-ink"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Select
              value={reason}
              onChange={(e) => update({ reason: e.target.value || null })}
              aria-label="Filter by reason"
              className="lg:w-48"
            >
              <option value="">All reasons</option>
              {RETURN_REASONS.map((r) => (
                <option key={r} value={r}>
                  {REASON_LABELS[r]}
                </option>
              ))}
            </Select>
            <Select
              className="w-auto lg:hidden"
              aria-label="Sort by"
              value={`${sort}:${order}`}
              onChange={(e) => {
                const [s, o] = e.target.value.split(":");
                update({ sort: s, order: o }, false);
              }}
            >
              <option value="createdAt:desc">Newest</option>
              <option value="createdAt:asc">Oldest</option>
              <option value="updatedAt:desc">Recently updated</option>
              <option value="customerName:asc">Customer A–Z</option>
              <option value="reference:asc">Reference</option>
              <option value="status:asc">Status</option>
            </Select>
          </div>
        </div>
        <div
          className="mt-3 flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter by status"
        >
          {REQUEST_STATUSES.map((s) => {
            const active = statuses.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                onClick={() => toggleStatus(s)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors",
                  active
                    ? "border-brand/30 bg-brand-soft text-brand"
                    : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
                )}
              >
                <span className={cn("size-1.5 rounded-full", STATUS_STYLES[s].dot)} />
                {STATUS_LABELS[s]}
              </button>
            );
          })}
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                update({ q: null, status: null, reason: null });
              }}
              className="ml-1 inline-flex h-7 items-center gap-1 rounded-full px-2 text-[12.5px] font-medium text-ink-muted hover:text-ink"
            >
              <X className="size-3.5" /> Clear filters
            </button>
          )}
        </div>
      </Card>

      <Card className="relative overflow-hidden">
        <AnimatePresence>
          {fetching && state.kind === "ready" && (
            <motion.div
              className="absolute inset-x-0 top-0 z-10 h-0.5 origin-left bg-brand"
              initial={{ scaleX: 0, opacity: 1 }}
              animate={{ scaleX: 0.8 }}
              exit={{ scaleX: 1, opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </AnimatePresence>

        {state.kind === "loading" && <ListSkeleton />}
        {state.kind === "error" && (
          <ErrorState message={state.message} onRetry={() => setReloadKey((k) => k + 1)} />
        )}
        {state.kind === "ready" &&
          state.items.length === 0 &&
          (hasFilters ? (
            <EmptyState
              icon={FileSearch}
              title="No requests match your filters"
              description="Try a different search term, or clear the status and reason filters."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    update({ q: null, status: null, reason: null });
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title="The desk is clear"
              description="There are no return requests yet. Raise one to get started."
              action={
                <Link
                  href="/requests/new"
                  className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-hover"
                >
                  <Plus className="size-4" /> New request
                </Link>
              }
            />
          ))}
        {state.kind === "ready" && state.items.length > 0 && (
          <>
            <DesktopTable items={state.items} sort={sort} order={order} onSort={setSort} />
            <MobileList items={state.items} />
            <Pagination
              meta={state.meta}
              onPage={(p) => update({ page: String(p) }, false)}
              onPageSize={(s) => update({ pageSize: String(s) })}
            />
          </>
        )}
      </Card>
    </div>
  );
}

function SortHeader({
  field,
  label,
  sort,
  order,
  onSort,
  className,
}: {
  field: SortField;
  label: string;
  sort: SortField;
  order: "asc" | "desc";
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = sort === field;
  const Icon = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (order === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-4 py-2.5 font-medium", className)}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
      </button>
    </th>
  );
}

function DesktopTable({
  items,
  sort,
  order,
  onSort,
}: {
  items: RequestDto[];
  sort: SortField;
  order: "asc" | "desc";
  onSort: (f: SortField) => void;
}) {
  const router = useRouter();
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-surface-muted text-[12.5px] text-ink-muted">
          <tr>
            <SortHeader
              field="reference"
              label="Reference"
              sort={sort}
              order={order}
              onSort={onSort}
              className="pl-5"
            />
            <SortHeader
              field="customerName"
              label="Customer"
              sort={sort}
              order={order}
              onSort={onSort}
            />
            <th scope="col" className="px-4 py-2.5 font-medium">
              Item
            </th>
            <th scope="col" className="hidden px-4 py-2.5 font-medium xl:table-cell">
              Reason
            </th>
            <SortHeader field="status" label="Status" sort={sort} order={order} onSort={onSort} />
            <SortHeader
              field="createdAt"
              label="Created"
              sort={sort}
              order={order}
              onSort={onSort}
              className="pr-5"
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((r, i) => (
            <motion.tr
              key={r.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.015, 0.2) }}
              onClick={() => router.push(`/requests/${r.id}`)}
              className="group cursor-pointer transition-colors hover:bg-brand-soft/40"
            >
              <td className="py-3 pr-4 pl-5">
                <Link
                  href={`/requests/${r.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-[13px] font-medium text-ink group-hover:text-brand"
                >
                  {r.reference}
                </Link>
                <div className="text-[12px] text-ink-faint">{r.orderId}</div>
              </td>
              <td className="max-w-56 px-4 py-3">
                <div className="truncate font-medium text-ink">{r.customerName}</div>
                <div className="truncate text-[12.5px] text-ink-muted">{r.customerEmail}</div>
              </td>
              <td className="max-w-64 px-4 py-3">
                <div className="truncate text-ink-soft">{r.itemName}</div>
                <div className="text-[12px] text-ink-faint">
                  <span className="font-mono">{r.itemSku}</span> · Qty {r.quantity}
                </div>
              </td>
              <td className="hidden px-4 py-3 xl:table-cell">
                <ReasonTag reason={r.reason} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={r.status} />
              </td>
              <td className="py-3 pr-5 pl-4 whitespace-nowrap text-ink-muted">
                <div className="text-[13px]">{formatDate(r.createdAt)}</div>
                <div className="text-[12px] text-ink-faint">{formatRelative(r.createdAt)}</div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileList({ items }: { items: RequestDto[] }) {
  return (
    <ul className="divide-y divide-line md:hidden">
      {items.map((r) => (
        <li key={r.id}>
          <Link href={`/requests/${r.id}`} className="block px-4 py-3.5 active:bg-surface-muted">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{r.customerName}</p>
                <p className="mt-0.5 font-mono text-[12.5px] text-ink-muted">{r.reference}</p>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <p className="mt-2 truncate text-[13px] text-ink-soft">
              {r.quantity} × {r.itemName}
            </p>
            <div className="mt-2 flex items-center justify-between text-[12px] text-ink-faint">
              <ReasonTag reason={r.reason} />
              <span>{formatRelative(r.createdAt)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Pagination({
  meta,
  onPage,
  onPageSize,
}: {
  meta: Meta;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
}) {
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 sm:flex-row sm:px-5">
      <p className="text-[13px] text-ink-muted" aria-live="polite">
        Showing{" "}
        <span className="font-medium text-ink">
          {from}–{to}
        </span>{" "}
        of <span className="font-medium text-ink">{meta.total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Select
          value={meta.pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          aria-label="Rows per page"
          className="h-8 w-auto text-[13px]"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s} / page
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-16 text-center text-[13px] text-ink-muted tabular-nums">
          {meta.page} / {meta.totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPage(meta.page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading requests" className="divide-y divide-line">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-40 md:block" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
