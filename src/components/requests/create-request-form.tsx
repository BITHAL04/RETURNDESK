"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/client";
import type { RequestDto } from "@/server/requests/serialize";
import { RequestForm } from "./request-form";

export function CreateRequestForm() {
  const router = useRouter();
  return (
    <RequestForm
      submitLabel="Create request"
      cancelHref="/requests"
      onSubmit={async (values) => {
        const { data } = await apiFetch<RequestDto>("/api/requests", {
          method: "POST",
          json: values,
        });
        toast.success(`Request ${data.reference} created`, {
          description: `${data.customerName} · ${data.itemName}`,
        });
        router.push(`/requests/${data.id}`);
        router.refresh();
      }}
    />
  );
}
