import type { WardRankings } from "@/lib/utils/ward-rankings";
import { escapeCSV, row, downloadCSV } from "@/lib/utils/ward-export";

/** Translation function shape - matches what `useLanguage().t` returns. */
type Translator = (key: string) => string;

/** Plain-English fallback labels used in the CSV when no translator is
 *  passed in. Earlier callers wrote `metric.label` directly, which is
 *  the i18n KEY (e.g. "report.metric_wb_health") rather than a human
 *  string, so the export read like a developer log. The dashboard label
 *  ("Avg restoration need" etc.) is technical-but-fine on screen, but
 *  in a spreadsheet context where rows have no surrounding explainer
 *  we err toward more conversational phrasing. */
const PLAIN_METRIC_LABEL: Record<string, string> = {
  wb_health: "How healthy are this ward's water bodies",
  wb_density: "How many water bodies per sq km",
  flood_risk: "Severe flood-risk zones per sq km",
  drainage: "Stormwater drain length per sq km",
  sewerage_infra: "Sewer pumping-main length per sq km",
};

const PLAIN_METRIC_UNIT: Record<string, string> = {
  wb_health: "score (lower = healthier)",
  wb_density: "bodies per sq km",
  flood_risk: "zones per sq km",
  drainage: "km per sq km",
  sewerage_infra: "km per sq km",
};

function metricLabelForCsv(metricKey: string, fallback: string, t?: Translator): string {
  // Prefer the plain-English wording; fall back to the on-screen label
  // (translated when a translator is passed in) if the metric isn't in
  // our map yet.
  return PLAIN_METRIC_LABEL[metricKey] ?? (t ? t(fallback) : fallback);
}

function metricUnitForCsv(metricKey: string, fallback: string): string {
  return PLAIN_METRIC_UNIT[metricKey] ?? fallback;
}

export function generateComparisonCSV(
  rankings: WardRankings[],
  t?: Translator,
): string {
  const lines: string[] = [];

  // Header row: Metric, Unit, then per-ward columns
  const headerCells: (string | number)[] = ["Metric", "Unit"];
  for (const r of rankings) {
    headerCells.push(`Ward ${r.wardNumber} Value`, `Ward ${r.wardNumber} Grade`, `Ward ${r.wardNumber} Rank`);
  }
  lines.push(headerCells.map(escapeCSV).join(","));

  // Overall row
  const overallCells: (string | number | null)[] = ["Overall water-risk grade", ""];
  for (const r of rankings) {
    overallCells.push(r.overallScore, r.overallGrade, `#${r.overallRank}/${r.overallTotal}`);
  }
  lines.push(overallCells.map(escapeCSV).join(","));

  // Metric rows - use first ranking as metric template (all have same metric keys)
  if (rankings.length > 0) {
    for (const metric of rankings[0].metrics) {
      const cells: (string | number | null)[] = [
        metricLabelForCsv(metric.key, metric.label, t),
        metricUnitForCsv(metric.key, metric.unit),
      ];
      for (const r of rankings) {
        const m = r.metrics.find((entry) => entry.key === metric.key);
        if (m && m.value != null && m.grade != null) {
          cells.push(
            Math.round(m.value * 10) / 10,
            m.grade,
            `#${m.rank}/${m.total}`,
          );
        } else {
          cells.push("N/A", "N/A", "N/A");
        }
      }
      lines.push(cells.map(escapeCSV).join(","));
    }
  }

  // Ward info
  lines.push("");
  lines.push(row("Ward", "Zone"));
  for (const r of rankings) {
    lines.push(row(r.wardNumber, `${r.zoneNo} - ${r.zoneName}`));
  }

  // Metadata
  lines.push("");
  lines.push(row("Grade scale", "A = best, F = worst (relative to all ranked wards)"));
  lines.push(row("Export date", new Date().toISOString().split("T")[0]));
  lines.push(row("Source", "neervazhvu.org"));

  return lines.join("\n");
}

export function downloadComparisonCSV(
  rankings: WardRankings[],
  t?: Translator,
): void {
  const wardNumbers = rankings.map((r) => r.wardNumber).join("-");
  const csv = generateComparisonCSV(rankings, t);
  downloadCSV(csv, `ward-comparison-${wardNumbers}.csv`);
}
