/**
 * Compute restoration priority scores for Delhi's hand-curated flagship
 * water bodies (water-bodies-flagship-delhi.json), emitting the same
 * RestorationPriorityData shape Chennai's /water-bodies ranking consumes -
 * no UI fork (multi-city component discipline).
 *
 * Run (from the delhi-onboarding worktree):
 *   npx tsx scripts/compute-restoration-priority-delhi.ts
 *
 * Delhi's full Chennai-style scoring over all 1,845 OSM polygons is
 * deferred until the ward layer + drain-proximity join land; like Madurai
 * we score the flagship register with the signals we have:
 *
 *   - status_severity: lost/remnant > encroached/sewage > works-pending >
 *     restored/operating
 *   - cultural_bonus: NGT/court anchor, Ramsar-grade habitat, pre-1700
 *     hydraulic heritage (hauz/baoli chain), active programme attention
 *   - size: area_acres bucketed
 *   - confidence_multiplier: A / B / C -> 1.0 / 0.85 / 0.7
 *
 * Each body is enriched with an OSM polygon match by name-token against
 * delhi-water-bodies-current.geojson (fall back to the register's own
 * monument coordinates).
 */

import { readFileSync } from "fs";
import { join } from "path";
import { writeArtifact } from "./lib/nvdm-write";

const root = process.cwd();

interface FlagshipBody {
  name: string;
  type: string;
  area_acres: number | null;
  year_built: number | null;
  era: string | null;
  status: string;
  cultural_note: string;
  confidence: "A" | "B" | "C";
  sources: string[];
  lat: number;
  lng: number;
}

type PriorityLevel = "critical" | "high" | "moderate" | "low";

const WEIGHTS = {
  status_severity: 0.5,
  cultural_bonus: 0.25,
  size: 0.15,
  confidence_multiplier: 0.1,
};

function statusSeverity(b: FlagshipBody): { score: number; label: string } {
  const s = `${b.status} ${b.cultural_note}`.toLowerCase();
  if (s.includes("remnant") || s.includes("97%"))
    return { score: 80, label: "remnant of a lost extent" };
  if (s.includes("down from") || s.includes("hardest") || s.includes("waste"))
    return { score: 70, label: "shrinking / waste-stressed" };
  // Restored/operating checked BEFORE the degraded keywords: several
  // restored entries also say "seasonally"/"water quality" in passing.
  if (s.includes("restored") || s.includes("operating") || s.includes("boating"))
    return { score: 25, label: "operating / restored" };
  if (s.includes("shrunken"))
    return { score: 60, label: "shrunken but persistent" };
  if (s.includes("dry at the lower") || s.includes("water quality poor") || s.includes("seasonal"))
    return { score: 55, label: "degraded / seasonal" };
  if (s.includes("under active") || s.includes("rejuvenation"))
    return { score: 45, label: "works in progress" };
  return { score: 40, label: "unclear" };
}

function culturalBonus(b: FlagshipBody): { score: number; label: string } {
  const s = `${b.status} ${b.cultural_note}`.toLowerCase();
  const parts: string[] = [];
  let score = 0;
  if (s.includes("ngt") || s.includes("petition") || s.includes("stalemate")) {
    score += 15;
    parts.push("court/NGT anchor");
  }
  if (s.includes("flamingo") || s.includes("waterbird") || s.includes("ramsar")) {
    score += 20;
    parts.push("Ramsar-grade habitat");
  }
  if (b.year_built && b.year_built < 1700) {
    score += 12;
    parts.push("pre-1700 hydraulic heritage");
  } else if (b.era && /sultanate|tughlaq|mamluk|khalji|lodi|mughal|sur/i.test(b.era)) {
    score += 10;
    parts.push("dynasty-era heritage");
  }
  if (s.includes("ritual") || s.includes("phoolwalon") || s.includes("dargah")) {
    score += 8;
    parts.push("living ritual use");
  }
  return { score: Math.min(score, 35), label: parts.join(", ") || "none" };
}

