/**
 * Build public/data/restoration-priority-mumbai.json over the 16
 * hand-curated MMR flagship water bodies, mirroring Madurai's scorer
 * (scripts/compute-restoration-priority-madurai.ts):
 *
 *   raw = status_severity (0-80) + cultural_bonus (0-35) + size (4-25)
 *   score = round(raw x confidence_multiplier (0.7-1.0)), capped at 100
 *   level: >=80 critical, >=60 high, >=40 moderate, else low
 *
 * Severity and cultural components are editorial judgments grounded in
 * each body's recorded status (water-bodies-flagship-mumbai.json) - the
 * rationale strings quote that basis so every score is auditable.
 * Supply reservoirs (Vihar, Tulsi) score low BY DESIGN: protected,
 * functioning sources are not restoration candidates.
 *
 * Run: npx tsx scripts/compute-restoration-priority-mumbai.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

import { writeArtifact } from "./lib/nvdm-write";

const root = process.cwd();

interface Flagship {
  name: string;
  area_acres?: number;
  status: string;
  lat: number;
  lng: number;
  location_confidence: string;
}

/** severity (0-80), cultural (0-35), confidence x, one-line grounding. */
const COMPONENTS: Record<
  string,
  { severity: number; cultural: number; conf: number; why: string }
> = {
  "Powai Lake": { severity: 70, cultural: 10, conf: 1.0, why: "eutrophic with ~18 MLD untreated sewage inflow; NGT penalty recommended; STP not due until Dec 2027" },
  "Vihar Lake": { severity: 5, cultural: 15, conf: 0.8, why: "protected active supply inside SGNP - not a restoration candidate; 1860 heritage (the city's first piped source)" },
  "Tulsi Lake": { severity: 5, cultural: 12, conf: 0.8, why: "forest-buffered supply reservoir, commonly cited as the cleanest - not a restoration candidate" },
  "Bandra Talao": { severity: 45, cultural: 25, conf: 0.9, why: "greenish water, foul odour, blocked inlets reported; reduced ~1/3 by a 1950s station road; heritage talao" },
  "Banganga Talao": { severity: 40, cultural: 35, conf: 1.0, why: "Grade-II sacred heritage tank; dewatered May 2026 for a ~Rs 20 cr restoration under activist criticism" },
  "Masunda Lake": { severity: 28, cultural: 25, conf: 0.9, why: "iconic and actively used but greenish water and foul odour reported; historic Thane talao" },
  "Upvan Lake": { severity: 48, cultural: 10, conf: 0.9, why: "'beautified' yet still acidic (pH 3.9-4.25), sewage-fed and eutrophic" },
  "Kacharali Lake": { severity: 22, cultural: 12, conf: 0.9, why: "beautified and well-maintained; on the AMRUT-2 conservation list" },
  "Siddheshwar Talao": { severity: 55, cultural: 12, conf: 0.9, why: "degraded and neglected - poor water quality, non-functional aerator, food-dumping - and left out of AMRUT-2 funding" },
  "Makhmali Talao": { severity: 62, cultural: 10, conf: 0.9, why: "severely degraded - slum sewage on three sides, hyacinth, fish kills, shrinking to encroachment; excluded from the City-of-Lakes campaign" },
  "Kavesar Lake": { severity: 55, cultural: 18, conf: 0.8, why: "Thane's last natural wetland (district's only naturally-growing white lotus); a beautification plan is opposed by the Save Kavesar movement" },
  "Thane Creek Flamingo Sanctuary": { severity: 25, cultural: 25, conf: 1.0, why: "Ramsar Site 2490 and Wildlife Sanctuary - protected, but the creek receives the region's sewage load" },
  "DPS Flamingo Lake": { severity: 65, cultural: 25, conf: 1.0, why: "flamingo deaths in 2024 after a water-flow disruption; Conservation Reserve declaration followed within days by a CIDCO de-reservation resolution" },
  "NRI Wetland": { severity: 60, cultural: 25, conf: 1.0, why: "the golf-course-vs-flamingos wetland; HC reclamation ban won but the developer's SLP is pending in the Supreme Court and reserve status remains undeclared" },
  "Kala Talao": { severity: 30, cultural: 12, conf: 0.8, why: "flagship recreational lake; cited as a hardscape-'beautification' example; area records conflict" },
  "Vadale Lake": { severity: 40, cultural: 15, conf: 0.8, why: "temple tank under weed and encroachment pressure; boating cancelled on ecological grounds; nature-based weevil control underway" },
};

