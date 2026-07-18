"use client";

// Basin OVERVIEW mode - the hierarchy level above the deep-dive atlas
// (docs/specs/cauvery-basin-hierarchy.md §3). Renders when a manifest
// declares overviewMode: "sub-basins": a calm orientation surface - sub-basin
// choropleth with a metric switcher, a computed basin headline, the live
// reservoir strip, and problems-first sub-basin cards carrying the public
// depth ladder (Arkavati = L4, the bar every sub-basin is measured against).
//
// Everything renders from the basin's data files (sub-basins.geojson,
// scoreboard.json, reservoirs.geojson) - no source-system knowledge here.

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip as LeafletTooltip, Popup, useMap } from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import "leaflet/dist/leaflet.css";
import type { BasinInventory, BasinManifest, SubBasinRef } from "@/lib/basins";
import { useMapTiles } from "@/lib/utils/map-tiles";
import { AccountabilityMatrix, type AccountabilityData } from "@/components/basin/basin-atlas";

interface MetricValue {
  value: number | string;
  unit?: string;
  asOf?: string;
  source?: string;
  verified?: boolean;
}
interface ScoreboardEntry {
  name: string;
  metrics: Record<string, MetricValue>;
}
interface Scoreboard {
  asOf: string;
  subBasins: Record<string, ScoreboardEntry>;
}
interface LiveReservoir {
  code: string;
  date: string;
  storageTmc: number | null;
  storagePctFrl: number | null;
}

type MetricKey = "rainfallDeviationPct" | "gwLevelM" | "pollution";

// Rainfall/GW render ONLY once their scoreboard values carry verified: true -
// the M4 cross-check found KWRIS's devper is NOT seasonal deviation
// (Bengaluru's own Jun 1-Jul 17 total reads ~-35% vs normal while devper says
// -96%), so unverified values never reach the display. Pollution is computed
// from the CPCB stretch geometries client-side and is always available.
const METRIC_OPTIONS: { key: MetricKey; label: string; needsVerified?: boolean }[] = [
  { key: "pollution", label: "Pollution" },
  { key: "rainfallDeviationPct", label: "Rainfall", needsVerified: true },
  { key: "gwLevelM", label: "Groundwater", needsVerified: true },
];

// Sequential severity ramps (worse = darker/redder), neutral when unknown.
function metricColor(metric: MetricKey, v: number | null): string {
  if (v === null) return "#cbd5e1";
  if (metric === "rainfallDeviationPct") {
    // deviation from normal, %: 0 fine, deeply negative = deficit
    if (v >= -20) return "#93c5fd";
    if (v >= -60) return "#fbbf24";
    if (v >= -90) return "#f97316";
    return "#dc2626";
  }
  if (metric === "gwLevelM") {
    // metres below ground level: deeper = worse
    if (v < 8) return "#93c5fd";
    if (v < 15) return "#fbbf24";
    if (v < 22) return "#f97316";
    return "#dc2626";
  }
  // pollution: count of CPCB stretches touching the sub-basin
  if (v === 0) return "#a7f3d0";
  if (v === 1) return "#f97316";
  return "#dc2626";
}

function fetchJson(url: string): Promise<unknown | null> {
  return fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
}

// Use-based class chip colours (A best .. E worst - KSPCB/NWMP verdicts).
const CLASS_CHIP: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  B: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  C: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  D: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  E: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
};
const CLASS_DOT: Record<string, string> = { A: "#10b981", B: "#10b981", C: "#f59e0b", D: "#f97316", E: "#dc2626" };

/** Fit the map to the selected sub-basin polygon (or the whole basin). */
function FitToSelection({ geom }: { geom: GeoJSON.Geometry | null }) {
  const map = useMap();
  useEffect(() => {
    if (!geom) return;
    let minX = 180, minY = 90, maxX = -180, maxY = -90;
    const scan = (coords: unknown): void => {
      if (Array.isArray(coords) && typeof coords[0] === "number") {
        const [x, y] = coords as number[];
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      } else if (Array.isArray(coords)) {
        coords.forEach(scan);
      }
    };
    scan((geom as { coordinates: unknown }).coordinates);
    if (minX <= maxX) map.fitBounds([[minY, minX], [maxY, maxX]], { padding: [24, 24] });
  }, [geom, map]);
  return null;
}

