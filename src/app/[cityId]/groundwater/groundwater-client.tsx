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

// Shape of public/data/ward-risk-{cityId}.json (output of
// scripts/compute-madurai-ward-risk.ts).
interface WardRiskFile {
  algorithm_version: string;
  weights: Record<string, number>;
  notes: string;
  wards: Array<{
    ward_number: number;
    composite_score: number | null;
    grade: "A" | "B" | "C" | "D" | "F" | "incomplete";
    pct_gw_depth: number | null;
    pct_wb_density: number | null;
    pct_wb_health: number | null;
    gw_depth_m: number | null;
    wb_count: number;
    wb_health_score: number | null;
  }>;
}

interface InterpolatedWardsResponse {
  asOf: string | null;
  method: string;
  cityAverage: number | null;
  wards: Array<{
    wardNumber: number;
    wardName: string;
    zone: string;
    depthM: number | null;
    trend: "improving" | "stable" | "declining" | "unknown";
    stationCount: number;
    meanDistanceKm: number | null;
  }>;
}

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
  const [interpolated, setInterpolated] = useState<InterpolatedWardsResponse | null>(null);
  const [riskFile, setRiskFile] = useState<WardRiskFile | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("exploitation");

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
      fetch(`/api/groundwater/wards-interpolated?city=${encodeURIComponent(cityId)}`)
        .then((r) => (r.ok ? (r.json() as Promise<InterpolatedWardsResponse>) : null))
        .catch(() => null),
      fetch(`/data/ward-risk-${cityId}.json`)
        .then((r) => (r.ok ? (r.json() as Promise<WardRiskFile>) : null))
        .catch(() => null),
    ])
      .then(([blocksRes, wrisRes, interpolatedRes, riskRes]: [
        { blocks?: GWBlock[] },
        WrisStationsResponse,
        InterpolatedWardsResponse | null,
        WardRiskFile | null,
      ]) => {
        setBlocks(blocksRes.blocks ?? []);
        // Pre-select most-exploited block to anchor the user.
        const sorted = [...(blocksRes.blocks ?? [])].sort(
          (a: GWBlock, b: GWBlock) => b.latest.development_pct - a.latest.development_pct,
        );
        if (sorted.length > 0) setSelectedBlock(sorted[0]);
        setWrisStations(wrisRes.stations ?? []);
        setInterpolated(interpolatedRes);
        setRiskFile(riskRes);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [assets, cityId]);

  const riskData = useMemo(() => {
    const m = new Map<number, WardRiskData>();
    if (!riskFile) return m;
    const gradeToLevel: Record<string, WardRiskData["riskLevel"]> = {
      A: "low",
      B: "moderate",
      C: "moderate",
      D: "high",
      F: "critical",
      incomplete: "noData",
    };
    for (const w of riskFile.wards) {
      m.set(w.ward_number, {
        wardNumber: w.ward_number,
        riskScore: w.composite_score ?? 0,
        riskLevel: gradeToLevel[w.grade] ?? "noData",
        groundwaterComponent: w.pct_gw_depth,
        trendComponent: null,
        reservoirComponent: w.pct_wb_density,
        seasonalComponent: w.pct_wb_health,
      });
    }
    return m;
  }, [riskFile]);

  const groundwaterData = useMemo(() => {
    const m = new Map<number, GroundwaterWard>();
    if (!interpolated) return m;
    for (const w of interpolated.wards) {
      m.set(w.wardNumber, {
        wardNumber: w.wardNumber,
        wardName: w.wardName,
        zone: w.zone,
        depthM: w.depthM,
        trend: w.trend,
      });
    }
    return m;
  }, [interpolated]);

  // Auto-promote to "depth" view if interpolated data is available - the
  // user lands on a richer choropleth instead of just the 4-block GWR map.
  useEffect(() => {
    if (interpolated && interpolated.wards.some((w) => w.depthM !== null)) {
      setViewMode("depth");
    }
  }, [interpolated]);

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
          {config.displayName} · {
            viewMode === "depth" ? "Ward depth (interpolated)" :
            viewMode === "risk" ? "Ward risk composite (3-factor)" :
            "CGWB block exploitation (GWR)"
          }
        </span>
        {viewMode === "exploitation" && headlinePhrases.length > 0 && (
          <span className="text-slate-500 dark:text-slate-400 text-xs">
            {headlinePhrases.join(" · ")}
          </span>
        )}
        {viewMode === "depth" && interpolated && (
          <span className="text-slate-500 dark:text-slate-400 text-xs">
            City avg {interpolated.cityAverage?.toFixed(1) ?? "-"} m below ground
            {interpolated.asOf && ` · as of ${interpolated.asOf}`}
          </span>
        )}
        {viewMode === "risk" && riskFile && (
          <span className="text-slate-500 dark:text-slate-400 text-xs">
            {riskFile.algorithm_version} · weights:{" "}
            {Object.entries(riskFile.weights)
              .map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`)
              .join(", ")}
          </span>
        )}
        {/* View-mode toggle - exposes whichever views have data ready. */}
        {(interpolated?.wards.some((w) => w.depthM !== null) || riskFile) && (
          <div className="ml-auto flex gap-1 text-xs">
            {interpolated?.wards.some((w) => w.depthM !== null) && (
              <button
                onClick={() => setViewMode("depth")}
                className={`px-2 py-0.5 rounded border ${
                  viewMode === "depth"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
                }`}
              >
                Depth (ward)
              </button>
            )}
            {riskFile && (
              <button
                onClick={() => setViewMode("risk")}
                className={`px-2 py-0.5 rounded border ${
                  viewMode === "risk"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
                }`}
              >
                Risk (composite)
              </button>
            )}
            <button
              onClick={() => setViewMode("exploitation")}
              className={`px-2 py-0.5 rounded border ${
                viewMode === "exploitation"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
              }`}
            >
              Exploitation (block)
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map area */}
        <div className="relative flex-1 h-full">
          {loading ? (
            <MapLoading />
          ) : (
            <WardMap
              groundwaterData={groundwaterData}
              riskData={riskData}
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
