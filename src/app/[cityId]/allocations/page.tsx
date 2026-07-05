import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import AllocationsClient from "./allocations-client";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config || !config.hasAllocationLedger) return { title: "Allocation Ledger | Neer Vazhvu" };

  const title = `${config.displayName} Water Allocation Ledger | Neer Vazhvu`;
  const description = `Who owns ${config.displayName}'s water: every supply arrangement's entitlement vs actual receipt, the instrument it rests on, and the gaps - assembled from official orders, operator tables and audited reports.`;
  return {
    title,
    description,
    alternates: { canonical: `/${cityId}/allocations` },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "en_IN",
      siteName: "Neer Vazhvu",
      url: `https://neervazhvu.org/${cityId}/allocations`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function AllocationsPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  // Capability-gated: only cities with a compiled ledger file ship this page.
  if (!config || !config.hasAllocationLedger) notFound();
  return <AllocationsClient cityId={cityId} />;
}
