"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UnifiedDetailPanel } from "@/components/water-bodies/unified-detail-panel";
import { UnifiedLegend } from "@/components/water-bodies/unified-legend";
import { ViewModeToggle, type ViewMode } from "@/components/water-bodies/view-mode-toggle";
import { LakeRegisterPanel } from "@/components/water-bodies/lake-register-panel";
import { RichBodyOverlay } from "@/components/water-bodies/rich-body-overlay";
import { CatchmentAtlasClient } from "@/components/catchments/catchment-atlas-client";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { MapInfoButton } from "@/components/map/map-info-button";
import { MapLoading } from "@/components/map/map-loading";
import { WardSearch } from "@/components/map/ward-search";
import { useElevationBands } from "@/components/map/elevation-bands";
import { ElevationBandsControl } from "@/components/map/elevation-bands-control";
import { getPlaceConfig } from "@/lib/cities";
import { restorationPriorityUrl, riversUrl, waterBodiesCurrentUrl, waterBodiesLostUrl } from "@/lib/cities/data-paths";
import { fetchJson, fetchJsonOrNull } from "@/lib/data/fetch-json";
import { loadProfiles, type WardProfile } from "@/lib/hooks/use-ward-profile";
import { useLockBodyScroll } from "@/lib/hooks/use-lock-body-scroll";
import { useLanguage } from "@/lib/i18n/context";
import type { CensusWaterBodyProperties, LostWaterBodyProperties, SelectedWaterBody } from "@/types/water-bodies";
import { getPriorityColor, type RestorationPriorityData, type ScoredWaterBody } from "@/types/restoration";
import { RestorationRankingTable } from "./restoration-ranking-table";

const UnifiedMap = dynamic(
  () => import("@/components/water-bodies/unified-map").then((m) => m.UnifiedMap),
  { ssr: false, loading: () => <MapLoading /> },
);
const ElevationBandsLayer = dynamic(
  () => import("@/components/map/elevation-bands-layer").then((m) => m.ElevationBandsLayer),
  { ssr: false },
);
// Region places (the MMR) overlay their municipal-corporation boundaries.
const CorporationBoundaries = dynamic(
  () => import("@/components/map/corporation-boundaries").then((m) => m.CorporationBoundaries),
  { ssr: false },
);

/** A water-bodies-lost-<city>.json entry, matched by name to a clicked body for its history note. */
export interface LostNarrative {
  name: string;
  status: string;
  side?: string;
  note?: string;
}

interface Props {
  cityId: string;
  /** Bodies in the current layer; null where the city has none. */
  existingCount: number | null;
  /** From water-bodies-lost-<city>.json; null where the city has no register. */
  lostSummary: { fullyLost: number; reduced: number } | null;
  lostNarratives: LostNarrative[];
  /** Who compiled the lost-bodies register (its primary source). */
  lostSource: string | null;
  /** Publishers of the current layer, from its provenance. */
  currentSource: string | null;
}

type CensusSummary = { total: number; encroached: number; avgStorageLossPct: number | null };

const PRIORITY_LEVELS = ["critical", "high", "moderate", "low"] as const;
const TAB_CLASS =
  "px-1 py-2.5 text-sm font-medium border-none rounded-none data-[state=active]:border-none after:!bg-blue-600 after:!h-[2.5px] after:!rounded-full";

const toSelected = (w: ScoredWaterBody): SelectedWaterBody =>
  w.osm_id != null
    ? { kind: "current", props: { osm_id: w.osm_id, osm_type: "", name: w.name, name_ta: w.name_ta, water_type: w.water_type, area_ha: w.area_ha }, latlng: w.centroid }
    : { kind: "scored", scored: w, latlng: w.centroid };

function Stat({ swatch, value, label }: { swatch: string; value: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
      <span className={`w-3 h-3 rounded-sm opacity-70 flex-shrink-0 ${swatch}`} />
      <span className="text-xs text-slate-600 dark:text-slate-400">
        <span className="font-semibold text-slate-900 dark:text-slate-100">{value}</span> {label}
      </span>
    </div>
  );
}

