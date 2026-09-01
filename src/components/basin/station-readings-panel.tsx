"use client";

// Station-readings panel (station-readings contract v1 - see
// docs/specs/flow-stations-contract.md). Renders whatever series a station's
// readings pack declares; it never knows which agency or basin it belongs to.
// Loaded lazily from BasinAtlas so recharts only ships when a readings
// station is actually clicked.
//
// Stations can be compared against each other: pick peers from the same
// family and every chart that both stations carry draws a line each. The
// upstream-vs-downstream read is the whole point - one station's BOD or
// discharge means much more beside the next one down the river.

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "@/components/theme-provider";
import type { ReadingsSeries, StationReadingsPack } from "@/lib/basins";

const MONTH_ABBR = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CLASS_COLORS: Record<string, string> = {
  A: "#059669", B: "#84cc16", C: "#f59e0b", D: "#ea580c", E: "#dc2626",
};

/** The station being viewed keeps each chart's established colour; peers take
 *  these in turn, so one station reads the same hue on every chart. */
const PEER_COLORS = ["#7c3aed", "#ea580c", "#0891b2", "#65a30d", "#be185d"];

/** Charts that overlay cleanly. A quartile band or a class timeline does not:
 *  two bands on one axis read as neither. Those stay single-station. Gauge
 *  levels are station-local datums (T. Narasipur ~317 m, the Kabini Reservoir
 *  ~1,482 m), so they read as single-station charts too, like climatology. */
const COMPARABLE = new Set([
  "discharge-monthly", "discharge-daily",
  "wq-param-series", "flow-duration", "annual-water-year",
]);

export interface ReadingsPeer {
  stationKey: string;
  name: string;
  /** Only peers from the same family are offered - a discharge gauge and a
   *  water-quality station share no series to draw against each other. */
  family: string;
  agency?: string;
}

interface Props {
  basinId: string;
  stationKey: string;
  /** Display fallbacks while the pack loads. */
  name?: string;
  /** Family of the station being viewed, used to scope the peer list. */
  family?: string;
  /** Every station in the basin whose pack exists, this one included. */
  peers?: ReadingsPeer[];
  onClose: () => void;
}

/** One line on a chart: a station and the series of its that matches. */
interface Track {
  key: string;
  label: string;
  color: string;
  series: ReadingsSeries;
}

