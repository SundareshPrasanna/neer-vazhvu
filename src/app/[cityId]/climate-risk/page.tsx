import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { FeatureNotYetAvailable } from "@/components/layout/feature-not-yet-available";
import { ClimateRiskContent } from "./climate-risk-content";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Climate Risk | Neer Vazhvu" };
  return {
    title: `${config.displayName} Climate Risk | Neer Vazhvu`,
    description: `Sub-basin climate-induced water risk (hazard, exposure, vulnerability) for ${config.displayName}, from the TNGCC + CEEW 2026 risk index.`,
    alternates: { canonical: `/${cityId}/climate-risk` },
  };
}

export default async function CityClimateRiskPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  // Gated by declared capability, not city id (multi-city-component-discipline
  // rule 3). Any city that publishes a sub-basin risk index opts in via
  // `climateRisk` in its config + a `<cityId>-sub-basins-risk.geojson`.
  if (!config.climateRisk) {
    return (
      <FeatureNotYetAvailable
        config={config}
        feature="Climate risk"
        scope="basin-system"
        parityVerdict="HARD"
        whatItShowsForChennai="sub-basin climate-risk index (hazard x exposure x vulnerability) across the six Chennai sub-basins, with per-sub-basin driver breakdowns"
        dataGapNote="No published sub-basin risk index for this city yet."
        relatedLinks={[
          { href: `/${cityId}`, label: `${config.displayName} home` },
          { href: `/${cityId}/flood-risk`, label: "Flood risk" },
        ]}
      />
    );
  }

  return <ClimateRiskContent cityId={cityId} />;
}
