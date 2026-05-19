"use client";

import { useEffect, useRef, useState } from "react";
import type { RichBodyEntry } from "@/lib/water-bodies/rich-body-registry";

interface ZoneYear {
  year: number;
  any_water_pct?: number | null;
  built_fraction_pct?: number | null;
}

interface JrcTrend {
  by_zone: Record<string, Record<string, ZoneYear>>;
}
interface DwTrend {
  by_zone: Record<string, Record<string, ZoneYear>>;
}
interface OpenBuildings {
  regions: Array<{
    region: string;
    building_count: number;
    building_area_ha: number;
    region_area_ha: number;
  }>;
}
interface OvertureBuildings {
  data_source?: { release_date?: string };
  regions: Array<{
    region: string;
    building_count: number;
    building_area_ha: number;
    region_area_ha: number;
  }>;
}

// Generic zone names emitted by all verify_rich_body_*.py scripts via
// scripts/_rich_body_zones.py. Same names regardless of body source.
const BODY_ZONE = "Body (primary)";
const HALO_ZONE = "Halo: 1km buffer - body";

interface RichBodyStatsStripProps {
  body: RichBodyEntry;
  year: number;
}

export function RichBodyStatsStrip({ body, year }: RichBodyStatsStripProps) {
  const [jrc, setJrc] = useState<JrcTrend | null>(null);
  const [dw, setDw] = useState<DwTrend | null>(null);
  const [ob, setOb] = useState<OpenBuildings | null>(null);
  const [ov, setOv] = useState<OvertureBuildings | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(body.analysis_paths.water_trend).then((r) => r.json()).catch(() => null),
      fetch(body.analysis_paths.built_trend).then((r) => r.json()).catch(() => null),
      fetch(body.analysis_paths.open_buildings).then((r) => r.json()).catch(() => null),
      body.analysis_paths.overture_buildings
        ? fetch(body.analysis_paths.overture_buildings).then((r) => r.json()).catch(() => null)
        : Promise.resolve(null),
    ]).then(([j, d, o, ovr]) => {
      setJrc(j);
      setDw(d);
      setOb(o);
      setOv(ovr);
    });
  }, [body.id, body.analysis_paths.overture_buildings]);

  const waterPct = jrc?.by_zone[BODY_ZONE]?.[String(year)]?.any_water_pct ?? null;
  const builtPct = dw?.by_zone[HALO_ZONE]?.[String(year)]?.built_fraction_pct ?? null;
  const haloBuildingsOb = ob?.regions.find((r) => r.region === HALO_ZONE);
  const bodyBuildingsOb = ob?.regions.find((r) => r.region === BODY_ZONE);
  const haloBuildingsOv = ov?.regions.find((r) => r.region === HALO_ZONE);
  const bodyBuildingsOv = ov?.regions.find((r) => r.region === BODY_ZONE);
  const overtureRelease = ov?.data_source?.release_date ?? "Q1 2026";

  // Baseline reference values for delta indicators
  const waterBaseline = jrc?.by_zone[BODY_ZONE]
    ? avgPct(jrc.by_zone[BODY_ZONE], [1988, 1989, 1990, 1991, 1992])
    : null;
  const builtBaseline = dw?.by_zone[HALO_ZONE]?.["2016"]?.built_fraction_pct ?? null;

  return (
    <div className="px-4 md:px-6 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 shrink-0">
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        <Stat
          label="Water surface in body"
          help="The body is its primary boundary (Ramsar for Pallikaranai, OpenStreetMap-mapped for reservoirs). This shows the share of land inside that boundary classified as water (seasonal or permanent) by the European JRC team using Landsat satellite data. It's averaged across the whole year, so it doesn't reflect today's water level."
          value={waterPct != null ? `${waterPct.toFixed(1)}%` : "n/a"}
          delta={waterPct != null && waterBaseline != null ? waterPct - waterBaseline : null}
          deltaUnit=" pts"
          deltaContext="1988-92 avg"
          deltaInvert
          caveat={year > 2021 ? "JRC data ends 2021" : null}
        />
        <Stat
          label="Built-up surface in 1 km halo"
          help="The 1 km halo is the donut-shaped ring of land just outside the body's edge (the body itself isn't counted). 'Built-up surface' is Google's Dynamic World classification of satellite imagery - it includes roads, rooftops, and paved areas, and sometimes mis-counts dry/bare ground as built. If this number looks higher than what you see in the satellite image above, that's why."
          value={builtPct != null ? `${builtPct.toFixed(1)}%` : "n/a"}
          delta={builtPct != null && builtBaseline != null ? builtPct - builtBaseline : null}
          deltaUnit=" pts"
          deltaContext="2016"
          caveat={year < 2016 ? "DW starts 2016" : null}
        />
        {/* Single source for building counts: Overture Maps quarterly.
            If Overture is missing for some reason (older onboarded body),
            fall back to Open Buildings v3 with the older date noted. */}
        <Stat
          label="Buildings in halo"
          value={
            haloBuildingsOv
              ? haloBuildingsOv.building_count.toLocaleString()
              : haloBuildingsOb
                ? haloBuildingsOb.building_count.toLocaleString()
                : "n/a"
          }
          caveat={haloBuildingsOv ? `Overture ${overtureRelease}` : "Open Buildings 2023"}
          help="Count of building rooftops in the 1 km donut ring just outside the body (a building's centre is used to decide which zone it belongs to). Overture Maps combines Microsoft, OpenStreetMap, and Google sources with conservative de-duplication, so this is a floor estimate - actual density (especially in informal settlements) is likely higher."
        />
        <Stat
          label="Buildings in body"
          value={
            bodyBuildingsOv
              ? bodyBuildingsOv.building_count.toLocaleString()
              : bodyBuildingsOb
                ? bodyBuildingsOb.building_count.toLocaleString()
                : "n/a"
          }
          caveat={bodyBuildingsOv ? `Overture ${overtureRelease}` : "Open Buildings 2023"}
          help="Count of building rooftops inside the body's primary boundary itself (a building's centre decides which zone it belongs to). Should be near zero for a well-protected reservoir; for a contested wetland like Pallikaranai this is a key encroachment signal."
        />
      </div>
    </div>
  );
}

