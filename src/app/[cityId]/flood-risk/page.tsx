import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { FeatureNotYetAvailable } from "@/components/layout/feature-not-yet-available";
import { FloodRiskContent } from "./flood-risk-content";
import { FLOOD_CONTENT } from "@/content/flood";
import { FloodRiskBangaloreContent } from "./flood-risk-bangalore-content";
import { FloodRiskMumbaiContent } from "./flood-risk-mumbai-content";
import { InteractiveFloodContent } from "./interactive-flood-content";

interface PageProps {
  params: Promise<{ cityId: string }>;
}


export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Flood Risk | Neer Vazhvu" };
  return {
    title: `${config.displayName} Flood Risk | Neer Vazhvu`,
    description:
      FLOOD_CONTENT[config.cityId]?.metaDescription ??
      `Flood risk, historical floods, and monitoring sources for ${config.displayName}.`,
    alternates: { canonical: `/${cityId}/flood-risk` },
  };
}


export default async function CityFloodRiskPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  // Renderer is selected by declared variant, not city id (see
  // docs/specs/multi-city-component-discipline.md rule 3). Any city can
  // adopt any variant by setting `flood.variant` in its config.
  //
  //  - 'interactive': full interactive flood map (4 view modes -
  //    hazard/historical/drainage/sewerage, legend, detail panel, ward
  //    search, stats bar). City-agnostic; reads `<cityId>-flood-*`.
  //    The same content component also backs the flat /flood-risk route.
  //  - 'bangalore': distinct map-based page (KSRSAC hotspots + BBMP
  //    rajakaluve network) whose data shape differs from the interactive
  //    map (no single dam-release threshold; rainfall + drainage capacity
  //    is the driver).
  //  - 'narrative' / undefined: the Madurai-style narrative card stack
  //    (FLOOD_CONFIG_BY_CITY) or the not-yet-available placeholder.
  const variant = config.flood?.variant;

  if (variant === "interactive") {
    return <InteractiveFloodContent cityId={cityId} />;
  }

  if (variant === "bangalore") {
    return <FloodRiskBangaloreContent cityDisplayName={config.displayName} />;
  }

  // Mumbai's flooding is rainfall + high-tide + drainage driven (not a
  // dam-release threshold), with a distinct chronic-spot map - its own
  // component rather than the Madurai dam-release config shape.
  if (cityId === "mumbai") {
    return <FloodRiskMumbaiContent cityDisplayName={config.displayName} />;
  }

  const cfg = FLOOD_CONTENT[config.cityId]?.config;
  if (!cfg) {
    return (
      <FeatureNotYetAvailable
        config={config}
        feature="Flood risk"
        scope="basin-system"
        routeKey="flood-risk"
        whatItShowsForChennai="modeled flood hazard zones (5/10/25/50/100/200-year), 2015 + 2020 hotspots, drainage + sewerage overlays"
        dataGapNote="No flood-config data for this city yet."
        relatedLinks={[
          { href: `/${cityId}`, label: `${config.displayName} home` },
          { href: `/${cityId}/groundwater`, label: "Groundwater stress map" },
        ]}
      />
    );
  }

  return (
    <FloodRiskContent
      cityId={cityId}
      cityDisplayName={config.displayName}
      cfg={cfg}
    />
  );
}
