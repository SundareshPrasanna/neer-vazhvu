/**
 * Build Tier 2 derived facts for Madurai and merge them into
 * public/data/facts-madurai.json so the /madurai/facts page surfaces
 * journalist-ready quotables computed from the data layers we ship.
 *
 * Sources read:
 *   gwr-blocks-madurai.json          -> CGWB block stress distribution
 *   restoration-priority-madurai.json -> top-priority flagship tanks
 *   ward-risk-madurai.json           -> F-grade ward count + worst ward
 *   river-quality-madurai.json       -> Vaigai BOD U/S vs D/S gradient
 *   water-bodies-lost-madurai.json   -> aggregate area lost
 *
 * The script is idempotent: it strips any prior auto-derived rows
 * (id starts with "auto-mad-") then re-appends fresh ones. Hand-curated
 * Tier 3/4 facts are preserved.
 *
 * Run:
 *   npx tsx scripts/compute-madurai-derived-facts.ts
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const root = process.cwd();

interface Fact {
  id: string;
  tier: 1 | 2 | 3 | 4;
  category: string;
  title: string;
  value: string;
  unit: string;
  interpretation: string;
  data_date: string;
  source_url: string;
  source_label: string;
}

interface FactsFile {
  place_id: string;
  generated_at: string;
  note?: string;
  facts: Fact[];
}

function load<T>(rel: string): T | null {
  const p = resolve(root, rel);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as T;
}

const AUTO_PREFIX = "auto-mad-";

function buildFacts(): Fact[] {
  const out: Fact[] = [];
  const today = new Date().toISOString().slice(0, 10);

  // ── CGWB blocks ──────────────────────────────────────────────────────
  const gwr = load<{
    source_url?: string;
    blocks: Array<{
      name: string;
      history: Array<{ year: number; class: string; development_pct: number }>;
    }>;
  }>("public/data/gwr-blocks-madurai.json");
  if (gwr?.blocks?.length) {
    // CGWB changed assessment granularity over time: pre-2023 rounds covered
    // ~66 firka-level units, while the 2023-24 rounds report the 11 revenue
    // blocks. Classify each block AT the latest common year so we never mix a
    // 2024 class with a stale 2020/2022 one. (The previous last-entry-per-block
    // approach did exactly that and inflated the over-exploited count to 4.)
    const latestYear = Math.max(
      ...gwr.blocks.flatMap((b) => b.history.map((h) => h.year)),
    );
    type BlockAtYear = {
      name: string;
      last: { year: number; class: string; development_pct: number };
    };
    const assessed = gwr.blocks
      .map((b) => ({
        name: b.name,
        last: b.history.find((h) => h.year === latestYear),
      }))
      .filter((b): b is BlockAtYear => b.last !== undefined);
    const oe = assessed.filter((b) => b.last.class === "Over Exploited");
    const cr = assessed.filter((b) => b.last.class === "Critical");
    const sc = assessed.filter((b) => b.last.class === "Semi Critical");
    const granularityNote =
      gwr.blocks.length > assessed.length
        ? ` CGWB's pre-2023 rounds assessed ${gwr.blocks.length} finer firka-level units, so earlier over-exploited counts are not directly comparable.`
        : "";

    if (oe.length > 0) {
      const top = oe.sort((a, b) => b.last.development_pct - a.last.development_pct)[0];
      out.push({
        id: `${AUTO_PREFIX}gwr-overexploited-blocks`,
        tier: 2,
        category: "Groundwater",
        title: "Over-exploited groundwater blocks (CGWB)",
        value: String(oe.length),
        unit: `of ${assessed.length} blocks`,
        interpretation: `${oe.length} of Madurai district's ${assessed.length} CGWB-assessed blocks (${latestYear}) ${oe.length === 1 ? "is" : "are"} pumping faster than recharge; most stressed is ${top.name} at ${top.last.development_pct.toFixed(0)}% development.${granularityNote}`,
        data_date: String(latestYear),
        source_url: gwr.source_url ?? "https://indiawris.gov.in/wris/",
        source_label: "CGWB GWR via India WRIS",
      });
    }
    if (cr.length + sc.length > 0) {
      out.push({
        id: `${AUTO_PREFIX}gwr-critical-semi`,
        tier: 2,
        category: "Groundwater",
        title: "Critical or semi-critical blocks",
        value: String(cr.length + sc.length),
        unit: `${cr.length} critical · ${sc.length} semi-critical`,
        interpretation: `Beyond the over-exploited tier, ${cr.length} ${cr.length === 1 ? "block is" : "blocks are"} 'Critical' (>90% draft) and ${sc.length} ${sc.length === 1 ? "is" : "are"} 'Semi Critical' (>70%). These are the watch-list zones where TWAD / Madurai Corporation interventions need to start before they tip over.`,
        data_date: String(latestYear),
        source_url: gwr.source_url ?? "https://indiawris.gov.in/wris/",
        source_label: "CGWB GWR via India WRIS",
      });
    }
  }

  // ── Restoration priority ────────────────────────────────────────────
  const pri = load<{
    algorithm_version?: string;
    bodies: Array<{ name: string; priority_score: number; priority_level: string }>;
  }>("public/data/restoration-priority-madurai.json");
  if (pri?.bodies?.length) {
    const critical = pri.bodies.filter((b) => b.priority_level === "critical");
    const high = pri.bodies.filter((b) => b.priority_level === "high");
    if (critical.length > 0) {
      const top = critical.sort((a, b) => b.priority_score - a.priority_score)[0];
      out.push({
        id: `${AUTO_PREFIX}restoration-critical`,
        tier: 2,
        category: "Restoration",
        title: "Flagship tanks at critical restoration priority",
        value: String(critical.length),
        unit: `of ${pri.bodies.length} flagships`,
        interpretation: `${critical.length} hand-curated flagship tanks score 'critical' on Madurai's restoration-priority composite (status severity × cultural anchor × size × source confidence). Highest score: ${top.name} at ${top.priority_score}/100.`,
        data_date: today,
        source_url: "/madurai/lake-restoration",
        source_label: `Algorithm: ${pri.algorithm_version ?? "madurai-flagship-v1"}`,
      });
    }
    if (high.length > 0) {
      out.push({
        id: `${AUTO_PREFIX}restoration-high`,
        tier: 2,
        category: "Restoration",
        title: "Flagships at high restoration priority",
        value: String(high.length),
        unit: `of ${pri.bodies.length} flagships`,
        interpretation: `Beyond critical, ${high.length} more flagships rank 'high'. Combined critical + high = ${critical.length + high.length} of ${pri.bodies.length} - the short-list for any Kudimaramathu / Smart City / AMRUT cycle.`,
        data_date: today,
        source_url: "/madurai/lake-restoration",
        source_label: `Algorithm: ${pri.algorithm_version ?? "madurai-flagship-v1"}`,
      });
    }
  }

  // ── Ward risk ───────────────────────────────────────────────────────
  const risk = load<{
    algorithm_version?: string;
    grade_counts: Record<string, number>;
    wards: Array<{
      ward_number: number;
      composite_score: number | null;
      grade: string;
      gw_depth_m: number | null;
      zone: string;
    }>;
  }>("public/data/ward-risk-madurai.json");
  if (risk?.wards?.length) {
    const f = risk.grade_counts.F ?? 0;
    const d = risk.grade_counts.D ?? 0;
    const total = risk.wards.length;
    if (f > 0) {
      const worst = [...risk.wards]
        .filter((w) => w.composite_score !== null)
        .sort((a, b) => (b.composite_score as number) - (a.composite_score as number))[0];
      out.push({
        id: `${AUTO_PREFIX}ward-f-grade`,
        tier: 2,
        category: "Governance",
        title: "F-grade wards on the risk composite",
        value: String(f),
        unit: `of ${total} wards`,
        interpretation: `${f} of Madurai's ${total} wards score F (composite >80) on the 3-factor risk index (groundwater depth 50%, water-body density 20%, water-body health 30%). Highest risk: Ward ${worst?.ward_number} (${worst?.zone}) at ${worst?.composite_score}/100. ${d} more wards score D.`,
        data_date: today,
        source_url: "/madurai/my-ward/report",
        source_label: `Algorithm: ${risk.algorithm_version ?? "madurai-risk-v1-3factor"}`,
      });
    }

    const withDepth = risk.wards.filter((w) => w.gw_depth_m !== null);
    if (withDepth.length > 0) {
      const avgDepth = withDepth.reduce((s, w) => s + (w.gw_depth_m as number), 0) / withDepth.length;
      const deepest = withDepth.sort((a, b) => (b.gw_depth_m as number) - (a.gw_depth_m as number))[0];
      out.push({
        id: `${AUTO_PREFIX}ward-gw-depth`,
        tier: 2,
        category: "Groundwater",
        title: "Shallow groundwater depth (CGWB Year Book wells)",
        value: avgDepth.toFixed(1),
        unit: "m below ground",
        interpretation: `Across Madurai's 21 CGWB Year Book observation wells (manually-measured dug wells in the shallow/phreatic aquifer), depth-to-water averages ${avgDepth.toFixed(1)} m, reaching about ${(deepest.gw_depth_m as number).toFixed(1)} m at the deepest well. Each ward is matched to its nearest well for the risk composite; the network is too sparse for a true per-ward survey, so this is a coarse nearest-well estimate, not interpolated precision.`,
        data_date: "2025-01",
        source_url: "/madurai/groundwater",
        source_label: "CGWB Ground Water Year Book (TN & Puducherry), 2023-25 · nearest-well",
      });
    }
  }

  // ── River quality ───────────────────────────────────────────────────
  const rq = load<{
    rivers: Array<{
      stations: Array<{
        id: string;
        name: string;
        readings: Array<{
          year: number;
          do_mgl: number | null;
          bod_mgl: number | null;
        }>;
      }>;
    }>;
  }>("public/data/river-quality-madurai.json");
  if (rq?.rivers?.[0]?.stations) {
    const stations = rq.rivers[0].stations;
    const us = stations.find((s) => s.id === "vaigai-sellur");
    const ds = stations.find((s) => s.id === "vaigai-anuppanadi");
    if (us && ds && us.readings.length > 0 && ds.readings.length > 0) {
      const usLatest = us.readings[us.readings.length - 1];
      const dsLatest = ds.readings[ds.readings.length - 1];
      if (usLatest.bod_mgl !== null && dsLatest.bod_mgl !== null) {
        out.push({
          id: `${AUTO_PREFIX}vaigai-bod-gradient`,
          tier: 2,
          category: "Rivers",
          title: "Vaigai BOD pollution gradient through Madurai",
          value: `+${(dsLatest.bod_mgl - usLatest.bod_mgl).toFixed(1)}`,
          unit: "mg/L D/S minus U/S",
          interpretation: `CPCB ${usLatest.year} NWMP readings: BOD jumps from ${usLatest.bod_mgl} mg/L upstream of Madurai (Sellur) to ${dsLatest.bod_mgl} mg/L downstream (Anuppanadi). Sewage outfalls and textile dyeing through the city push the river over the 3 mg/L drinkable-after-treatment threshold.`,
          data_date: String(usLatest.year),
          source_url: "https://cpcb.gov.in/nwmp-data-2/",
          source_label: "CPCB NWMP · Vaigai stations 10059 + 10060",
        });
      }
      if (dsLatest.do_mgl !== null) {
        out.push({
          id: `${AUTO_PREFIX}vaigai-do-downstream`,
          tier: 2,
          category: "Rivers",
          title: "Vaigai dissolved oxygen, downstream of Madurai",
          value: dsLatest.do_mgl.toFixed(1),
          unit: "mg/L (CPCB threshold 5.0)",
          interpretation: `Latest CPCB NWMP reading at Vaigai D/S Madurai (${dsLatest.year}). The 5 mg/L threshold is the cutoff for outdoor bathing and propagation of fish/wildlife under CPCB Class C. ${dsLatest.do_mgl >= 5 ? "Just above" : "Below"} threshold.`,
          data_date: String(dsLatest.year),
          source_url: "https://cpcb.gov.in/nwmp-data-2/",
          source_label: "CPCB NWMP station 10060",
        });
      }
    }
  }

  // ── Lost water bodies ───────────────────────────────────────────────
  const lost = load<{
    summary: {
      fully_lost_count: number;
      severely_reduced_count: number;
      combined_area_lost_sqkm_estimate: number;
      share_of_city_estimate_pct: number;
      slum_households_on_former_tank_beds_estimate: number;
    };
  }>("public/data/water-bodies-lost-madurai.json");
  if (lost?.summary) {
    out.push({
      id: `${AUTO_PREFIX}lost-tanks-area`,
      tier: 2,
      category: "Water bodies",
      title: "Urban tank area lost to encroachment",
      value: lost.summary.combined_area_lost_sqkm_estimate.toFixed(1),
      unit: "sq km lost",
      interpretation: `${lost.summary.fully_lost_count} fully lost + ${lost.summary.severely_reduced_count} severely reduced urban tanks. Combined area swallowed: ~${lost.summary.combined_area_lost_sqkm_estimate.toFixed(1)} sq km, roughly ${lost.summary.share_of_city_estimate_pct}% of Madurai's old city footprint. ~${(lost.summary.slum_households_on_former_tank_beds_estimate / 1000).toFixed(0)}k slum households now sit on former tank beds.`,
      data_date: today,
      source_url: "/madurai/lake-restoration",
      source_label: "Vencatesan (2014) + DHAN field studies",
    });
  }

  return out;
}

function main() {
  const factsPath = resolve(root, "public/data/facts-madurai.json");
  const factsFile = JSON.parse(readFileSync(factsPath, "utf-8")) as FactsFile;

  // Strip prior auto-derived rows.
  const handCurated = factsFile.facts.filter((f) => !f.id.startsWith(AUTO_PREFIX));
  const derived = buildFacts();

  console.log(`Hand-curated retained: ${handCurated.length}`);
  console.log(`Derived appended:      ${derived.length}`);

  factsFile.facts = [...handCurated, ...derived];
  factsFile.generated_at = new Date().toISOString().slice(0, 10);

  writeFileSync(factsPath, JSON.stringify(factsFile, null, 2));
  console.log(`\nWrote ${factsPath}`);
  console.log("Tier 2 derived ids:");
  for (const f of derived) console.log(`  ${f.id}: ${f.title} = ${f.value} ${f.unit}`);
}

main();
