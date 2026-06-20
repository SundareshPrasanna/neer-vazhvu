import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import CityGroundwaterClient from "./groundwater-client";
import ChennaiGroundwaterClient from "./chennai-groundwater-client";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Groundwater | Neer Vazhvu" };
  // Cities on the authoritative per-ward survey (Chennai) describe their
  // ward-level depth coverage; the block-level CGWB cities describe the GWR
  // assessment. Keyed off the same capability that selects the renderer.
  const description = config.dashboard?.groundwaterSnapshot
    ? `Monitor groundwater depth across ${config.displayName}'s ${config.localGovernment.wardCount} wards. Track water table trends, identify stressed zones, and explore ward-level data on an interactive map.`
    : `CGWB Dynamic Groundwater Resource Assessment for ${config.displayName} - block-level stress classification and CGWB station coverage.`;
  return {
    title: `${config.displayName} Groundwater | Neer Vazhvu`,
    description,
    alternates: { canonical: `/${cityId}/groundwater` },
  };
}

export default async function CityGroundwaterPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  // Renderer is selected by a declared capability, not a city id (see
  // docs/specs/multi-city-component-discipline.md rule 3 - variant by a
  // named config signal, mirroring how flood-risk picks flood.variant).
  //
  // Chennai's groundwater is fed by a fundamentally different data pipeline:
  // an authoritative OpenCity per-ward monthly survey (/api/groundwater) +
  // Supabase ward_risk_score (/api/groundwater/risk) + legacy unprefixed
  // gwr-blocks.json. The shared CityGroundwaterClient was built for the
  // sparse-station IDW pipeline (wards-interpolated + static ward-risk-<city>
  // + <city>-prefixed blocks) and cannot reach those sources for Chennai.
  //
  // dashboard.groundwaterSnapshot is the documented "dense per-ward GW data"
  // capability flag (src/lib/cities/types.ts) - exactly the prerequisite the
  // authoritative renderer needs - so any city that lands that pipeline opts
  // in by setting it, without a cityId check here.
  if (config.dashboard?.groundwaterSnapshot) {
    return <ChennaiGroundwaterClient />;
  }

  // Pre-resolve the default tab server-side so SSR renders with the correct
  // active button styling. Without this, useParams() returns empty on SSR
  // and the client falls back to "exploitation" before snapping to "iisc"
  // after hydration, producing a visible flicker for Bangalore visitors.
  const initialViewMode = config.groundwaterViews?.iisc ? "iisc" : "exploitation";
  return <CityGroundwaterClient initialViewMode={initialViewMode} />;
}

