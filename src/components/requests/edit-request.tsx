"use client";

import { FileSearch, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useRequest } from "@/hooks/use-request";
import { apiFetch } from "@/lib/api/client";
import { STATUS_LABELS } from "@/lib/domain/constants";
import type { RequestDto } from "@/server/requests/serialize";
import { DetailSkeleton } from "./request-detail";
import { RequestForm } from "./request-form";

export function EditRequest({ id }: { id: string }) {
  const router = useRouter();
  const { state, refresh } = useRequest(id);

  if (state.kind === "loading") return <DetailSkeleton />;
  if (state.kind === "not-found")
    return (
      <Card>
        <EmptyState
          icon={FileSearch}
          title="Request not found"
          description="It may have been removed from the desk."
        />
      </Card>
    );
  if (state.kind === "error")
    return (
      <Card>
        <ErrorState message={state.message} onRetry={refresh} />
      </Card>
    );

  const r = state.request;
  const header = (
    <PageHeader
      eyebrow={
        <Link href={`/requests/${r.id}`} className="font-mono hover:text-ink">
          {r.reference}
        </Link>
      }
      title="Edit request"
      description="Correct customer or item details while the request is still undecided."
    />
  );

  if (!r.actions.canEditDetails) {
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <Card>
          <EmptyState
            icon={Lock}
            title="Details are locked"
            description={`This request is ${STATUS_LABELS[r.status]}. Once a request is decided its customer and item details can't be changed, but you can still add notes.`}
            action={
              <Link
                href={`/requests/${r.id}`}
                className="text-sm font-medium text-brand hover:text-brand-hover"
              >
                Back to request
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {header}
      <RequestForm
        submitLabel="Save changes"
        cancelHref={`/requests/${r.id}`}
        defaultValues={{
          customerName: r.customerName,
          customerEmail: r.customerEmail,
          customerPhone: r.customerPhone ?? "",
          orderId: r.orderId,
          itemSku: r.itemSku,
          itemName: r.itemName,
          quantity: r.quantity,
          reason: r.reason,
        }}
        onSubmit={async (_values, changed) => {
          if (Object.keys(changed).length === 0) {
            toast("Nothing to save", { description: "No details were changed." });
            router.push(`/requests/${r.id}`);
            return;
          }
          const { data } = await apiFetch<RequestDto>(`/api/requests/${r.id}`, {
            method: "PATCH",
            json: changed,
          });
          toast.success(`${data.reference} updated`);
          router.push(`/requests/${r.id}`);
        }}
      />
    </div>
  );
}
