import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/app-shell";
import { CreateRequestForm } from "@/components/requests/create-request-form";

export const metadata: Metadata = { title: "New request" };

export default function NewRequestPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={
          <Link href="/requests" className="hover:text-ink">
            All requests
          </Link>
        }
        title="New return request"
        description="The reference number is generated automatically when you save."
      />
      <CreateRequestForm />
    </div>
  );
}
