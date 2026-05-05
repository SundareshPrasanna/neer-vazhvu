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
  if (!config) return { title: "Water Bodies | Neer Vazhvu" };
  return {
    title: `${config.displayName} Water Bodies | Neer Vazhvu`,
    alternates: { canonical: `/${cityId}/water-bodies` },
  };
}

export default async function CityWaterBodiesPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  return (
    <FeatureNotYetAvailable
      config={config}
      feature="Water bodies"
      scope="district-admin"
      parityVerdict="EASY"
      whatItShowsForChennai="305 census water bodies, current OSM polygons, lost-bodies overlay, restoration priority scoring, and a 12-flagship-lake satellite history (Sentinel-2 + CHIRPS via GEE)"
      dataGapNote="The First Census of Water Bodies dataset has Madurai-district records (~5,891 bodies; filter the existing CSV by district code 33). Famous temple tanks (Vandiyur Mariamman Teppakulam, Mariamman Teppakulam, Golden Lotus Tank) are already in OSM. The lake-restoration partnership angle would route through DHAN Foundation (Madurai HQ). Suggested 12 flagship water bodies for the GEE satellite series are documented in the parity research memory."
      relatedLinks={[
        { href: `/${cityId}`, label: `${config.displayName} home` },
        { href: `/${cityId}/groundwater`, label: "Groundwater stress map" },
      ]}
    />
  );
}