function DepthPips({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`Data depth ${level} of 4 - how much of this sub-basin is mapped on this atlas (the Arkavathi has the fullest picture)`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            i <= level && level > 0 ? "bg-blue-600 dark:bg-blue-400" : i === 0 ? "bg-slate-400" : "bg-slate-200 dark:bg-slate-700"
          }`}
        />
      ))}
    </span>
  );
}

export function BasinOverview({
  manifest,
  inventory,
  embedded = false,
  initialSubBasinKey = null,
  onClose,
  onNavigateBasin,
}: {
  manifest: BasinManifest;
  inventory: BasinInventory | null;
  embedded?: boolean;
  /** Pre-select a sub-basin profile (embed ?sub= deep link). */
  initialSubBasinKey?: string | null;
  onClose?: () => void;
  /** Drill into a child deep-dive basin (manifest swap in the host). */
  onNavigateBasin?: (basinId: string) => void;
}) {
  const tiles = useMapTiles();
  const base = `/data/basins/${manifest.basinId}`;
  const [boundary, setBoundary] = useState<FeatureCollection | null>(null);
  const [subBasins, setSubBasins] = useState<FeatureCollection | null>(null);
  const [streams, setStreams] = useState<FeatureCollection | null>(null);
  const [tanks, setTanks] = useState<FeatureCollection | null>(null);
  const [stations, setStations] = useState<FeatureCollection | null>(null);
  const [reservoirs, setReservoirs] = useState<FeatureCollection | null>(null);
  const [prs, setPrs] = useState<FeatureCollection | null>(null);
  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null);
  const [live, setLive] = useState<Record<string, LiveReservoir>>({});
  const [metric, setMetric] = useState<MetricKey>("pollution");
  const [selectedKey, setSelectedKey] = useState<string | null>(initialSubBasinKey);
  // Per-sub-basin accountability matrices (the portable Arkavati contract):
  // fetched on selection; absent file (404 -> null) simply renders nothing.
  const [accBySub, setAccBySub] = useState<Record<string, AccountabilityData | null>>({});

  useEffect(() => {
    fetchJson(`${base}/boundary.geojson`).then((d) => setBoundary(d as FeatureCollection | null));
    fetchJson(`${base}/sub-basins.geojson`).then((d) => setSubBasins(d as FeatureCollection | null));
    fetchJson(`${base}/streams.geojson`).then((d) => setStreams(d as FeatureCollection | null));
    fetchJson(`${base}/tanks.geojson`).then((d) => setTanks(d as FeatureCollection | null));
    fetchJson(`${base}/wq-stations.geojson`).then((d) => setStations(d as FeatureCollection | null));
    fetchJson(`${base}/reservoirs.geojson`).then((d) => setReservoirs(d as FeatureCollection | null));
    fetchJson(`${base}/prs-stretches.geojson`).then((d) => setPrs(d as FeatureCollection | null));
    fetchJson(`${base}/scoreboard.json`).then((d) => setScoreboard(d as Scoreboard | null));
  }, [base]);

  // Live storage for reservoirs that join the daily feed.
  useEffect(() => {
    if (!reservoirs) return;
    const codes = reservoirs.features
      .map((f) => (f.properties as Record<string, unknown>)?.liveCode)
      .filter(Boolean);
    if (codes.length === 0) return;
    fetchJson(`/api/reservoir/basin?codes=${codes.join(",")}`).then((d) => {
      const rows = ((d as { reservoirs?: LiveReservoir[] })?.reservoirs ?? []);
      setLive(Object.fromEntries(rows.map((r) => [r.code, r])));
    });
  }, [reservoirs]);

  useEffect(() => {
    if (!selectedKey || selectedKey in accBySub) return;
    fetchJson(`${base}/accountability-${selectedKey}.json`).then((d) =>
      setAccBySub((cur) => ({ ...cur, [selectedKey]: (d as AccountabilityData | null) })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, base]);

  // When a sub-basin is picked on the MAP, bring its expanded card into view
  // in the panel (list clicks are already at the right scroll position).
  useEffect(() => {
    if (!selectedKey) return;
    const t = setTimeout(() => {
      document.getElementById("subbasin-profile")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
    return () => clearTimeout(t);
  }, [selectedKey]);

  const refs: SubBasinRef[] = useMemo(() => manifest.subBasins ?? [], [manifest.subBasins]);
  const refByKey = useMemo(() => Object.fromEntries(refs.map((r) => [r.key, r])), [refs]);

  // Pollution metric: CPCB stretches assigned to sub-basins by sampling a
  // stretch vertex against the sub-basin polygons (client-side, 5 features).
  const prsCountByKey = useMemo(() => {
    const out: Record<string, number> = {};
    if (!prs || !subBasins) return out;
    const polys = subBasins.features.map((f) => ({
      key: (f.properties as Record<string, unknown>)?.code as string,
      geom: f.geometry,
    }));
    const inRing = (x: number, y: number, ring: number[][]) => {
      let c = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const inGeom = (x: number, y: number, g: GeoJSON.Geometry): boolean => {
      if (g.type === "Polygon") return inRing(x, y, g.coordinates[0] as number[][]);
      if (g.type === "MultiPolygon") return g.coordinates.some((p) => inRing(x, y, p[0] as number[][]));
      return false;
    };
    const firstVertex = (g: GeoJSON.Geometry): number[] | null => {
      if (g.type === "LineString") return g.coordinates[Math.floor(g.coordinates.length / 2)] as number[];
      if (g.type === "MultiLineString") return g.coordinates[0][Math.floor(g.coordinates[0].length / 2)] as number[];
      if (g.type === "Polygon") return (g.coordinates[0] as number[][])[0];
      if (g.type === "MultiPolygon") return (g.coordinates[0][0] as number[][])[0];
      return null;
    };
    for (const f of prs.features) {
      const v = f.geometry ? firstVertex(f.geometry) : null;
      if (!v) continue;
      const hit = polys.find((p) => inGeom(v[0], v[1], p.geom));
      if (hit?.key) out[hit.key] = (out[hit.key] ?? 0) + 1;
    }
    return out;
  }, [prs, subBasins]);

  // A scoreboard metric is usable only when verified (see METRIC_OPTIONS).
  const verifiedMetric = (key: string, ref: SubBasinRef): MetricValue | null => {
    const m = scoreboard?.subBasins?.[ref.scoreboardKey]?.metrics?.[key];
    return m && m.verified ? m : null;
  };
  const metricAvailable = (key: MetricKey) =>
    key === "pollution" || refs.some((r) => verifiedMetric(key, r) !== null);
  const shownOptions = METRIC_OPTIONS.filter((m) => !m.needsVerified || metricAvailable(m.key));

  // "No CPCB stretch" is only meaningful where monitoring exists: a sub-basin
  // with zero WQ stations can't earn a green "none" - it renders as
  // not-assessed (grey) instead of implying cleanliness.
  const isAssessed = (ref: SubBasinRef): boolean =>
    (prsCountByKey[ref.key] ?? 0) > 0 ||
    Number(scoreboard?.subBasins?.[ref.scoreboardKey]?.metrics?.wqStationCount?.value ?? 0) > 0;

  const metricFor = (ref: SubBasinRef): number | null => {
    if (metric === "pollution") return isAssessed(ref) ? (prsCountByKey[ref.key] ?? 0) : null;
    const m = verifiedMetric(metric, ref);
    return m ? Number(m.value) : null;
  };

  // Most-polluted-first card order: worst NWMP class leads (E worst), then
  // CPCB stretch count, then size; unassessed sub-basins sink to the bottom.
  const orderedRefs = useMemo(() => {
    const classRank = (r: SubBasinRef) => {
      const c = scoreboard?.subBasins?.[r.scoreboardKey]?.metrics?.wqWorstClass?.value;
      return typeof c === "string" ? "ABCDE".indexOf(c) : -1;
    };
    return [...refs].sort((a, b) => {
      const cls = classRank(b) - classRank(a);
      if (cls !== 0) return cls;
      const diff = (prsCountByKey[b.key] ?? 0) - (prsCountByKey[a.key] ?? 0);
      return diff !== 0 ? diff : b.areaKm2 - a.areaKm2;
    });
  }, [refs, prsCountByKey, scoreboard]);

  // Headline uses only verified facts: stretch counts (computed here) and
  // the live reservoir feed. Rainfall/GW join once their values verify.
  const headline = useMemo(() => {
    const polluted = Object.values(prsCountByKey).filter((n) => n > 0).length;
    const stretchCount = Object.values(prsCountByKey).reduce((s, n) => s + n, 0);
    const liveVals = Object.values(live).map((r) => r.storagePctFrl).filter((v): v is number => v != null);
    const avgPct = liveVals.length ? Math.round(liveVals.reduce((s, v) => s + v, 0) / liveVals.length) : null;
    const devs = refs
      .map((r) => verifiedMetric("rainfallDeviationPct", r)?.value)
      .filter((v): v is number => typeof v === "number");
    const parts: string[] = [];
    if (stretchCount) parts.push(`${stretchCount} CPCB polluted stretches across ${polluted} of ${refs.length} sub-basins`);
    if (devs.length) parts.push(`${devs.filter((v) => v < -20).length} of ${devs.length} in rainfall deficit`);
    if (avgPct !== null) parts.push(`major reservoirs average ${avgPct}% of full level`);
    return parts.length ? parts.join("; ") + "." : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreboard, refs, prsCountByKey, live]);

  const selected = selectedKey ? refByKey[selectedKey] : null;
  const selectedScore = selected ? scoreboard?.subBasins?.[selected.scoreboardKey] : null;

  const subBasinStyle = (feat?: Feature) => {
    const key = (feat?.properties as Record<string, unknown>)?.code as string;
    const ref = refByKey[key];
    const v = ref ? metricFor(ref) : null;
    const isSel = key === selectedKey;
    return {
      color: isSel ? "#0f172a" : "#475569",
      weight: isSel ? 2.5 : 1,
      fillColor: metricColor(metric, v),
      fillOpacity: tiles.isDark ? 0.45 : 0.55,
    };
  };

  const legendStops =
    metric === "rainfallDeviationPct"
      ? [["near normal", "#93c5fd"], ["-20 to -60%", "#fbbf24"], ["-60 to -90%", "#f97316"], ["below -90%", "#dc2626"]]
      : metric === "gwLevelM"
        ? [["< 8 m", "#93c5fd"], ["8-15 m", "#fbbf24"], ["15-22 m", "#f97316"], ["> 22 m", "#dc2626"]]
        : [["none identified (monitored)", "#a7f3d0"], ["1 stretch", "#f97316"], ["2+", "#dc2626"]];

  // Selected sub-basin profile - rendered INLINE under its card in the
  // list (clicking the bottom card must not teleport focus to the top).
  const profileSection = selected ? (
    <div id="subbasin-profile">
          <section className="rounded-lg border-2 border-slate-300 dark:border-slate-600 p-2.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[13px] font-bold">{selected.name}</div>
                <div className="text-[11px] text-slate-400">{selected.areaKm2.toLocaleString()} sq km - depth <DepthPips level={selected.depthLevel} /></div>
              </div>
              <button onClick={() => setSelectedKey(null)} aria-label="Close profile" className="text-slate-400 hover:text-slate-600 text-sm">×</button>
            </div>
            {selected.blurb && <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug">{selected.blurb}</p>}
            <dl className="text-[12px] divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
              {([
                ["CPCB polluted stretches", isAssessed(selected) ? ({ value: prsCountByKey[selected.key] ?? 0, verified: true } as MetricValue) : undefined, (v: number) => `${v}`],
                ["MI tanks", selectedScore?.metrics?.tankCount, (v: number) => `${v}`],
                ["KSPCB WQ stations", selectedScore?.metrics?.wqStationCount, (v: number) => `${v}`],
                ["Reservoirs", selectedScore?.metrics?.reservoirCount, (v: number) => `${v}`],
                ["Rainfall deviation", selectedScore?.metrics?.rainfallDeviationPct, (v: number) => `${v}% vs normal`],
                ["Groundwater level", selectedScore?.metrics?.gwLevelM, (v: number) => `${v} m below ground`],
                ["Worst WQ class (NWMP)", selectedScore?.metrics?.wqWorstClass, () => ""],
              ] as [string, MetricValue | undefined, (v: number) => string][]).map(([label, mv, fmt]) => (
                <div key={label} className="flex justify-between gap-2 px-2 py-1">
                  <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="font-medium">
                    {!mv ? (
                      <span className="italic text-slate-400">not reported</span>
                    ) : mv.verified === false ? (
                      // Sourced but the period basis is unconfirmed - say so
                      // rather than display a possibly-misleading number.
                      <span className="italic text-slate-400" title="Sourced from KWRIS but the reporting period is unconfirmed; withheld until verified">pending verification</span>
                    ) : typeof mv.value === "string" && CLASS_CHIP[mv.value] ? (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CLASS_CHIP[mv.value]}`}>Class {mv.value}</span>
                    ) : (
                      fmt(Number(mv.value))
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {/* Stations with their published verdicts (L2 readings) */}
            {(() => {
              const rows = stations?.features
                .filter((f) => (f.properties as Record<string, unknown>)?.subBasin === selected.key)
                .map((f) => f.properties as Record<string, unknown>) ?? [];
              if (rows.length === 0) return null;
              return (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">WQ stations (KSPCB / NWMP)</div>
                  <ul className="mt-0.5 space-y-0.5">
                    {rows.map((p, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="truncate">{String(p.name)}{p.river ? ` (${String(p.river)})` : ""}</span>
                        {typeof p.worstClass === "string" ? (
                          <span className={`shrink-0 text-[9px] font-bold px-1 py-0.5 rounded ${CLASS_CHIP[p.worstClass as string]}`}>{String(p.worstClass)}</span>
                        ) : (
                          <span className="shrink-0 italic text-slate-400 text-[10px]">no classification</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {rows.some((p) => p.readingsPeriod) && (
                    <p className="mt-0.5 text-[10px] text-slate-400">Worst monthly use-based class, {String(rows.find((p) => p.readingsPeriod)?.readingsPeriod)}. A best - E worst.</p>
                  )}
                </div>
              );
            })()}
            {selected.unlocks && selected.unlocks.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Data we don&apos;t have yet</div>
                <ul className="list-disc pl-4 space-y-0.5">
                  {selected.unlocks.map((u, i) => (
                    <li key={i} className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{u}</li>
                  ))}
                </ul>
              </div>
            )}
            {/* Portable accountability matrix: the same contract + component
                as the Arkavati deep dive, fed by this stretch's own
                Action Plan + MPR extraction. */}
            {accBySub[selected.key] && <AccountabilityMatrix data={accBySub[selected.key]!} />}
            {selected.deepDiveBasinId && onNavigateBasin && (
              <button
                onClick={() => onNavigateBasin(selected.deepDiveBasinId!)}
                className="w-full rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[13px] font-semibold px-3 py-2"
              >
                Open the {selected.name} deep dive →
              </button>
            )}
          </section>
    </div>
  ) : null;

  return (
    <div className="absolute inset-0 flex flex-col md:flex-row bg-white dark:bg-slate-950">
      {/* Map */}
      <div className="relative flex-1 min-h-[45vh]">
        <MapContainer
          center={manifest.mapCenter}
          zoom={manifest.mapZoom}
          className="absolute inset-0"
          preferCanvas
        >
          <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
          {boundary && (
            <GeoJSON data={boundary} style={{ color: "#d946ef", weight: 2.5, fill: false, opacity: 0.9 }} interactive={false} />
          )}
          {streams && (
            <GeoJSON data={streams} style={{ color: "#3b82f6", weight: 1, opacity: 0.5 }} interactive={false} />
          )}
          {subBasins && (
            <GeoJSON
              key={`${metric}-${selectedKey}-${tiles.isDark}-${prs ? 1 : 0}`}
              data={subBasins}
              style={subBasinStyle}
              onEachFeature={(feat, layer) => {
                const p = feat.properties as Record<string, unknown>;
                const key = p?.code as string;
                const ref = refByKey[key];
                // Prefer the manifest's display name over the source-verbatim
                // geojson prop (KWRIS spells "Arkavati"; our display standard,
                // matching CPCB/KSPCB/NMCG/Paani usage, is "Arkavathi").
                layer.bindTooltip(`${ref?.name ?? p?.name ?? key}${ref?.deepDiveBasinId ? " - tap for the deep dive" : ""}`, { sticky: true });
                layer.on("click", () => setSelectedKey(key));
              }}
            />
          )}
          {/* Focus mode: fit to the selected sub-basin and reveal its own
              tanks + WQ stations (the L1/L2 layers, scoped not statewide). */}
          <FitToSelection
            geom={
              selectedKey
                ? (subBasins?.features.find((f) => (f.properties as Record<string, unknown>)?.code === selectedKey)?.geometry ?? null)
                : (boundary?.features[0]?.geometry ?? null)
            }
          />
          {selectedKey &&
            tanks?.features
              .filter((f) => (f.properties as Record<string, unknown>)?.subBasin === selectedKey && f.geometry?.type === "Point")
              .map((f, i) => {
                const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates as number[];
                const p = f.properties as Record<string, unknown>;
                const tankLabel = String(p.name || p.tankId || "MI tank");
                return (
                  <CircleMarker key={`t${i}`} center={[lat, lon]} radius={2.5} pathOptions={{ color: "#0284c7", weight: 1, fillColor: "#0284c7", fillOpacity: 0.7 }}>
                    <LeafletTooltip>{tankLabel}</LeafletTooltip>
                    <Popup>
                      <strong>{tankLabel}</strong>
                      <br />
                      <span style={{ fontSize: 11 }}>
                        Minor-irrigation tank
                        {p.areaHa ? ` - ${Number(p.areaHa).toFixed(1)} ha` : ""}
                        {p.catchment ? ` - ${String(p.catchment)} catchment` : ""}
                      </span>
                    </Popup>
                  </CircleMarker>
                );
              })}
          {selectedKey &&
            stations?.features
              .filter((f) => (f.properties as Record<string, unknown>)?.subBasin === selectedKey && f.geometry?.type === "Point")
              .map((f, i) => {
                const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates as number[];
                const p = f.properties as Record<string, unknown>;
                const worst = p.worstClass as string | undefined;
                const stationInfo = (
                  <>
                    <strong>{String(p.name)}</strong> ({String(p.river ?? "")})
                    {worst ? (
                      <>
                        <br />
                        <span style={{ fontSize: 11 }}>KSPCB water-quality station - worst class {worst}, latest {String(p.latestClass)} ({String(p.readingsPeriod)})</span>
                      </>
                    ) : (
                      <>
                        <br />
                        <span style={{ fontSize: 11 }}>KSPCB water-quality station - no published classification</span>
                      </>
                    )}
                  </>
                );
                return (
                  <CircleMarker key={`s${i}`} center={[lat, lon]} radius={5.5} pathOptions={{ color: "#0f172a", weight: 1, fillColor: worst ? CLASS_DOT[worst] : "#94a3b8", fillOpacity: 0.9 }}>
                    <LeafletTooltip>{stationInfo}</LeafletTooltip>
                    <Popup>{stationInfo}</Popup>
                  </CircleMarker>
                );
              })}
          {reservoirs?.features.map((f, i) => {
            const p = f.properties as Record<string, unknown>;
            if (f.geometry?.type !== "Point") return null;
            const [lon, lat] = f.geometry.coordinates as number[];
            const lv = p.liveCode ? live[p.liveCode as string] : undefined;
            const isLive = !!lv;
            const reservoirInfo = (
              <>
                <strong>{String(p.name ?? "Reservoir")}</strong>
                <br />
                <span style={{ fontSize: 11 }}>
                  {isLive && lv?.storagePctFrl != null
                    ? `${lv.storageTmc != null ? `${lv.storageTmc} TMC - ` : ""}${Math.round(lv.storagePctFrl)}% of FRL (${lv.date})`
                    : `Reservoir / tank location${p.district ? `, ${String(p.district)} district` : ""} - no live storage feed`}
                </span>
              </>
            );
            return (
              <CircleMarker
                key={i}
                center={[lat, lon]}
                radius={isLive ? 6 : 3.5}
                // Location-only reservoirs render as hollow rings so they read
                // as markers, not data - the grey fill was muddying into the
                // choropleth colours.
                pathOptions={isLive
                  ? { color: "#0f172a", weight: 1, fillColor: "#0891b2", fillOpacity: 0.9 }
                  : { color: "#334155", weight: 1.5, fillColor: "#ffffff", fillOpacity: 0.85 }}
              >
                <LeafletTooltip>{reservoirInfo}</LeafletTooltip>
                <Popup>{reservoirInfo}</Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* Metric switcher (only when there is actually a choice) + legend */}
        <div className="absolute top-3 right-3 z-[500] flex flex-col items-end gap-1.5">
          {shownOptions.length > 1 && (
            <div className="flex rounded-md overflow-hidden border border-slate-300 dark:border-slate-600 shadow bg-white dark:bg-slate-900">
              {shownOptions.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  className={`px-2.5 py-1 text-[11px] font-semibold ${
                    metric === m.key
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
          <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-[10px] text-slate-600 dark:text-slate-300 shadow space-y-0.5">
            <div className="font-semibold text-slate-700 dark:text-slate-200">
              {metric === "pollution" ? "CPCB polluted stretches" : metric === "gwLevelM" ? "Groundwater level" : "Rainfall vs normal"}
            </div>
            {legendStops.map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                {label}
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-slate-300" />
              {metric === "pollution" ? "not assessed (no stations)" : "no data"}
            </div>
            {/* Marker key - shown while a sub-basin is in focus and its own
                points are on the map. Every rendered symbol gets a legend row. */}
            {selectedKey && (
              <>
                <div className="pt-1 mt-0.5 border-t border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200">In this sub-basin</div>
                <div className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: "#0284c7" }} />MI tank</div>
                <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full border border-slate-900" style={{ backgroundColor: "#dc2626" }} />WQ station (colour = worst class, A-E)</div>
                <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full border border-slate-900" style={{ backgroundColor: "#0891b2" }} />Reservoir - live storage</div>
                <div className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-slate-600 bg-white" />Reservoir / tank - location only</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Panel */}
      <div className="w-full md:w-[380px] md:max-w-[45%] shrink-0 overflow-y-auto border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 p-3.5 space-y-3.5 text-slate-800 dark:text-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Basin overview</div>
            <h2 className="text-lg font-bold leading-snug">{manifest.displayName}</h2>
            {manifest.displayNameLocal && <div className="text-[12px] text-slate-500 dark:text-slate-400">{manifest.displayNameLocal}</div>}
          </div>
          {onClose && (
            <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {headline && (
          <p className="text-[13px] font-semibold leading-relaxed rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 p-2.5">
            {headline}
          </p>
        )}

        <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">{manifest.blurb}</p>

        {/* Live reservoir strip */}
        {Object.keys(live).length > 0 && reservoirs && (
          <section>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1.5">Major reservoirs - live storage</div>
            <div className="grid grid-cols-2 gap-1.5">
              {reservoirs.features
                .filter((f) => (f.properties as Record<string, unknown>)?.liveCode)
                .map((f) => {
                  const p = f.properties as Record<string, unknown>;
                  const lv = live[p.liveCode as string];
                  if (!lv) return null;
                  return (
                    <div key={String(p.liveCode)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                      <div className="text-[11px] font-semibold truncate">{String(p.name)}</div>
                      <div className="text-[15px] font-bold">{lv.storagePctFrl != null ? `${Math.round(lv.storagePctFrl)}%` : "-"}</div>
                      <div className="text-[10px] text-slate-400">{lv.storageTmc != null ? `${lv.storageTmc} TMC - ` : ""}{lv.date}</div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}


        {/* Sub-basin cards, problems first */}
        <section>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1.5">
            Sub-basins <span className="normal-case font-normal text-slate-400">(most polluted first &middot; more dots = more data on this atlas)</span>
          </div>
          <div className="space-y-1.5">
            {orderedRefs.map((r) => {
              const sc = scoreboard?.subBasins?.[r.scoreboardKey];
              const devM = verifiedMetric("rainfallDeviationPct", r);
              const dev = devM ? Number(devM.value) : undefined;
              const tanks = sc?.metrics?.tankCount?.value;
              const worst = sc?.metrics?.wqWorstClass?.value as string | undefined;
              const stretches = prsCountByKey[r.key] ?? 0;
              return (
                <button
                  key={r.key}
                  onClick={() => setSelectedKey(r.key)}
                  className={`w-full text-left rounded-lg border px-2.5 py-2 transition-colors ${
                    r.key === selectedKey
                      ? "border-slate-400 dark:border-slate-500 bg-slate-50 dark:bg-slate-800/60"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold flex items-center gap-1.5">
                      {r.name}
                      {worst && CLASS_CHIP[worst] && (
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${CLASS_CHIP[worst]}`}>{worst}</span>
                      )}
                    </span>
                    <DepthPips level={r.depthLevel} />
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {r.areaKm2.toLocaleString()} sq km
                    {typeof tanks === "number" && ` - ${tanks} tanks`}
                    {typeof dev === "number" && ` - rain ${dev}% vs normal`}
                    {stretches > 0 && <span className="text-rose-600 dark:text-rose-400"> - {stretches} polluted stretch{stretches > 1 ? "es" : ""}</span>}
                    {r.deepDiveBasinId && <span className="text-blue-600 dark:text-blue-400 font-medium"> - full deep dive →</span>}
                  </div>
                </button>
              );
            }).map((card, i) => (
              // Accordion: the selected card's profile expands right below it.
              <div key={orderedRefs[i].key}>
                {card}
                {orderedRefs[i].key === selectedKey && profileSection}
              </div>
            ))}
          </div>
        </section>

        {/* Scope + credits */}
        {manifest.areaNote && <p className="text-[11px] text-slate-400 leading-snug border-t border-slate-200 dark:border-slate-700 pt-2">{manifest.areaNote}</p>}
        {manifest.credits && (
          <details className="text-[11px] text-slate-400">
            <summary className="cursor-pointer font-semibold uppercase tracking-wider text-[10px]">Data on this map</summary>
            <ul className="mt-1 space-y-0.5">
              {manifest.credits.map((c, i) => (
                <li key={i} className="leading-snug">{c}</li>
              ))}
              {inventory && (
                <li className="leading-snug">
                  {Object.entries(inventory.families ?? {}).map(([f, v]) => `${f}: ${(v as { featureCount?: number }).featureCount}`).join(" - ")}
                </li>
              )}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
