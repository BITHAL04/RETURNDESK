import type { Metadata } from "next";
import { EditRequest } from "@/components/requests/edit-request";

export const metadata: Metadata = { title: "Edit request" };

export default async function EditRequestPage({ params }: PageProps<"/requests/[id]/edit">) {
  const { id } = await params;
  return <EditRequest id={id} />;
}
