"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

interface WardRow {
  ward_number: number;
  ward_name: string;
  zone: string;
  area_sq_km: number;
  composite_score: number | null;
  grade: "A" | "B" | "C" | "D" | "F" | "incomplete";
  pct_gw_depth: number | null;
  pct_wb_density: number | null;
  pct_wb_health: number | null;
  gw_depth_m: number | null;
  gw_station_count: number;
  wb_count: number;
  wb_density_per_sqkm: number;
  wb_health_score: number | null;
  wb_health_sample_count: number;
}

interface RiskFile {
  algorithm_version: string;
  weights: Record<string, number>;
  notes: string;
  grade_counts: Record<WardRow["grade"], number>;
  wards: WardRow[];
}

const GRADE_STYLES: Record<WardRow["grade"], { bg: string; text: string; border: string; label: string }> = {
  A: { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200", label: "Low risk" },
  B: { bg: "bg-blue-50",     text: "text-blue-700",    border: "border-blue-200",    label: "Below average" },
  C: { bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200",   label: "Average" },
  D: { bg: "bg-orange-50",   text: "text-orange-700",  border: "border-orange-200",  label: "Above average" },
  F: { bg: "bg-red-50",      text: "text-red-700",     border: "border-red-200",     label: "High risk" },
  incomplete: { bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200", label: "Insufficient data" },
};

function GradeBadge({ grade, large = false }: { grade: WardRow["grade"]; large?: boolean }) {
  const s = GRADE_STYLES[grade];
  const cls = large
    ? `w-20 h-20 text-4xl font-black rounded-xl border-2 ${s.bg} ${s.text} ${s.border} dark:bg-opacity-20`
    : `w-7 h-7 text-sm font-bold rounded-md border ${s.bg} ${s.text} ${s.border}`;
  return (
    <div className={`inline-flex items-center justify-center ${cls}`}>
      {grade === "incomplete" ? "—" : grade}
    </div>
  );
}

function MetricRow({
  label,
  rawValue,
  unit,
  percentile,
  weight,
  description,
}: {
  label: string;
  rawValue: string;
  unit?: string;
  percentile: number | null;
  weight: number;
  description: string;
}) {
  return (
    <div className="grid grid-cols-12 gap-2 items-baseline border-t border-slate-200 dark:border-slate-700 py-2 text-sm">
      <div className="col-span-5 sm:col-span-4">
        <div className="font-medium text-slate-800 dark:text-slate-200">{label}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">{description}</div>
      </div>
      <div className="col-span-3 sm:col-span-3 text-slate-700 dark:text-slate-300 tabular-nums">
        {rawValue}
        {unit && <span className="text-[10px] text-slate-500 ml-0.5">{unit}</span>}
      </div>
      <div className="col-span-2 text-slate-600 dark:text-slate-400 text-xs tabular-nums">
        {percentile !== null ? `${percentile}/100` : "-"}
      </div>
      <div className="col-span-2 text-slate-500 text-xs tabular-nums">{(weight * 100).toFixed(0)}%</div>
    </div>
  );
}

export function CityWardReportCard({
  cityId,
  cityDisplayName,
}: {
  cityId: string;
  cityDisplayName: string;
}) {
  const searchParams = useSearchParams();
  const wardParam = searchParams.get("ward");
  const wardNumber = wardParam ? parseInt(wardParam, 10) : null;

  const [riskFile, setRiskFile] = useState<RiskFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/data/ward-risk-${cityId}.json`)
      .then((r) => {
        if (!r.ok) throw new Error("Risk file not yet computed for this city");
        return r.json() as Promise<RiskFile>;
      })
      .then(setRiskFile)
      .catch((e) => setError(e.message));
  }, [cityId]);

  const ward = useMemo(() => {
    if (!riskFile || wardNumber === null) return null;
    return riskFile.wards.find((w) => w.ward_number === wardNumber) ?? null;
  }, [riskFile, wardNumber]);

  const cityRank = useMemo(() => {
    if (!riskFile || !ward || ward.composite_score === null) return null;
    const scored = riskFile.wards.filter((w) => w.composite_score !== null);
    const sorted = [...scored].sort((a, b) => (a.composite_score as number) - (b.composite_score as number));
    const idx = sorted.findIndex((w) => w.ward_number === ward.ward_number);
    if (idx < 0) return null;
    return { rank: idx + 1, total: sorted.length };
  }, [riskFile, ward]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-sm text-slate-600 dark:text-slate-400">
        <p>Ward risk data is not yet available for {cityDisplayName}.</p>
        <p className="mt-2">
          Run <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">npx tsx scripts/compute-{cityId}-ward-risk.ts</code> to generate it.
        </p>
        <Link href={`/${cityId}/my-ward`} className="text-blue-600 hover:underline mt-3 inline-block">
          ← Back to ward map
        </Link>
      </div>
    );
  }

  if (!riskFile) {
    return <div className="p-6 text-slate-400 text-sm">Loading...</div>;
  }

  // No ward selected: show ward picker.
  if (!ward) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div>
          <Link href={`/${cityId}/my-ward`} className="text-blue-600 hover:underline text-sm">
            ← Back to {cityDisplayName} ward map
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {cityDisplayName} Ward Report Card
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pick a ward to see its grade and factor breakdown. Algorithm:{" "}
            <code className="font-mono text-xs">{riskFile.algorithm_version}</code>
          </p>
        </div>

        {/* Grade summary tiles */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {(["A", "B", "C", "D", "F", "incomplete"] as const).map((g) => (
            <div key={g} className={`text-center rounded-lg p-2 border ${GRADE_STYLES[g].bg} ${GRADE_STYLES[g].border}`}>
              <div className={`text-xl font-black ${GRADE_STYLES[g].text}`}>
                {g === "incomplete" ? "—" : g}
              </div>
              <div className={`text-xs ${GRADE_STYLES[g].text}`}>
                {riskFile.grade_counts[g] ?? 0} wards
              </div>
            </div>
          ))}
        </div>

        {/* Ward list grouped by grade */}
        <div className="space-y-3">
          {(["F", "D", "C", "B", "A", "incomplete"] as const).map((g) => {
            const list = riskFile.wards.filter((w) => w.grade === g);
            if (list.length === 0) return null;
            return (
              <div key={g}>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1.5">
                  Grade {g === "incomplete" ? "—" : g} · {GRADE_STYLES[g].label} · {list.length}
                </div>
                <div className="flex flex-wrap gap-1">
                  {list
                    .sort((a, b) => (b.composite_score ?? 0) - (a.composite_score ?? 0))
                    .map((w) => (
                      <Link
                        key={w.ward_number}
                        href={`/${cityId}/my-ward/report?ward=${w.ward_number}`}
                        className={`text-xs px-2 py-0.5 rounded border hover:opacity-80 ${GRADE_STYLES[g].bg} ${GRADE_STYLES[g].text} ${GRADE_STYLES[g].border}`}
                      >
                        Ward {w.ward_number}
                      </Link>
                    ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-500 italic pt-3 border-t border-slate-200 dark:border-slate-700">
          {riskFile.notes}
        </p>
      </div>
    );
  }

  const s = GRADE_STYLES[ward.grade];

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      <div>
        <Link href={`/${cityId}/my-ward/report`} className="text-blue-600 hover:underline text-xs">
          ← All wards
        </Link>
        <Link href={`/${cityId}/my-ward`} className="text-blue-600 hover:underline text-xs ml-3">
          Map view
        </Link>
      </div>

      {/* Header */}
      <div className={`rounded-xl border-2 ${s.border} ${s.bg} p-5 dark:bg-opacity-20`}>
        <div className="flex items-start gap-4">
          <GradeBadge grade={ward.grade} large />
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wider text-slate-500">{cityDisplayName}</div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Ward {ward.ward_number}
            </h1>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Zone {ward.zone} · {ward.area_sq_km.toFixed(2)} sq km
            </div>
            <div className={`text-sm font-medium mt-1 ${s.text}`}>
              {s.label}
              {ward.composite_score !== null && (
                <span className="text-slate-600 dark:text-slate-400 ml-2 font-normal">
                  · Composite {ward.composite_score.toFixed(0)}/100
                </span>
              )}
              {cityRank && (
                <span className="text-slate-600 dark:text-slate-400 ml-2 font-normal">
                  · Ranked #{cityRank.rank} of {cityRank.total}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metric breakdown */}
      <div>
        <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-slate-500 pb-1">
          <div className="col-span-5 sm:col-span-4">Factor</div>
          <div className="col-span-3 sm:col-span-3">Raw</div>
          <div className="col-span-2">Pctile</div>
          <div className="col-span-2">Weight</div>
        </div>

        <MetricRow
          label="Groundwater depth"
          rawValue={ward.gw_depth_m !== null ? ward.gw_depth_m.toFixed(1) : "no data"}
          unit={ward.gw_depth_m !== null ? "m" : undefined}
          percentile={ward.pct_gw_depth}
          weight={0.5}
          description={`IDW from ${ward.gw_station_count} CGWB station${ward.gw_station_count === 1 ? "" : "s"} within 15 km · deeper = more stress`}
        />
        <MetricRow
          label="Water-body density"
          rawValue={ward.wb_density_per_sqkm.toFixed(2)}
          unit="/sq km"
          percentile={ward.pct_wb_density}
          weight={0.2}
          description={`${ward.wb_count} OSM water bodies in ward · higher density = lower risk`}
        />
        <MetricRow
          label="Water-body health"
          rawValue={ward.wb_health_score !== null ? ward.wb_health_score.toFixed(0) : "no flagship"}
          percentile={ward.pct_wb_health}
          weight={0.3}
          description={`Mean restoration_priority_score across ${ward.wb_health_sample_count} flagship${ward.wb_health_sample_count === 1 ? "" : "s"} within 3 km · higher score = sicker tank`}
        />
      </div>

      {/* Methodology footnote */}
      <p className="text-[11px] text-slate-500 italic pt-2 border-t border-slate-200 dark:border-slate-700">
        Algorithm: <code className="font-mono">{riskFile.algorithm_version}</code>.{" "}
        Each factor is converted to a city-wide percentile (100 = highest risk in {cityDisplayName})
        then weighted and summed. Composite ≤20 = A, ≤40 = B, ≤60 = C, ≤80 = D, &gt;80 = F.
      </p>
      <p className="text-[11px] text-slate-500 italic">
        {riskFile.notes}
      </p>
    </div>
  );
}
