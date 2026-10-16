import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import CoastalClient from "./coastal-client";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

/** Per-city share-card copy, config like CITY_COPY in ./coastal-client (which
 *  is a client module, so its values cannot be read here). ogFinding ends the
 *  openGraph line; descriptionTail ends the meta description. A coast with no
 *  entry gets the plain measurement line. */
interface ShorelineShareCopy {
  ogFinding?: string;
  descriptionTail?: string;
}

const PLAIN_OG_FINDING = ", with an acceleration check";

const SHARE_COPY: Record<string, ShorelineShareCopy> = {
  // Chennai's study-backed findings: Ennore and Kattupalli down-drift erosion,
  // and the acceleration stat.
  chennai: {
    ogFinding: ", with port-driven down-drift erosion and an acceleration check",
    descriptionTail:
      " Corroborated by Anagha, Singh & Frappart (2026). About 72% of the eroding coast is eroding faster than before.",
  },
  // Mumbai keeps its earlier card unchanged; its page copy credits the beach
  // belt and reclamation rather than port down-drift (owner to decide).
  mumbai: {
    ogFinding: ", with port-driven down-drift erosion and an acceleration check",
  },
  visakhapatnam: { ogFinding: PLAIN_OG_FINDING },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config || !config.routes.includes("shoreline")) return { title: "Shoreline Change | Neer Vazhvu" };

  const title = `${config.displayName} Shoreline Change | Neer Vazhvu`;
  const share: ShorelineShareCopy = SHARE_COPY[cityId] ?? {};
  return {
    title,
    description: `Shoreline erosion and accretion along the ${config.displayName} coast (1990-2026): our own satellite measurement (MNDWI on Landsat + Sentinel-2).${share.descriptionTail ?? ""}`,
    alternates: { canonical: `/${cityId}/shoreline` },
    openGraph: {
      title,
      description: `Where ${config.displayName}'s coast is eroding and how fast - a satellite shoreline-change measurement 1990-2026${share.ogFinding ?? PLAIN_OG_FINDING}.`,
      type: "website",
      locale: "en_IN",
      siteName: "Neer Vazhvu",
      url: `https://neervazhvu.org/${cityId}/shoreline`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: `${config.displayName} coastal erosion/accretion 1990-2026, measured from open satellite data.`,
    },
  };
}

export default async function CoastalPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  // Coastal feature is gated by capability flag: inland cities have no
  // shoreline surface.
  if (!config || !config.routes.includes("shoreline")) notFound();
  return <CoastalClient cityId={cityId} />;
}
