import { promises as fs } from "fs";
import path from "path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { FeatureNotYetAvailable } from "@/components/layout/feature-not-yet-available";
import { WaterBodiesClient, type LostNarrative } from "./water-bodies-client";

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

interface LostFile {
  summary: { fully_lost_count: number; severely_reduced_count: number };
  primary_source?: string | { citation?: string; name?: string };
  lost_bodies: LostNarrative[];
}

interface CurrentGeoJson {
  provenance?: { sources?: { publisher?: string }[] };
  features: unknown[];
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

  const [lostFile, currentGeoJson] = await Promise.all([
    loadJson<LostFile>(`water-bodies-lost-${cityId}.json`, "data"),
    loadJson<CurrentGeoJson>(`${cityId}-water-bodies-current.geojson`, "geojson"),
  ]);

  // Gate on the layer that DRAWS THE MAP, not on the optional lost-bodies register: a register
  // of lost water bodies is the rare artifact (none exists for Pune), the current layer the common one.
  if (!currentGeoJson && !lostFile) {
    return (
      <FeatureNotYetAvailable
        config={config}
        feature="Water bodies"
        scope="district-admin"
        routeKey="water-bodies"
        whatItShowsForChennai="305 census water bodies, current OSM polygons, lost-bodies overlay, restoration priority scoring, and a 12-flagship-lake satellite history"
        dataGapNote="No curated water-body data files for this city yet."
        relatedLinks={[
          { href: `/${cityId}`, label: `${config.displayName} home` },
          { href: `/${cityId}/groundwater`, label: "Groundwater stress map" },
        ]}
      />
    );
  }

  const ps = lostFile?.primary_source;
  const publishers = new Set(currentGeoJson?.provenance?.sources?.map((s) => s.publisher).filter(Boolean));
  return (
    <WaterBodiesClient
      cityId={cityId}
      existingCount={currentGeoJson?.features.length ?? null}
      lostSummary={lostFile ? { fullyLost: lostFile.summary.fully_lost_count, reduced: lostFile.summary.severely_reduced_count } : null}
      lostNarratives={(lostFile?.lost_bodies ?? []).map(({ name, status, side, note }) => ({ name, status, side, note }))}
      lostSource={(typeof ps === "string" ? ps : ps?.citation ?? ps?.name) ?? null}
      currentSource={[...publishers].join(", ") || null}
    />
  );
}
