/**
 * Fetch CGWB groundwater resource assessment data for Madurai district.
 *
 * Mirrors fetch-wris-groundwater.ts but is Madurai-specific to avoid
 * touching Chennai's existing pipeline. M4's broader decoupling will
 * fold both into a single place-aware script.
 *
 * Outputs:
 * - public/data/gwr-blocks-madurai.json (11 blocks + multi-year history)
 * - public/geojson/madurai-gwr-blocks.geojson (block polygons)
 * - public/data/gw-stations-madurai.json (CGWB station locations)
 *
 * Run: npx tsx scripts/fetch-wris-groundwater-madurai.ts
 */

import { writeArtifact } from "./lib/nvdm-write";
import { resolve } from "path";

// WRIS has an incomplete SSL certificate chain - allow connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const root = resolve(new URL(".", import.meta.url).pathname, "..");
const WRIS_BASE = "https://arc.indiawris.gov.in/server/rest/services/NWIC";

// GWR years available on WRIS
const GWR_YEARS = [2011, 2013, 2017, 2020, 2022, 2023, 2024] as const;

// Madurai-district WHERE clause; works as a substring match so cases like
// 'MADURAI' / 'Madurai' / 'madurai' all hit. Escape ' for ArcGIS REST.
const DISTRICT_WHERE = "state%3D%27TN%27+AND+district+LIKE+%27%25adurai%25%27";

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

// Normalize Madurai block names. WRIS has no sub-block compounds for Madurai
// (unlike Chennai's "Mambalam - Guindy-I"), so this is a thin pass.
function normalizeBlockName(raw: string): string {
  return raw.trim();
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

async function fetchStations(): Promise<
  {
    name: string;
    lat: number;
    lng: number;
    agency: string;
    block: string;
    station_code: string;
    data_types: string;
  }[]
> {
  const url =
    `${WRIS_BASE}/GroundwaterLevel_Stations/MapServer/0/query?` +
    `where=district_name+LIKE+%27%25adurai%25%27` +
    `&outFields=station_name,lat,long,agency_name,block_name,station_code,station_data_type_new` +
    `&f=json&resultRecordCount=200`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Stations fetch failed: ${resp.status}`);
  const data = await resp.json();

  const stations = (data.features || []).map(
    (f: { attributes: Record<string, unknown> }) => ({
      name: (f.attributes.station_name as string) || "",
      lat: f.attributes.lat as number,
      lng: f.attributes.long as number,
      agency: (f.attributes.agency_name as string) || "",
      block: (f.attributes.block_name as string) || "",
      station_code: (f.attributes.station_code as string) || "",
      data_types: (f.attributes.station_data_type_new as string) || "",
    }),
  );

  // Deduplicate by name + rounded coords.
  const seen = new Set<string>();
  const unique = stations.filter((s: { name: string; lat: number; lng: number }) => {
    const key = `${s.name.toLowerCase()}_${s.lat.toFixed(3)}_${s.lng.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`  Stations: ${stations.length} total, ${unique.length} unique`);
  return unique;
}

async function main() {
  console.log("Fetching WRIS groundwater data for Madurai district...\n");

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
      `    ${b.name.padEnd(20)} ${b.latest.class.padEnd(18)} dev=${b.latest.development_pct}%`,
    );
  }

  console.log("\n3. Fetching block boundary polygons:");
  const boundaries = await fetchBlockBoundaries();

  console.log("\n4. Fetching monitoring stations:");
  const stations = await fetchStations();

  console.log("\n5. Writing output files:");

  const gwrOutput = {
    source: "India WRIS / CGWB",
    source_url: "https://indiawris.gov.in/wris/",
    place_id: "madurai",
    fetched_at: new Date().toISOString(),
    years: GWR_YEARS,
    blocks,
  };
  const gwrPath = resolve(root, "public/data/gwr-blocks-madurai.json");
  writeArtifact(gwrPath, gwrOutput);
  console.log(`  ${gwrPath}`);

  const geoPath = resolve(root, "public/geojson/madurai-gwr-blocks.geojson");
  writeArtifact(geoPath, boundaries);
  console.log(`  ${geoPath}`);

  const stationsOutput = {
    source: "India WRIS / CGWB",
    place_id: "madurai",
    fetched_at: new Date().toISOString(),
    stations,
  };
  const stationsPath = resolve(root, "public/data/gw-stations-madurai.json");
  writeArtifact(stationsPath, stationsOutput);
  console.log(`  ${stationsPath}`);

  console.log("\nDone!");
}

main().catch(console.error);
