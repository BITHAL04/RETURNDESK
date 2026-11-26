import type { Metadata } from "next";
import { RequestDetail } from "@/components/requests/request-detail";

export const metadata: Metadata = { title: "Request" };

export default async function RequestPage({ params }: PageProps<"/requests/[id]">) {
  const { id } = await params;
  return <RequestDetail id={id} />;
}
