import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { FeatureNotYetAvailable } from "@/components/layout/feature-not-yet-available";
import RiversClient, { type RiverInfo } from "./rivers-client";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Rivers | Neer Vazhvu" };
  return {
    title: `${config.displayName} Rivers | Neer Vazhvu`,
    description: `River-system map for ${config.displayName} - Vaigai mainstem, tributaries, and the cross-state Mullaperiyar feeder.`,
    alternates: { canonical: `/${cityId}/rivers` },
  };
}

// Per-city river narrative. Keyed by river_id from the geojson's properties.
// Madurai uses Vaigai-system scope (basin-wide) per
// project_madurai_scope_decision.md - Periyar (Kerala feeder) and the Vaigai
// downstream stretch through Sivagangai/Ramanathapuram are in scope.
const RIVER_INFO_BY_CITY: Record<string, Record<string, RiverInfo>> = {
  madurai: {
    vaigai: {
      display_name: "Vaigai",
      length_km_geom: 304,
      description:
        "Madurai's mainstem river. Receives ~80% of its flow from the Mullaperiyar trans-basin tunnel; less than 20% comes from its own catchment in the Megamalai/Cumbum hills. Drains 7,009 sq km across Theni, Dindigul, Madurai, Sivagangai, Ramanathapuram before reaching the Bay of Bengal.",
      upstream_terminus: "Periyar / Vaigai dam (Andipatti, Theni district)",
      downstream_terminus: "Bay of Bengal at Ramanathapuram (estuarine)",
      feeds: "Madurai city water supply; downstream irrigation command",
      status: "CPCB NWMP Priority III polluted stretch (Madurai-Manamadurai); textile-dyeing + sewage outfalls",
      cpcb_nwmp_stations: [
        "Vaigai dam reservoir",
        "Sellur (Madurai upstream)",
        "Anuppanadi (Madurai downstream)",
        "Andipatti",
        "Manamadurai (Sivagangai)",
        "Ramanathapuram (estuarine)",
      ],
      color: "stroke-blue-600",
    },
    periyar: {
      display_name: "Periyar (Kerala feeder)",
      length_km_geom: 121,
      description:
        "Kerala-side river that feeds Vaigai through the 1886 Mullaperiyar tunnel. The 999-year lease deed makes Periyar a TN-operated source even though the reservoir sits in Kerala's Idukki district. ~80% of Vaigai's annual yield originates here.",
      upstream_terminus: "Western Ghats (Idukki, Kerala)",
      downstream_terminus: "Mullaperiyar reservoir / Vaigai tunnel",
      feeds: "Vaigai dam via the Periyar tunnel diversion",
      status: "Politically charged - Kerala-TN dispute since 1979; SC 2014 caps storage at 142 ft",
      cpcb_nwmp_stations: [],
      color: "stroke-violet-600",
    },
    suruliyaru: {
      display_name: "Suruliyaru",
      length_km_geom: 72,
      description:
        "Tributary of Vaigai joining from the south (Theni district hills). Carries Western Ghats runoff during the SW monsoon, contributing to Vaigai dam inflows.",
      upstream_terminus: "Suruli falls / Cumbum valley (Theni)",
      downstream_terminus: "Joins Vaigai upstream of Vaigai dam",
      feeds: "Vaigai mainstem",
      status: "Less monitored; key SW-monsoon contributor",
      cpcb_nwmp_stations: [],
      color: "stroke-cyan-600",
    },
    manjalar: {
      display_name: "Manjalar",
      length_km_geom: 27,
      description:
        "Short Vaigai-basin tributary with its own dam (Manjalar Dam, Theni district) used for irrigation. Tilapia fishery noted in the reservoir.",
      upstream_terminus: "Theni hills",
      downstream_terminus: "Joins Vaigai system via Manjalar Dam",
      feeds: "Manjalar Dam command area",
      status: "Operational reservoir; minor monitoring",
      cpcb_nwmp_stations: [],
      color: "stroke-emerald-600",
    },
    varaha: {
      display_name: "Varaha (Varaha Nadhi)",
      length_km_geom: 117,
      description:
        "Vaigai-basin tributary; dammed at Sothuparai (Periyakulam taluk, Theni). Sothuparai is NOT on the daily TN Agri ARS portal so live storage data is PWD-memo-only.",
      upstream_terminus: "Theni hills (Periyakulam side)",
      downstream_terminus: "Joins Vaigai system via Sothuparai dam",
      feeds: "Sothuparai reservoir, downstream agriculture",
      status: "Operational; data gap on daily storage",
      cpcb_nwmp_stations: [],
      color: "stroke-amber-600",
    },
  },
};

export default async function CityRiversPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  const riverInfo = RIVER_INFO_BY_CITY[cityId];
  if (!riverInfo) {
    return (
      <FeatureNotYetAvailable
        config={config}
        feature="Rivers"
        scope="basin-system"
        parityVerdict="EASY"
        whatItShowsForChennai="3 rivers (Cooum, Adyar, Kosasthalaiyar) with CPCB NWMP annual quality samples, sewage inlets, pollution overlays from industrial sources"
        dataGapNote="No curated river-info config for this city yet."
        relatedLinks={[
          { href: `/${cityId}`, label: `${config.displayName} home` },
          { href: `/${cityId}/water-bodies`, label: "Water bodies map" },
        ]}
      />
    );
  }

  // Center map slightly south-west of the city so the Vaigai mainstem from
  // Theni dam through Madurai to Manamadurai/Ramanathapuram fits in view.
  const mapCenter: [number, number] = [config.center.lat - 0.1, config.center.lng - 0.2];

  return (
    <RiversClient
      cityId={cityId}
      cityDisplayName={config.displayName}
      mapCenter={mapCenter}
      mapZoom={9}
      scopeLabel="Vaigai system"
      riverInfo={riverInfo}
    />
  );
}
