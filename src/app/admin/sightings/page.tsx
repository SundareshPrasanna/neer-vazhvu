import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReviewApp } from "@/components/sightings/review-app";

export const metadata: Metadata = { title: "Review citizen reports | Neer Vazhvu", robots: { index: false, follow: false } };

export default function ReviewPage() {
  if (process.env.NEXT_PUBLIC_CITIZEN_REPORTS !== "on") notFound();
  return (
    <ReviewApp />
  );
}