function sizeScore(b: FlagshipBody): { score: number; label: string } {
  const acres = b.area_acres;
  if (acres == null) return { score: 5, label: "size unknown (baoli/structure)" };
  if (acres >= 500) return { score: 25, label: `${acres} acres (very large)` };
  if (acres >= 100) return { score: 18, label: `${acres} acres (large)` };
  if (acres >= 50) return { score: 12, label: `${acres} acres (medium)` };
  if (acres >= 10) return { score: 8, label: `${acres} acres (small)` };
  return { score: 4, label: `${acres} acres (tiny)` };
}

function confidenceMultiplier(c: FlagshipBody["confidence"]): number {
  if (c === "A") return 1.0;
  if (c === "B") return 0.85;
  return 0.7;
}

function bucket(score: number): PriorityLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "moderate";
  return "low";
}

interface OsmFeature {
  geometry: GeoJSON.Geometry;
  properties: { osm_id?: number; name?: string; water_type?: string; area_ha?: number };
}

function nameTokens(n: string): Set<string> {
  return new Set(
    n
      .toLowerCase()
      .replace(/[()]/g, " ")
      .split(/[\s-]+/)
      .filter((t) => t.length > 3 && !["lake", "tank", "baoli", "moat", "wetlands", "jheel"].includes(t)),
  );
}

function main() {
  const flagship = JSON.parse(
    readFileSync(join(root, "public/data/water-bodies-flagship-delhi.json"), "utf-8"),
  ) as { bodies: FlagshipBody[] };
  const osm = JSON.parse(
    readFileSync(join(root, "public/geojson/delhi-water-bodies-current.geojson"), "utf-8"),
  ) as { features: OsmFeature[] };

  const namedOsm = osm.features.filter((f) => f.properties.name);

  const scored = flagship.bodies.map((b) => {
    const sev = statusSeverity(b);
    const cult = culturalBonus(b);
    const size = sizeScore(b);
    const conf = confidenceMultiplier(b.confidence);

    const raw =
      sev.score * WEIGHTS.status_severity +
      cult.score * WEIGHTS.cultural_bonus +
      size.score * WEIGHTS.size;
    // Confidence scales the whole score (its weight share is implicit).
    const score = Math.round(raw * (conf + WEIGHTS.confidence_multiplier) * 10) / 10;

    const tokens = nameTokens(b.name);
    const match = namedOsm.find((f) => {
      const ft = nameTokens(f.properties.name!);
      return [...tokens].some((t) => ft.has(t));
    });

    return {
      id: match?.properties.osm_id ? `osm:${match.properties.osm_id}` : `flagship:${b.name}`,
      source: (match ? "matched" : "flagship") as "matched" | "flagship",
      osm_id: match?.properties.osm_id ?? null,
      census_id: null,
      name: b.name,
      name_hi: "",
      water_type: b.type,
      area_ha: match?.properties.area_ha ?? (b.area_acres != null ? +(b.area_acres / 2.471).toFixed(2) : 0),
      centroid: [b.lat, b.lng] as [number, number],
      priority_score: score,
      priority_level: bucket(score),
      components: {
        status_severity: sev.score,
        cultural_bonus: cult.score,
        size: size.score,
        confidence_multiplier: conf,
      },
      rationale: `${sev.label}; ${cult.label}; ${size.label}; confidence ${b.confidence}`,
    };
  });

  scored.sort((a, b) => b.priority_score - a.priority_score);

  const out = {
    place_id: "delhi",
    computed_at: new Date().toISOString().slice(0, 10),
    total_scored: scored.length,
    weights: WEIGHTS,
    algorithm_version: "delhi-flagship-v1",
    notes:
      "Flagship-register scoring (Madurai pattern): 12 hand-curated bodies scored on status severity, " +
      "cultural/court anchors, size and source confidence. Full-polygon scoring over the 1,845 OSM bodies " +
      "waits on the ward layer + drain-proximity join. Components kept per-body for transparency.",
    water_bodies: scored,
    river_sections: [] as never[],
  };

  writeArtifact(join(root, "public/data/restoration-priority-delhi.json"), out);
  console.log(`scored ${scored.length} bodies`);
  for (const s of scored.slice(0, 6)) {
    console.log(`  ${s.priority_score} (${s.priority_level}) - ${s.name} [${s.source}]`);
  }
}

main();
