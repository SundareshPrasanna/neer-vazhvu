"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Feature } from "geojson";
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

type EventCategory = "court_order" | "dispute" | "threshold" | "news" | "restoration";

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
  riverInfo,
}: ClientProps) {
  useLockBodyScroll();
  const [rivers, setRivers] = useState<RiverGeoFeature[]>([]);
  const [selectedRiverId, setSelectedRiverId] = useState<string | null>(null);
  const [cpcb, setCpcb] = useState<CpcbFile | null>(null);
  const [events, setEvents] = useState<RiverEvent[]>([]);
  const [industrial, setIndustrial] = useState<IndustrialSource[]>([]);

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
        // Prefer the city's mainstem river when present (Vaigai for
        // Madurai, Cooum for Chennai etc.) instead of an arbitrary
        // index-0 - feeders and tributaries should not load by default.
        const mainstem = out.find((r) =>
          ["vaigai", "cooum", "adyar"].includes(r.river_id)
        );
        if (mainstem) setSelectedRiverId(mainstem.river_id);
        else if (out.length > 0) setSelectedRiverId(out[0].river_id);
      })
      .catch(console.error);
  }, [cityId]);

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

  const industrialMarkers = useMemo(
    () =>
      industrial.map((s) => ({
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
  const selectedRiver = useMemo(
    () => rivers.find((r) => r.river_id === selectedRiverId) ?? null,
    [rivers, selectedRiverId],
  );
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
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Stats bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {cityDisplayName} · {scopeLabel}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {rivers.length} rivers
          {cpcbStationMarkers.length > 0 && ` · ${cpcbStationMarkers.length} CPCB stations`}
          {industrialMarkers.length > 0 && ` · ${industrialMarkers.length} industrial sources`}
          {" · click for details"}
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
            cpcbStations={cpcbStationMarkers}
            industrialSources={industrialMarkers}
          />
        </div>

        {/* Detail sidebar - same RiverPanel Chennai uses, with Madurai's
            extras (court orders + industrial sources for the selected
            river) passed through the additionalSections slot. */}
        <div className="hidden md:flex h-full md:w-96 lg:w-[420px] border-l border-slate-200 dark:border-slate-700 flex-col overflow-y-auto">
          {selectedRiverId && cpcb ? (
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
          ) : (
            <div className="p-4 text-sm text-slate-500">Click a river to see details.</div>
          )}
        </div>
      </div>

      {/* Mobile bottom panel - same component */}
      {selectedRiverId && cpcb && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 max-h-[40vh] overflow-y-auto">
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
};

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
              const tone = EVENT_TONE[e.category];
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
                      {e.actors.join(" · ")}
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
            Industrial sources affecting this river ({industrial.length})
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
