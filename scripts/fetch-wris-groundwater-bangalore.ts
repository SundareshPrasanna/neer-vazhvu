/**
 * Fetch CGWB groundwater resource assessment data for Bangalore Urban district.
 *
 * Mirrors fetch-wris-groundwater-madurai.ts. WRIS returns Karnataka block-
 * level GEC classifications (Safe / Semi Critical / Critical / Over Exploited),
 * stage-of-development %, net annual GW availability, and draft components
 * per assessment unit for each GEC vintage (2011, 2013, 2017, 2020, 2022,
 * 2023, 2024).
 *
 * Bangalore Urban district has 5 CGWB assessment units: BBMP, Bangalore
 * North, Bangalore East, Bangalore South, and Anekal. WRIS spells the
 * district 'Bengaluru Urban' in newer vintages and 'Bangalore Urban' in
 * older ones, so the WHERE clause matches both via substring.
 *
 * Outputs:
 *   public/data/gwr-blocks-bangalore.json
 *   public/geojson/bangalore-gwr-blocks.geojson
 *
 * Run: npx tsx scripts/fetch-wris-groundwater-bangalore.ts
 */

import { writeFileSync } from "fs";
import { resolve } from "path";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const root = resolve(new URL(".", import.meta.url).pathname, "..");
const WRIS_BASE = "https://arc.indiawris.gov.in/server/rest/services/NWIC";

const GWR_YEARS = [2011, 2013, 2017, 2020, 2022, 2023, 2024] as const;

// Matches both 'Bengaluru Urban' (newer) and 'Bangalore Urban' (older
// vintages). LIKE substring %ngaluru% catches 'Bengaluru' and %ngalore%
// catches 'Bangalore'; using both alternatives via OR keeps the WHERE
// readable. State is KA in WRIS.
const DISTRICT_WHERE =
  "state%3D%27KA%27+AND+%28district+LIKE+%27%25engaluru%25Urban%25%27+OR+district+LIKE+%27%25angalore%25Urban%25%27%29";

interface GWRRecord {
  block: string;
  class: string;
  sgw_dev_pe: number;
  na_gwa: number | null;
  agwd_tot: number | null;
  agwd_irr: number | null;
  agwd_dom_i: number | null;
}

interface NormalizedBlock {
  name: string;
  history: {
    year: number;
    class: string;
    development_pct: number;
    availability_ham: number | null;
    draft_total_ham: number | null;
  }[];
  latest: {
    class: string;
    development_pct: number;
    availability_ham: number | null;
    draft_total_ham: number | null;
  };
}

// WRIS spells Bangalore blocks inconsistently across vintages:
//   - 'Bengaluru North' vs 'Bangalore-North' vs 'Bangalore North_non Command'
//   - 'Bangalore' / 'Bangalore City' / 'Bangalore-City' / 'BBMP'
//   - direction may be parenthesised: 'Bangalore (North)'
// Plus blocks got subdivided over time (Yelahanka carved out in 2020,
// North split off some earlier year). To keep the join against the
// polygon GeoJSON stable, every input maps to one of the six canonical
// 2024-vintage names (Bangalore (North), Bangalore-South, Bangalore-East,
// Bangalore-City, Yelahanka, Anekal). Cases where pre-2020 records mix
// a now-split area into the parent block are unavoidable; the older
// history entries become attributable to the most plausible canonical
// block at that vintage, with shorter timelines for newly created blocks.
function normalizeBlockName(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*non\s*command\s*$/, "")
    .replace(/^bengaluru\b/, "bangalore");

  if (s.includes("yelahanka")) return "Yelahanka";
  if (s.includes("anekal")) return "Anekal";
  if (s.includes("north")) return "Bangalore (North)";
  if (s.includes("south")) return "Bangalore-South";
  if (s.includes("east")) return "Bangalore-East";
  if (s.includes("west")) return "Bangalore-West";
  if (s === "bangalore" || s.includes("city") || s.includes("bbmp")) {
    return "Bangalore-City";
  }
  return raw;
}

async function fetchGWRYear(year: number): Promise<{ year: number; records: GWRRecord[] }> {
  const url =
    `${WRIS_BASE}/GWR${year}_CGWB/MapServer/8/query?` +
    `where=${DISTRICT_WHERE}` +
    `&outFields=block,class,sgw_dev_pe,na_gwa,agwd_tot,agwd_irr,agwd_dom_i` +
    `&f=json&resultRecordCount=100`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`GWR${year} fetch failed: ${resp.status}`);
  const data = await resp.json();

  const records: GWRRecord[] = (data.features || []).map(
    (f: { attributes: Record<string, unknown> }) => ({
      block: f.attributes.block as string,
      class: f.attributes.class as string,
      sgw_dev_pe: f.attributes.sgw_dev_pe as number,
      na_gwa: f.attributes.na_gwa as number | null,
      agwd_tot: f.attributes.agwd_tot as number | null,
      agwd_irr: f.attributes.agwd_irr as number | null,
      agwd_dom_i: f.attributes.agwd_dom_i as number | null,
    }),
  );

  console.log(`  GWR${year}: ${records.length} records`);
  return { year, records };
}

