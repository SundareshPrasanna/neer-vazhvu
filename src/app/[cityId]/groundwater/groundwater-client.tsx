"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { BlockDetailPanel } from "@/components/groundwater/block-detail-panel";
import { WrisStationPanel } from "@/components/groundwater/wris-station-panel";
import { GroundwaterLegend } from "@/components/groundwater/legend";
import { MapInfoButton } from "@/components/map/map-info-button";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { useLanguage } from "@/lib/i18n/context";
import { useLockBodyScroll } from "@/lib/hooks/use-lock-body-scroll";
import { getPlaceConfig, tryGetPlaceConfig, type PlaceConfig } from "@/lib/cities";
import type {
  GroundwaterWard,
  WardRiskData,
  GWBlock,
  WrisStation,
  WrisStationsResponse,
  ViewMode,
} from "@/types/groundwater";

function MapLoading() {
  const { t } = useLanguage();
  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <span className="text-slate-500 dark:text-slate-400">{t("gw_page.loading_map")}</span>
    </div>
  );
}

const WardMap = dynamic(
  () => import("@/components/groundwater/ward-map").then((m) => m.WardMap),
  { ssr: false, loading: () => <MapLoading /> },
);

// Empty maps - non-Chennai cities don't have ward-level GW or risk yet.
const EMPTY_WARD_DATA: Map<number, GroundwaterWard> = new Map();
const EMPTY_RISK_DATA: Map<number, WardRiskData> = new Map();

interface CityGwAssets {
  blocksJsonUrl: string;
  blockGeoJsonUrl: string;
  stationsJsonUrl: string;
  wardGeoJsonUrl: string;
  mapCenter: [number, number];
}

function assetsForCity(config: PlaceConfig): CityGwAssets {
  return {
    blocksJsonUrl: `/data/gwr-blocks-${config.cityId}.json`,
    blockGeoJsonUrl: `/geojson/${config.cityId}-gwr-blocks.geojson`,
    stationsJsonUrl: `/data/gw-stations-${config.cityId}.json`,
    wardGeoJsonUrl: `/geojson/${config.cityId}-wards-2022.geojson`,
    mapCenter: [config.center.lat, config.center.lng],
  };
}

