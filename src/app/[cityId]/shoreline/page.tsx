import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import CoastalClient from "./coastal-client";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config || !config.hasShoreline) return { title: "Shoreline Change | Neer Vazhvu" };

  const title = `${config.displayName} Shoreline Change | Neer Vazhvu`;
  return {
    title,
    description: `Shoreline erosion and accretion along the ${config.displayName} coast (1990-2026): our own satellite measurement (MNDWI on Landsat + Sentinel-2), corroborated by Anagha, Singh & Frappart (2026). About 72% of the eroding coast is eroding faster than before.`,
    alternates: { canonical: `/${cityId}/shoreline` },
    openGraph: {
      title,
      description: `Where ${config.displayName}'s coast is eroding and how fast - a satellite shoreline-change measurement 1990-2026, with port-driven down-drift erosion and an acceleration check.`,
      type: "website",
      locale: "en_IN",
      siteName: "Neer Vazhvu",
      url: `https://neervazhvu.org/${cityId}/shoreline`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: `${config.displayName} coastal erosion/accretion 1990-2026; ~72% of the eroding coast is eroding faster than before.`,
    },
  };
}

export default async function CoastalPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  // Coastal feature is gated by capability flag: inland cities have no
  // shoreline surface.
  if (!config || !config.hasShoreline) notFound();
  return <CoastalClient />;
}