async function fetchBlockBoundaries(): Promise<GeoJSON.FeatureCollection> {
  const url =
    `${WRIS_BASE}/GWR2024_CGWB/MapServer/8/query?` +
    `where=${DISTRICT_WHERE}` +
    `&outFields=block,class,sgw_dev_pe,na_gwa,agwd_tot` +
    `&f=geojson&returnGeometry=true&resultRecordCount=50`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Block boundaries fetch failed: ${resp.status}`);
  const data = await resp.json();
  console.log(`  Block boundaries: ${data.features.length} polygons`);
  return data;
}

async function main() {
  console.log("Fetching WRIS groundwater data for Bangalore Urban district...\n");

  console.log("1. Fetching GWR block assessments:");
  const yearData: { year: number; records: GWRRecord[] }[] = [];
  for (const year of GWR_YEARS) {
    try {
      yearData.push(await fetchGWRYear(year));
    } catch (e) {
      console.warn(`  GWR${year}: skipped (${(e as Error).message})`);
    }
  }

  console.log("\n2. Normalizing block names and aggregating history:");
  const blockMap = new Map<string, NormalizedBlock>();

  for (const yd of yearData) {
    const blockAgg = new Map<
      string,
      { classes: string[]; devs: number[]; avails: number[]; drafts: number[] }
    >();

    for (const rec of yd.records) {
      const normName = normalizeBlockName(rec.block);
      if (!blockAgg.has(normName)) {
        blockAgg.set(normName, { classes: [], devs: [], avails: [], drafts: [] });
      }
      const agg = blockAgg.get(normName)!;
      agg.classes.push(rec.class);
      agg.devs.push(rec.sgw_dev_pe);
      if (rec.na_gwa != null) agg.avails.push(rec.na_gwa);
      if (rec.agwd_tot != null) agg.drafts.push(rec.agwd_tot);
    }

    for (const [name, agg] of blockAgg) {
      if (!blockMap.has(name)) {
        blockMap.set(name, {
          name,
          history: [],
          latest: {
            class: "",
            development_pct: 0,
            availability_ham: null,
            draft_total_ham: null,
          },
        });
      }
      const block = blockMap.get(name)!;
      const classOrder = ["Safe", "Semi Critical", "Semi-Critical", "Critical", "Over Exploited"];
      const worstClass = agg.classes.sort(
        (a, b) => classOrder.indexOf(b) - classOrder.indexOf(a),
      )[0];
      const totalAvail = agg.avails.reduce((s, v) => s + v, 0);
      const totalDraft = agg.drafts.reduce((s, v) => s + v, 0);
      const avgDev =
        totalAvail > 0
          ? (totalDraft / totalAvail) * 100
          : agg.devs.reduce((s, v) => s + v, 0) / agg.devs.length;

      block.history.push({
        year: yd.year,
        class: worstClass.replace("Semi-Critical", "Semi Critical"),
        development_pct: Math.round(avgDev * 10) / 10,
        availability_ham: totalAvail > 0 ? Math.round(totalAvail * 10) / 10 : null,
        draft_total_ham: totalDraft > 0 ? Math.round(totalDraft * 10) / 10 : null,
      });
    }
  }

  for (const block of blockMap.values()) {
    block.history.sort((a, b) => a.year - b.year);
    const last = block.history[block.history.length - 1];
    block.latest = {
      class: last.class,
      development_pct: last.development_pct,
      availability_ham: last.availability_ham,
      draft_total_ham: last.draft_total_ham,
    };
  }

  const blocks = [...blockMap.values()].sort(
    (a, b) => b.latest.development_pct - a.latest.development_pct,
  );
  console.log(`  ${blocks.length} blocks`);
  for (const b of blocks) {
    console.log(
      `    ${b.name.padEnd(24)} ${b.latest.class.padEnd(18)} dev=${b.latest.development_pct}%`,
    );
  }

  console.log("\n3. Fetching block boundary polygons:");
  const boundaries = await fetchBlockBoundaries();

  console.log("\n4. Writing output files:");

  const gwrOutput = {
    source: "India WRIS / CGWB",
    source_url: "https://indiawris.gov.in/wris/",
    place_id: "bangalore",
    fetched_at: new Date().toISOString(),
    years: GWR_YEARS,
    blocks,
  };
  const gwrPath = resolve(root, "public/data/gwr-blocks-bangalore.json");
  writeFileSync(gwrPath, JSON.stringify(gwrOutput, null, 2));
  console.log(`  ${gwrPath}`);

  const geoPath = resolve(root, "public/geojson/bangalore-gwr-blocks.geojson");
  writeFileSync(geoPath, JSON.stringify(boundaries, null, 2));
  console.log(`  ${geoPath}`);

  console.log("\nDone!");
}

main().catch(console.error);
