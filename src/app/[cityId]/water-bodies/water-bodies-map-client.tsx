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
  fullyLostCount: number;
  reducedCount: number;
  namedOsmCount: number | null;
  /** Whether the cascade reconstruction overlay is available for this
   *  city (PMTiles produced by `scripts/run_cascade.py` exist). */
  hasCascadeOverlay?: boolean;
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
      return restorationData.water_bodies.find((w) => w.osm_id === osmId) ?? null;
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
          {cityDisplayName} · {cityState}
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
            <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
              <span className="w-3 h-3 rounded-sm bg-red-500 opacity-70" />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{fullyLostCount}</span> fully lost
              </span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
              <span className="w-3 h-3 rounded-sm bg-orange-500 opacity-70" />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{reducedCount}</span> at risk
              </span>
            </div>
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
        <div className="relative flex-1 h-full">
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
          />

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
              // Bengaluru's V0 data layer is OSM polygons + tabular
              // lost-kere only - no census-to-OSM polygon spatial join
              // yet, so the three census_* legend entries would mislead
              // (no feature on the map is coloured by them). Filter
              // them out. Chennai/Madurai default to the full legend.
              visibleCategoryIds={
                cityId === "bangalore"
                  ? ["existing", "fully_lost", "severely_reduced", "encroached"]
                  : undefined
              }
            />
          </div>

          {/* Map info button - sources */}
          <MapInfoButton className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000]">
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
