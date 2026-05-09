/**
 * Audit large water bodies (>= threshold ha) in chennai-water-bodies-current.geojson.
 *
 * Writes a CSV with centroid lat/lng, Google Maps URL, OSM URL, and current
 * name for hand-curation. Fill in the `correct_name` and `correct_name_ta`
 * columns, set `action` to one of keep / replace / blank, then feed the CSV
 * back via apply-water-body-name-audits.ts (separate script when needed).
 *
 * Run: npx tsx scripts/audit-large-water-bodies.ts [min_area_ha]
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const MIN_AREA_HA = process.argv[2] ? parseFloat(process.argv[2]) : 1000;

interface Feature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: {
    osm_id: number;
    osm_type: string;
    name: string;
    name_ta: string;
    water_type: string;
    area_ha: number | null;
    wikidata_qid?: string;
    [key: string]: unknown;
  };
}

function polygonCentroid(geom: Feature["geometry"]): [number, number] {
  let coords: number[][];
  if (geom.type === "Polygon") coords = (geom.coordinates as number[][][])[0];
  else if (geom.type === "MultiPolygon") coords = (geom.coordinates as number[][][][])[0][0];
  else return [0, 0];
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return [lng, lat];
}

function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function main() {
  const geojsonPath = join(process.cwd(), "public/geojson/chennai-water-bodies-current.geojson");
  const gj: { features: Feature[] } = JSON.parse(readFileSync(geojsonPath, "utf-8"));

  const rows = gj.features
    .filter((f) => (f.properties.area_ha || 0) >= MIN_AREA_HA)
    .map((f) => {
      const [lng, lat] = polygonCentroid(f.geometry);
      return {
        osm_id: f.properties.osm_id,
        osm_type: f.properties.osm_type,
        area_ha: f.properties.area_ha,
        water_type: f.properties.water_type,
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
        current_name: f.properties.name || "",
        current_name_ta: f.properties.name_ta || "",
        wikidata_qid: f.properties.wikidata_qid || "",
        google_maps_url: `https://www.google.com/maps/@${lat.toFixed(5)},${lng.toFixed(5)},15z`,
        osm_url: `https://www.openstreetmap.org/${f.properties.osm_type}/${f.properties.osm_id}`,
        correct_name: "",
        correct_name_ta: "",
        action: "", // keep | replace | blank
        notes: "",
      };
    })
    .sort((a, b) => (b.area_ha || 0) - (a.area_ha || 0));

  const headers = [
    "osm_id", "osm_type", "area_ha", "water_type", "lat", "lng",
    "current_name", "current_name_ta", "wikidata_qid",
    "google_maps_url", "osm_url",
    "correct_name", "correct_name_ta", "action", "notes",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape((r as Record<string, unknown>)[h] as string | number)).join(","));
  }

  const outPath = join(process.cwd(), "scripts/data-raw/water-body-names-audit.csv");
  writeFileSync(outPath, lines.join("\n") + "\n");

  console.log(`Wrote ${rows.length} rows (>= ${MIN_AREA_HA} ha) to ${outPath}`);
  console.log(`\nPreview (top 15):`);
  console.log(`  area_ha   osm_id        current_name`);
  for (const r of rows.slice(0, 15)) {
    const name = r.current_name || "(unnamed)";
    console.log(`  ${String(r.area_ha).padStart(8)}  ${String(r.osm_id).padStart(11)}  ${name}`);
  }
}

main();
