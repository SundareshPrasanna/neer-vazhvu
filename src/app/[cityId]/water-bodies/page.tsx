import { promises as fs } from "fs";
import path from "path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { FeatureNotYetAvailable } from "@/components/layout/feature-not-yet-available";
import WaterBodiesMapClient from "./water-bodies-map-client";
import { RichWaterBodiesContent } from "./rich-water-bodies-content";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Water Bodies | Neer Vazhvu" };
  return {
    title: `${config.displayName} Water Bodies | Neer Vazhvu`,
    description: `Lost tanks, named flagship water bodies, and restoration programmes for ${config.displayName}.`,
    alternates: { canonical: `/${cityId}/water-bodies` },
  };
}

interface LostBody {
  status: "Fully lost" | "Severely reduced" | "Partially encroached";
}

interface LostFile {
  summary: { fully_lost_count: number; severely_reduced_count: number };
  lost_bodies: LostBody[];
}

interface CurrentGeoJsonFeature {
  properties: { name?: string };
}

interface CurrentGeoJson {
  features: CurrentGeoJsonFeature[];
}

async function loadJson<T>(filename: string, dir: "data" | "geojson" = "data"): Promise<T | null> {
  try {
    const text = await fs.readFile(path.join(process.cwd(), "public", dir, filename), "utf-8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export default async function CityWaterBodiesPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  // Cities whose data supports the rich surface (tabs, ranking, census, ward
  // deep-linking, lost-bodies overlay, cascade/catchment atlas) get the
  // parametrized rich renderer. Selected by capability flag, not city id.
  if (config.waterBodies?.rankingTab) {
    return <RichWaterBodiesContent cityId={cityId} />;
  }

  const [lostFile, currentGeoJson] = await Promise.all([
    loadJson<LostFile>(`water-bodies-lost-${cityId}.json`, "data"),
    loadJson<CurrentGeoJson>(`${cityId}-water-bodies-current.geojson`, "geojson"),
  ]);

  // Fall back to the empty-state stub only when there is NOTHING to show.
  // Previously this required the lost-bodies study specifically, which hid a
  // perfectly good current-bodies map from any city whose vanished tanks had
  // not been researched yet (Surat: 3,401 mapped polygons, no lost study).
  // Losing a layer should cost that layer, not the page.
  if (!lostFile && !currentGeoJson) {
    return (
      <FeatureNotYetAvailable
        config={config}
        feature="Water bodies"
        scope="district-admin"
        parityVerdict="EASY"
        whatItShowsForChennai="305 census water bodies, current OSM polygons, lost-bodies overlay, restoration priority scoring, and a 12-flagship-lake satellite history"
        dataGapNote="No curated water-body data files for this city yet."
        relatedLinks={[
          { href: `/${cityId}`, label: `${config.displayName} home` },
          { href: `/${cityId}/groundwater`, label: "Groundwater stress map" },
        ]}
      />
    );
  }

  const namedOsmCount = currentGeoJson
    ? currentGeoJson.features.filter((f) => f.properties?.name).length
    : null;

  // Mumbai's drinking-water reservoirs sit 70-110 km NE of the city (Thane/
  // Palghar). A city-tight zoom hides them entirely, so the water-bodies +
  // catchment maps open on a wider regional frame that includes both the city
  // and its distant supply lakes ("expand the zone"). Users zoom in for the
  // in-city lakes. Other cities keep the city-tight default.
  const supplyShedView: Record<string, { center: [number, number]; zoom: number }> = {
    mumbai: { center: [19.3, 73.05], zoom: 10 },
  };
  const view = supplyShedView[cityId];

  return (
    <WaterBodiesMapClient
      cityId={cityId}
      cityDisplayName={config.displayName}
      cityState={config.stateCode}
      mapCenter={view ? view.center : [config.center.lat, config.center.lng]}
      mapZoom={view ? view.zoom : 11}
      fullyLostCount={lostFile?.summary.fully_lost_count}
      reducedCount={lostFile?.summary.severely_reduced_count}
      namedOsmCount={namedOsmCount}
      hasCascadeOverlay={config.hasCascadeOverlay ?? false}
      catchmentsGapNote={config.catchmentsGapNote}
    />
  );
}
