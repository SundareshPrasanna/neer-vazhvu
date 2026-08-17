import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeatureNotYetAvailable } from "@/components/layout/feature-not-yet-available";
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
  //
  // Pick the first enabled view, never a disabled one: a city excluded from
  // the CGWB block assessment (Mumbai: exploitation=false, only cgwbStations)
  // must NOT default to "exploitation", or the block base layer never loads
  // and the map hangs on "Loading map...". Such cities fall back to the
  // ward-based "depth" base, over which the CGWB station points render.
  const gv = config.groundwaterViews;

  // No enabled view at all -> honest named-gap state, never a blank map.
  // (Delhi at onboarding: every layer is India-IP-gated or pending the
  // current CGWB Year Book edition; the client would otherwise fall back
  // to the "depth" pipeline with no data behind it.)
  const anyView = !!gv && !!(gv.iisc || gv.exploitation || gv.depth || gv.risk || gv.cgwbStations);
  if (gv && !anyView) {
    return (
      <FeatureNotYetAvailable
        config={config}
        feature="Groundwater"
        scope="district-admin"
        routeKey="groundwater"
        whatItShowsForChennai="per-ward monthly depth survey, CGWB block exploitation status, and the ward risk composite"
        dataGapNote={
          config.groundwaterViews?.gapNote ??
          "No groundwater layer has publishable data for this city yet."
        }
        relatedLinks={[
          { href: `/${cityId}`, label: `${config.displayName} home` },
          { href: `/${cityId}/water-bodies`, label: "Water bodies map" },
        ]}
      />
    );
  }

  const initialViewMode = gv?.iisc
    ? "iisc"
    : gv?.exploitation
      ? "exploitation"
      : gv?.depth
        ? "depth"
        : gv?.risk
          ? "risk"
          : "depth";
  return <CityGroundwaterClient initialViewMode={initialViewMode} />;
}

