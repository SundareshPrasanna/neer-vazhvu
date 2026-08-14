/**
 * Compute restoration priority for Hyderabad's flagship water bodies.
 *
 * Structurally the Delhi/Madurai/Mumbai scorer, but the COMPONENTS are
 * Hyderabad's, because the risk signals here are different.
 *
 * The one that matters most is new: **legal exposure**. Hyderabad is the only
 * city on the platform with a gazetted per-lake boundary register (HMDA's
 * 2,978-lake Full Tank Level register, in-repo). A lake whose FTL boundary has
 * a preliminary notification but no FINAL one has no legally settled edge to
 * prosecute an encroachment against - which is precisely the condition
 * encroachment needs. That is a restoration-priority signal no other city can
 * compute, so it carries real weight here rather than being a footnote.
 *
 * Two deliberate departures from Delhi's scorer:
 *   - Delhi's cultural bonus keys on Sultanate/Tughlaq/Ramsar keywords. Those
 *     mean nothing here; Hyderabad's heritage vocabulary is Qutb Shahi and
 *     Asaf Jahi, and its conservation anchor is the Biodiversity Heritage Site
 *     designation rather than Ramsar.
 *   - `not_in_hmda_register` is NOT scored as unprotected. The register covers
 *     the Extended HMDA Area survey and omits several of the largest lakes
 *     (Hussain Sagar, Himayat Sagar, Shamirpet, Ameenpur) which sit under other
 *     authorities. Absence from the register is unknown status, not bad status,
 *     and is scored neutrally with the reason stated in the rationale.
 *
 * Inputs:  public/data/water-bodies-flagship-hyderabad.json
 *          public/geojson/hyderabad-water-bodies-current.geojson (area cross-check)
 * Output:  public/data/restoration-priority-hyderabad.json
 *
 * Run: npx tsx scripts/compute-restoration-priority-hyderabad.ts
 */

import { readFileSync, writeFileSync } from "fs";
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
  lat: number | null;
  lng: number | null;
  hmda_register: string;
  boundary_legally_final: boolean | null;
}

type PriorityLevel = "critical" | "high" | "moderate" | "low";

const WEIGHTS = {
  status_severity: 0.4,
  legal_exposure: 0.25,
  cultural_bonus: 0.2,
  size: 0.15,
  confidence_multiplier: 0.1,
};

const ALGORITHM_VERSION = "hyderabad-v1";

function statusSeverity(b: FlagshipBody): { score: number; label: string } {
  const s = `${b.status} ${b.cultural_note}`.toLowerCase();
  if (s.includes("shrunk from") || s.includes("down from") || s.includes("encroachment"))
    return { score: 80, label: "documented shrinkage / encroachment" };
  if (s.includes("sewage"))
    return { score: 70, label: "sewage-stressed" };
  if (s.includes("restoration") || s.includes("revival") || s.includes("hydraa"))
    return { score: 45, label: "restoration works under way" };
  if (s.includes("live drinking-water source"))
    return { score: 30, label: "operating supply source" };
  if (s.includes("survives"))
    return { score: 55, label: "surviving remnant" };
  return { score: 40, label: "status unclear" };
}

/**
 * The Hyderabad-specific component. Reads the in-repo HMDA register status
 * carried on each flagship entry.
 */
function legalExposure(b: FlagshipBody): { score: number; label: string } {
  if (b.boundary_legally_final === false)
    return {
      score: 100,
      label: "gazetted but NO final FTL notification - boundary not legally settled",
    };
  if (b.boundary_legally_final === true)
    return { score: 20, label: "final FTL notification issued" };
  return {
    score: 40,
    label: "not in the HMDA register (Extended-HMDA survey scope; other authority)",
  };
}

function culturalBonus(b: FlagshipBody): { score: number; label: string } {
  const s = `${b.status} ${b.cultural_note}`.toLowerCase();
  const parts: string[] = [];
  let score = 0;
  if (s.includes("biodiversity heritage site")) {
    score += 22;
    parts.push("Biodiversity Heritage Site");
  }
  if (s.includes("go 111")) {
    score += 14;
    parts.push("GO 111 catchment");
  }
  if (b.era && /qutb shahi/i.test(b.era)) {
    score += 12;
    parts.push("Qutb Shahi heritage");
  } else if (b.era && /asaf jahi|nizam/i.test(b.era)) {
    score += 10;
    parts.push("Asaf Jahi heritage");
  }
  if (s.includes("flood control") || s.includes("1908")) {
    score += 8;
    parts.push("1908 flood-control lineage");
  }
  if (s.includes("hydraa")) {
    score += 6;
    parts.push("named in HYDRAA's programme");
  }
  return { score: Math.min(score, 35), label: parts.join(", ") || "none" };
}