/**
 * Click-toggle popover for inline help text. Works on touch (where hover-only
 * tooltips don't trigger) and on desktop. Click outside or Esc to dismiss.
 */
function HelpPopover({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label="What does this mean?"
        aria-expanded={open}
        className="text-[10px] w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-help select-none leading-none inline-flex items-center justify-center"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 w-72 max-w-[85vw] max-h-[50vh] overflow-y-auto p-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[12px] leading-relaxed text-slate-700 dark:text-slate-200 shadow-lg normal-case tracking-normal font-normal"
        >
          {text}
        </span>
      )}
    </span>
  );
}

function avgPct(yearMap: Record<string, ZoneYear>, years: number[]): number | null {
  const vals: number[] = [];
  for (const y of years) {
    const v = yearMap[String(y)]?.any_water_pct;
    if (v != null) vals.push(v);
  }
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

interface StatProps {
  label: string;
  value: string;
  delta?: number | null;
  deltaUnit?: string;
  /** What the delta is compared against, e.g. "1988-92 avg" or "2016". Shown inline. */
  deltaContext?: string;
  /** When true, a positive delta is BAD (e.g. water loss) - colour inverts */
  deltaInvert?: boolean;
  caveat?: string | null;
  /** Optional second value (e.g. "X via Open Buildings 2023" alongside Overture) */
  secondary?: string;
  /** Optional hover tooltip explaining the metric */
  help?: string;
}

function Stat({ label, value, delta, deltaUnit = "", deltaContext, deltaInvert = false, caveat, secondary, help }: StatProps) {
  const sign = delta == null ? null : delta > 0.05 ? "+" : delta < -0.05 ? "-" : "";
  const isBad = delta != null && (deltaInvert ? delta < 0 : delta > 0);
  const deltaColor = sign
    ? isBad
      ? "text-rose-600 dark:text-rose-400"
      : "text-emerald-600 dark:text-emerald-400"
    : "text-slate-500 dark:text-slate-400";

  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
        {label}
        {help && <HelpPopover text={help} />}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {value}
        </span>
        {delta != null && sign && (
          <span className={`text-[11px] tabular-nums ${deltaColor}`}>
            {sign}
            {Math.abs(delta).toFixed(1)}
            {deltaUnit}
            {deltaContext && (
              <span className="text-slate-400 dark:text-slate-500 font-normal ml-0.5">
                {" "}vs {deltaContext}
              </span>
            )}
          </span>
        )}
        {caveat && (
          <span className="text-[10px] italic text-slate-400 dark:text-slate-500">
            {caveat}
          </span>
        )}
      </span>
      {secondary && (
        <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">
          cf. {secondary}
        </span>
      )}
    </div>
  );
}
