import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { FeatureNotYetAvailable } from "@/components/layout/feature-not-yet-available";
import { FloodRiskContent } from "./flood-risk-content";
import { FLOOD_CONTENT } from "@/content/flood";
import { FloodMapPage } from "@/components/flood/flood-map-page";
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

  // Renderer is selected by declared variant or by what the city's flood
  // content declares, never by city id (docs/specs/multi-city-component-discipline.md
  // rule 3):
  //  - flood.variant 'interactive': the full hazard / historical / drainage /
  //    sewerage map (Chennai), reading `<cityId>-flood-*`.
  //  - a `map` in src/content/flood/<city>: a layer map with a text sidebar,
  //    for cities whose flood record is mapped registers (Bengaluru, Mumbai).
  //  - a narrative `config`: the card stack (Madurai), else not-yet-available.
  if (config.flood?.variant === "interactive") {
    return <InteractiveFloodContent cityId={cityId} />;
  }

  const content = FLOOD_CONTENT[config.cityId];
  if (content?.map) {
    return <FloodMapPage cityId={cityId} cityDisplayName={config.displayName} spec={content.map} />;
  }

  const cfg = content?.config;
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