export function WaterBodiesClient({ cityId, existingCount, lostSummary, lostNarratives, lostSource, currentSource }: Props) {
  useLockBodyScroll();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const config = getPlaceConfig(cityId);
  const wb = config.waterBodies;
  const hasCatchments = config.hasCatchments ?? false;
  const hasWardSearch = wb?.wardSearch ?? false;
  const hasLostBodies = wb?.lostBodies ?? false;
  const hasRankingTab = wb?.rankingTab ?? false;
  const hasLegalRegister = wb?.legalRegister ?? false;
  const view = wb?.mapView ?? { center: [config.center.lat, config.center.lng] as [number, number], zoom: 11 };

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const m = searchParams.get("mode");
    if (m === "restoration") return "restoration";
    if (m === "catchments" && hasCatchments) return "catchments";
    return "water-bodies";
  });
  const [selected, setSelected] = useState<SelectedWaterBody | null>(null);
  const [focusCenter, setFocusCenter] = useState<[number, number] | undefined>();
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [restorationData, setRestorationData] = useState<RestorationPriorityData | null>(null);
  const [wardProfiles, setWardProfiles] = useState<WardProfile[]>([]);
  const [censusData, setCensusData] = useState<CensusWaterBodyProperties[]>([]);
  const [censusSummary, setCensusSummary] = useState<CensusSummary | null>(null);
  const [lostLayer, setLostLayer] = useState<GeoJSON.FeatureCollection | null>(null);
  const [activeTab, setActiveTab] = useState("map");
  const [statsOpen, setStatsOpen] = useState(false);
  // Ground-elevation bands (FABDEM); the control hides itself where the city has no bands file.
  const elevation = useElevationBands(wb?.elevationBands === false ? null : cityId);

  // Persist the mode to the URL so refreshes and shared links open in it.
  const changeMode = (mode: ViewMode) => {
    setViewMode(mode);
    setHiddenCategories(new Set());
    setSelected(null);
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "water-bodies") params.delete("mode");
    else params.set("mode", mode);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Restoration scores, then the body to open on load: the ?ward= deep link's top body (or the
  // nearest one), else the city's configured body, else the top-priority body in restoration view.
  useEffect(() => {
    fetchJsonOrNull<RestorationPriorityData>(restorationPriorityUrl(cityId))
      .then(async (d) => {
        setRestorationData(d);
        if (!d) return;
        const wardParam = searchParams.get("ward");
        if (hasWardSearch && wardParam) {
          const wardNum = parseInt(wardParam, 10);
          try {
            const profiles = await loadProfiles(cityId);
            setWardProfiles(profiles);
            const profile = profiles.find((p) => p.ward_number === wardNum);
            const topName = profile?.water_bodies.top_bodies?.[0]?.name;
            let match = topName ? d.water_bodies.find((w) => w.name === topName) : undefined;
            // Ward profiles store centroid as [lng, lat]; water bodies use [lat, lng].
            if (!match && profile) {
              const [wLng, wLat] = profile.centroid;
              let minDist = Infinity;
              for (const w of d.water_bodies) {
                const dist = (w.centroid[0] - wLat) ** 2 + (w.centroid[1] - wLng) ** 2;
                if (dist < minDist) { minDist = dist; match = w; }
              }
            }
            if (match) {
              setSelected(toSelected(match));
              setFocusCenter(match.centroid);
              return;
            }
          } catch { /* fall through to the default */ }
        }
        const first =
          wb?.openOnLoad != null
            ? d.water_bodies.find((w) => w.osm_id === wb.openOnLoad)
            : searchParams.get("mode") === "restoration"
              ? [...d.water_bodies].sort((a, b) => b.priority_score - a.priority_score)[0]
              : undefined;
        if (first) setSelected(toSelected(first));
      })
      .catch(() => setRestorationData(null));
  // First-load anchor only: toggling modes must not re-open a body.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId]);

  // Ward profiles for the search box (unless the deep link already loaded them).
  useEffect(() => {
    if (!hasWardSearch || wardProfiles.length > 0) return;
    loadProfiles(cityId).then(setWardProfiles).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId]);

  useEffect(() => {
    if (!(wb?.censusSource ?? false)) return;
    fetchJson<{ data: CensusWaterBodyProperties[]; summary: CensusSummary }>("/api/water-bodies-census")
      .then((d) => {
        setCensusData(d.data ?? []);
        setCensusSummary(d.summary ?? null);
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId]);

  const lostStats = useMemo(() => {
    if (!hasLostBodies || !lostLayer) return null;
    const props = lostLayer.features.map((f) => f.properties as LostWaterBodyProperties);
    return {
      lostCount: props.length,
      totalHaLost: props.reduce((sum, p) => sum + (p.historical_area_ha - (p.current_area_ha ?? 0)), 0),
    };
  }, [hasLostBodies, lostLayer]);

  // Chennai's scorer ranks every mapped body; the others rank a hand-curated cohort, so a body
  // outside it reads "not assessed" and the notes cite the curated inventory.
  const curatedCohort = !!restorationData?.water_bodies.some(
    (w) => w.source !== "osm" && w.source !== "matched" && w.source !== "census",
  );

  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, moderate: 0, low: 0 };
    for (const w of restorationData?.water_bodies ?? []) counts[w.priority_level]++;
    return counts;
  }, [restorationData]);

  const selectedRestoration = useMemo(() => {
    if (!selected || !restorationData) return null;
    if (selected.kind === "scored") return selected.scored;
    const rows = restorationData.water_bodies;
    if (selected.kind === "census") return rows.find((w) => w.id === `census:${selected.props.id}`) ?? null;
    if (selected.kind !== "current") return null;
    // Flagship rows (Mumbai, Hyderabad) carry no osm_id: match the polygon by name.
    const name = (selected.props.name ?? "").toLowerCase();
    return (
      rows.find((w) => w.osm_id === selected.props.osm_id) ??
      (name ? rows.find((w) => w.name.toLowerCase() === name) : undefined) ??
      null
    );
  }, [selected, restorationData]);

  const selectedLostNarrative = useMemo(() => {
    if (!selected || selected.kind !== "current") return null;
    const clicked = (selected.props.name ?? "").trim().toLowerCase();
    return clicked ? lostNarratives.find((b) => b.name.trim().toLowerCase() === clicked) ?? null : null;
  }, [lostNarratives, selected]);

  // Legend rows only for layers this city draws.
  const legendIds = useMemo(() => {
    const ids = ["existing"];
    if (lostLayer?.features.length) ids.push("fully_lost", "severely_reduced", "encroached");
    if (censusData.length) ids.push("census_healthy", "census_encroached", "census_degraded");
    return ids;
  }, [lostLayer, censusData]);

  const selectRanked = (w: ScoredWaterBody) => {
    if (w.source !== "census") return setSelected(toSelected(w));
    const census = censusData.find((c) => c.id === w.census_id);
    if (census) setSelected({ kind: "census", props: census, latlng: w.centroid });
  };

  const tabs = hasRankingTab || hasLegalRegister;
  const lostSourceLabel = lostSource ?? (hasLostBodies ? t("wb.lost_source_value") : null);
  const close = () => setSelected(null);
  const toggle = (
    <ViewModeToggle
      value={viewMode}
      onChange={changeMode}
      catchmentsAvailable={hasCatchments}
      catchmentsGapNote={config.catchmentsGapNote}
    />
  );

  const stats =
    viewMode === "water-bodies" ? (
      <>
        {existingCount != null && <Stat swatch="bg-blue-500" value={existingCount.toLocaleString()} label={t("wb.existing")} />}
        {hasLostBodies && <Stat swatch="bg-red-500" value={lostStats?.lostCount ?? "-"} label={t("wb.lost")} />}
        {lostStats && <Stat swatch="bg-orange-500" value={`~${Math.round(lostStats.totalHaLost / 100) * 100} ha`} label={t("wb.ha_lost")} />}
        {lostSummary && <Stat swatch="bg-red-500" value={lostSummary.fullyLost} label="fully lost" />}
        {lostSummary && <Stat swatch="bg-orange-500" value={lostSummary.reduced} label="at risk" />}
        {censusSummary && censusSummary.total > 0 && (
          <Stat swatch="bg-emerald-500" value={censusSummary.total} label={t("wb.census_surveyed")} />
        )}
        {lostStats && (
          <p className="text-xs text-slate-400 dark:text-slate-500 ml-auto hidden sm:block whitespace-nowrap">
            {t("wb.tagline").replace("{lostCount}", String(lostStats.lostCount))}
          </p>
        )}
      </>
    ) : viewMode === "restoration" ? (
      <>
        {restorationData && (
          <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap shrink-0">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{restorationData.total_scored.toLocaleString()}</span>{" "}
            {t("lr.total_scored")}
          </span>
        )}
        {PRIORITY_LEVELS.map((level) => (
          <div key={level} className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: getPriorityColor(level) }} />
            <span className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-slate-100">{priorityCounts[level]}</span> {t(`lr.${level}`)}
            </span>
          </div>
        ))}
        {restorationData && !curatedCohort && (
          <p className="text-xs text-slate-400 dark:text-slate-500 ml-auto hidden sm:block whitespace-nowrap">
            {t("lr.tagline").replace("{criticalCount}", String(priorityCounts.critical + priorityCounts.high))}
          </p>
        )}
      </>
    ) : (
      <span className="text-xs text-slate-600 dark:text-slate-400">
        Click a lake to see its catchment, feeder streams, and rooftop-harvest potential.
      </span>
    );

  const catchments = (
    <div className="flex-1 min-h-0">
      <CatchmentAtlasClient cityId={cityId} cityDisplayName={config.displayName} center={view.center} zoom={view.zoom} />
    </div>
  );

  // Rich-data bodies (Pallikaranai etc.) open their own full-screen overlay instead of the sheet.
  const selectionPanel = !selected ? null : selected.kind === "current" && selected.richBodyId ? (
    <RichBodyOverlay bodyId={selected.richBodyId} onClose={close} />
  ) : (
    <BottomSheet onClose={close}>
      <UnifiedDetailPanel
        selected={selected}
        restorationData={selectedRestoration}
        cityHasRestorationCohort={curatedCohort}
        lostNarrative={selectedLostNarrative}
        onClose={close}
      />
    </BottomSheet>
  );

  // The sheet is a sibling of the map div so the desktop sidebar sits in the flex row.
  const mapArea = (
    <>
      <div className="relative flex-1 h-full">
        <UnifiedMap
          viewMode={viewMode}
          cityId={cityId}
          scoredData={restorationData?.water_bodies ?? []}
          censusData={censusData}
          onSelectCurrent={setSelected}
          onSelectLost={setSelected}
          onLostLayer={setLostLayer}
          focusCenter={focusCenter}
          hiddenCategories={hiddenCategories}
          currentGeoJsonUrl={waterBodiesCurrentUrl(cityId)}
          lostGeoJsonUrl={waterBodiesLostUrl(cityId)}
          riversGeoJsonUrl={riversUrl(cityId)}
          mapCenter={view.center}
          mapZoom={view.zoom}
        >
          <ElevationBandsLayer data={elevation.data} />
          {config.placeKind === "region" && <CorporationBoundaries cityId={cityId} />}
        </UnifiedMap>
        <ElevationBandsControl
          elevation={elevation}
          note="Ground height above sea level from satellite (FABDEM 30 m, buildings and forests removed) - the terrain each water body drains. Read as bands, not spot heights (~2 m vertical accuracy)."
        />
        <div className={`absolute sm:bottom-4 z-[1000] transition-[bottom] duration-300 left-2 right-auto md:left-auto md:right-4 ${selected ? "bottom-[148px] md:bottom-4" : "bottom-2"}`}>
          <UnifiedLegend
            viewMode={viewMode}
            hiddenCategories={hiddenCategories}
            visibleCategoryIds={legendIds}
            onToggleCategory={(cat) => setHiddenCategories((prev) => {
              const next = new Set(prev);
              if (next.has(cat)) next.delete(cat); else next.add(cat);
              return next;
            })}
          />
        </div>
        <MapInfoButton className="absolute top-20 left-2.5 z-[1000]">
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            {currentSource && (
              <div>
                {t("wb.osm_source")} <span className="font-semibold text-slate-700 dark:text-slate-300">{currentSource}</span>
              </div>
            )}
            {viewMode === "water-bodies" && lostSourceLabel && (
              <div>
                {t("wb.lost_source")} <span className="font-semibold text-slate-700 dark:text-slate-300">{lostSourceLabel}</span>
              </div>
            )}
            {viewMode === "water-bodies" && censusData.length > 0 && (
              <div>
                {t("wb.census_source")}{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">{t("wb.census_source_value")}</span>
              </div>
            )}
            {viewMode === "restoration" && restorationData && (
              <div>{t(curatedCohort ? "lr.source_note_flagship" : "lr.source_note")}</div>
            )}
          </div>
        </MapInfoButton>
        {hasWardSearch && (
          <WardSearch
            className="absolute top-2 right-2 sm:top-4 sm:right-4 z-[1000]"
            onSelect={(wardNum) => {
              const profile = wardProfiles.find((p) => p.ward_number === wardNum);
              if (profile) setFocusCenter([profile.centroid[1], profile.centroid[0]]);
            }}
          />
        )}
      </div>
      {selectionPanel}
    </>
  );

  if (!tabs) {
    return (
      <div className="h-[calc(100vh-64px)] flex flex-col">
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 items-center text-sm shrink-0">
          <span className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
            {config.displayName} - {config.stateCode}
          </span>
          {stats}
          <div className="ml-auto flex items-center gap-2">{toggle}</div>
        </div>
        {viewMode === "catchments" ? catchments : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">{mapArea}</div>
        )}
      </div>
    );
  }

  const chevron = (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Stats: one collapsed line on mobile, always open on desktop. */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shrink-0">
        {!statsOpen && (
          <button
            onClick={() => setStatsOpen(true)}
            className="sm:hidden w-full px-4 py-1.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400"
          >
            <span>{viewMode === "water-bodies" ? `${existingCount?.toLocaleString() ?? "-"} ${t("wb.existing")}${hasLostBodies ? ` - ${lostStats?.lostCount ?? "-"} ${t("wb.lost")}` : ""}` : `${restorationData?.total_scored.toLocaleString() ?? "-"} ${t("lr.total_scored")}`}</span>
            {chevron}
          </button>
        )}
        <div className={`${statsOpen ? "block" : "hidden"} sm:!flex px-4 py-2 sm:py-2.5 sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-1`}>
          <div className="sm:hidden flex justify-end mb-1">
            <button onClick={() => setStatsOpen(false)} className="text-slate-400 rotate-180">{chevron}</button>
          </div>
          {stats}
        </div>
      </div>

      <Tabs
        defaultValue="map"
        className="flex-1 flex flex-col overflow-hidden"
        onValueChange={(val) => {
          setActiveTab(val);
          if (val === "ranking") {
            setViewMode("restoration");
            setSelected(null); // so the table is visible on mobile
          }
        }}
      >
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 flex items-center justify-between">
          <TabsList variant="line" className="h-auto p-0 gap-6">
            <TabsTrigger value="map" className={TAB_CLASS}>{t("lr.tab_map")}</TabsTrigger>
            {hasRankingTab && <TabsTrigger value="ranking" className={TAB_CLASS}>{t("lr.tab_ranking")}</TabsTrigger>}
            {hasLegalRegister && <TabsTrigger value="register" className={TAB_CLASS}>Lake register</TabsTrigger>}
          </TabsList>
          {activeTab === "map" && <div className="flex items-center gap-2">{toggle}</div>}
        </div>
        <TabsContent value="map" className="flex-1 m-0 flex flex-col md:flex-row overflow-hidden">
          {viewMode === "catchments" ? catchments : mapArea}
        </TabsContent>
        {hasRankingTab && (
          <TabsContent value="ranking" className="flex-1 m-0 flex flex-col md:flex-row overflow-hidden">
            <div className={`flex-1 overflow-hidden ${selected ? "h-[55vh] md:h-full" : "h-full"}`}>
              {restorationData && <RestorationRankingTable data={restorationData.water_bodies} onSelect={selectRanked} />}
            </div>
            {selectionPanel}
          </TabsContent>
        )}
        {/* The gazetted register is a different POPULATION from the map's OSM polygons; the gap is the story. */}
        {hasLegalRegister && (
          <TabsContent value="register" className="flex-1 m-0 overflow-hidden">
            <LakeRegisterPanel cityId={cityId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
