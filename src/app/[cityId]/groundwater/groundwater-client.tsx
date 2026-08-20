"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { BlockDetailPanel } from "@/components/groundwater/block-detail-panel";
import { WrisStationPanel } from "@/components/groundwater/wris-station-panel";
import { CgwbStationPanel } from "@/components/groundwater/cgwb-station-panel";
import { GroundwaterLegend } from "@/components/groundwater/legend";
import { MapInfoButton } from "@/components/map/map-info-button";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { useLanguage } from "@/lib/i18n/context";
import { useLockBodyScroll } from "@/lib/hooks/use-lock-body-scroll";
import { getPlaceConfig, tryGetPlaceConfig, type PlaceConfig } from "@/lib/cities";
import { wardsGeoJsonPathFor } from "@/lib/cities/wards-vintage";
import type {
  GroundwaterWard,
  WardRiskData,
  GWBlock,
  WrisStation,
  WrisStationsResponse,
  ViewMode,
  CgwbStation,
  CgwbStationsFile,
} from "@/types/groundwater";

/** Resolve which GW view layers a city has enabled, falling back to legacy
 *  "all views" behaviour when groundwaterViews is undefined on the place
 *  config. Each flag is a feature toggle for the matching view in the
 *  view-mode bar; cgwbStations gates the CGWB Year Book point overlay
 *  load and rendering. See PlaceConfig.groundwaterViews docs. */
function resolveGwViews(config: PlaceConfig | undefined | null) {
  const v = config?.groundwaterViews;
  return {
    exploitation: v?.exploitation ?? true,
    depth: v?.depth ?? true,
    risk: v?.risk ?? true,
    cgwbStations: v?.cgwbStations ?? false,
    iisc: v?.iisc ?? false,
  };
}

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

const IIScStressWardsMap = dynamic(
  () =>
    import("@/components/dashboard/iisc-stress-wards-map").then(
      (m) => m.IIScStressWardsMap,
    ),
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
    centroid_latlng?: [number, number];
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
    wardGeoJsonUrl: wardsGeoJsonPathFor(config.cityId),
    mapCenter: [config.center.lat, config.center.lng],
  };
}

interface CityGroundwaterClientProps {
  /** Server-resolved default tab. Bangalore gets "iisc"; other cities
   *  get "exploitation". See page.tsx for the resolution. */
  initialViewMode: ViewMode;
}