function sizeScore(acres: number | undefined): { score: number; label: string } {
  if (!acres) return { score: 4, label: "size unrecorded" };
  if (acres >= 500) return { score: 25, label: `${acres} acres (very large)` };
  if (acres >= 100) return { score: 18, label: `${acres} acres (large)` };
  if (acres >= 50) return { score: 12, label: `${acres} acres (medium)` };
  if (acres >= 10) return { score: 8, label: `${acres} acres (small)` };
  return { score: 4, label: `${acres} acres (very small)` };
}

function level(score: number): string {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "moderate";
  return "low";
}

const flagshipFile = JSON.parse(
  readFileSync(resolve(root, "public/data/water-bodies-flagship-mumbai.json"), "utf-8"),
) as { bodies: Flagship[] };

const water_bodies = flagshipFile.bodies.map((b) => {
  const c = COMPONENTS[b.name];
  if (!c) throw new Error(`no components for ${b.name}`);
  const size = sizeScore(b.area_acres);
  const raw = c.severity + c.cultural + size.score;
  const score = Math.min(100, Math.round(raw * c.conf));
  return {
    id: `flagship:${b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    source: "flagship",
    name: b.name,
    water_type: "lake",
    area_ha: b.area_acres ? Math.round(b.area_acres * 0.4047 * 10) / 10 : null,
    centroid: [b.lat, b.lng],
    priority_score: score,
    priority_level: level(score),
    components: {
      status_severity: c.severity,
      cultural_bonus: c.cultural,
      size: size.score,
      confidence_multiplier: c.conf,
    },
    rationale: `${c.why} · ${size.label} · location ${b.location_confidence} confidence`,
  };
});

const out = {
  place_id: "mumbai",
  computed_at: new Date().toISOString().slice(0, 10),
  total_scored: water_bodies.length,
  algorithm_version: "mumbai-v1 (mirrors madurai scorer)",
  weights: { status_severity: 0.5, cultural_bonus: 0.25, size: 0.15, confidence_multiplier: 0.1 },
  notes:
    "Scored over the 16 hand-curated MMR flagship bodies (water-bodies-flagship-mumbai.json). " +
    "Components: status severity (0-80) + cultural/ecological bonus (0-35) + size (4-25), " +
    "scaled by location/source confidence (0.7-1.0). Every rationale quotes the recorded " +
    "status it is grounded in. Supply reservoirs (Vihar, Tulsi) score low by design - " +
    "protected, functioning sources are not restoration candidates. Bodies outside this " +
    "cohort (e.g. Tansa, Morbe) are NOT scored - absence of a priority means 'not assessed', " +
    "not 'fine'.",
  water_bodies: water_bodies.sort((a, b) => b.priority_score - a.priority_score),
  river_sections: [],
};

// Envelope-preserving write (scripts/lib/nvdm-write.ts): keeps the NVDM
// envelope injected by the migration so a rerun cannot strip it.
writeArtifact(resolve(root, "public/data/restoration-priority-mumbai.json"), out);
console.log(
  `wrote restoration-priority-mumbai.json: ${water_bodies.length} bodies`,
  out.water_bodies.slice(0, 5).map((w) => `${w.name}=${w.priority_score}(${w.priority_level})`).join(", "),
);