function sizeScore(b: FlagshipBody): { score: number; label: string } {
  const acres = b.area_acres;
  if (acres == null) return { score: 5, label: "size unknown" };
  if (acres >= 1000) return { score: 25, label: `${acres} acres (very large)` };
  if (acres >= 300) return { score: 20, label: `${acres} acres (large)` };
  if (acres >= 100) return { score: 14, label: `${acres} acres (medium)` };
  if (acres >= 50) return { score: 9, label: `${acres} acres (small)` };
  return { score: 5, label: `${acres} acres (tiny)` };
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

function main() {
  const flagship = JSON.parse(
    readFileSync(join(root, "public/data/water-bodies-flagship-hyderabad.json"), "utf-8"),
  ) as { bodies: FlagshipBody[] };

  const scored = flagship.bodies.map((b) => {
    const st = statusSeverity(b);
    const le = legalExposure(b);
    const cu = culturalBonus(b);
    const sz = sizeScore(b);
    const cm = confidenceMultiplier(b.confidence);
    const raw =
      st.score * WEIGHTS.status_severity +
      le.score * WEIGHTS.legal_exposure +
      cu.score * WEIGHTS.cultural_bonus +
      sz.score * WEIGHTS.size;
    const score = Math.round(raw * (1 - WEIGHTS.confidence_multiplier + WEIGHTS.confidence_multiplier * cm) * 10) / 10;
    return {
      id: `flagship:${b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      source: "flagship" as const,
      name: b.name,
      water_type: b.type,
      area_ha: b.area_acres == null ? null : Math.round(b.area_acres * 0.404686 * 10) / 10,
      centroid: b.lat == null || b.lng == null ? null : [b.lat, b.lng],
      priority_score: score,
      priority_level: bucket(score),
      hmda_register: b.hmda_register,
      boundary_legally_final: b.boundary_legally_final,
      components: {
        status_severity: st.score,
        legal_exposure: le.score,
        cultural_bonus: cu.score,
        size: sz.score,
        confidence_multiplier: cm,
      },
      rationale: [st.label, le.label, cu.label !== "none" ? cu.label : null, sz.label, `confidence ${b.confidence}`]
        .filter(Boolean)
        .join("; "),
    };
  });

  scored.sort((a, b) => b.priority_score - a.priority_score);

  const out = {
    place_id: "hyderabad",
    computed_at: new Date().toISOString().slice(0, 10),
    algorithm_version: ALGORITHM_VERSION,
    total_scored: scored.length,
    weights: WEIGHTS,
    notes:
      "Hyderabad-specific scorer. The distinguishing component is LEGAL EXPOSURE, computed from " +
      "HMDA's gazetted Full Tank Level register (in-repo): a lake with a preliminary but no FINAL " +
      "notification has no legally settled boundary to prosecute encroachment against, and scores " +
      "highest. Absence from the register is scored NEUTRALLY, not as unprotected - the register " +
      "covers the Extended HMDA Area survey and omits several of the largest lakes (Hussain Sagar, " +
      "Himayat Sagar, Shamirpet, Ameenpur), which sit under other authorities. Areas and centroids " +
      "derive from the in-repo OSM layer; two entries carry null coordinates because no confident " +
      "polygon match exists and a guessed pin is worse than an absent one.",
    water_bodies: scored,
    river_sections: [],
  };

  writeArtifact(
    join(root, "public/data/restoration-priority-hyderabad.json"),
    out as unknown as Record<string, unknown>,
  );

  console.log(`Scored ${scored.length} flagship bodies (${ALGORITHM_VERSION})`);
  for (const s of scored) {
    const legal =
      s.boundary_legally_final === false
        ? "NO FINAL FTL"
        : s.boundary_legally_final === true
          ? "final FTL"
          : "not in register";
    console.log(`  ${String(s.priority_score).padStart(5)} ${s.priority_level.padEnd(9)} ${s.name.padEnd(26)} ${legal}`);
  }
}

main();
