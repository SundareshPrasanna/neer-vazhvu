import type { WardRankings } from "@/lib/utils/ward-rankings";
import { escapeCSV, row, downloadCSV } from "@/lib/utils/ward-export";

export function generateComparisonCSV(rankings: WardRankings[]): string {
  const lines: string[] = [];

  // Header row: Metric, Unit, then per-ward columns
  const headerCells: (string | number)[] = ["Metric", "Unit"];
  for (const r of rankings) {
    headerCells.push(`Ward ${r.wardNumber} Value`, `Ward ${r.wardNumber} Grade`, `Ward ${r.wardNumber} Rank`);
  }
  lines.push(headerCells.map(escapeCSV).join(","));

  // Overall row
  const overallCells: (string | number | null)[] = ["Overall", ""];
  for (const r of rankings) {
    overallCells.push(r.overallScore, r.overallGrade, `#${r.overallRank}/${r.overallTotal}`);
  }
  lines.push(overallCells.map(escapeCSV).join(","));

  // Metric rows - use first ranking as metric template (all have same metric keys)
  if (rankings.length > 0) {
    for (const metric of rankings[0].metrics) {
      const cells: (string | number | null)[] = [metric.label, metric.unit];
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
  lines.push(row("Export date", new Date().toISOString().split("T")[0]));
  lines.push(row("Source", "neervazhvu.org"));

  return lines.join("\n");
}

export function downloadComparisonCSV(rankings: WardRankings[]): void {
  const wardNumbers = rankings.map((r) => r.wardNumber).join("-");
  const csv = generateComparisonCSV(rankings);
  downloadCSV(csv, `ward-comparison-${wardNumbers}.csv`);
}
