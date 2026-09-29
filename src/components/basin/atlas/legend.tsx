import { useEffect, useState } from "react";
import type { BasinLayer } from "@/lib/basins";
import { PRESSURE_KIND_COLOR } from "./map-style";
import type { LegendItem, LegendSym } from "@/lib/basins/panel-types";

/** One legend entry per symbol actually on the map right now, expanding
 *  pressures into its kinds and showing the monitoring public-domain cue
 *  (filled vs hollow). Every entry's color comes from the layer's manifest
 *  `color` or the shared PRESSURE_KIND_COLOR map - the same sources the map
 *  styles read - so the legend can never disagree with what's drawn. Shared
 *  by the on-map MapLegend and the PDF export's page-1 legend. */
export function buildLegendItems(layers: BasinLayer[], elevation?: { band: string; color: string }[]): LegendItem[] {
  const items: LegendItem[] = [];
  for (const l of layers) {
    if (l.classes) {
      for (const r of l.classes.rows) items.push({ sym: l.geom === "point" ? "dot" : l.geom === "line" ? "line" : "box", color: r.color, label: r.label });
    }
    else if (l.legendRows) {
      // The manifest speaks for itself: a layer whose features carry more than
      // one visual role declares its own rows (basin-specific prose stays
      // data, never a hardcoded label here).
      items.push(...l.legendRows);
    }
    else if (l.elevation) {
      // Band labels come from the data (they differ per basin), matching the
      // city elevation legend: never hardcode edges at a call site.
      for (const e of elevation ?? []) items.push({ sym: "box", color: e.color, label: e.band });
    }
    else if (l.gap) {
      // Severity scale (matches the fill/badge colours) so red vs amber reads
      // as "how bad is the gap", not just decoration.
      items.push({ sym: "box", color: "#dc2626", label: "Waste gap - severe" });
      items.push({ sym: "box", color: "#ea580c", label: "Waste gap - moderate" });
      items.push({ sym: "box", color: "#f59e0b", label: "Waste gap - minor" });
    }
    else if (l.family === "boundary") items.push({ sym: "line", color: l.color, label: l.label });
    else if (l.family === "sub-hydrosheds") items.push({ sym: "dash", color: l.color, label: "Sub-catchment" });
    else if (l.family === "rivers") items.push({ sym: "line", color: l.color, label: "River" });
    else if (l.family === "drainage") items.push({ sym: "line", color: l.color, label: l.label });
    else if (l.readings) {
      // A readings layer's cue is whether a pack opens on tap, whatever the
      // family - so this branch must win over the monitoring-points one.
      if (l.family === "flow-stations") {
        items.push({ sym: "dot", color: l.color, label: "Gauge (tap for readings)" });
        items.push({ sym: "ring", color: l.color, label: "Gauge (readings not yet fetched)" });
      } else {
        items.push({ sym: "dot", color: l.color, label: "Station (tap for readings)" });
        items.push({ sym: "ring", color: l.color, label: "Station (no readings to show)" });
      }
    } else if (l.family === "monitoring-points") {
      items.push({ sym: "dot", color: l.color, label: "Monitoring (public data)" });
      items.push({ sym: "ring", color: l.color, label: "Monitoring (not in public domain)" });
    } else if (l.family === "pressures-industrial" && l.kindFilter === "industrial-area-other") {
      items.push({ sym: "outline", color: "#94a3b8", label: "Industrial area - unnamed (no effluent details)" });
    } else if (l.family === "pressures-industrial" && l.kindFilter === "major-industry") {
      items.push({ sym: "dot", color: PRESSURE_KIND_COLOR["major-industry"], label: "17-category industry (KSPCB)" });
    } else if (l.family === "pressures-industrial" && l.kindFilter && l.kindFilter !== "industrial-area") {
      // A kind-split entry that is NOT the estate fill (points, units outside
      // estates, estates outside the basin) draws in its own layer colour -
      // one row each. Routing these through the CETP trio repeated the same
      // three rows once per entry (Madhuri, 31 Aug).
      items.push({ sym: l.geom === "point" ? "dot" : "box", color: l.color, label: l.label });
    } else if (l.family === "pressures-industrial") {
      // The three CETP states are all solid fills (see fillStyle) - the legend
      // rows must mirror that, one box per state.
      items.push({ sym: "box", color: "#C62828", label: "Industrial area - no CETP (est.)" });
      items.push({ sym: "box", color: "#1976D2", label: "Industrial area - CETP available" });
      items.push({ sym: "box", color: "#F9A825", label: "Industrial area - CETP status to be verified" });
      // The 17-category dot appears here only when this entry is NOT
      // kind-split (a split manifest declares its own toggle + legend row).
      if (!l.kindFilter) items.push({ sym: "dot", color: PRESSURE_KIND_COLOR["major-industry"], label: "Major industry (17-category)" });
    } else if (l.family === "pressures-quarries") {
      items.push({ sym: "box", color: PRESSURE_KIND_COLOR["quarry"], label: "Quarry" });
    } else if (l.family === "pressures-waste") {
      items.push({ sym: "box", color: PRESSURE_KIND_COLOR["waste-facility"], label: "Hazardous waste facility" });
    } else if (l.family === "infrastructure") {
      // Squares / triangles, echoing the treatmentIcon marker shapes.
      items.push({ sym: "box", color: l.color, label: "STP (operational)" });
      items.push({ sym: "outline", color: l.color, label: "STP (not yet functional)" });
    } else if (l.family === "fstp") {
      items.push({ sym: "tri", color: l.color, label: "FSTP (operational)" });
      items.push({ sym: "tri-ring", color: l.color, label: "FSTP (not yet functional)" });
    } else if (l.family.startsWith("admin")) items.push({ sym: "outline", color: l.color, label: l.label });
    else if (l.geom === "point") items.push({ sym: "dot", color: l.color, label: l.label });
    else if (l.geom === "line") items.push({ sym: "line", color: l.color, label: l.label });
    else items.push({ sym: "box", color: l.color, label: l.label });
  }
  // Backstop: two layer entries that legitimately produce the same row (a
  // kind-split family) must not print it twice.
  const seen = new Set<string>();
  return items.filter((it) => {
    const k = `${it.sym}|${it.color}|${it.label}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** How the legend last stood, across basins and visits: it opens collapsed
 *  (a full legend ate most of a small map - Madhuri, 31 Aug) unless the
 *  reader expanded it last time. */
const LEGEND_OPEN_KEY = "nv-basin-legend-open";

/** Dynamic legend: reflects what's currently visible on the map. */
export function MapLegend({ layers, elevation, notes, raised }: { layers: BasinLayer[]; elevation?: { band: string; color: string }[]; notes?: string[]; raised?: boolean }) {
  // Collapsed on first paint even when storage says open - the stored value is
  // applied in an effect so server and client render the same initial tree.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(LEGEND_OPEN_KEY) === "1") setOpen(true);
    } catch { /* storage unavailable: stay collapsed */ }
  }, []);
  const toggle = () => setOpen((o) => {
    try { localStorage.setItem(LEGEND_OPEN_KEY, o ? "0" : "1"); } catch { /* fine */ }
    return !o;
  });
  const items = buildLegendItems(layers, elevation);
  if (!items.length) return null;
  return (
    <div className={`absolute ${raised ? "bottom-[156px] md:bottom-3" : "bottom-3"} left-3 z-[800] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-lg shadow text-[11px] max-w-[230px] transition-[bottom] duration-200`}>
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-2.5 py-1.5 font-semibold text-slate-600 dark:text-slate-300"
      >
        Legend <span className="text-slate-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-2.5 pb-2 space-y-1 max-h-[42vh] overflow-y-auto">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <LegendSymbol sym={it.sym} color={it.color} />
              <span className="text-slate-600 dark:text-slate-300 leading-tight">{it.label}</span>
            </div>
          ))}
          {notes && notes.map((n, i) => (
            <div key={`note-${i}`} className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug pt-1 mt-1 border-t border-slate-200 dark:border-slate-700">{n}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Legend chips for a classed layer: click a class to hide it and focus on the rest. */
export function ClassChips({ layer, hidden, counts, onToggle }: {
  layer: BasinLayer;
  hidden: string[];
  counts?: { kind: string | null; count: number }[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="ml-6 mt-1 mb-1 flex flex-col gap-0.5">
      {layer.classes!.rows.map((r) => {
        const off = hidden.includes(r.value);
        const n = counts?.find((c) => c.kind === r.value)?.count;
        return (
          <button
            key={r.value}
            type="button"
            aria-pressed={!off}
            onClick={() => onToggle(r.value)}
            className={`flex items-center gap-1.5 text-left text-[11px] leading-tight ${off ? "opacity-40 line-through" : ""} text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white`}
          >
            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: r.color }} />
            <span>{r.label}{n != null && <span className="text-slate-400"> ({n})</span>}</span>
          </button>
        );
      })}
    </div>
  );
}

function LegendSymbol({ sym, color }: { sym: LegendSym; color: string }) {
  if (sym === "dot") return <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />;
  if (sym === "ring") return <span className="inline-block w-3 h-3 rounded-full shrink-0 border-2 bg-transparent" style={{ borderColor: color }} />;
  if (sym === "line") return <span className="inline-block w-4 h-[2px] shrink-0" style={{ backgroundColor: color }} />;
  if (sym === "dash") return <span className="inline-block w-4 border-t-2 border-dashed shrink-0" style={{ borderColor: color }} />;
  if (sym === "outline") return <span className="inline-block w-3 h-3 rounded-sm shrink-0 border" style={{ borderColor: color }} />;
  if (sym === "tri" || sym === "tri-ring")
    return (
      <svg viewBox="0 0 12 12" className="w-3 h-3 shrink-0" aria-hidden>
        <polygon
          points="6,1 11.5,11 0.5,11"
          fill={sym === "tri" ? color : "none"}
          stroke={color}
          strokeWidth={sym === "tri" ? 0 : 1.8}
          strokeLinejoin="round"
        />
      </svg>
    );
  return <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />;
}
