"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Feature, Geometry, LineString, MultiLineString } from "geojson";
import { useLockBodyScroll } from "@/lib/hooks/use-lock-body-scroll";
import { useLanguage } from "@/lib/i18n/context";
// Shared types from the Chennai-baseline pollution + river-quality
// models. Each city's industrial-sources-{cityId}.json conforms to
// IndustrialPollutionData; PollutionSource is the per-row shape.
// RiverQualityData / SelectedRiver are reused from Chennai so the
// shared RiverPanel can render any city's data.
import type {
  PollutionSource as IndustrialSource,
  IndustrialPollutionData as IndustrialSourcesFile,
} from "@/types/industrial-pollution";
import type { RiverQualityData, SelectedRiver } from "@/types/river-quality";

import { RiverPanel } from "@/components/rivers/river-panel";
import { BasinAtlasClient } from "@/components/basin/basin-atlas-client";
import type { BasinFloor, BasinInventory, BasinManifest } from "@/lib/basins";
/** public/data/<city>-drain-quality.json. Delhi-only today; see
 *  neer-vazhvu-api/scripts/extract_delhi_drain_quality.py. */
interface DrainQualityFile {
  summary?: { months?: string[] };
  readings: Array<{
    name: string;
    group: string | null;
    lat: number | null;
    lng: number | null;
    month: string | null;
    no_flow: boolean;
    bod: number | null;
    cod: number | null;
  }>;
}


interface ClientProps {
  cityId: string;
  cityDisplayName: string;
  mapCenter: [number, number];
  mapZoom?: number;
  /** Place pill scope label, e.g. "Vaigai system" */
  scopeLabel: string;
  /** Show the "N rivers - N CPCB stations - ..." tally next to the scope
   *  label. Cities whose partner review asked for a cleaner header (Bengaluru)
   *  turn it off in the per-city header config. Default true. */
  showHeaderStats?: boolean;
  /** Label for the basin-atlas CTA button; defaults to the treatment-gaps
   *  framing used by the original Chennai-baseline surface. */
  atlasCtaLabel?: string;
  /** Per-river narrative metadata, keyed by river_id from the geojson. */
  riverInfo: Record<string, RiverInfo>;
  /** Optional deep basin atlas: when a river on this map belongs to a basin,
   *  clicking it opens the layered basin view as an overlay. */
  basin?: { manifest: BasinManifest; inventory: BasinInventory | null } | null;
  /** Optional parent-basin OVERVIEW (e.g. the Cauvery above Bengaluru's
   *  Arkavathi): a header button opens it as the same kind of overlay. */
  overviewBasin?: { manifest: BasinManifest; inventory: BasinInventory | null } | null;
}

// Rivers-page river_id -> basin riverId, where the two registries spell the
// same river differently (the rivers page predates the basin manifest).
const BASIN_RIVER_ALIAS: Record<string, string> = { arkavati: "arkavathi" };
const RIVERS_COACH_KEY = "rivers-drilldown-coach-dismissed";

/** Combine one or more line geometries into a single (Multi)LineString. */
function mergeLineGeoms(geoms: Geometry[]): LineString | MultiLineString | null {
  const lines: number[][][] = [];
  for (const g of geoms) {
    if (g.type === "LineString") lines.push(g.coordinates as number[][]);
    else if (g.type === "MultiLineString") lines.push(...(g.coordinates as number[][][]));
  }
  if (lines.length === 0) return null;
  return lines.length === 1
    ? { type: "LineString", coordinates: lines[0] }
    : { type: "MultiLineString", coordinates: lines };
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
  // Optional Tamil overrides. When the user has language=ta and the
  // override is present, the *_ta version replaces its English sibling
  // at render time. Falls back to English string if the override is
  // omitted, so single-language cities (Chennai) need no schema change.
  display_name_ta?: string;
  description_ta?: string;
  upstream_terminus_ta?: string;
  downstream_terminus_ta?: string;
  feeds_ta?: string;
  status_ta?: string;
  cpcb_nwmp_stations_ta?: string[];
  /** Native-script name shown under the English name (Hindi cities).
   *  Display-only, like the ta name line - full hi field overrides come
   *  with Delhi's translation pass. */
  display_name_hi?: string;
}

