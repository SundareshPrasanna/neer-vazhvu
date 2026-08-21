"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { UnifiedDetailPanel } from "@/components/water-bodies/unified-detail-panel";
import { UnifiedLegend } from "@/components/water-bodies/unified-legend";
import { ViewModeToggle, type ViewMode } from "@/components/water-bodies/view-mode-toggle";
import { CatchmentAtlasClient } from "@/components/cascade/catchment-atlas-client";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { MapInfoButton } from "@/components/map/map-info-button";
import { elevationLegendEntries, useElevationBands } from "@/components/map/elevation-bands";

const ElevationBandsLayer = dynamic(
  () => import("@/components/map/elevation-bands-layer").then((m) => m.ElevationBandsLayer),
  { ssr: false },
);
import { tryGetPlaceConfig } from "@/lib/cities";
import { RichBodyOverlay } from "@/components/water-bodies/rich-body-overlay";
import { useLanguage } from "@/lib/i18n/context";
import { useLockBodyScroll } from "@/lib/hooks/use-lock-body-scroll";
import type { SelectedWaterBody } from "@/types/water-bodies";
import type { RestorationPriorityData } from "@/types/restoration";
import { getPriorityColor } from "@/types/restoration";

/** Shape of the entries inside water-bodies-lost-{cityId}.json that the
 *  detail panel uses to enrich a clicked OSM body with historical
 *  narrative ("foam-and-fire" for Bellandur etc.). */
interface LostBodyEntry {
  name: string;
  status: string;
  side?: string;
  note?: string;
}

interface LostBodiesFile {
  lost_bodies: LostBodyEntry[];
}

interface ClientProps {
  cityId: string;
  cityDisplayName: string;
  cityState: string;
  mapCenter: [number, number];
  mapZoom?: number;
  /** Stats bar values from the server; nulls render as dashes. */
  /** Null where the city has no lost-bodies register. The overlay is
   *  optional; the current-polygon map is not, so these legend chips render
   *  only when the register exists rather than showing a false zero. */
  fullyLostCount: number | null;
  reducedCount: number | null;
  namedOsmCount: number | null;
  /** Whether the cascade reconstruction overlay is available for this
   *  city (PMTiles produced by `scripts/run_cascade.py` exist). */
  hasCascadeOverlay?: boolean;
  catchmentsGapNote?: string;
}

function MapLoading() {
  const { t } = useLanguage();
  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <span className="text-slate-500 dark:text-slate-400">{t("wb.loading")}</span>
    </div>
  );
}

const UnifiedMap = dynamic(
  () => import("@/components/water-bodies/unified-map").then((m) => m.UnifiedMap),
  { ssr: false, loading: () => <MapLoading /> },
);

// react-leaflet is browser-only; load the corporation-boundary overlay
// client-side (it renders inside the ssr:false UnifiedMap).
const CorporationBoundaries = dynamic(
  () => import("@/components/map/corporation-boundaries").then((m) => m.CorporationBoundaries),
  { ssr: false },
);

