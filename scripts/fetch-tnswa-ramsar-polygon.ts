/**
 * Extract a single Tamil Nadu Ramsar site polygon from the Tamil Nadu
 * State Wetland Authority's public QGIS web map at
 *   https://tnswa.tn.gov.in/qgis_web/index.html
 *
 * The map loads its data via two qgis2web exports:
 *   - data/RamsarBoundary_2.js   (var json_RamsarBoundary_2 = {...})
 *   - data/RamsarInfo_3.js       (var json_RamsarInfo_3 = {...})
 *
 * This is the canonical *gazetted* boundary used by NGT / CMDA / RSIS
 * references. It contains all 20 TN Ramsar sites as MultiPolygon features
 * keyed by the property "Wetland".
 *
 * Output:
 *   - public/geojson/rich-bodies/<bodyId>.geojson         (the polygon)
 *   - public/geojson/rich-bodies/<bodyId>-buffer-<m>m.geojson (optional)
 *
 * Usage:
 *   npx tsx scripts/fetch-tnswa-ramsar-polygon.ts \
 *     --wetland-name "Pallikaranai Marsh Reserve Forest" \
 *     --body-id pallikaranai \
 *     --buffer-m 1000
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import buffer from "@turf/buffer";
import area from "@turf/area";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

const TNSWA_BOUNDARY_URL =
  "https://tnswa.tn.gov.in/qgis_web/data/RamsarBoundary_2.js";
const TNSWA_INFO_URL =
  "https://tnswa.tn.gov.in/qgis_web/data/RamsarInfo_3.js";
const TNSWA_PAGE_URL = "https://tnswa.tn.gov.in/qgis_web/index.html";
const USER_AGENT = "neervazhvu-rich-body-fetcher/1.0";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const val = argv[i + 1];
    if (val && !val.startsWith("--")) {
      out[key] = val;
      i++;
    } else {
      out[key] = "true";
    }
  }
  return out;
}

async function fetchAndStripJsVar<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Fetch ${url} returned ${res.status}`);
  }
  const txt = await res.text();
  const m = txt.match(/^\s*var\s+\w+\s*=\s*([\s\S]*?);?\s*$/);
  if (!m) {
    throw new Error(`Could not parse JS var assignment from ${url}`);
  }
  return JSON.parse(m[1]);
}

async function main() {
  const args = parseArgs(process.argv);
  const wetlandName = args["wetland-name"];
  const bodyId = args["body-id"];
  const bufferM = parseInt(args["buffer-m"] || "0", 10);

  if (!wetlandName || !bodyId) {
    console.error(
      'Usage: --wetland-name "<Name as on TNSWA>" --body-id <slug> [--buffer-m <metres>]'
    );
    process.exit(1);
  }

  console.log(`Fetching TNSWA Ramsar boundary file...`);
  const boundary = await fetchAndStripJsVar<FeatureCollection>(TNSWA_BOUNDARY_URL);
  console.log(`  loaded ${boundary.features.length} TN Ramsar polygons`);

  console.log(`Fetching TNSWA Ramsar info file (for centroid / area metadata)...`);
  let info: FeatureCollection | null = null;
  try {
    info = await fetchAndStripJsVar<FeatureCollection>(TNSWA_INFO_URL);
    console.log(`  loaded ${info.features.length} TN Ramsar info markers`);
  } catch (err) {
    console.warn(`  info fetch failed, continuing without it: ${err}`);
  }

  const match = boundary.features.find(
    (f) => (f.properties as any)?.Wetland === wetlandName
  );
  if (!match) {
    const names = boundary.features
      .map((f) => (f.properties as any)?.Wetland)
      .filter(Boolean);
    console.error(`Wetland "${wetlandName}" not found in TNSWA boundary file.`);
    console.error(`Available names:\n  - ${names.join("\n  - ")}`);
    process.exit(1);
  }

  const infoMatch = info?.features.find(
    (f) => (f.properties as any)?.Name === wetlandName
  );
  const infoProps = (infoMatch?.properties as any) || {};

  const geom = match.geometry as MultiPolygon | Polygon;
  const totalAreaHa = Math.round((area(geom) / 10000) * 100) / 100;

  const polygonCount =
    geom.type === "MultiPolygon" ? geom.coordinates.length : 1;
  const outerPointCount =
    geom.type === "MultiPolygon"
      ? geom.coordinates.reduce((s, p) => s + p[0].length, 0)
      : geom.coordinates[0].length;

  console.log(`\nMatched "${wetlandName}"`);
  console.log(`  geometry: ${geom.type}, ${polygonCount} polygon(s), ${outerPointCount} outer points`);
  console.log(`  computed area: ${totalAreaHa} ha`);
  if (infoProps.Area_Exren) console.log(`  TNSWA-reported area: ${infoProps.Area_Exren}`);
  if (infoProps.District) console.log(`  district: ${infoProps.District}`);
  if (infoProps.Elevation) console.log(`  elevation: ${infoProps.Elevation}`);

  const feature: Feature = {
    type: "Feature",
    geometry: geom,
    properties: {
      body_id: bodyId,
      name: wetlandName,
      district: infoProps.District || null,
      area_ha_computed: totalAreaHa,
      area_reported_tnswa: infoProps.Area_Exren || null,
      elevation_tnswa: infoProps.Elevation || null,
      ramsar: true,
      source: `Tamil Nadu State Wetland Authority (TNSWA) via ${TNSWA_PAGE_URL}`,
      source_dataset: TNSWA_BOUNDARY_URL,
      license: "Public data from Tamil Nadu State Wetland Authority portal",
      fetched_at: new Date().toISOString(),
    },
  };

  const outDir = join(process.cwd(), "public/geojson/rich-bodies");
  mkdirSync(outDir, { recursive: true });
  const bodyPath = join(outDir, `${bodyId}.geojson`);
  writeFileSync(
    bodyPath,
    JSON.stringify({ type: "FeatureCollection", features: [feature] }, null, 2)
  );
  console.log(`\nWrote ${bodyPath}`);

  if (bufferM > 0) {
    const buffered = buffer(feature as Feature<MultiPolygon | Polygon>, bufferM, {
      units: "meters",
    });
    if (!buffered) {
      throw new Error("Buffer computation returned null");
    }
    const bufFeature = {
      ...buffered,
      properties: {
        body_id: bodyId,
        buffer_metres: bufferM,
        source_polygon: `${bodyId}.geojson`,
        source_polygon_provider: "TNSWA",
        computed_with: "@turf/buffer",
        fetched_at: new Date().toISOString(),
      },
    };
    const bufPath = join(outDir, `${bodyId}-buffer-${bufferM}m.geojson`);
    writeFileSync(
      bufPath,
      JSON.stringify({ type: "FeatureCollection", features: [bufFeature] }, null, 2)
    );
    const bufGeom = bufFeature.geometry as Polygon | MultiPolygon;
    console.log(`Wrote ${bufPath}`);
    console.log(`  buffer area: ${Math.round(area(bufGeom) / 10000)} ha`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