// CPCB reading shape used by the marker tooltip / colour-coding logic.
// The full reading schema is now imported via RiverQualityData; the
// type below is the minimum the marker layer needs.
interface CpcbReading {
  year: number;
  do_mgl: number | null;
  bod_mgl: number | null;
  ph: number | null;
  fecal_coliform_mpn: number | null;
}

type EventCategory =
  | "court_order"
  | "dispute"
  | "threshold"
  | "news"
  | "restoration"
  | "instrument"
  | "flood"
  | "audit"
  | "milestone";

interface RiverEvent {
  id: string;
  river_id: string;
  category: EventCategory;
  date: string;
  title: string;
  actors: string[];
  summary: string;
  url?: string;
  url_label?: string;
}

interface RiverEventsFile {
  events: RiverEvent[];
}

// Use Chennai's RiverQualityData shape directly so the shared
// RiverPanel can render Madurai's data without a transformer.
type CpcbFile = RiverQualityData;

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
  showHeaderStats = true,
  atlasCtaLabel,
  riverInfo,
  basin = null,
  overviewBasin = null,
}: ClientProps) {
  useLockBodyScroll();
  const [rivers, setRivers] = useState<RiverGeoFeature[]>([]);
  const [selectedRiverId, setSelectedRiverId] = useState<string | null>(null);
  // When set, the layered basin atlas is open (over the rivers map), scoped
  // to this basin river. Clicking a basin river opens it; everything else on
  // the standard rivers page is unchanged.
  const [openBasinRiverId, setOpenBasinRiverId] = useState<string | null>(null);
  // Parent-basin overview overlay (Cauvery above Bengaluru's rivers).
  const [overviewOpen, setOverviewOpen] = useState(false);
  // Which floor the atlas opens on (e.g. straight to gaps via the button).
  const [atlasFloor, setAtlasFloor] = useState<BasinFloor | undefined>(undefined);
  // More accurate basin river geometry (Paani), keyed by rivers-page river_id.
  const [basinRiverGeom, setBasinRiverGeom] = useState<Record<string, LineString | MultiLineString>>({});
  const [coachDismissed, setCoachDismissed] = useState(true);

  // basin riverId -> rivers-page river_id (reverse of the spelling alias).
  const reverseAlias = useMemo(
    () => Object.fromEntries(Object.entries(BASIN_RIVER_ALIAS).map(([k, v]) => [v, k])),
    [],
  );

  // The basin riverId a rivers-page river maps to, or null if it has no basin.
  function basinRiverIdFor(riverId: string): string | null {
    if (!basin) return null;
    const target = BASIN_RIVER_ALIAS[riverId] ?? riverId;
    return basin.manifest.rivers.find((r) => r.riverId === target)?.riverId ?? null;
  }

  // Clicking a river that has a basin opens the deep atlas; otherwise the
  // standard select-and-show-panel behaviour.
  function handleSelectRiver(riverId: string | null) {
    const bid = riverId ? basinRiverIdFor(riverId) : null;
    if (bid) { setAtlasFloor(undefined); setOpenBasinRiverId(bid); }
    else setSelectedRiverId(riverId);
  }
  const [cpcb, setCpcb] = useState<CpcbFile | null>(null);
  const [events, setEvents] = useState<RiverEvent[]>([]);
  const [industrial, setIndustrial] = useState<IndustrialSource[]>([]);
  const [drainFile, setDrainFile] = useState<DrainQualityFile | null>(null);

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
        // Pre-select the mainstem river ONLY for cities WITHOUT a basin atlas
        // (e.g. Madurai), where the quality panel is the primary surface. For
        // cities WITH a basin (e.g. Bengaluru), don't auto-open a panel: the
        // "click to drill into the basin" coach mark guides the user into the
        // atlas, and an auto-opened panel would compete with it.
        if (!basin) {
          const mainstem = out.find((r) =>
            ["vaigai", "cooum", "adyar", "vrishabhavathi", "yamuna"].includes(r.river_id)
          );
          if (mainstem) setSelectedRiverId(mainstem.river_id);
          else if (out.length > 0) setSelectedRiverId(out[0].river_id);
        }
      })
      .catch(console.error);
  }, [cityId, basin]);

  // Optional CPCB NWMP overlay - 404 (no file) is expected and silent.
  useEffect(() => {
    fetch(`/data/river-quality-${cityId}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CpcbFile | null) => setCpcb(data))
      .catch(() => setCpcb(null));
  }, [cityId]);

  // Optional court orders + news events overlay.
  useEffect(() => {
    fetch(`/data/river-events-${cityId}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<RiverEventsFile>) : null))
      .then((data) => setEvents(data?.events ?? []))
      .catch(() => setEvents([]));
  }, [cityId]);

  // Optional industrial pollution sources overlay.
  useEffect(() => {
    fetch(`/data/industrial-sources-${cityId}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<IndustrialSourcesFile>) : null))
      .then((data) => setIndustrial(data?.sources ?? []))
      .catch(() => setIndustrial([]));
  }, [cityId]);

  // Optional monitored-drain overlay. Only Delhi publishes a drain network at
  // this granularity today; the fetch simply 404s elsewhere and the layer
  // stays empty, so no city gate is needed.
  useEffect(() => {
    fetch(`/data/${cityId}-drain-quality.json`)
      .then((r) => (r.ok ? (r.json() as Promise<DrainQualityFile>) : null))
      .then((data) => setDrainFile(data))
      .catch(() => setDrainFile(null));
  }, [cityId]);

  // The basin carries a more accurate river line (Paani) than the OSM rivers
  // file; use it to draw the basin's rivers on this page too.
  useEffect(() => {
    if (!basin) return;
    fetch(`/data/basins/${basin.manifest.basinId}/rivers.geojson`)
      .then((r) => (r.ok ? (r.json() as Promise<{ features: Feature[] }>) : null))
      .then((fc) => {
        if (!fc) return;
        const byPageId: Record<string, Geometry[]> = {};
        for (const f of fc.features) {
          const bid = (f.properties as { riverId?: string } | null)?.riverId;
          if (!bid || !f.geometry) continue;
          const pageId = reverseAlias[bid] ?? bid;
          (byPageId[pageId] ??= []).push(f.geometry);
        }
        const out: Record<string, LineString | MultiLineString> = {};
        for (const [pageId, geoms] of Object.entries(byPageId)) {
          const merged = mergeLineGeoms(geoms);
          if (merged) out[pageId] = merged;
        }
        setBasinRiverGeom(out);
      })
      .catch(() => {});
  }, [basin, reverseAlias]);

  useEffect(() => {
    setCoachDismissed(localStorage.getItem(RIVERS_COACH_KEY) === "1");
  }, []);

  // Rivers drawn on the map: basin rivers use the more accurate basin geometry.
  const displayRivers = useMemo(
    () =>
      rivers.map((r) =>
        basinRiverGeom[r.river_id] ? { ...r, geometry: basinRiverGeom[r.river_id] } : r,
      ),
    [rivers, basinRiverGeom],
  );

  // Names of the rivers on this page that drill into the basin (for the hint).
  const drillableNames = useMemo(() => {
    if (!basin) return [];
    const pageIds = new Set(rivers.map((r) => r.river_id));
    return basin.manifest.rivers
      .map((r) => ({ name: r.displayName, pageId: reverseAlias[r.riverId] ?? r.riverId }))
      .filter((x) => pageIds.has(x.pageId))
      .map((x) => x.name);
  }, [basin, rivers, reverseAlias]);

  const selectedEvents = useMemo(
    () => events.filter((e) => e.river_id === selectedRiverId),
    [events, selectedRiverId],
  );

  const selectedIndustrial = useMemo(
    () =>
      selectedRiverId
        ? industrial.filter((s) => s.rivers_affected.includes(selectedRiverId))
        : [],
    [industrial, selectedRiverId],
  );

  // Show ONE month - the most recent - rather than every reading stacked on
  // the same point. A drain that was trapped in June but flowing in May must
  // read as trapped now, not as two contradictory markers.
  const drainMarkers = useMemo(() => {
    const rows = (drainFile?.readings ?? []).filter(
      (r) => typeof r.lat === "number" && typeof r.lng === "number",
    );
    if (rows.length === 0) return [];
    const latest = rows.reduce((m, r) => (r.month && r.month > m ? r.month : m), "");
    return rows
      .filter((r) => r.month === latest)
      .map((r, i) => ({
        id: `${r.name}-${i}`,
        name: r.name,
        lat: r.lat as number,
        lng: r.lng as number,
        group: r.group,
        noFlow: r.no_flow,
        bod: r.bod,
        cod: r.cod,
        month: r.month,
      }));
  }, [drainFile]);

  const drainMonth = useMemo(
    () => drainMarkers[0]?.month ?? null,
    [drainMarkers],
  );

  const industrialMarkers = useMemo(
    () =>
      industrial
        // A source may legitimately have no coordinates: Delhi's SMA CETP is
        // real and carries its full flow series, but neither "SMA Industrial
        // Area" nor "Shahzada Bagh" is in OpenStreetMap, so it was recorded
        // without a position rather than placed by guesswork. Leaflet throws
        // "Invalid LatLng object" on a null centre, which would take the whole
        // rivers map down, so unplaced sources are filtered here instead.
        .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
        .map((s) => ({
          id: s.id,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          type: s.type,
          rivers_affected: s.rivers_affected,
        })),
    [industrial],
  );

  const selectedInfo = selectedRiverId ? riverInfo[selectedRiverId] : null;
  // The full quality panel only makes sense when the selected channel actually
  // has an entry in the quality file - Delhi's DPCC feed covers the Yamuna but
  // not the Munak carrier or the drains; without this guard those render an
  // empty panel (QA: the "black strip", auto-selected sahibi on load).
  const selectedHasQuality =
    !!cpcb && !!selectedRiverId && cpcb.rivers.some((r) => r.id === selectedRiverId);
  const selectedRiver = useMemo(
    () => displayRivers.find((r) => r.river_id === selectedRiverId) ?? null,
    [displayRivers, selectedRiverId],
  );

  // A river on a basin-city that doesn't (yet) drill into the basin: tell the
  // user the layered view is in progress rather than implying it exists.
  const basinComingSoon = !!basin && !!selectedRiverId && !basinRiverIdFor(selectedRiverId);
  const comingSoonNote = basinComingSoon ? (
    <div className="m-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-800 dark:text-amber-200">
      Layered basin data (pollution, monitoring &amp; infrastructure) for this river is being worked on - coming soon.
    </div>
  ) : null;
  // Flatten CPCB stations across all rivers for the map markers; latest
  // reading is the row with the highest year, even if some metrics are
  // null.
  const cpcbStationMarkers = useMemo(() => {
    if (!cpcb) return [];
    return cpcb.rivers.flatMap((r) =>
      r.stations.map((s) => {
        const sorted = [...s.readings].sort((a, b) => b.year - a.year);
        const latest = sorted[0] ?? null;
        return {
          id: s.id,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          river_id: r.id,
          has_readings: s.readings.length > 0,
          latest_bod: latest?.bod_mgl ?? null,
          latest_do: latest?.do_mgl ?? null,
          latest_year: latest?.year ?? null,
        };
      }),
    );
  }, [cpcb]);

  return (
    <div className="relative h-[calc(100vh-64px)] flex flex-col">
      {/* Stats bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300 sm:whitespace-nowrap">
          {cityDisplayName} - {scopeLabel}
        </span>
        {showHeaderStats && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {rivers.length} rivers
            {cpcbStationMarkers.length > 0 && ` - ${cpcbStationMarkers.length} CPCB stations`}
            {industrialMarkers.length > 0 && ` - ${industrialMarkers.length} industrial sources`}
            {/* The month is stated next to the count because this feed is not
                live and the reader should not assume today's state: DPCC's
                listing holds only a rolling few months. */}
            {drainMarkers.length > 0 &&
              ` - ${drainMarkers.length} monitored drains${drainMonth ? ` (${drainMonth})` : ""}`}
            {" - click for details"}
          </span>
        )}
        {(basin || overviewBasin) && (
          <span className="ml-auto inline-flex items-center gap-1.5">
            {overviewBasin && (
              <button
                onClick={() => setOverviewOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-3 py-1 shadow-sm"
              >
                <span aria-hidden>&uarr;</span> {overviewBasin.manifest.displayName}
              </button>
            )}
            {basin && drillableNames.length > 0 && (
              <button
                onClick={() => { setAtlasFloor("governance"); setOpenBasinRiverId("__gaps__"); }}
                className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-1 shadow-sm"
              >
                {atlasCtaLabel ?? "Treatment & waste gaps"}
                <span aria-hidden>&rarr;</span>
              </button>
            )}
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map */}
        <div className="relative flex-1 h-full">
          <RiversLeafletMap
            rivers={displayRivers}
            selectedRiverId={selectedRiverId}
            onSelectRiver={handleSelectRiver}
            mapCenter={mapCenter}
            mapZoom={mapZoom}
            riverInfo={riverInfo}
            cpcbStations={cpcbStationMarkers}
            industrialSources={industrialMarkers}
            drains={drainMarkers}
          />

          {/* Drill-down hint: shown where at least one river opens a basin atlas. */}
          {drillableNames.length > 0 && !coachDismissed && !openBasinRiverId && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[600] max-w-[88%] sm:max-w-md bg-slate-900/95 text-white text-xs rounded-xl px-3.5 py-2 shadow-lg flex items-center gap-3">
              <span>
                Click on a river to explore its basin in detail. Pollution &middot; Monitoring &middot; Infrastructure &middot; Governance &middot; Restoration
              </span>
              <button
                onClick={() => { localStorage.setItem(RIVERS_COACH_KEY, "1"); setCoachDismissed(true); }}
                className="shrink-0 text-slate-300 hover:text-white underline"
              >
                don&apos;t show again
              </button>
            </div>
          )}
        </div>

        {/* Detail sidebar. Three modes:
              1. selectedRiver + cpcb data -> full RiverPanel (Chennai/Madurai)
              2. selectedRiver, no cpcb    -> minimal info panel from
                 riverInfo (Bengaluru today, until CPCB monitoring is
                 wired up). Shows description / upstream / downstream /
                 feeds / status from the per-city config.
              3. nothing selected          -> placeholder hint. */}
        {/* Detail sidebar appears only when a river WITHOUT a basin drill-down
            is selected (basin rivers open the atlas instead). No empty
            placeholder - the sidebar shows up once such a river is clicked. */}
        {selectedRiverId && (
        <div className="hidden md:flex h-full md:w-96 lg:w-[420px] border-l border-slate-200 dark:border-slate-700 flex-col overflow-y-auto">
          {comingSoonNote}
          {selectedHasQuality && cpcb ? (
            <RiverPanel
              selected={{ riverId: selectedRiverId, latlng: mapCenter }}
              qualityData={cpcb}
              cityId={cityId}
              cityDisplayName={cityDisplayName}
              additionalSections={
                <RiverExtraSections events={selectedEvents} industrial={selectedIndustrial} />
              }
              onClose={() => setSelectedRiverId(null)}
            />
          ) : selectedInfo ? (
            <RiverInfoOnlyPanel info={selectedInfo} cityDisplayName={cityDisplayName} onClose={() => setSelectedRiverId(null)} />
          ) : (
            <div className="p-4 text-sm text-slate-500">No detailed data for this river yet.</div>
          )}
        </div>
        )}
      </div>

      {/* Mobile bottom panel - same modes as desktop sidebar */}
      {selectedRiverId && selectedHasQuality && cpcb && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 max-h-[40vh] overflow-y-auto">
          {comingSoonNote}
          <RiverPanel
            selected={{ riverId: selectedRiverId, latlng: mapCenter }}
            qualityData={cpcb}
            cityId={cityId}
            cityDisplayName={cityDisplayName}
            additionalSections={
              <RiverExtraSections events={selectedEvents} industrial={selectedIndustrial} />
            }
            onClose={() => setSelectedRiverId(null)}
          />
        </div>
      )}
      {selectedRiverId && !selectedHasQuality && selectedInfo && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 max-h-[40vh] overflow-y-auto">
          {comingSoonNote}
          <RiverInfoOnlyPanel info={selectedInfo} cityDisplayName={cityDisplayName} onClose={() => setSelectedRiverId(null)} />
        </div>
      )}

      {/* Layered basin atlas, opened by clicking a river that has basin data.
          Opens at the WHOLE-BASIN view (not scoped to the clicked river) so the
          full picture shows first; the user drills into a sub-catchment from
          there. Overlays the rivers map; "Back to rivers" returns. */}
      {basin && openBasinRiverId && (
        <div className="absolute inset-0 z-[1000] bg-white dark:bg-slate-950">
          <BasinAtlasClient
            cityId={cityId}
            cityDisplayName={cityDisplayName}
            manifest={basin.manifest}
            inventory={basin.inventory}
            initialRiverId={null}
            initialFloor={atlasFloor}
            embedded
            onClose={() => { setOpenBasinRiverId(null); setAtlasFloor(undefined); }}
          />
        </div>
      )}

      {/* Parent-basin overview overlay (e.g. Cauvery KA above Bengaluru).
          Same basin-stack client: its Arkavati cell drills into the deep
          dive in place; closing returns to the rivers map. */}
      {overviewBasin && overviewOpen && !openBasinRiverId && (
        <div className="absolute inset-0 z-[1000] bg-white dark:bg-slate-950">
          <BasinAtlasClient
            cityId={cityId}
            cityDisplayName={cityDisplayName}
            manifest={overviewBasin.manifest}
            inventory={overviewBasin.inventory}
            embedded
            onClose={() => setOverviewOpen(false)}
          />
        </div>
      )}
    </div>
  );
}


/* ── Extra sections rendered inside the shared RiverPanel ────────────
   Court-orders / events panel + industrial pollution sources filtered
   to the selected river. Both are city-extras the Chennai-baseline
   RiverPanel doesn't ship by default. */

const EVENT_TONE: Record<EventCategory, { bg: string; text: string; label: string }> = {
  court_order: { bg: "bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700",       text: "text-red-800 dark:text-red-200",       label: "Court order" },
  dispute:     { bg: "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700", text: "text-amber-800 dark:text-amber-200",   label: "Dispute" },
  threshold:   { bg: "bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700", text: "text-orange-800 dark:text-orange-200", label: "Threshold" },
  news:        { bg: "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600", text: "text-slate-700 dark:text-slate-300",   label: "News" },
  restoration: { bg: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700", text: "text-emerald-800 dark:text-emerald-200", label: "Restoration" },
  // Delhi's Yamuna timeline categories (river-events-delhi.json).
  instrument:  { bg: "bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700", text: "text-blue-800 dark:text-blue-200", label: "Instrument" },
  flood:       { bg: "bg-cyan-100 dark:bg-cyan-900/40 border-cyan-300 dark:border-cyan-700", text: "text-cyan-800 dark:text-cyan-200", label: "Flood" },
  audit:       { bg: "bg-violet-100 dark:bg-violet-900/40 border-violet-300 dark:border-violet-700", text: "text-violet-800 dark:text-violet-200", label: "Audit" },
  milestone:   { bg: "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600", text: "text-slate-700 dark:text-slate-300", label: "Milestone" },
};

/** Unknown categories must degrade to the news tone, never crash the panel. */
const DEFAULT_TONE = EVENT_TONE.news;

function RiverExtraSections({ events, industrial }: { events: RiverEvent[]; industrial: IndustrialSource[] }) {
  if (events.length === 0 && industrial.length === 0) return null;
  return (
    <>
      {events.length > 0 && (
        <div className="mb-5 space-y-2">
          <div className="text-[10px] uppercase text-slate-500 tracking-wider">
            Court orders &amp; key events ({events.length})
          </div>
          {[...events]
            .sort((a, b) => (b.date > a.date ? 1 : -1))
            .map((e) => {
              const tone = EVENT_TONE[e.category] ?? DEFAULT_TONE;
              return (
                <div key={e.id} className={`border rounded-md p-2 ${tone.bg}`}>
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className={`text-[10px] uppercase font-medium tracking-wider ${tone.text}`}>
                      {tone.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      {e.date}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    {e.title}
                  </div>
                  {e.actors.length > 0 && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {e.actors.join(" - ")}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed mt-1.5">
                    {e.summary}
                  </p>
                  {e.url && (
                    <a
                      href={e.url}
                      target={e.url.startsWith("/") ? undefined : "_blank"}
                      rel={e.url.startsWith("/") ? undefined : "noopener noreferrer"}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline mt-1.5 inline-block"
                    >
                      {e.url_label ?? "Source →"}
                    </a>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {industrial.length > 0 && (
        <div className="mb-5 space-y-2">
          <div className="text-[10px] uppercase text-slate-500 tracking-wider">
            Industrial sources reported to affect this river ({industrial.length})
          </div>
          {industrial.map((s) => (
            <div key={s.id} className="border border-slate-200 dark:border-slate-700 rounded-md p-2 bg-white/50 dark:bg-slate-900/50">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {s.name}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                  {s.type.replace(/_/g, " ")}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                {s.operator}
              </div>
              {s.pollutants.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.pollutants.map((p) => (
                    <span
                      key={p}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed mt-1.5">
                {s.description}
              </p>
              {s.source && (
                <a
                  href={s.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline mt-1.5 inline-block"
                >
                  Source →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}


/* ── River info-only panel ────────────────────────────────────────────
   Renders the per-city RIVER_INFO description for cities that do not
   yet have a CPCB NWMP quality file. Bengaluru today: KSPCB monthly
   lake WQ is on roadmap, river WQ is patchier; until those land we
   surface the engineering-doc river description as the click target. */

function RiverInfoOnlyPanel({
  info,
  cityDisplayName,
  onClose,
}: {
  info: RiverInfo;
  cityDisplayName: string;
  onClose: () => void;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 w-full h-full p-4 sm:p-6 overflow-y-auto">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
            {info.display_name}
          </h3>
          {(info.display_name_ta || info.display_name_hi) && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {info.display_name_ta || info.display_name_hi}
            </span>
          )}
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

      <div className="space-y-3 text-sm">
        {info.status && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
              Status
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{info.status}</p>
          </div>
        )}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
            About this river
          </div>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{info.description}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
              Length (geom)
            </div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {info.length_km_geom} km
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
              Source
            </div>
            <div className="text-slate-700 dark:text-slate-300">{info.upstream_terminus}</div>
          </div>
          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
              Mouth
            </div>
            <div className="text-slate-700 dark:text-slate-300">{info.downstream_terminus}</div>
          </div>
          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
              Feeds
            </div>
            <div className="text-slate-700 dark:text-slate-300">{info.feeds}</div>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-2 border-t border-slate-200 dark:border-slate-700">
          CPCB NWMP water-quality monitoring for {cityDisplayName} rivers is not yet wired into this dashboard. When it is, this panel will switch to the full Chennai-style quality + station view.
        </p>
      </div>
    </div>
  );
}