export function StationReadingsPanel({ basinId, stationKey, name, family, peers, onClose }: Props) {
  // Keyed by station so a stale pack never renders for a newly clicked
  // station - no synchronous reset in the effect needed.
  const [loaded, setLoaded] = useState<{ key: string; pack: StationReadingsPack | null } | null>(null);
  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const [peerPacks, setPeerPacks] = useState<Record<string, StationReadingsPack | null>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    let live = true;
    fetch(`/data/basins/${basinId}/readings/${encodeURIComponent(stationKey)}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (live) setLoaded({ key: stationKey, pack: d }); })
      .catch(() => { if (live) setLoaded({ key: stationKey, pack: null }); });
    return () => { live = false; };
  }, [basinId, stationKey]);

  // A different station was clicked: start its comparison set empty rather
  // than carrying the previous station's peers onto an unrelated chart.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCompareKeys([]); setPickerOpen(false); }, [stationKey]);

  // Peer packs are fetched once each and kept, so toggling a station off and
  // on again is instant.
  useEffect(() => {
    let live = true;
    const missing = compareKeys.filter((k) => !(k in peerPacks));
    if (!missing.length) return;
    Promise.all(missing.map((k) =>
      fetch(`/data/basins/${basinId}/readings/${encodeURIComponent(k)}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
        .then((pack) => [k, pack] as const),
    )).then((entries) => {
      if (live) setPeerPacks((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
    return () => { live = false; };
  }, [compareKeys, peerPacks, basinId]);

  const pack = loaded?.key === stationKey ? loaded.pack : null;
  const failed = loaded?.key === stationKey && loaded.pack === null;

  const shown = useMemo(() => (pack?.series ?? []).filter((s) => s.verified), [pack]);
  const meta = [pack?.station.agency, pack?.station.siteType, pack?.station.river]
    .filter(Boolean).join(" · ");

  // Same family only, and never the station already on screen.
  const offered = useMemo(
    () => (peers ?? []).filter((p) => p.stationKey !== stationKey && (!family || p.family === family)),
    [peers, stationKey, family],
  );
  const colorOf = useMemo(() => {
    const m: Record<string, string> = {};
    compareKeys.forEach((k, i) => { m[k] = PEER_COLORS[i % PEER_COLORS.length]; });
    return m;
  }, [compareKeys]);

  /** The tracks to draw for one of the viewed station's series. */
  const tracksFor = (s: ReadingsSeries, primaryColor: string): Track[] => {
    const tracks: Track[] = [{
      key: "v", label: pack?.station.name ?? name ?? stationKey, color: primaryColor, series: s,
    }];
    if (!COMPARABLE.has(String(s.kind))) return tracks;
    for (const k of compareKeys) {
      const p = peerPacks[k];
      if (!p) continue;
      const match = p.series.find((o) => o.verified && o.kind === s.kind
        && (s.kind !== "wq-param-series" || o.param === s.param));
      if (match) {
        tracks.push({ key: `p_${k}`, label: p.station.name ?? k, color: colorOf[k] ?? PEER_COLORS[0], series: match });
      }
    }
    return tracks;
  };

  // Series the compared stations carry that this one does not. Without these,
  // opening a single-series station (the reservoir's gauge level) and comparing
  // it with a river station showed that one chart and silently hid everything
  // the peer actually measures (review, 27 Aug).
  const peerOnly = useMemo<ReadingsSeries[]>(() => {
    if (!compareKeys.length) return [];
    const mine = new Set(shown.filter((s) => COMPARABLE.has(String(s.kind))).map(seriesId));
    const out: ReadingsSeries[] = [];
    const seen = new Set<string>();
    for (const k of compareKeys) {
      for (const o of peerPacks[k]?.series ?? []) {
        if (!o.verified || !COMPARABLE.has(String(o.kind))) continue;
        const id = seriesId(o);
        if (mine.has(id) || seen.has(id)) continue;
        seen.add(id);
        out.push(o);
      }
    }
    return out;
  }, [compareKeys, peerPacks, shown]);

  /** Tracks for a peer-only series: no primary line, because the open station
   *  does not measure it. That absence IS the reading. */
  const peerTracksFor = (s: ReadingsSeries): Track[] => {
    const tracks: Track[] = [];
    for (const k of compareKeys) {
      const match = peerPacks[k]?.series.find((o) => o.verified && seriesId(o) === seriesId(s));
      if (match) {
        tracks.push({ key: `p_${k}`, label: peerPacks[k]?.station.name ?? k,
                      color: colorOf[k] ?? PEER_COLORS[0], series: match });
      }
    }
    return tracks;
  };

  // A station can be selected and still add nothing - the reservoir gauge has
  // no discharge to put beside a river station's. Say so rather than leaving
  // the reader wondering why the chart did not change.
  const contributing = new Set<string>();
  for (const s of shown) {
    if (!COMPARABLE.has(String(s.kind))) continue;
    for (const k of compareKeys) {
      const p = peerPacks[k];
      if (p?.series.some((o) => o.verified && o.kind === s.kind
        && (s.kind !== "wq-param-series" || o.param === s.param))) contributing.add(k);
    }
  }
  for (const s of peerOnly) {
    for (const k of compareKeys) {
      if (peerPacks[k]?.series.some((o) => o.verified && seriesId(o) === seriesId(s))) contributing.add(k);
    }
  }
  // A null pack is a peer whose fetch FAILED - saying it has no series in
  // common would be a claim about data nobody has seen.
  const unloadable = compareKeys.filter((k) => peerPacks[k] === null);
  const idle = compareKeys.filter((k) => peerPacks[k] != null && !contributing.has(k));

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Monitoring station</div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {pack?.station.name ?? name ?? stationKey}
          </h2>
          {meta && <div className="text-xs text-slate-500 dark:text-slate-400">{meta}</div>}
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {failed && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Readings could not be loaded for this station.
        </p>
      )}
      {!pack && !failed && <p className="text-xs text-slate-400">Loading readings…</p>}

      {pack?.period && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          Record: {pack.period.from} to {pack.period.to}
        </div>
      )}

      {pack && offered.length > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 space-y-2">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            className="flex w-full items-center justify-between gap-2 text-[12px] font-medium text-slate-700 dark:text-slate-200"
          >
            <span>
              Compare with other stations
              {compareKeys.length > 0 && (
                <span className="ml-1 font-normal text-slate-400">({compareKeys.length} on)</span>
              )}
            </span>
            <span aria-hidden className="text-slate-400">{pickerOpen ? "−" : "+"}</span>
          </button>

          {pickerOpen && (
            <div className="space-y-2 pt-1">
              {groupByAgency(offered).map(([agency, list]) => (
                <div key={agency}>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-1">{agency}</div>
                  <div className="flex flex-wrap gap-1">
                    {list.map((p) => {
                      const on = compareKeys.includes(p.stationKey);
                      return (
                        <button
                          key={p.stationKey}
                          onClick={() => setCompareKeys((prev) => on
                            ? prev.filter((k) => k !== p.stationKey)
                            : [...prev, p.stationKey])}
                          aria-pressed={on}
                          className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                            on
                              ? "text-white border-transparent"
                              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                          style={on ? { backgroundColor: colorOf[p.stationKey] } : undefined}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {compareKeys.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-[3px] rounded" style={{ backgroundColor: PRIMARY_COMPARE_COLOR }} />
                {pack.station.name ?? stationKey}
              </span>
              {compareKeys.map((k) => (
                <span key={k} className="flex items-center gap-1">
                  <span className="inline-block w-3 h-[3px] rounded" style={{ backgroundColor: colorOf[k] }} />
                  {peerPacks[k]?.station.name ?? k}
                </span>
              ))}
            </div>
          )}

          {idle.length > 0 && (
            <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-snug">
              No series in common with {idle.map((k) => peerPacks[k]?.station.name ?? k).join(", ")}
              , so nothing is added to these charts.
            </p>
          )}

          {unloadable.length > 0 && (
            <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-snug">
              Couldn&apos;t load readings for {unloadable.map((k) => offered.find((p) => p.stationKey === k)?.name ?? k).join(", ")}.
            </p>
          )}
        </div>
      )}

      {shown.map((s, i) => (
        <SeriesBlock
          key={`${s.kind}-${i}`}
          s={s}
          tracks={tracksFor(s, compareKeys.length ? PRIMARY_COMPARE_COLOR : primaryColorFor(String(s.kind)))}
          comparing={compareKeys.length > 0}
          isDark={isDark}
        />
      ))}

      {peerOnly.length > 0 && (
        <div className="space-y-3 pt-1 border-t border-dashed border-slate-200 dark:border-slate-700">
          <p className="text-[10px] text-slate-400 leading-snug pt-1">
            Not measured at {pack?.station.name ?? stationKey}, and measured at the station
            {compareKeys.length > 1 ? "s" : ""} you added:
          </p>
          {peerOnly.map((s, i) => (
            <SeriesBlock key={`peer-${s.kind}-${i}`} s={s} tracks={peerTracksFor(s)} comparing isDark={isDark} />
          ))}
        </div>
      )}

      {pack && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Source: {pack.source.url ? (
            <a href={pack.source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{pack.source.label}</a>
          ) : pack.source.label}
          {" · "}fetched {pack.source.fetched}
          {pack.source.licence ? <> · {pack.source.licence}</> : null}
        </div>
      )}
    </div>
  );
}

function groupByAgency(peers: ReadingsPeer[]): [string, ReadingsPeer[]][] {
  const groups = new Map<string, ReadingsPeer[]>();
  for (const p of peers) {
    const k = p.agency || "Other";
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/** Identity of a series for comparison: kind, and parameter where kind alone
 *  is not enough to tell two series apart. */
const seriesId = (s: ReadingsSeries) => `${s.kind}|${s.kind === "wq-param-series" ? s.param ?? "" : ""}`;

/** The viewed station's colour once a comparison is on - matching the legend,
 *  which cannot show three different hues for one station. */
const PRIMARY_COMPARE_COLOR = "#2563eb";

function primaryColorFor(kind: string): string {
  if (kind === "wq-param-series") return "#9d174d";
  if (kind === "flow-duration") return "#0d9488";
  return "#2563eb";
}

/** Plain-language read of what each chart kind shows, one sentence under the
 *  chart - a first-time reader should not have to reverse-engineer the axes
 *  (Madhuri review, 31 Aug 2026). Keyed by kind, so it stays true for every
 *  station and basin; the per-series `note` carries the specifics. */
const KIND_EXPLAINER: Record<string, string> = {
  "discharge-monthly": "Each point is the average of that month's daily river-flow readings.",
  "discharge-daily": "One point per daily flow reading, as published.",
  "climatology-monthly": "The typical year: for each calendar month, the median daily flow on record and the band the middle half falls in.",
  "flow-duration": "How often a flow is met or exceeded: the value at 10% was reached on at least 10% of recorded days. The left end is flood, the right end is dry-weather flow.",
  "annual-water-year": "Average flow over each water year, beside each station's own long-term average (dashed line).",
  "gauge-level-monthly": "Monthly average water level against the station's own gauge datum - levels read within a station, not across stations.",
  "wq-param-series": "One reading per year from CPCB's annual river-quality tables, with the criterion line where one applies.",
  "wq-class-series": "CPCB water-quality class for each year, A (best) to E (worst).",
};

function SeriesBlock({ s, tracks, comparing, isDark }: {
  s: ReadingsSeries; tracks: Track[]; comparing: boolean; isDark: boolean;
}) {
  const singleOnly = comparing && !COMPARABLE.has(String(s.kind));
  return (
    <div>
      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
        {s.label ?? s.kind}
        {s.unit ? <span className="font-normal text-slate-400"> ({s.unit})</span> : null}
      </div>
      <SeriesChart s={s} tracks={tracks} isDark={isDark} />
      {singleOnly && (
        <div className="text-[10px] text-slate-400 leading-snug mt-0.5">
          This chart shows the selected station only.
        </div>
      )}
      {KIND_EXPLAINER[String(s.kind)] && (
        <div className="text-[10px] text-slate-400 leading-snug mt-0.5">{KIND_EXPLAINER[String(s.kind)]}</div>
      )}
      {s.note && <div className="text-[10px] text-slate-400 leading-snug mt-0.5">{s.note}</div>}
    </div>
  );
}

/** Merge every track's points onto one row per x value, so recharts can draw
 *  a line per station over a shared axis. A point's optional third element is
 *  the number of daily readings behind the value (see ReadingsPoint); it rides
 *  along as `<key>_n` for the hover readout, never plotted. */
function mergePoints(tracks: Track[], pick: (s: ReadingsSeries) => (string | number)[][]) {
  const rows = new Map<string, Record<string, string | number>>();
  for (const tr of tracks) {
    for (const [x, v, n] of pick(tr.series)) {
      const id = String(x);
      const row = rows.get(id) ?? { x };
      row[tr.key] = Number(v);
      if (n != null && Number.isFinite(Number(n))) row[`${tr.key}_n`] = Number(n);
      rows.set(id, row);
    }
  }
  return [...rows.values()].sort((a, b) =>
    typeof a.x === "number" && typeof b.x === "number"
      ? a.x - b.x
      : String(a.x).localeCompare(String(b.x)));
}

/** Compact hover readout.
 *
 *  recharts' default tooltip prints one "<full station name>: <value>" row per
 *  series. On a 150px chart with every station compared that box is taller and
 *  wider than the plot it sits on, so the reader loses the very thing a hover
 *  is for: where they are on the x-axis (review, 27 Aug). This keeps the rows
 *  to a swatch, a short name and the value, goes two-up past four series, and
 *  sorts by value so the stack is scannable. The x label leads, because that
 *  is the position being read. */
function HoverReadout({ active, payload, label, isDark, unit, labelFormat }: {
  active?: boolean;
  // An array value is a band (the climatology quartiles ship as [p25, p75]) -
  // it must survive the finite-number filter or the band row goes unreadable.
  payload?: { dataKey?: string | number; name?: string; value?: number | number[]; color?: string; payload?: Record<string, unknown> }[];
  label?: string | number;
  isDark: boolean;
  unit?: string;
  labelFormat?: (v: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  const isBand = (v: unknown): v is number[] =>
    Array.isArray(v) && v.length > 0 && v.every((n) => Number.isFinite(Number(n)));
  const sortVal = (v?: number | number[]) => (isBand(v) ? Math.max(...v.map(Number)) : Number(v));
  const rows = payload
    .filter((d) => isBand(d.value) || (d.value != null && Number.isFinite(Number(d.value))))
    .sort((a, b) => sortVal(b.value) - sortVal(a.value));
  if (!rows.length) return null;
  const twoUp = rows.length > 4;
  return (
    <div
      style={{
        backgroundColor: isDark ? "rgba(15,23,42,0.94)" : "rgba(255,255,255,0.96)",
        border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
        borderRadius: 6,
        padding: "4px 6px",
        fontSize: 10,
        lineHeight: 1.35,
        color: isDark ? "#e2e8f0" : "#0f172a",
        boxShadow: "0 1px 6px rgba(0,0,0,0.12)",
        maxWidth: twoUp ? 250 : 170,
        pointerEvents: "none",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 2 }}>
        {labelFormat && label != null ? labelFormat(label) : String(label ?? "")}
        {unit ? <span style={{ fontWeight: 400, opacity: 0.6 }}> - {unit}</span> : null}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: twoUp ? "1fr 1fr" : "1fr", columnGap: 8 }}>
        {rows.map((d, i) => {
          // How many daily readings stand behind an aggregated value - packs
          // built with counts put them beside the value as `<key>_n`
          // (Madhuri review, 31 Aug 2026: a 3-reading month must not read
          // like a 31-reading month). Older packs simply have none.
          const n = Number(d.payload?.[`${String(d.dataKey)}_n`]);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: d.color, flexShrink: 0 }} />
              <span style={{ opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", maxWidth: 92 }}>
                {shortName(String(d.name ?? ""))}
              </span>
              <span style={{ fontWeight: 600, marginLeft: "auto" }}>
                {isBand(d.value) ? d.value.map((v) => fmtValue(Number(v))).join(" - ") : fmtValue(Number(d.value))}
                {Number.isFinite(n) && n > 0 && (
                  <span style={{ fontWeight: 400, opacity: 0.6 }}> ·{n}d</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Station names run long ("Kabini at T. Narasipura water supply intake"). The
 *  swatch colour is what identifies the line; the text only has to disambiguate. */
function shortName(name: string): string {
  const cut = name.replace(/^(Kabini|Cauvery)\s+(at|near|d\/s|u\/s)\s+/i, "");
  return cut.length > 16 ? `${cut.slice(0, 15)}\u2026` : cut;
}

function fmtValue(v: number): string {
  if (!Number.isFinite(v)) return "-";
  const a = Math.abs(v);
  if (a >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (a >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

function SeriesChart({ s, tracks, isDark }: { s: ReadingsSeries; tracks: Track[]; isDark: boolean }) {
  const grid = isDark ? "#334155" : "#e2e8f0";
  const axis = isDark ? "#94a3b8" : "#64748b";
  const tickStyle = { fontSize: 9, fill: axis };
  switch (s.kind) {
    case "discharge-monthly":
    case "discharge-daily":
    case "gauge-level-monthly":
    case "wq-param-series": {
      const data = mergePoints(tracks, (x) => (x.points ?? []) as [string, number][]);
      return (
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="x" tick={tickStyle} minTickGap={40} />
            <YAxis tick={tickStyle} width={54} />
            <Tooltip cursor={{ stroke: axis, strokeWidth: 1, strokeDasharray: "3 3" }} allowEscapeViewBox={{ x: false, y: true }} wrapperStyle={{ zIndex: 20, pointerEvents: "none" }} content={<HoverReadout isDark={isDark} unit={s.unit} />} />
            {tracks.map((tr) => (
              <Line key={tr.key} type="monotone" dataKey={tr.key} stroke={tr.color}
                strokeWidth={1.5} dot={false} connectNulls name={tr.label} />
            ))}
            {s.kind === "wq-param-series" && s.criterion != null && (
              // extendDomain: a station comfortably WITHIN the criterion must
              // still show the line - "well under the limit" is the reading.
              <ReferenceLine y={s.criterion} stroke="#dc2626" strokeDasharray="4 4" ifOverflow="extendDomain"
                label={{ value: s.criterionLabel ?? `criterion ${s.criterion}`, fontSize: 9, fill: axis, position: "insideTopRight" }} />
            )}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    case "climatology-monthly": {
      // median_n feeds the hover readout's count suffix on the median row -
      // the quartiles' day-count when the pack carries it.
      const data = (s.months ?? []).map((m) => ({
        m: MONTH_ABBR[m.m], band: [m.p25, m.p75], median: m.median, median_n: m.n,
      }));
      return (
        <ResponsiveContainer width="100%" height={150}>
          <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="m" tick={tickStyle} />
            <YAxis tick={tickStyle} width={54} />
            <Tooltip cursor={{ stroke: axis, strokeWidth: 1, strokeDasharray: "3 3" }} allowEscapeViewBox={{ x: false, y: true }} wrapperStyle={{ zIndex: 20, pointerEvents: "none" }} content={<HoverReadout isDark={isDark} unit={s.unit} />} />
            <Area dataKey="band" stroke="none" fill="#2563eb" fillOpacity={0.18} name="p25-p75" />
            <Line type="monotone" dataKey="median" stroke="#2563eb" strokeWidth={2} dot={false} name="median" />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    case "flow-duration": {
      const data = mergePoints(tracks, (x) => (x.exceedance ?? []) as [number, number][]);
      // A log axis cannot hold a zero, and recharts does not degrade: given a
      // domain containing 0 it draws no ticks and no line, so the chart comes
      // out blank under a caption still claiming N values. Rivers that run dry
      // are exactly the ones worth plotting - T. Narasipur reads 0 cumec at the
      // 95th and 99th percentile - so fall back to a linear axis whenever any
      // series on the chart touches zero, and keep log for the perennial
      // stations where it earns its keep across three orders of magnitude.
      const positive = data.every((d) => tracks.every((tr) => {
        const v = d[tr.key];
        return v === undefined || (Number.isFinite(Number(v)) && Number(v) > 0);
      }));
      return (
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="x" tick={tickStyle} unit="%" type="number" domain={[0, 100]} />
            {positive ? (
              <YAxis tick={tickStyle} width={54} scale="log" domain={["auto", "auto"]} allowDataOverflow />
            ) : (
              <YAxis tick={tickStyle} width={54} />
            )}
            <Tooltip cursor={{ stroke: axis, strokeWidth: 1, strokeDasharray: "3 3" }} allowEscapeViewBox={{ x: false, y: true }} wrapperStyle={{ zIndex: 20, pointerEvents: "none" }} content={<HoverReadout isDark={isDark} unit={s.unit} labelFormat={(v) => `exceeded ${v}% of days`} />} />
            {tracks.map((tr) => (
              <Line key={tr.key} type="monotone" dataKey={tr.key} stroke={tr.color}
                strokeWidth={1.5} dot={false} connectNulls name={tr.label} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    case "annual-water-year": {
      const data = mergePoints(tracks, (x) => (x.points ?? []) as [string, number][]);
      // Every station's long-term average draws as a dashed line in that
      // station's own colour - the caption promises the line, so compare mode
      // must not silently drop it (Madhuri review, 31 Aug 2026). Colour is
      // what keeps N baselines from reading as one shared level.
      const baselines = tracks.map((tr) => {
        const vals = data.map((d) => Number(d[tr.key])).filter(Number.isFinite);
        return vals.length ? { key: tr.key, color: tr.color, lta: vals.reduce((a, b) => a + b, 0) / vals.length } : null;
      }).filter((b) => b != null);
      return (
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="x" tick={tickStyle} minTickGap={20} />
            <YAxis tick={tickStyle} width={54} />
            <Tooltip cursor={{ stroke: axis, strokeWidth: 1, strokeDasharray: "3 3" }} allowEscapeViewBox={{ x: false, y: true }} wrapperStyle={{ zIndex: 20, pointerEvents: "none" }} content={<HoverReadout isDark={isDark} unit={s.unit} />} />
            {tracks.map((tr) => (
              <Bar key={tr.key} dataKey={tr.key} fill={tr.color} name={tr.label} />
            ))}
            {baselines.map((b) => (
              <ReferenceLine key={`lta-${b.key}`} y={b.lta} stroke={b.color} strokeDasharray="4 4" strokeOpacity={0.75} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    case "wq-class-series": {
      const pts = s.points ?? [];
      return (
        <div className="flex flex-wrap gap-0.5 py-1">
          {pts.map(([t, v]) => (
            <span key={t} title={`${t}: class ${v}`}
              className="w-4 h-4 rounded-sm text-[8px] leading-4 text-center text-white font-semibold"
              style={{ backgroundColor: CLASS_COLORS[String(v)] ?? "#94a3b8" }}>
              {String(v)}
            </span>
          ))}
        </div>
      );
    }

    default: {
      // Forward-compatible: unknown kinds render as a plain table.
      const rows = (s.points ?? []).slice(-24);
      return (
        <table className="w-full text-[11px] text-slate-600 dark:text-slate-300">
          <tbody>
            {rows.map(([t, v]) => (
              <tr key={t} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-0.5 pr-2">{t}</td>
                <td className="py-0.5 text-right tabular-nums">{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  }
}
