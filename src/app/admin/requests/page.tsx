import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RequestsAdmin } from "@/components/requests/requests-admin";

export const metadata: Metadata = { title: "Requests | Neer Vazhvu", robots: { index: false, follow: false } };

export default function RequestsPage() {
  if (process.env.NEXT_PUBLIC_CITIZEN_REPORTS !== "on") notFound();
  return <RequestsAdmin />;
}
