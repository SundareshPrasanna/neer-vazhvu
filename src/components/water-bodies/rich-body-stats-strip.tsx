"use client";

import { useEffect, useState } from "react";
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
          label="Water in body"
          value={waterPct != null ? `${waterPct.toFixed(1)}%` : "n/a"}
          delta={waterPct != null && waterBaseline != null ? waterPct - waterBaseline : null}
          deltaUnit="pp"
          deltaInvert
          caveat={year > 2021 ? "JRC data ends 2021" : null}
        />
        <Stat
          label="Built in 1 km halo"
          value={builtPct != null ? `${builtPct.toFixed(1)}%` : "n/a"}
          delta={builtPct != null && builtBaseline != null ? builtPct - builtBaseline : null}
          deltaUnit="pp"
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
        />
      </div>
    </div>
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
  /** When true, a positive delta is BAD (e.g. water loss) - colour inverts */
  deltaInvert?: boolean;
  caveat?: string | null;
  /** Optional second value (e.g. "X via Open Buildings 2023" alongside Overture) */
  secondary?: string;
}

function Stat({ label, value, delta, deltaUnit = "", deltaInvert = false, caveat, secondary }: StatProps) {
  const sign = delta == null ? null : delta > 0.05 ? "+" : delta < -0.05 ? "-" : "";
  const isBad = delta != null && (deltaInvert ? delta < 0 : delta > 0);
  const deltaColor = sign
    ? isBad
      ? "text-rose-600 dark:text-rose-400"
      : "text-emerald-600 dark:text-emerald-400"
    : "text-slate-500 dark:text-slate-400";

  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
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