export default function WaterBodiesMapClient({
  cityId,
  cityDisplayName,
  cityState,
  mapCenter,
  mapZoom = 11,
  fullyLostCount,
  reducedCount,
  namedOsmCount,
  hasCascadeOverlay = false,
  catchmentsGapNote,
}: ClientProps) {
  useLockBodyScroll();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<SelectedWaterBody | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [restorationData, setRestorationData] = useState<RestorationPriorityData | null>(null);
  // Lost-bodies tabular data (Bengaluru today: narrative notes for
  // Bellandur, Halsoor, Dharmambudhi etc.). Used to surface the rich
  // historical "what happened to this kere" text in UnifiedDetailPanel
  // when the clicked OSM polygon's name matches an entry here. Cities
  // that ship a *-water-bodies-lost.geojson layer (Chennai/Madurai) get
  // this via the dedicated "lost" click path; this is the augment for
  // cities with tabular-only lost data.
  const [lostBodies, setLostBodies] = useState<LostBodyEntry[] | null>(null);
  // Off by default - the layer + protomaps-leaflet runtime are
  // dynamic-imported only when the user opts in.
  // View mode: "water-bodies" (OSM polygons + lost markers),
  // "restoration" (priority-coloured layer + flagship orphan circles), or
  // "catchments" (terrain-derived area-of-influence atlas). Sourced from
  // the URL so deep links share state.
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const m = searchParams.get("mode");
    if (m === "restoration") return "restoration";
    if (m === "catchments" && hasCascadeOverlay) return "catchments";
    return "water-bodies";
  });

  // Persist toggle to the URL so the chosen view survives refresh and
  // shareable links open in the right mode.
  // Ground-elevation bands (FABDEM) - self-hides for cities without the file.
  const [showElevation, setShowElevation] = useState(false);
  const elevation = useElevationBands(cityId, showElevation);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setHiddenCategories(new Set());
    setSelected(null);
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "water-bodies") params.delete("mode");
    else params.set("mode", mode);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Load this city's restoration-priority JSON. Chennai's /water-bodies
  // page does the same; the JSON conforms to the shared
  // RestorationPriorityData shape across cities.
  useEffect(() => {
    fetch(`/data/restoration-priority-${cityId}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<RestorationPriorityData>) : null))
      .then((data) => {
        setRestorationData(data);
        // On restoration view first load, surface the highest-priority
        // body so the user sees the panel without needing to hunt.
        // Mirrors Chennai's "default to Chembarambakkam" behaviour.
        if (
          data &&
          searchParams.get("mode") === "restoration" &&
          data.water_bodies.length > 0
        ) {
          const top = [...data.water_bodies].sort(
            (a, b) => b.priority_score - a.priority_score,
          )[0];
          if (top) {
            if (top.osm_id != null) {
              setSelected({
                kind: "current",
                props: {
                  osm_id: top.osm_id,
                  osm_type: "",
                  name: top.name,
                  name_ta: top.name_ta,
                  water_type: top.water_type,
                  area_ha: top.area_ha,
                },
                latlng: top.centroid,
              });
            } else {
              setSelected({ kind: "scored", scored: top, latlng: top.centroid });
            }
          }
        }
      })
      .catch(() => setRestorationData(null));
  // Intentionally only depend on cityId - the searchParams check is a
  // first-load anchor and shouldn't re-fire as the user toggles modes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId]);

  // Fetch lost-bodies tabular file for narrative augmentation. Optional;
  // 404 is fine (Chennai/Madurai use the geojson layer for this).
  useEffect(() => {
    fetch(`/data/water-bodies-lost-${cityId}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<LostBodiesFile>) : null))
      .then((data) => setLostBodies(data?.lost_bodies ?? null))
      .catch(() => setLostBodies(null));
  }, [cityId]);

  // For a "current" click, look up the body by name (case + whitespace
  // normalised) in the lost-bodies tabular file. Matches Bellandur /
  // Halsoor / Sankey / Hesaraghatta etc. on /bangalore/water-bodies.
  const selectedLostNarrative = useMemo(() => {
    if (!lostBodies || !selected || selected.kind !== "current") return null;
    const clickedName = (selected.props.name ?? "").trim().toLowerCase();
    if (!clickedName) return null;
    return (
      lostBodies.find(
        (b) => b.name.trim().toLowerCase() === clickedName,
      ) ?? null
    );
  }, [lostBodies, selected]);

  // Resolve the score row for the selected body. For "current" we
  // match by osm_id; for "scored" the scored row is already in hand.
  const selectedRestoration = useMemo(() => {
    if (!selected || !restorationData) return null;
    if (selected.kind === "current") {
      const osmId = selected.props.osm_id;
      const name = (selected.props.name ?? "").toLowerCase();
      return (
        restorationData.water_bodies.find((w) => w.osm_id === osmId) ??
        // Flagship-sourced rows (Mumbai) carry no osm_id - match the OSM
        // polygon by name so clicking Powai still shows its score.
        (name
          ? restorationData.water_bodies.find((w) => w.name.toLowerCase() === name)
          : undefined) ??
        null
      );
    }
    if (selected.kind === "scored") {
      return selected.scored;
    }
    return null;
  }, [selected, restorationData]);

  // Priority counts for the header chips (restoration view only).
  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, moderate: 0, low: 0 };
    if (!restorationData) return counts;
    for (const wb of restorationData.water_bodies) counts[wb.priority_level]++;
    return counts;
  }, [restorationData]);
  const PRIORITY_LEVELS = ["critical", "high", "moderate", "low"] as const;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Stats bar - swaps content based on view mode. */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {cityDisplayName} - {cityState}
        </span>
        {viewMode === "water-bodies" ? (
          <>
            {namedOsmCount !== null && (
              <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                <span className="w-3 h-3 rounded-sm bg-blue-500 opacity-70" />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{namedOsmCount}</span> named bodies on OSM
                </span>
              </div>
            )}
            {fullyLostCount !== null && (
              <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                <span className="w-3 h-3 rounded-sm bg-red-500 opacity-70" />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{fullyLostCount}</span> fully lost
                </span>
              </div>
            )}
            {reducedCount !== null && (
              <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                <span className="w-3 h-3 rounded-sm bg-orange-500 opacity-70" />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{reducedCount}</span> at risk
                </span>
              </div>
            )}
          </>
        ) : viewMode === "restoration" ? (
          <>
            {restorationData && (
              <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{restorationData.total_scored.toLocaleString()}</span> {t("lr.total_scored")}
                </span>
              </div>
            )}
            {PRIORITY_LEVELS.map((level) => (
              <div key={level} className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: getPriorityColor(level) }} />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{priorityCounts[level]}</span> {t(`lr.${level}`)}
                </span>
              </div>
            ))}
          </>
        ) : (
          <span className="text-xs text-slate-600 dark:text-slate-400">
            Click a lake to see its catchment, feeder streams, and rooftop-harvest potential.
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <ViewModeToggle
            value={viewMode}
            onChange={handleViewModeChange}
            catchmentsAvailable={hasCascadeOverlay}
            catchmentsGapNote={catchmentsGapNote}
          />
        </div>
      </div>

      {viewMode === "catchments" ? (
        <div className="flex-1 min-h-0">
          <CatchmentAtlasClient
            cityId={cityId}
            cityDisplayName={cityDisplayName}
            center={mapCenter}
            zoom={mapZoom}
          />
        </div>
      ) : (
      /* Map + sidebar layout - identical to Chennai's water-bodies page */
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="relative h-[45vh] shrink-0 md:h-full md:flex-1 md:shrink">
          {/* Mobile: explicit height - as a flex-basis-0 item next to the tall
              sidebar this collapsed to 0px (same fix as the flood maps). */}
          <UnifiedMap
            viewMode={viewMode}
            scoredData={restorationData?.water_bodies ?? []}
            censusData={[]}
            onSelectCurrent={setSelected}
            onSelectLost={setSelected}
            hiddenCategories={hiddenCategories}
            currentGeoJsonUrl={`/geojson/${cityId}-water-bodies-current.geojson`}
            lostGeoJsonUrl={`/geojson/${cityId}-water-bodies-lost.geojson`}
            riversGeoJsonUrl={`/geojson/${cityId}-rivers.geojson`}
            mapCenter={mapCenter}
            mapZoom={mapZoom}
          >
            {/* Region places (the MMR) overlay their municipal-corporation
                boundaries as context. No-op for single-city places. */}
            <ElevationBandsLayer data={elevation.data} />
            {tryGetPlaceConfig(cityId)?.placeKind === "region" && (
              <CorporationBoundaries cityId={cityId} />
            )}
          </UnifiedMap>
          {elevation.available && (
            <div className="absolute bottom-2 right-2 md:bottom-8 md:left-2.5 md:right-auto z-[1000] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md p-2.5 text-xs max-w-[46vw] md:max-w-[240px] space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={showElevation}
                  onChange={() => setShowElevation((v) => !v)}
                  className="accent-sky-700"
                />
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-sky-800 via-lime-400 to-amber-800" />
                  Ground elevation (FABDEM)
                </span>
              </label>
              {showElevation && (
                <>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-600 dark:text-slate-300">
                  {elevationLegendEntries(elevation.data).map(({ band, color }) => (
                    <span key={band} className="inline-flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                      {band}
                    </span>
                  ))}
                </div>
                  <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                    Ground height above sea level from satellite (FABDEM 30 m, buildings and
                    forests removed) - the terrain each water body drains. Read as bands, not
                    spot heights (~2 m vertical accuracy).
                  </p>
                </>
              )}
            </div>
          )}

          {/* Legend overlay */}
          <div
            className={`absolute sm:bottom-4 z-[1000] transition-[bottom] duration-300 left-2 right-auto md:left-auto md:right-4 ${
              selected ? "bottom-[148px] md:bottom-4" : "bottom-2"
            }`}
          >
            <UnifiedLegend
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
              // Bengaluru's water-bodies map only renders OSM "current"
              // polygons, which all read as "existing" (blue). There is no
              // lost-lakes inventory for the city (so fully_lost /
              // severely_reduced / encroached have zero features on the
              // map), and the only survey we hold - the MoWR 6th Minor
              // Irrigation Census (718 points) - records encroached=No and
              // in-use=No for every body, so it cannot back a condition
              // classification either. Show only the one category that
              // actually appears. Chennai/Madurai default to the full
              // legend. Revisit if a real lake-condition survey (e.g. a
              // digitised KTCDA / IISc encroachment inventory) is wired in.
              visibleCategoryIds={
                cityId === "bangalore" ? ["existing"] : undefined
              }
            />
          </div>

          {/* Map info button - sources */}
          <MapInfoButton className="absolute top-20 left-2.5 z-[1000]">
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <div>
                Polygons from <span className="font-semibold text-slate-700 dark:text-slate-300">OpenStreetMap</span>
              </div>
              <div>
                Lost-tank narrative from <span className="font-semibold text-slate-700 dark:text-slate-300">Vencatesan academic inventory</span>
              </div>
            </div>
          </MapInfoButton>
        </div>

        {/* BottomSheet renders as desktop sidebar / mobile fixed-bottom. MUST
            be a sibling of the map div (not nested inside it) so the desktop
            sidebar layout works inside the parent flex flex-row container.
            Rich-data bodies (Pallikaranai etc.) take over with their own
            full-screen overlay instead of the BottomSheet. */}
        {selected && selected.kind === "current" && selected.richBodyId ? (
          <RichBodyOverlay
            bodyId={selected.richBodyId}
            onClose={() => setSelected(null)}
          />
        ) : selected ? (
          <BottomSheet onClose={() => setSelected(null)}>
            <UnifiedDetailPanel
              selected={selected}
              restorationData={selectedRestoration}
              cityHasRestorationCohort={!!restorationData && restorationData.water_bodies.length > 0}
              lostNarrative={selectedLostNarrative}
              onClose={() => setSelected(null)}
            />
          </BottomSheet>
        ) : null}
      </div>
      )}
    </div>
  );
}
