import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { FeatureNotYetAvailable } from "@/components/layout/feature-not-yet-available";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Rivers | Neer Vazhvu" };
  return {
    title: `${config.displayName} Rivers | Neer Vazhvu`,
    alternates: { canonical: `/${cityId}/rivers` },
  };
}

export default async function CityRiversPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  // Per the scope decision (project_madurai_scope_decision.md): rivers use
  // basin-system scope, not district-admin. Madurai's rivers page will
  // show Vaigai-system stations including downstream Manamadurai (Sivagangai
  // district) and the estuarine Ramanathapuram station - explicitly labelled.

  return (
    <FeatureNotYetAvailable
      config={config}
      feature="Rivers"
      scope="basin-system"
      parityVerdict="EASY"
      whatItShowsForChennai="3 rivers (Cooum, Adyar, Kosasthalaiyar) with CPCB NWMP annual quality samples (DO, BOD, pH, fecal coliform), sewage inlets along the Cooum, and pollution overlays from industrial sources"
      dataGapNote="Vaigai is a CPCB NWMP river with ~6-8 stations along its course (Vaigai dam reservoir, Sellur upstream of Madurai, Anuppanadi downstream of Madurai, Andipatti, Manamadurai in Sivagangai, Ramanathapuram estuarine). 2010-2024 history is parseable from the same CPCB annual reports we already use for Chennai. Page will explicitly badge as 'Vaigai river system - includes downstream Sivagangai stations' to keep the scope honest."
      relatedLinks={[
        { href: `/${cityId}`, label: `${config.displayName} home (Vaigai dam)` },
        { href: `/${cityId}/groundwater`, label: "Groundwater stress map" },
      ]}
    />
  );
}