export default function CityGroundwaterClient() {
  useLockBodyScroll();
  const { t } = useLanguage();
  const params = useParams<{ cityId: string }>();
  const cityId = params.cityId;
  const config = useMemo(() => tryGetPlaceConfig(cityId), [cityId]);

  const [blocks, setBlocks] = useState<GWBlock[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<GWBlock | null>(null);
  const [wrisStations, setWrisStations] = useState<WrisStation[]>([]);
  const [selectedWrisStation, setSelectedWrisStation] = useState<WrisStation | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Non-Chennai cities have block + station data only; depth/risk views are
  // hidden until ward-level GW data is available.
  const viewMode: ViewMode = "exploitation";

  const assets = useMemo(() => (config ? assetsForCity(config) : null), [config]);

  useEffect(() => {
    if (!assets) {
      setLoading(false);
      return;
    }
    Promise.all([
      fetch(assets.blocksJsonUrl).then((r) => r.json()),
      fetch(`/api/groundwater/stations?city=${encodeURIComponent(cityId)}`)
        .then((r) => r.json() as Promise<WrisStationsResponse>)
        .catch(() => ({ stations: [], totalStations: 0 } as WrisStationsResponse)),
    ])
      .then(([blocksRes, wrisRes]: [{ blocks?: GWBlock[] }, WrisStationsResponse]) => {
        setBlocks(blocksRes.blocks ?? []);
        // Pre-select most-exploited block to anchor the user.
        const sorted = [...(blocksRes.blocks ?? [])].sort(
          (a: GWBlock, b: GWBlock) => b.latest.development_pct - a.latest.development_pct,
        );
        if (sorted.length > 0) setSelectedBlock(sorted[0]);
        setWrisStations(wrisRes.stations ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [assets, cityId]);

  if (!config) {
    // Layout-level guard already 404s unknown cities; this is just a typesafety
    // fallback for the client-side render.
    return null;
  }

  const sortedBlocks = [...blocks].sort(
    (a, b) => b.latest.development_pct - a.latest.development_pct,
  );
  const overExploited = sortedBlocks.find((b) => b.latest.class === "Over Exploited");
  const critical = sortedBlocks.find((b) => b.latest.class === "Critical");
  const semiCount = sortedBlocks.filter((b) => b.latest.class === "Semi Critical").length;

  const headlinePhrases: string[] = [];
  if (overExploited) {
    headlinePhrases.push(
      `${overExploited.name} over-exploited at ${overExploited.latest.development_pct.toFixed(1)}%`,
    );
  }
  if (critical) {
    headlinePhrases.push(`${critical.name} critical at ${critical.latest.development_pct.toFixed(1)}%`);
  }
  if (semiCount > 0) headlinePhrases.push(`${semiCount} blocks semi-critical`);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Context bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-6 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {config.displayName} · CGWB block exploitation (GWR)
        </span>
        {headlinePhrases.length > 0 && (
          <span className="text-slate-500 dark:text-slate-400 text-xs">
            {headlinePhrases.join(" · ")}
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map area */}
        <div className="relative flex-1 h-full">
          {loading ? (
            <MapLoading />
          ) : (
            <WardMap
              groundwaterData={EMPTY_WARD_DATA}
              riskData={EMPTY_RISK_DATA}
              viewMode={viewMode}
              wrisStations={wrisStations}
              selectedWrisStationCode={selectedWrisStation?.stationCode ?? null}
              hiddenCategories={hiddenCategories}
              onWardSelect={() => {
                /* no-op for non-Chennai cities (no ward data) */
              }}
              onBlockSelect={(b) => {
                setSelectedBlock(b);
                setSelectedWrisStation(null);
              }}
              onWrisStationSelect={(s) => {
                setSelectedWrisStation(s);
                setSelectedBlock(null);
              }}
              blockGeoJsonUrl={assets!.blockGeoJsonUrl}
              blocksJsonUrl={assets!.blocksJsonUrl}
              stationsJsonUrl={assets!.stationsJsonUrl}
              wardGeoJsonUrl={assets!.wardGeoJsonUrl}
              mapCenter={assets!.mapCenter}
              mapZoom={10}
            />
          )}

          {/* Legend overlay */}
          <div
            className={`absolute sm:bottom-4 z-[1000] transition-[bottom] duration-300 left-2 right-auto md:left-auto md:right-4 ${
              selectedBlock ? "bottom-[148px] md:bottom-4" : "bottom-2"
            }`}
          >
            <GroundwaterLegend
              viewMode={viewMode}
              hiddenCategories={hiddenCategories}
              onToggleCategory={(cat) =>
                setHiddenCategories((prev) => {
                  const next = new Set(prev);
                  if (next.has(cat)) next.delete(cat);
                  else next.add(cat);
                  return next;
                })
              }
            />
          </div>

          {/* Info pill - source + ward-level gap call-out */}
          <MapInfoButton className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000]">
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{config.displayName}</span>{" "}
                ({config.stateCode})
              </div>
              <div>{t("gw_page.source_cgwb")}</div>
              {wrisStations.length > 0 ? (
                <div className="text-emerald-600 dark:text-emerald-400">
                  {wrisStations.length} CGWB stations live · click for depth + quality flag
                </div>
              ) : (
                <div className="text-amber-600 dark:text-amber-400">
                  Live station readings not yet ingested for {config.displayName} -
                  showing block-level CGWB classification only.
                </div>
              )}
            </div>
          </MapInfoButton>
        </div>

        {/* Detail panels - one open at a time */}
        {selectedBlock && (
          <BottomSheet onClose={() => setSelectedBlock(null)}>
            <BlockDetailPanel
              block={selectedBlock}
              onClose={() => setSelectedBlock(null)}
            />
          </BottomSheet>
        )}
        {selectedWrisStation && (
          <BottomSheet onClose={() => setSelectedWrisStation(null)}>
            <WrisStationPanel
              station={selectedWrisStation}
              onClose={() => setSelectedWrisStation(null)}
            />
          </BottomSheet>
        )}
      </div>
    </div>
  );
}

// Suppress unused warnings while the per-city config helpers stabilise.
void getPlaceConfig;
