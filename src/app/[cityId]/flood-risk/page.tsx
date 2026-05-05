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
  if (!config) return { title: "Flood Risk | Neer Vazhvu" };
  return { title: `${config.displayName} Flood Risk | Neer Vazhvu` };
}

export default async function CityFloodRiskPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  // Per scope decision: flood-risk uses Vaigai-system scope. The story is
  // dam-release-driven - 2023 Madurai inundation came from a 6,000 cusec
  // Vaigai release. Without curated hazard maps for Madurai, the eventual
  // page will be lighter than Chennai's: dam-release tracking + CWC
  // Andipatti gauge + master-plan flood zones (PDF-extracted).

  return (
    <FeatureNotYetAvailable
      config={config}
      feature="Flood risk"
      scope="basin-system"
      parityVerdict="HARD"
      whatItShowsForChennai="modeled flood hazard zones (5/10/25/50/100/200-year return periods), 2015 + 2020 hotspot inventories, drainage network (8,092 SWD segments), and sewerage infrastructure overlays - all from OpenCity / GCC sources"
      dataGapNote="Madurai has no public CFM-DSS-equivalent sensor network. The closest substitutes are CWC's Vaigai-Andipatti dam gauge (during NE monsoon) + the Madurai Master Plan 2024-2044 flood-prone zones (PDF, manual digitisation). 2023 Vaigai-release inundation hotspots would need RTI to MMC. The page when built will explicitly badge as 'Vaigai system' since dam releases drive Madurai inundation."
      relatedLinks={[
        { href: `/${cityId}`, label: `${config.displayName} home (Vaigai dam)` },
        { href: `/${cityId}/groundwater`, label: "Groundwater stress map" },
      ]}
    />
  );
}
