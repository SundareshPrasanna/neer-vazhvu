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
  if (!config) return { title: "My Ward | Neer Vazhvu" };
  return { title: `My Ward (${config.displayName}) | Neer Vazhvu` };
}

export default async function CityMyWardPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  return (
    <FeatureNotYetAvailable
      config={config}
      feature="My Ward"
      scope="ward-admin"
      parityVerdict="HARD"
      whatItShowsForChennai="per-ward report card (drainage / sewerage / flood / water bodies / groundwater scored 0-100), uplift planner with cost estimates, comparison vs neighbouring wards, and AI-generated ward narratives in English + Tamil"
      dataGapNote={`${config.displayName === "Madurai" ? "Madurai" : config.displayName} has 100 wards across 5 zones (KML already in repo). The ward-profiles JSON currently only has centroid + area; water_bodies / flood / drainage / sewerage / rivers / industrial / risk fields are skeleton. Filling them needs the M3 data work to land first (water bodies census subset, river-quality, restoration scoring) plus a sewerage-network GeoJSON we don't have for Madurai. AI ward narratives reuse the existing pipeline once profiles are filled.`}
      relatedLinks={[
        { href: `/${cityId}`, label: `${config.displayName} home` },
        { href: `/${cityId}/groundwater`, label: "Block-level groundwater" },
      ]}
    />
  );
}