export default function CityGroundwaterClient({
  initialViewMode,
}: CityGroundwaterClientProps) {
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
  const [cgwbFile, setCgwbFile] = useState<CgwbStationsFile | null>(null);
  const [selectedCgwbStation, setSelectedCgwbStation] = useState<CgwbStation | null>(null);
  // Default tab is resolved server-side and passed in via `initialViewMode`.
  // `explicitViewMode` tracks any subsequent user click; until then the
  // effective viewMode is the server-supplied default. The derived-state
  // pattern (rather than a useEffect that calls setState) keeps the
  // project's react-hooks/set-state-in-effect rule happy.
  const [explicitViewMode, setExplicitViewMode] = useState<ViewMode | null>(null);
  const viewMode: ViewMode = explicitViewMode ?? initialViewMode;
  const setViewMode = setExplicitViewMode;
  const [selectedWard, setSelectedWard] = useState<GroundwaterWard | null>(null);

  const gwViews = useMemo(() => resolveGwViews(config), [config]);
  const usesCgwbYearbook = gwViews.cgwbStations;
  const assets = useMemo(() => (config ? assetsForCity(config) : null), [config]);


  useEffect(() => {
    if (!assets) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    Promise.all([
      // Cities without a curated gwr-blocks JSON (Bangalore today) get
      // an empty-blocks fallback instead of letting the .json() parse on
      // the 404 HTML body reject the whole Promise.all and leave the map
      // stuck in a loading state.
      fetch(assets.blocksJsonUrl)
        .then((r) => (r.ok ? (r.json() as Promise<{ blocks?: GWBlock[] }>) : { blocks: [] }))
        .catch(() => ({ blocks: [] })),
      fetch(`/api/groundwater/stations?city=${encodeURIComponent(cityId)}`)
        .then((r) => r.json() as Promise<WrisStationsResponse>)
        .catch(() => ({ stations: [], totalStations: 0 } as WrisStationsResponse)),
      // Pull the block geojson too so we can scope auto-selection to
      // blocks that actually have a polygon on the map. Madurai's data
      // file lists 66 CGWB blocks across the whole district while only
      // 11 are inside MMC and rendered - without this filter the page
      // would auto-select an off-map block on first load.
      fetch(assets.blockGeoJsonUrl)
        .then((r) => (r.ok ? (r.json() as Promise<GeoJSON.FeatureCollection>) : null))
        .catch(() => null),
      // Skip data fetches for views the city has turned off in its
      // PlaceConfig.groundwaterViews. Saves one network round-trip per
      // disabled layer and keeps the page from briefly flashing data
      // we'd then suppress at render time.
      gwViews.depth
        ? fetch(`/api/groundwater/wards-interpolated?city=${encodeURIComponent(cityId)}`)
            .then((r) => (r.ok ? (r.json() as Promise<InterpolatedWardsResponse>) : null))
            .catch(() => null)
        : Promise.resolve(null),
      gwViews.risk
        ? fetch(`/data/ward-risk-${cityId}.json`)
            .then((r) => (r.ok ? (r.json() as Promise<WardRiskFile>) : null))
            .catch(() => null)
        : Promise.resolve(null),
      gwViews.cgwbStations
        ? fetch(`/data/${cityId}-cgwb-stations.json`)
            .then((r) => (r.ok ? (r.json() as Promise<CgwbStationsFile>) : null))
            .catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([blocksRes, wrisRes, geoRes, interpolatedRes, riskRes, cgwbRes]: [
        { blocks?: GWBlock[] },
        WrisStationsResponse,
        GeoJSON.FeatureCollection | null,
        InterpolatedWardsResponse | null,
        WardRiskFile | null,
        CgwbStationsFile | null,
      ]) => {
        setBlocks(blocksRes.blocks ?? []);
        // Pre-select most-exploited block to anchor the user - but only
        // among blocks whose polygon is on the rendered map. Otherwise
        // the panel can describe a block the user can't visually find
        // (e.g. Madurai's "Sindhupatti" block is in the data file but
        // outside MMC, so it has no polygon).
        const onMapNames = geoRes
          ? new Set(
              geoRes.features
                .map((f) => {
                  const p = f.properties as Record<string, unknown> | null;
                  return String(p?.block ?? p?.name ?? "").trim();
                })
                .filter((n) => n.length > 0),
            )
          : null;
        const candidateBlocks = (blocksRes.blocks ?? []).filter((b) =>
          onMapNames ? onMapNames.has(b.name) : true,
        );
        const sorted = [...candidateBlocks].sort(
          (a: GWBlock, b: GWBlock) => b.latest.development_pct - a.latest.development_pct,
        );
        // Auto-open the highest-stress block in the BlockDetailPanel so the
        // page has visible content on first load. Skip when the default tab
        // is the IISc Outlook view (Bangalore today) - the block panel
        // would render on the right and contradict the active tab.
        if (sorted.length > 0 && initialViewMode !== "iisc") {
          setSelectedBlock(sorted[0]);
        }
        setWrisStations(wrisRes.stations ?? []);
        setInterpolated(interpolatedRes);
        setRiskFile(riskRes);
        setCgwbFile(cgwbRes);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [assets, cityId, gwViews.depth, gwViews.risk, gwViews.cgwbStations, initialViewMode]);

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

  // Auto-promote to "depth" view if interpolated data is available and
  // the city has the depth view enabled - the user lands on a richer
  // choropleth instead of just the GWR-block map. Cities that disable
  // the depth view (e.g. those with sparse stations relying on the
  // CGWB Year Book point overlay instead) keep the block-exploitation
  // default.
  useEffect(() => {
    if (!gwViews.depth) return;
    if (interpolated && interpolated.wards.some((w) => w.depthM !== null)) {
      // Auto-promote view-mode after interpolated data lands, so the
      // initial 'exploitation' default flips to 'depth' for cities
      // that have ward depth data. Intentional async reaction.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewMode("depth");
    }
  }, [interpolated, gwViews.depth, setViewMode]);

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

  // Actual reading span across the CGWB wells, so the banner label is honest
  // per city (Mumbai runs May 2022 -> Jan 2025; Madurai differs).
  const MONTH_ABBR = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const cgwbReadings = (cgwbFile?.wells ?? []).flatMap((w) => w.readings);
  const cgwbSpan = cgwbReadings.length
    ? (() => {
        const keyed = cgwbReadings.map((r) => ({ k: r.year * 100 + r.month, r }));
        const lo = keyed.reduce((a, b) => (b.k < a.k ? b : a)).r;
        const hi = keyed.reduce((a, b) => (b.k > a.k ? b : a)).r;
        return `${MONTH_ABBR[lo.month]} ${lo.year} - ${MONTH_ABBR[hi.month]} ${hi.year}`;
      })()
    : "";

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

  // The exploitation view needs BLOCKS, not just a config flag. The depth and
  // risk toggles below already gate on their data having loaded; this one did
  // not, and the two cities whose IN-GRES assessment is DISTRICT-level rather
  // than block-level both shipped with `exploitation: true` and an empty
  // `blocks` array. The result was a page titled "CGWB block exploitation
  // (GWR)" drawing a percent-scale legend over either nothing at all
  // (Gurugram: no station layer either, so a bare basemap) or over markers
  // coloured by DEPTH IN METRES (Surat) - two different quantities under one
  // legend. Gate it the same way as its siblings.
  const hasExploitation = gwViews.exploitation && blocks.length > 0;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Context bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-6 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {config.displayName} - {
            viewMode === "depth" ? "Ward depth (interpolated)" :
            viewMode === "risk" ? "Ward risk composite (3-factor)" :
            hasExploitation ? "CGWB block exploitation (GWR)" :
            usesCgwbYearbook ? "CGWB Year Book stations" :
            "Groundwater"
          }
        </span>
        {viewMode === "exploitation" && hasExploitation && headlinePhrases.length > 0 && (
          <span className="text-slate-500 dark:text-slate-400 text-xs">
            {headlinePhrases.join(" - ")}
          </span>
        )}
        {usesCgwbYearbook && cgwbFile && (
          <span className="text-slate-500 dark:text-slate-400 text-xs">
            {cgwbFile.wells.length} {cgwbFile.series_label ?? "CGWB Year Book"} stations ·{" "}
            {cgwbFile.reading_kind ?? "seasonal readings"}
            {cgwbSpan ? ` ${cgwbSpan}` : ""}
          </span>
        )}
        {viewMode === "depth" && interpolated && (
          <span className="text-slate-500 dark:text-slate-400 text-xs">
            City avg {interpolated.cityAverage?.toFixed(1) ?? "-"} m below ground
            {interpolated.asOf && ` - as of ${interpolated.asOf}`}
          </span>
        )}
        {viewMode === "risk" && riskFile && (
          <span className="text-slate-500 dark:text-slate-400 text-xs">
            {riskFile.algorithm_version} - weights:{" "}
            {Object.entries(riskFile.weights)
              .map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`)
              .join(", ")}
          </span>
        )}
        {/* View-mode toggle - each button is gated by both (a) the city's
            groundwaterViews feature flag and (b) the underlying data being
            available. A view is rendered only when both are true; cities
            that disable a view in their PlaceConfig don't see the toggle. */}
        {(
          (gwViews.depth && interpolated?.wards.some((w) => w.depthM !== null)) ||
          (gwViews.risk && riskFile) ||
          gwViews.iisc
        ) && (
          <div className="ml-auto flex gap-1 text-xs">
            {gwViews.depth && interpolated?.wards.some((w) => w.depthM !== null) && (
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
            {gwViews.risk && riskFile && (
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
            {hasExploitation && (
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
            )}
            {gwViews.iisc && (
              <button
                onClick={() => setViewMode("iisc")}
                className={`px-2 py-0.5 rounded border ${
                  viewMode === "iisc"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
                }`}
              >
                IISc Outlook (ward)
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map area */}
        <div className="relative flex-1 h-full">
          {loading ? (
            <MapLoading />
          ) : viewMode === "iisc" ? (
            // IIScStressWardsMap is a vertical layout (header + map +
            // grouped-by-corporation ward list). The /groundwater wrapper
            // is overflow-hidden for the panel-style WardMap layout, so we
            // give the IISc branch its own scrolling container.
            <div className="h-full overflow-y-auto bg-white dark:bg-slate-950">
              <div className="p-4">
                <IIScStressWardsMap />
              </div>
            </div>
          ) : (
            <WardMap
              groundwaterData={groundwaterData}
              riskData={riskData}
              viewMode={viewMode}
              wrisStations={wrisStations}
              cgwbStations={cgwbFile?.wells ?? []}
              selectedWrisStationCode={selectedWrisStation?.stationCode ?? null}
              selectedCgwbStationName={selectedCgwbStation?.name ?? null}
              hiddenCategories={hiddenCategories}
              onWardSelect={(w) => {
                setSelectedWard(w);
                setSelectedBlock(null);
                setSelectedWrisStation(null);
                setSelectedCgwbStation(null);
              }}
              onBlockSelect={(b) => {
                setSelectedBlock(b);
                setSelectedWrisStation(null);
                setSelectedCgwbStation(null);
              }}
              onWrisStationSelect={(s) => {
                setSelectedWrisStation(s);
                setSelectedBlock(null);
                setSelectedCgwbStation(null);
              }}
              onCgwbStationSelect={(s) => {
                setSelectedCgwbStation(s);
                setSelectedBlock(null);
                setSelectedWrisStation(null);
              }}
              blockGeoJsonUrl={assets!.blockGeoJsonUrl}
              blocksJsonUrl={assets!.blocksJsonUrl}
              stationsJsonUrl={assets!.stationsJsonUrl}
              wardGeoJsonUrl={assets!.wardGeoJsonUrl}
              mapCenter={assets!.mapCenter}
              mapZoom={10}
              cityId={cityId}
            />
          )}

          {/* Legend overlay - IISc view has its own legend baked into
              IIScStressWardsMap, so the GroundwaterLegend (which only
              models depth / risk / exploitation) is hidden for that mode. */}
          {viewMode !== "iisc" && (viewMode !== "exploitation" || hasExploitation) && (
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
          )}

          {/* Info pill - source + ward-level gap call-out */}
          <MapInfoButton className="absolute top-20 left-2.5 z-[1000]">
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{config.displayName}</span>{" "}
                ({config.stateCode})
              </div>
              <div>{t("gw_page.source_cgwb")}</div>
              {usesCgwbYearbook && cgwbFile ? (
                <div className="text-emerald-600 dark:text-emerald-400">
                  {cgwbFile.wells.length} {cgwbFile.series_label ?? "CGWB Year Book"} stations -{" "}
                  {cgwbFile.reading_kind ?? "quarterly readings"}, click for hydrograph
                </div>
              ) : wrisStations.length > 0 ? (
                <div className="text-emerald-600 dark:text-emerald-400">
                  {wrisStations.length} CGWB stations live - click for depth + quality flag
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

        {/* Detail panels - one open at a time. None of these are meaningful
            on the IISc Outlook tab (which has its own click interactions
            baked into IIScStressWardsMap), so we suppress them while that
            view is active. */}
        {viewMode !== "iisc" && selectedBlock && (
          <BottomSheet onClose={() => setSelectedBlock(null)}>
            <BlockDetailPanel
              block={selectedBlock}
              onClose={() => setSelectedBlock(null)}
            />
          </BottomSheet>
        )}
        {viewMode !== "iisc" && selectedWrisStation && (
          <BottomSheet onClose={() => setSelectedWrisStation(null)}>
            <WrisStationPanel
              station={selectedWrisStation}
              onClose={() => setSelectedWrisStation(null)}
            />
          </BottomSheet>
        )}
        {viewMode !== "iisc" && selectedCgwbStation && (
          <BottomSheet onClose={() => setSelectedCgwbStation(null)}>
            <CgwbStationPanel
              station={selectedCgwbStation}
              onClose={() => setSelectedCgwbStation(null)}
              seriesLabel={cgwbFile?.series_label}
              unitLabel={cgwbFile?.unit_label}
              sourceNote={
                cgwbFile?.source_label
                  ? // The measurement description is per-file: Madurai and
                    // Mumbai are manually-read dug wells on the CGWB seasonal
                    // calendar, Delhi is 6-hourly telemetric piezometers, and
                    // asserting the former for both would be wrong.
                    `Source: ${cgwbFile.source_label}. ${
                      cgwbFile.cadence_note ??
                      "Phreatic (unconfined) aquifer dug well, manual seasonal measurement (May / Aug / Nov / Jan)."
                    } ${cgwbFile.quality_note ?? ""}`
                  : undefined
              }
            />
          </BottomSheet>
        )}
        {viewMode !== "iisc" && selectedWard && (
          <BottomSheet onClose={() => setSelectedWard(null)}>
            <WardDepthPanel
              ward={selectedWard}
              wrisStations={wrisStations}
              cgwbWells={cgwbFile?.wells ?? []}
              riskWard={riskFile?.wards.find((w) => w.ward_number === selectedWard.wardNumber) ?? null}
              onSelectStation={(s) => {
                setSelectedWrisStation(s);
                setSelectedWard(null);
              }}
              onSelectCgwbWell={(w) => {
                setSelectedCgwbStation(w);
                setSelectedWard(null);
              }}
              onClose={() => setSelectedWard(null)}
            />
          </BottomSheet>
        )}
      </div>
    </div>
  );
}

/* ── ward depth detail panel ────────────────────────────────────────
   Surfaces the contributing CGWB stations for the clicked ward, sorted
   by distance from the ward centroid. Clicking any station opens the
   existing WrisStationPanel which has the time-series chart. */

function haversineKmLocal(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function WardDepthPanel({
  ward,
  wrisStations,
  cgwbWells,
  riskWard,
  onSelectStation,
  onSelectCgwbWell,
  onClose,
}: {
  ward: GroundwaterWard;
  wrisStations: WrisStation[];
  /** Static Year Book wells - the contributing stations for cities whose
   *  depth surface interpolates from the curated CGWB file (Mumbai) rather
   *  than live WRIS stations (Chennai/Madurai). */
  cgwbWells: CgwbStation[];
  riskWard: WardRiskFile["wards"][number] | null;
  onSelectStation: (s: WrisStation) => void;
  onSelectCgwbWell: (w: CgwbStation) => void;
  onClose: () => void;
}) {
  // Compute the nearest contributing stations using ward centroid from
  // the risk file (which carries centroid_latlng). If risk data is absent
  // we fall back to the city-wide list ranked alphabetically.
  const centroid: [number, number] | null = riskWard?.centroid_latlng ?? null;
  const ranked = centroid
    ? [...wrisStations]
        .filter((s) => typeof s.latitude === "number" && typeof s.longitude === "number")
        .map((s) => ({
          station: s,
          distKm: haversineKmLocal(centroid, [s.latitude as number, s.longitude as number]),
        }))
        .sort((a, b) => a.distKm - b.distKm)
        .slice(0, 4)
    : wrisStations.slice(0, 4).map((s) => ({ station: s, distKm: null as number | null }));
  // Cities without live WRIS stations (Mumbai) interpolate from the curated
  // Year Book wells instead - list those as the contributing stations, and
  // clicking opens the well's seasonal-history panel.
  const usesCgwbFallback = wrisStations.length === 0 && cgwbWells.length > 0;
  const rankedCgwb = usesCgwbFallback
    ? (centroid
        ? [...cgwbWells]
            .map((w) => ({ well: w, distKm: haversineKmLocal(centroid, [w.lat, w.lng]) }))
            .sort((a, b) => a.distKm - b.distKm)
            .slice(0, 4)
        : cgwbWells.slice(0, 4).map((w) => ({ well: w, distKm: null as number | null })))
    : [];

  return (
    <div className="bg-white dark:bg-slate-900 w-full p-4 sm:p-5 overflow-y-auto">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
            Ward {ward.wardNumber}
          </h3>
          {ward.zone && <div className="text-xs text-slate-500">{ward.zone}</div>}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
          aria-label="Close panel"
        >
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2">
          <div className="text-[10px] uppercase text-slate-500">Interpolated depth</div>
          <div className="font-semibold mt-0.5 text-base">
            {ward.depthM !== null ? `${ward.depthM.toFixed(1)} m` : "no data"}
          </div>
          <div className="text-[10px] text-slate-500">below ground level</div>
        </div>
        {riskWard && (
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2">
            <div className="text-[10px] uppercase text-slate-500">Risk grade</div>
            <div className="font-semibold mt-0.5 text-base">
              {riskWard.grade === "incomplete" ? "—" : riskWard.grade}
            </div>
            <div className="text-[10px] text-slate-500">
              {riskWard.composite_score !== null ? `${riskWard.composite_score}/100 composite` : "incomplete"}
            </div>
          </div>
        )}
      </div>

      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
        {usesCgwbFallback
          ? "Contributing Year Book wells - click for seasonal history"
          : "Contributing stations - click for time series"}
      </div>
      {ranked.length === 0 && !usesCgwbFallback && (
        <p className="text-xs text-slate-500">No CGWB stations within range of this ward.</p>
      )}
      {usesCgwbFallback && (
        <div className="space-y-1.5">
          {rankedCgwb.map(({ well, distKm }) => {
            const latest = well.readings[well.readings.length - 1];
            return (
              <button
                key={well.name}
                onClick={() => onSelectCgwbWell(well)}
                className="w-full text-left border border-slate-200 dark:border-slate-700 rounded-md p-2 hover:border-blue-400 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{well.name}</span>
                  {distKm != null && (
                    <span className="text-[10px] text-slate-500 shrink-0">{distKm.toFixed(1)} km</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500">
                  {well.block}
                  {latest ? ` · ${latest.depth_m_bgl} m bgl (${latest.year}-${String(latest.month).padStart(2, "0")})` : ""}
                </div>
              </button>
            );
          })}
        </div>
      )}
      <div className="space-y-1.5">
        {ranked.map(({ station, distKm }) => (
          <button
            key={station.stationCode}
            onClick={() => onSelectStation(station)}
            className="w-full text-left border border-slate-200 dark:border-slate-700 rounded-md p-2 hover:border-blue-400 transition-colors"
          >
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {station.stationName}
              </span>
              {distKm !== null && (
                <span className="text-[10px] font-mono text-slate-500">
                  {distKm.toFixed(1)} km
                </span>
              )}
            </div>
            <div className="flex items-baseline justify-between gap-2 text-[11px] mt-0.5">
              <span className="text-slate-500">
                {station.acquisitionMode}
                {station.wellAquiferType && ` - ${station.wellAquiferType}`}
              </span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {Math.abs(station.latestDepthM).toFixed(1)} m
                <span className="text-slate-400 ml-1">({station.latestDate})</span>
              </span>
            </div>
          </button>
        ))}
      </div>

      <p className="text-[10px] text-slate-400 italic mt-3">
        Ward depth is interpolated from the four nearest CGWB stations
        within 15 km of the ward centroid. Click a station above to open
        its full reading history.
      </p>
    </div>
  );
}

// Suppress unused warnings while the per-city config helpers stabilise.
void getPlaceConfig;
