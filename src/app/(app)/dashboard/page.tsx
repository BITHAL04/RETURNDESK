import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { PageHeader } from "@/components/layout/app-shell";
import { getStats } from "@/server/requests/service";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await connection(); // always render with live data
  const stats = await getStats();
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A live overview of the returns desk."
        actions={
          <Link
            href="/requests/new"
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] bg-brand px-3.5 text-sm font-medium text-white shadow-card hover:bg-brand-hover"
          >
            <Plus className="size-4" /> New request
          </Link>
        }
      />
      <DashboardView stats={stats} />
    </>
  );
}
