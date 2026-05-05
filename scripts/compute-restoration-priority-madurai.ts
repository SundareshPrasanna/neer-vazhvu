/**
 * Compute restoration priority scores for Madurai's hand-curated flagship
 * water bodies (water-bodies-flagship-madurai.json).
 *
 * Run: npx tsx scripts/compute-restoration-priority-madurai.ts
 *
 * Madurai's full Chennai-style scoring on 715 OSM polygons is blocked on
 * (a) Tier 1.E CPCB NWMP river quality readings (river_pollution component)
 * and (b) an industrial-sources-madurai.json (industrial_proximity
 * component). Until those land we score the 19 flagship tanks/dams using
 * signals we DO have:
 *
 *   - Status severity: lost > severely reduced > encroached > restored
 *   - Cultural bonus: BHS / Ramsar / HC PIL / heritage age
 *   - Size: area_acres bucketed
 *   - Confidence: V / N / C scales the final score
 *
 * Output is a Madurai-shaped restoration-priority-{cityId}.json that the
 * lake-restoration page consumes for sorting + colour-coded badges.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const root = resolve(new URL(".", import.meta.url).pathname, "..");

interface FlagshipBody {
  name: string;
  alternate_names?: string[];
  type: string;
  area_acres?: number;
  area_ha?: number;
  capacity_mcft?: number;
  capacity_tmc?: number;
  year_built?: number | null;
  era?: string;
  builder?: string;
  feed?: string;
  river?: string;
  district?: string;
  location?: string;
  status: string;
  cultural_note?: string;
  biodiversity_heritage_site?: boolean;
  ramsar_proposed_date?: string;
  confidence: "V" | "N" | "C";
  sources: string[];
}

interface FlagshipFile {
  bodies: FlagshipBody[];
}

type PriorityLevel = "critical" | "high" | "moderate" | "low";

interface ScoredBody {
  name: string;
  status: string;
  priority_score: number;
  priority_level: PriorityLevel;
  components: {
    status_severity: number;
    cultural_bonus: number;
    size: number;
    confidence_multiplier: number;
  };
  rationale: string;
}

interface Output {
  place_id: string;
  generated_at: string;
  algorithm_version: "madurai-flagship-v1";
  notes: string;
  total_scored: number;
  bodies: ScoredBody[];
}

function statusSeverity(status: string): { score: number; label: string } {
  const s = status.toLowerCase();
  if (s.includes("dry") || s.includes("lost")) return { score: 80, label: "drying / lost" };
  if (s.includes("severely reduced") || s.includes("under encroachment pressure"))
    return { score: 70, label: "severely reduced" };
  if (s.includes("encroach") || s.includes("sewage-fed") || s.includes("sewage-impacted"))
    return { score: 55, label: "encroached / polluted" };
  if (s.includes("data gap")) return { score: 35, label: "data gap" };
  if (s.includes("restored") || s.includes("operational")) return { score: 25, label: "operational / restored" };
  return { score: 40, label: "unclear" };
}

function culturalBonus(b: FlagshipBody): { score: number; label: string } {
  const parts: string[] = [];
  let score = 0;
  if (b.biodiversity_heritage_site) {
    score += 25;
    parts.push("Biodiversity Heritage Site");
  }
  if (b.ramsar_proposed_date) {
    score += 20;
    parts.push("Ramsar candidate");
  }
  if (b.status.match(/WP\(M\)|HC PIL|HC ordered|Madras HC/i)) {
    score += 15;
    parts.push("HC PIL anchor");
  }
  if (b.year_built && b.year_built < 1700) {
    score += 10;
    parts.push("pre-modern heritage");
  } else if (b.era && /pandyan|chola|nayak/i.test(b.era)) {
    score += 8;
    parts.push("dynasty-era heritage");
  }
  return { score: Math.min(score, 35), label: parts.join(", ") };
}

function sizeScore(b: FlagshipBody): { score: number; label: string } {
  const acres =
    b.area_acres ??
    (b.area_ha !== undefined ? Math.round(b.area_ha * 2.471) : undefined);
  if (acres === undefined) return { score: 5, label: "size unknown" };
  if (acres >= 500) return { score: 25, label: `${acres} acres (very large)` };
  if (acres >= 100) return { score: 18, label: `${acres} acres (large)` };
  if (acres >= 50) return { score: 12, label: `${acres} acres (medium)` };
  if (acres >= 10) return { score: 8, label: `${acres} acres (small)` };
  return { score: 4, label: `${acres} acres (tiny)` };
}

function confidenceMultiplier(c: FlagshipBody["confidence"]): number {
  if (c === "V") return 1.0;
  if (c === "N") return 0.85;
  return 0.7;
}

function bucket(score: number): PriorityLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "moderate";
  return "low";
}

function scoreBody(b: FlagshipBody): ScoredBody {
  const sev = statusSeverity(b.status);
  const cul = culturalBonus(b);
  const size = sizeScore(b);
  const mul = confidenceMultiplier(b.confidence);

  const raw = sev.score + cul.score + size.score;
  const adjusted = Math.round(raw * mul);
  const final = Math.min(100, Math.max(0, adjusted));

  const rationaleParts: string[] = [sev.label];
  if (cul.label) rationaleParts.push(cul.label);
  rationaleParts.push(size.label);
  if (b.confidence !== "V") rationaleParts.push(`confidence ${b.confidence} (×${mul})`);

  return {
    name: b.name,
    status: b.status,
    priority_score: final,
    priority_level: bucket(final),
    components: {
      status_severity: sev.score,
      cultural_bonus: cul.score,
      size: size.score,
      confidence_multiplier: mul,
    },
    rationale: rationaleParts.join(" · "),
  };
}

function main() {
  const inputPath = resolve(root, "public/data/water-bodies-flagship-madurai.json");
  const flagshipFile = JSON.parse(readFileSync(inputPath, "utf-8")) as FlagshipFile;

  console.log(`Scoring ${flagshipFile.bodies.length} Madurai flagship bodies...`);

  const scored = flagshipFile.bodies
    .map(scoreBody)
    .sort((a, b) => b.priority_score - a.priority_score);

  const counts = scored.reduce(
    (acc, s) => {
      acc[s.priority_level]++;
      return acc;
    },
    { critical: 0, high: 0, moderate: 0, low: 0 } as Record<PriorityLevel, number>,
  );
  console.log(
    `  critical=${counts.critical} high=${counts.high} moderate=${counts.moderate} low=${counts.low}`,
  );

  const output: Output = {
    place_id: "madurai",
    generated_at: new Date().toISOString().slice(0, 10),
    algorithm_version: "madurai-flagship-v1",
    notes:
      "Slim scorer over the 19 hand-curated flagship water bodies. " +
      "Components: status severity (0-80), cultural bonus (0-35), size (4-25), confidence (×0.7-1.0). " +
      "Full Chennai-style 6-component scoring on all 715 OSM polygons is blocked on river-quality + industrial-sources Madurai data layers.",
    total_scored: scored.length,
    bodies: scored,
  };

  const outPath = resolve(root, "public/data/restoration-priority-madurai.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${scored.length} scored bodies to ${outPath}`);
  console.log("\nTop 5 priorities:");
  for (const b of scored.slice(0, 5)) {
    console.log(`  ${b.priority_score} (${b.priority_level}) ${b.name} - ${b.rationale}`);
  }
}

main();
