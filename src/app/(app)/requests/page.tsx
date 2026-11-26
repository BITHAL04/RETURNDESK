import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { ListSkeleton, RequestsList } from "@/components/requests/requests-list";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "All requests" };

export default function RequestsPage() {
  return (
    <>
      <PageHeader
        title="All requests"
        description="Search, filter and work through every return on the desk."
        actions={
          <Link
            href="/requests/new"
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] bg-brand px-3.5 text-sm font-medium text-white shadow-card hover:bg-brand-hover"
          >
            <Plus className="size-4" /> New request
          </Link>
        }
      />
      <Suspense
        fallback={
          <Card>
            <ListSkeleton />
          </Card>
        }
      >
        <RequestsList />
      </Suspense>
    </>
  );
}
