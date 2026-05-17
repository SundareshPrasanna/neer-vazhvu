"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UnifiedDetailPanel } from "@/components/water-bodies/unified-detail-panel";
import { UnifiedLegend } from "@/components/water-bodies/unified-legend";
import { ViewModeToggle } from "@/components/water-bodies/view-mode-toggle";
import type { ViewMode } from "@/components/water-bodies/view-mode-toggle";
import { CascadeToggle } from "@/components/cascade/cascade-toggle";
import { CHENNAI } from "@/lib/cities/chennai";
import { RestorationRankingTable } from "@/components/lake-restoration/restoration-ranking-table";
import type { SelectedWaterBody, LostWaterBodyProperties, CensusWaterBodyProperties } from "@/types/water-bodies";
import type { RestorationPriorityData, ScoredWaterBody } from "@/types/restoration";
import { getPriorityColor } from "@/types/restoration";
import { useLanguage } from "@/lib/i18n/context";
import type { WardProfile } from "@/lib/hooks/use-ward-profile";
import { useLockBodyScroll } from "@/lib/hooks/use-lock-body-scroll";
import { MapInfoButton } from "@/components/map/map-info-button";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { WardSearch } from "@/components/map/ward-search";
import { RichBodyOverlay } from "@/components/water-bodies/rich-body-overlay";

function MapLoading() {
  const { t } = useLanguage();
  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <span className="text-slate-500 dark:text-slate-400">{t("wb.loading")}</span>
    </div>
  );
}

const UnifiedMap = dynamic(
  () =>
    import("@/components/water-bodies/unified-map").then((m) => m.UnifiedMap),
  { ssr: false, loading: () => <MapLoading /> }
);

// Cascade overlay: dynamic-imported only when toggled, so the
// protomaps-leaflet runtime stays out of the initial bundle.
const CascadeMapLayer = dynamic(
  () => import("@/components/cascade/cascade-map-layer"),
  { ssr: false }
);

interface LostGeoJSON {
  type: string;
  features: Array<{ properties: LostWaterBodyProperties }>;
}

const PRIORITY_LEVELS = ["critical", "high", "moderate", "low"] as const;

export default function WaterBodiesPage() {
  return (
    <Suspense>
      <WaterBodiesPageContent />
    </Suspense>
  );
}

