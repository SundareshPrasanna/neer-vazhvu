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
}: {
  rows: CorridorTalukRow[];
  editions: string[];
}) {
  const latest = editions[editions.length - 1];
  const sorted = [...rows].sort(
    (a, b) =>
      (b.editions[latest]?.stage_pct ?? -1) - (a.editions[latest]?.stage_pct ?? -1),
  );
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <th className="px-3 py-2 font-semibold">Taluk</th>
            <th className="px-3 py-2 font-semibold">District</th>
            {editions.map((ed) => (
              <th key={ed} className="px-3 py-2 font-semibold whitespace-nowrap">
                {ed} stage %
              </th>
            ))}
            <th className="px-3 py-2 font-semibold">Trend</th>
            <th className="px-3 py-2 font-semibold whitespace-nowrap">
              Classification ({latest})
            </th>
            <th className="px-3 py-2 font-semibold">Firkas inside ({latest})</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const cat = row.editions[latest]?.category as AssessmentCategory | null;
            const stressed = row.firka_categories_2025.filter(
              ([, c]) => c === "critical" || c === "over_exploited",
            );
            return (
              <tr
                key={row.taluk}
                className="border-t border-slate-100 dark:border-slate-800 align-top"
              >
                <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  {titleCase(row.taluk)}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {row.district}
                </td>
                {editions.map((ed) => (
                  <td key={ed} className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200">
                    {row.editions[ed]?.stage_pct ?? "-"}
                  </td>
                ))}
                <td className="px-3 py-2" title="Change in stage of extraction vs the prior edition (more than 1 percentage point)">
                  {row.stage_trend === "up" ? "▲ rising" : row.stage_trend === "down" ? "▼ falling" : "→ flat"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
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
                <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                  {row.firka_categories_2025.length} firkas
                  {stressed.length > 0 && (
                    <span>
                      {": "}
                      {stressed
                        .map(
                          ([name, c]) =>
                            `${titleCase(name)} is ${CATEGORY_LABELS[c as AssessmentCategory]}`,
                        )
                        .join("; ")}
                    </span>
                  )}
                </td>
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
