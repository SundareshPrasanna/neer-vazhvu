"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Feature } from "geojson";
import { useLockBodyScroll } from "@/lib/hooks/use-lock-body-scroll";
import { useLanguage } from "@/lib/i18n/context";

interface ClientProps {
  cityId: string;
  cityDisplayName: string;
  mapCenter: [number, number];
  mapZoom?: number;
  /** Place pill scope label, e.g. "Vaigai system" */
  scopeLabel: string;
  /** Per-river narrative metadata, keyed by river_id from the geojson. */
  riverInfo: Record<string, RiverInfo>;
}

export interface RiverInfo {
  display_name: string;
  length_km_geom: number;
  description: string;
  upstream_terminus: string;
  downstream_terminus: string;
  feeds: string;
  status: string;
  cpcb_nwmp_stations: string[];
  /** Tailwind color class for the polyline. */
  color: string;
}

interface RiverGeoFeature {
  river_id: string;
  name: string;
  name_ta: string;
  length_km: number;
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString;
}

interface RiverGeoFile {
  features: Array<Feature<GeoJSON.LineString | GeoJSON.MultiLineString, {
    river_id?: string;
    name?: string;
    name_ta?: string;
    length_km?: number;
  }>>;
}

function MapLoading() {
  const { t } = useLanguage();
  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <span className="text-slate-500 dark:text-slate-400">{t("rivers_page.loading_map") || "Loading map..."}</span>
    </div>
  );
}

const RiversLeafletMap = dynamic(
  () => import("./rivers-leaflet-map").then((m) => m.RiversLeafletMap),
  { ssr: false, loading: () => <MapLoading /> },
);

export default function RiversClient({
  cityId,
  cityDisplayName,
  mapCenter,
  mapZoom = 9,
  scopeLabel,
  riverInfo,
}: ClientProps) {
  useLockBodyScroll();
  const [rivers, setRivers] = useState<RiverGeoFeature[]>([]);
  const [selectedRiverId, setSelectedRiverId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/geojson/${cityId}-rivers.geojson`)
      .then((r) => r.json())
      .then((data: RiverGeoFile) => {
        const out: RiverGeoFeature[] = [];
        for (const feat of data.features) {
          const p = feat.properties ?? {};
          if (!p.river_id || !p.name) continue;
          out.push({
            river_id: p.river_id,
            name: p.name,
            name_ta: p.name_ta ?? "",
            length_km: p.length_km ?? 0,
            geometry: feat.geometry,
          });
        }
        setRivers(out);
        // Pre-select Vaigai for Madurai (or whatever the first listed is).
        if (out.length > 0) setSelectedRiverId(out[0].river_id);
      })
      .catch(console.error);
  }, [cityId]);

  const selectedInfo = selectedRiverId ? riverInfo[selectedRiverId] : null;
  const selectedRiver = useMemo(
    () => rivers.find((r) => r.river_id === selectedRiverId) ?? null,
    [rivers, selectedRiverId],
  );

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Stats bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {cityDisplayName} · {scopeLabel}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {rivers.length} rivers · click a polyline for details
        </span>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map */}
        <div className="relative flex-1 h-full">
          <RiversLeafletMap
            rivers={rivers}
            selectedRiverId={selectedRiverId}
            onSelectRiver={setSelectedRiverId}
            mapCenter={mapCenter}
            mapZoom={mapZoom}
            riverInfo={riverInfo}
          />
        </div>

        {/* Detail sidebar */}
        <div className="hidden md:flex h-full md:w-96 lg:w-[420px] border-l border-slate-200 dark:border-slate-700 flex-col overflow-y-auto">
          {selectedInfo && selectedRiver ? (
            <RiverDetail
              info={selectedInfo}
              geomLengthKm={selectedRiver.length_km}
              nameTa={selectedRiver.name_ta}
            />
          ) : (
            <div className="p-4 text-sm text-slate-500">Click a river to see details.</div>
          )}
        </div>
      </div>

      {/* Mobile bottom panel */}
      {selectedInfo && selectedRiver && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 max-h-[40vh] overflow-y-auto">
          <RiverDetail
            info={selectedInfo}
            geomLengthKm={selectedRiver.length_km}
            nameTa={selectedRiver.name_ta}
          />
        </div>
      )}
    </div>
  );
}

function RiverDetail({
  info,
  geomLengthKm,
  nameTa,
}: {
  info: RiverInfo;
  geomLengthKm: number;
  nameTa: string;
}) {
  return (
    <div className="p-4 space-y-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {info.display_name}
        </h2>
        {nameTa && <p className="text-xs text-slate-500 italic">{nameTa}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2">
          <div className="text-[10px] uppercase text-slate-500">OSM length</div>
          <div className="font-semibold mt-0.5">{geomLengthKm.toFixed(0)} km</div>
        </div>
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2">
          <div className="text-[10px] uppercase text-slate-500">Status</div>
          <div className="font-semibold mt-0.5 truncate">{info.status}</div>
        </div>
      </div>

      <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        {info.description}
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <span className="text-slate-500 uppercase tracking-wider text-[10px] block">Upstream</span>
          <span className="text-slate-700 dark:text-slate-300">{info.upstream_terminus}</span>
        </div>
        <div>
          <span className="text-slate-500 uppercase tracking-wider text-[10px] block">Downstream</span>
          <span className="text-slate-700 dark:text-slate-300">{info.downstream_terminus}</span>
        </div>
        <div>
          <span className="text-slate-500 uppercase tracking-wider text-[10px] block">Feeds</span>
          <span className="text-slate-700 dark:text-slate-300">{info.feeds}</span>
        </div>
      </div>

      {info.cpcb_nwmp_stations.length > 0 && (
        <div>
          <div className="text-[10px] uppercase text-slate-500 tracking-wider mb-1">
            CPCB NWMP stations (planned)
          </div>
          <div className="flex flex-wrap gap-1">
            {info.cpcb_nwmp_stations.map((s) => (
              <span
                key={s}
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                {s}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 italic mt-1.5">
            Annual NWMP samples (BOD, DO, pH, fecal coliform) - data layer pending parser, mirrors Chennai&apos;s Cooum/Adyar pipeline.
          </p>
        </div>
      )}
    </div>
  );
}