function WaterBodiesPageContent() {
  useLockBodyScroll();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>(
    searchParams.get("mode") === "restoration" ? "restoration" : "water-bodies"
  );
  const [selected, setSelected] = useState<SelectedWaterBody | null>(null);
  const [focusCenter, setFocusCenter] = useState<[number, number] | undefined>();
  const [wardProfiles, setWardProfiles] = useState<WardProfile[]>([]);
  const [restorationData, setRestorationData] = useState<RestorationPriorityData | null>(null);
  const [lostStats, setLostStats] = useState<{ lostCount: number; totalHaLost: number } | null>(null);
  const [censusData, setCensusData] = useState<CensusWaterBodyProperties[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [censusSummary, setCensusSummary] = useState<{ total: number; encroached: number; avgStorageLossPct: number | null } | null>(null);
  const [activeTab, setActiveTab] = useState<string>("map");
  const [statsOpen, setStatsOpen] = useState(false);
  // Cascade overlay - off by default; layer + protomaps-leaflet runtime
  // are dynamic-imported only when the user opts in.
  const [showCascade, setShowCascade] = useState(false);
  const hasCascadeOverlay = CHENNAI.hasCascadeOverlay ?? false;

  // Build id lookup for restoration data
  const scoreLookup = useMemo(() => {
    if (!restorationData) return new Map<string, ScoredWaterBody>();
    const map = new Map<string, ScoredWaterBody>();
    for (const wb of restorationData.water_bodies) {
      map.set(wb.id, wb);
      // Also index by osm_id for quick polygon lookup
      if (wb.osm_id != null) map.set(`osm_id:${wb.osm_id}`, wb);
    }
    return map;
  }, [restorationData]);

  // Priority counts
  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, moderate: 0, low: 0 };
    if (restorationData) {
      for (const wb of restorationData.water_bodies) counts[wb.priority_level]++;
    }
    return counts;
  }, [restorationData]);

  // Fetch restoration data + ward-based deep linking
  useEffect(() => {
    const wardParam = searchParams.get("ward");

    fetch("/data/restoration-priority.json")
      .then((r) => r.json())
      .then(async (d: RestorationPriorityData) => {
        setRestorationData(d);

        // Ward deep link: find the ward's nearest/top water body
        if (wardParam) {
          const wardNum = parseInt(wardParam, 10);
          try {
            const profiles: WardProfile[] = await fetch("/data/ward-profiles.json").then((r) => r.json());
            setWardProfiles(profiles);
            const profile = profiles.find((p) => p.ward_number === wardNum);
            if (profile?.water_bodies.top_bodies?.length) {
              const topName = profile.water_bodies.top_bodies[0].name;
              const match = d.water_bodies.find((w) => w.name === topName);
              if (match) {
                setSelected({
                  kind: "current",
                  props: {
                    osm_id: match.osm_id!,
                    osm_type: "",
                    name: match.name,
                    name_ta: match.name_ta,
                    water_type: match.water_type,
                    area_ha: match.area_ha,
                  },
                  latlng: match.centroid,
                });
                setFocusCenter(match.centroid);
                return;
              }
            }
            // Fallback: find the nearest water body by distance to ward centroid
            // Ward profiles store centroid as [lng, lat]; water bodies use [lat, lng]
            if (profile) {
              const [wLng, wLat] = profile.centroid;
              let nearest: ScoredWaterBody | null = null;
              let minDist = Infinity;
              for (const wb of d.water_bodies) {
                const dLat = wb.centroid[0] - wLat;
                const dLng = wb.centroid[1] - wLng;
                const dist = dLat * dLat + dLng * dLng;
                if (dist < minDist) { minDist = dist; nearest = wb; }
              }
              if (nearest) {
                setSelected({
                  kind: "current",
                  props: {
                    osm_id: nearest.osm_id!,
                    osm_type: "",
                    name: nearest.name,
                    name_ta: nearest.name_ta,
                    water_type: nearest.water_type,
                    area_ha: nearest.area_ha,
                  },
                  latlng: nearest.centroid,
                });
                setFocusCenter(nearest.centroid);
                return;
              }
            }
          } catch { /* fall through to default */ }
        }

        // Default: pre-select Chembarambakkam Lake so users see the panel on load
        const chembarambakkam = d.water_bodies.find((w) => w.osm_id === 25453624);
        if (chembarambakkam) {
          setSelected({
            kind: "current",
            props: {
              osm_id: chembarambakkam.osm_id!,
              osm_type: "",
              name: chembarambakkam.name,
              name_ta: chembarambakkam.name_ta,
              water_type: chembarambakkam.water_type,
              area_ha: chembarambakkam.area_ha,
            },
            latlng: chembarambakkam.centroid,
          });
        }
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch ward profiles for search fly-to (if not already loaded by deep link)
  useEffect(() => {
    if (wardProfiles.length > 0) return;
    fetch("/data/ward-profiles.json")
      .then((r) => r.json())
      .then((profiles: WardProfile[]) => setWardProfiles(profiles))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch census data
  useEffect(() => {
    fetch("/api/water-bodies-census")
      .then((r) => r.json())
      .then((d: { data: CensusWaterBodyProperties[]; summary: { total: number; encroached: number; avgStorageLossPct: number | null } }) => {
        setCensusData(d.data ?? []);
        setCensusSummary(d.summary ?? null);
      })
      .catch(console.error);
  }, []);

  // Fetch lost stats
  useEffect(() => {
    fetch("/geojson/chennai-water-bodies-lost.geojson")
      .then((r) => r.json())
      .then((data: LostGeoJSON) => {
        const lostCount = data.features.length;
        const totalHaLost = data.features.reduce((sum, f) => {
          const p = f.properties;
          return sum + (p.historical_area_ha - (p.current_area_ha ?? 0));
        }, 0);
        setLostStats({ lostCount, totalHaLost });
      })
      .catch(console.error);
  }, []);

  // Find restoration data for the selected water body
  const selectedRestoration = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === "current") {
      return scoreLookup.get(`osm_id:${selected.props.osm_id}`) ?? null;
    }
    if (selected.kind === "census") {
      return scoreLookup.get(`census:${selected.props.id}`) ?? null;
    }
    return null;
  }, [selected, scoreLookup]);

  // When ranking table selects a ScoredWaterBody, convert to SelectedWaterBody
  const handleRankingSelect = (wb: ScoredWaterBody) => {
    if (wb.source === "census") {
      // Census-only body
      const censusMatch = censusData.find((c) => c.id === wb.census_id);
      if (censusMatch) {
        setSelected({
          kind: "census",
          props: censusMatch,
          latlng: wb.centroid,
        });
      }
    } else {
      // OSM or matched body
      setSelected({
        kind: "current",
        props: {
          osm_id: wb.osm_id!,
          osm_type: "",
          name: wb.name,
          name_ta: wb.name_ta,
          water_type: wb.water_type,
          area_ha: wb.area_ha,
        },
        latlng: wb.centroid,
      });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Stats bar - collapsed on mobile, always visible on desktop */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shrink-0">
        {/* Mobile: collapsed summary - hidden when expanded */}
        {!statsOpen && (
          <button
            onClick={() => setStatsOpen(true)}
            className="sm:hidden w-full px-4 py-1.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400"
          >
            <span>{viewMode === "water-bodies" ? `1,787 ${t("wb.existing")} · ${lostStats?.lostCount ?? "-"} ${t("wb.lost")}` : `${restorationData?.total_scored.toLocaleString() ?? "-"} ${t("lr.total_scored")}`}</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
        {/* Full stats - always on desktop, toggle on mobile */}
        <div className={`${statsOpen ? "block" : "hidden"} sm:!flex px-4 py-2 sm:py-2.5 sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-1`}>
          {/* Mobile collapse button */}
          <div className="sm:hidden flex justify-end mb-1">
            <button onClick={() => setStatsOpen(false)}>
              <svg className="w-3.5 h-3.5 text-slate-400 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          {viewMode === "water-bodies" ? (
            <>
              <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                <span className="w-3 h-3 rounded-sm bg-blue-500 opacity-70 flex-shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">1,787</span>{" "}
                  {t("wb.existing")}
                </span>
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                <span className="w-3 h-3 rounded-sm bg-red-500 opacity-70 flex-shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {lostStats?.lostCount ?? "-"}
                  </span>{" "}
                  {t("wb.lost")}
                </span>
              </div>
              {lostStats && (
                <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                  <span className="w-3 h-3 rounded-sm bg-orange-500 opacity-70 flex-shrink-0" />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      ~{Math.round(lostStats.totalHaLost / 100) * 100} ha
                    </span>{" "}
                    {t("wb.ha_lost")}
                  </span>
                </div>
              )}
              {censusSummary && censusSummary.total > 0 && (
                <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 opacity-70 flex-shrink-0" />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {censusSummary.total}
                    </span>{" "}
                    {t("wb.census_surveyed")}
                  </span>
                </div>
              )}
              <p className="text-xs text-slate-400 dark:text-slate-500 ml-auto hidden sm:block whitespace-nowrap">
                {t("wb.tagline").replace("{lostCount}", String(lostStats?.lostCount ?? 15))}
              </p>
            </>
          ) : (
            <>
              {restorationData && (
                <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{restorationData.total_scored.toLocaleString()}</span>{" "}
                    {t("lr.total_scored")}
                  </span>
                </div>
              )}
              {PRIORITY_LEVELS.map((level) => (
                <div key={level} className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: getPriorityColor(level) }}
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{priorityCounts[level]}</span>{" "}
                    {t(`lr.${level}`)}
                  </span>
                </div>
              ))}
              <p className="text-xs text-slate-400 dark:text-slate-500 ml-auto hidden sm:block whitespace-nowrap">
                {t("lr.tagline").replace("{criticalCount}", String(priorityCounts.critical + priorityCounts.high))}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Main content with tabs */}
      <Tabs
        defaultValue="map"
        className="flex-1 flex flex-col overflow-hidden"
        onValueChange={(val) => {
          setActiveTab(val);
          if (val === "ranking") {
            setViewMode("restoration");
            setSelected(null); // Clear selection so table is visible on mobile
          }
        }}
      >
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 flex items-center justify-between">
          <TabsList variant="line" className="h-auto p-0 gap-6">
            <TabsTrigger
              value="map"
              className="px-1 py-2.5 text-sm font-medium border-none rounded-none data-[state=active]:border-none after:!bg-blue-600 after:!h-[2.5px] after:!rounded-full"
            >
              {t("lr.tab_map")}
            </TabsTrigger>
            <TabsTrigger
              value="ranking"
              className="px-1 py-2.5 text-sm font-medium border-none rounded-none data-[state=active]:border-none after:!bg-blue-600 after:!h-[2.5px] after:!rounded-full"
            >
              {t("lr.tab_ranking")}
            </TabsTrigger>
          </TabsList>
          {activeTab === "map" && (
            <div className="flex items-center gap-2">
              {hasCascadeOverlay && (
                <>
                  <CascadeToggle pressed={showCascade} onPressedChange={setShowCascade} />
                  {showCascade && (
                    <Link
                      href="/cascades"
                      className="hidden sm:inline-flex items-center gap-1 rounded-md border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950 px-2.5 py-1.5 text-xs font-medium text-sky-700 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors"
                      title="See cascade health and priority"
                    >
                      Cascade health
                      <span aria-hidden>→</span>
                    </Link>
                  )}
                </>
              )}
              <ViewModeToggle value={viewMode} onChange={(mode) => { setViewMode(mode); setHiddenCategories(new Set()); }} />
            </div>
          )}
        </div>

        {/* Map tab */}
        <TabsContent value="map" className="flex-1 m-0 flex flex-col md:flex-row overflow-hidden">
          <div className="relative flex-1 h-full">
            <UnifiedMap
              viewMode={viewMode}
              scoredData={restorationData?.water_bodies ?? []}
              censusData={censusData}
              onSelectCurrent={setSelected}
              onSelectLost={setSelected}
              focusCenter={focusCenter}
              hiddenCategories={hiddenCategories}
              suppressLayerTooltips={hasCascadeOverlay && showCascade}
            >
              {hasCascadeOverlay && showCascade && <CascadeMapLayer cityId="chennai" />}
            </UnifiedMap>
            <div className={`absolute sm:bottom-4 z-[1000] transition-[bottom] duration-300 left-2 right-auto md:left-auto md:right-4 ${selected ? "bottom-[148px] md:bottom-4" : "bottom-2"}`}>
              <UnifiedLegend
                viewMode={viewMode}
                hiddenCategories={hiddenCategories}
                onToggleCategory={(cat) => setHiddenCategories((prev) => {
                  const next = new Set(prev);
                  if (next.has(cat)) next.delete(cat); else next.add(cat);
                  return next;
                })}
              />
            </div>
            <MapInfoButton className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000]">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t("wb.osm_source")}{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  OpenStreetMap
                </span>
              </div>
              {viewMode === "water-bodies" && (
                <>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {t("wb.lost_source")}{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {t("wb.lost_source_value")}
                    </span>
                  </div>
                  {censusData.length > 0 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {t("wb.census_source")}{" "}
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {t("wb.census_source_value")}
                      </span>
                    </div>
                  )}
                </>
              )}
              {viewMode === "restoration" && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t("lr.source_note")}
                </div>
              )}
              {hasCascadeOverlay && showCascade && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    Cascade overlay &middot; predicted, not observed
                  </div>
                  <div>
                    <span className="inline-block w-3 h-0.5 bg-sky-500 align-middle mr-1.5" />
                    Sky-blue lines: predicted tank-to-tank cascade links from HydroSHEDS DEM and flow direction.
                  </div>
                  <div>
                    <span className="inline-block w-3 h-0.5 bg-amber-500 align-middle mr-1.5" />
                    Amber lines: tanks that drain into a river instead of another tank.
                  </div>
                  <div className="pt-1">
                    Edges respect rivers as both barriers (no crossings) and sinks. Heuristic only - a future pass will label edges as intact / broken / encroached.{" "}
                    <Link
                      href="/about#cascade-methodology"
                      className="text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      Full methodology &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </MapInfoButton>
            <WardSearch
              className="absolute top-2 right-2 sm:top-4 sm:right-4 z-[1000]"
              onSelect={(wardNum) => {
                const profile = wardProfiles.find((p) => p.ward_number === wardNum);
                if (profile) setFocusCenter([profile.centroid[1], profile.centroid[0]]);
              }}
            />
          </div>
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
                onClose={() => setSelected(null)}
              />
            </BottomSheet>
          ) : null}
        </TabsContent>

        {/* Ranking table tab */}
        <TabsContent value="ranking" className="flex-1 m-0 flex flex-col md:flex-row overflow-hidden">
          <div className={`flex-1 overflow-hidden ${selected ? "h-[55vh] md:h-full" : "h-full"}`}>
            {restorationData && (
              <RestorationRankingTable
                data={restorationData.water_bodies}
                onSelect={handleRankingSelect}
              />
            )}
          </div>
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
                onClose={() => setSelected(null)}
              />
            </BottomSheet>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
