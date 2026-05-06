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

// Slim shape of public/data/river-quality-{cityId}.json - same schema
// Chennai's RiverQualityData uses but without the strict RiverId enum,
// so this works for any city's NWMP file.
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

interface IndustrialSource {
  id: string;
  name: string;
  name_ta?: string;
  type: string;
  lat: number;
  lng: number;
  operator: string;
  rivers_affected: string[];
  pollutants: string[];
  description: string;
  url?: string;
}

interface IndustrialSourcesFile {
  sources: IndustrialSource[];
}
interface CpcbStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  stretch: string;
  readings: CpcbReading[];
}
interface CpcbRiver {
  id: string;
  stations: CpcbStation[];
}
interface CpcbFile {
  data_year_range: [number, number];
  source: string;
  rivers: CpcbRiver[];
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
        if (out.length > 0) setSelectedRiverId(out[0].river_id);
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
  const selectedCpcbRiver = useMemo(
    () => cpcb?.rivers.find((r) => r.id === selectedRiverId) ?? null,
    [cpcb, selectedRiverId],
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

        {/* Detail sidebar */}
        <div className="hidden md:flex h-full md:w-96 lg:w-[420px] border-l border-slate-200 dark:border-slate-700 flex-col overflow-y-auto">
          {selectedInfo && selectedRiver ? (
            <RiverDetail
              info={selectedInfo}
              geomLengthKm={selectedRiver.length_km}
              nameTa={selectedRiver.name_ta}
              cpcbRiver={selectedCpcbRiver}
              events={selectedEvents}
              industrial={selectedIndustrial}
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
            cpcbRiver={selectedCpcbRiver}
            events={selectedEvents}
            industrial={selectedIndustrial}
          />
        </div>
      )}
    </div>
  );
}

function StationReadingsTable({ station }: { station: CpcbStation }) {
  if (station.readings.length === 0) return null;
  const sorted = [...station.readings].sort((a, b) => a.year - b.year);
  return (
    <div className="text-[11px] mt-1 overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-slate-500">
            <th className="text-left font-normal pr-2">Year</th>
            <th className="text-right font-normal pr-2">DO</th>
            <th className="text-right font-normal pr-2">BOD</th>
            <th className="text-right font-normal pr-2">pH</th>
            <th className="text-right font-normal">FC</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.year}>
              <td className="pr-2 text-slate-700 dark:text-slate-300">{r.year}</td>
              <td className="text-right pr-2 tabular-nums">{r.do_mgl ?? "-"}</td>
              <td className="text-right pr-2 tabular-nums">{r.bod_mgl ?? "-"}</td>
              <td className="text-right pr-2 tabular-nums">{r.ph ?? "-"}</td>
              <td className="text-right tabular-nums">{r.fecal_coliform_mpn ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const EVENT_TONE: Record<EventCategory, { bg: string; text: string; label: string }> = {
  court_order: { bg: "bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700",       text: "text-red-800 dark:text-red-200",       label: "Court order" },
  dispute:     { bg: "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700", text: "text-amber-800 dark:text-amber-200",   label: "Dispute" },
  threshold:   { bg: "bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700", text: "text-orange-800 dark:text-orange-200", label: "Threshold" },
  news:        { bg: "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600", text: "text-slate-700 dark:text-slate-300",   label: "News" },
  restoration: { bg: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700", text: "text-emerald-800 dark:text-emerald-200", label: "Restoration" },
};

function RiverDetail({
  info,
  geomLengthKm,
  nameTa,
  cpcbRiver,
  events,
  industrial,
}: {
  info: RiverInfo;
  geomLengthKm: number;
  nameTa: string;
  cpcbRiver: CpcbRiver | null;
  events: RiverEvent[];
  industrial: IndustrialSource[];
}) {
  const hasReadings = !!cpcbRiver?.stations.some((s) => s.readings.length > 0);
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

      {hasReadings && cpcbRiver ? (
        <div>
          <div className="text-[10px] uppercase text-slate-500 tracking-wider mb-1">
            CPCB NWMP annual readings
          </div>
          <div className="space-y-3">
            {cpcbRiver.stations
              .filter((s) => s.readings.length > 0)
              .map((s) => (
                <div key={s.id} className="border border-slate-200 dark:border-slate-700 rounded-md p-2">
                  <div className="font-medium text-xs text-slate-800 dark:text-slate-200">{s.name}</div>
                  <div className="text-[10px] text-slate-500">{s.stretch}</div>
                  <StationReadingsTable station={s} />
                </div>
              ))}
          </div>
          <p className="text-[10px] text-slate-400 italic mt-1.5">
            Values are min-max midpoints from CPCB annual River Water Quality reports. DO mg/L, BOD mg/L, FC = fecal coliform MPN/100ml.
          </p>
        </div>
      ) : (
        info.cpcb_nwmp_stations.length > 0 && (
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
              Annual NWMP samples (BOD, DO, pH, fecal coliform) - drop CPCB report PDFs in docs/cpcb/ and run scrape_cpcb_nwmp_vaigai.py to populate readings.
            </p>
          </div>
        )
      )}

      {events.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase text-slate-500 tracking-wider">
            Court orders &amp; key events ({events.length})
          </div>
          {events
            .slice()
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
        <div className="space-y-2">
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
              {s.url && (
                <a
                  href={s.url}
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
    </div>
  );
}
