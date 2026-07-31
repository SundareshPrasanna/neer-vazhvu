import type { CorridorTalukRow } from "@/lib/corridors/types";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS_LIGHT,
  type AssessmentCategory,
} from "./classification";

/**
 * The all-taluks data table: classification, stage of extraction, assessment
 * edition, trend arrow vs the prior edition, and the firka substructure the
 * taluk average hides. Server-rendered (no client JS) so it survives print
 * and copy-paste into an audit working paper.
 */
export function AssessmentTable({
  rows,
  editions,
  compact = false,
}: {
  rows: CorridorTalukRow[];
  editions: string[];
  /** Print/brief variant: tighter cells, symbol-only trend, no firka column. */
  compact?: boolean;
}) {
  const latest = editions[editions.length - 1];
  const sorted = [...rows].sort(
    (a, b) =>
      (b.editions[latest]?.stage_pct ?? -1) - (a.editions[latest]?.stage_pct ?? -1),
  );
  const cell = compact ? "px-2 py-1" : "px-3 py-2";
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className={compact ? "w-full text-[11px]" : "w-full text-sm"}>
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <th className={`${cell} font-semibold`}>Taluk</th>
            <th className={`${cell} font-semibold`}>District</th>
            {editions.map((ed) => (
              <th key={ed} className={`${cell} font-semibold whitespace-nowrap`}>
                {ed} stage %
              </th>
            ))}
            <th className={`${cell} font-semibold`}>Trend</th>
            <th className={`${cell} font-semibold whitespace-nowrap`}>
              {compact ? "Classification" : `Classification (${latest})`}
            </th>
            {!compact && <th className={`${cell} font-semibold`}>Firkas inside ({latest})</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const cat = row.editions[latest]?.category as AssessmentCategory | null;
            const stressed = row.firka_categories_2025.filter(
              ([, c]) => c === "critical" || c === "over_exploited",
            );
            const stressedLabel = (name: string, c: string, stage: number | null) =>
              `${titleCase(name)} is ${CATEGORY_LABELS[c as AssessmentCategory]}${stage != null ? ` (${stage.toFixed(1)}%)` : ""}`;
            return (
              <tr
                key={row.taluk}
                className="border-t border-slate-100 dark:border-slate-800 align-top"
              >
                <td className={`${cell} font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap`}>
                  {titleCase(row.taluk)}
                </td>
                <td className={`${cell} text-slate-600 dark:text-slate-300 whitespace-nowrap`}>
                  {row.district}
                </td>
                {editions.map((ed) => (
                  <td key={ed} className={`${cell} font-mono text-slate-700 dark:text-slate-200`}>
                    {row.editions[ed]?.stage_pct ?? "-"}
                  </td>
                ))}
                <td
                  className={`${cell} whitespace-nowrap`}
                  title="Net stage change across editions 2023-2025: flat within 2 percentage points net; rising/falling only when both inter-edition steps agree with the net direction; mixed otherwise"
                >
                  {row.stage_trend === "up"
                    ? compact ? "▲" : "▲ rising"
                    : row.stage_trend === "down"
                      ? compact ? "▼" : "▼ falling"
                      : row.stage_trend === "mixed"
                        ? compact ? "⇄" : "⇄ mixed"
                        : compact ? "→" : "→ flat"}
                </td>
                <td className={`${cell} whitespace-nowrap`}>
                  <span
                    className="inline-flex items-center gap-1.5"
                    style={{ color: cat ? CATEGORY_COLORS_LIGHT[cat] : undefined }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm inline-block"
                      style={{ backgroundColor: cat ? CATEGORY_COLORS_LIGHT[cat] : "#9ca3af" }}
                    />
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {cat ? CATEGORY_LABELS[cat] : "n/a"}
                    </span>
                  </span>
                </td>
                {!compact && (
                <td className={`${cell} text-xs text-slate-600 dark:text-slate-300`}>
                  {row.firka_categories_2025.length} firkas
                  {stressed.length > 0 && (
                    <span>
                      {": "}
                      {stressed
                        .map(([name, c, stage]) => stressedLabel(name, c as string, stage))
                        .join("; ")}
                    </span>
                  )}
                </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
