/**
 * One-time script: Fetch the Delhi "Jal Dharohar" Water Bodies Census map
 * and convert it to GeoJSON points.
 *
 * Source chain (attribution required on every rendering surface):
 *   - Census: 1st Census of Water Bodies / Jal Dharohar enumeration for
 *     NCT Delhi (enumeration 2022; map released 2023), GNCTD / MoJS.
 *   - Digitization + hosting: OpenCity Urban Data Portal, dataset
 *     "Delhi Water Bodies Census Data", resource "Delhi Water Census Map
 *     2023" (KML). Dataset page:
 *     https://data.opencity.in/dataset/delhi-water-bodies-census-data
 *
 * Run: npx tsx scripts/fetch-water-census-delhi.ts
 * Output: public/geojson/delhi-water-bodies-census.geojson
 *
 * 893 point features with the census attributes (unique_id, district,
 * tehsil, village, type, ownership, storage capacity, max depth, khasra,
 * enumeration date). Points join onto the OSM polygon layer
 * (delhi-water-bodies-current.geojson) at render time - the Chennai
 * census-join pattern.
 */

import { writeFileSync } from "fs";
import { join } from "path";

const KML_URL =
  "https://data.opencity.in/dataset/0e089da2-53bc-4751-a919-7d6f95f72784/resource/0d3882a6-4d4e-4d67-87fc-d23729b1f6eb/download/b4219512-7105-4227-9c95-9bdf64020799.kml";

interface CensusFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, string | number>;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function main() {
  console.log("Fetching Jal Dharohar census KML from OpenCity...");
  const res = await fetch(KML_URL, {
    headers: {
      "User-Agent": "neer-vazhvu/delhi-onboarding (https://neervazhvu.org; civic water dashboard)",
    },
  });
  if (!res.ok) throw new Error(`OpenCity returned ${res.status}`);
  const kml = await res.text();
  console.log(`Fetched ${kml.length.toLocaleString()} bytes`);

  const placemarks = kml.match(/<Placemark>[\s\S]*?<\/Placemark>/g) ?? [];
  console.log(`Found ${placemarks.length} placemarks`);

  const features: CensusFeature[] = [];
  let skippedNoCoords = 0;

  for (const pm of placemarks) {
    const props: Record<string, string | number> = {};
    const dataRe = /<SimpleData name="([^"]+)">([\s\S]*?)<\/SimpleData>/g;
    let m: RegExpExecArray | null;
    while ((m = dataRe.exec(pm)) !== null) {
      props[m[1]] = decodeXmlEntities(m[2].trim());
    }

    // Prefer the KML <coordinates>; fall back to the attribute lat/lon.
    const coordMatch = pm.match(/<coordinates>\s*([-\d.]+),([-\d.]+)/);
    const lon = coordMatch ? Number(coordMatch[1]) : Number(props["longitude"]);
    const lat = coordMatch ? Number(coordMatch[2]) : Number(props["latitude"]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon === 0 || lat === 0) {
      skippedNoCoords++;
      continue;
    }

    // Epoch-ms enumeration_date -> ISO date for readability.
    const epoch = Number(props["enumeration_date"]);
    if (Number.isFinite(epoch) && epoch > 0) {
      props["enumeration_date"] = new Date(epoch).toISOString().slice(0, 10);
    }

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: props,
    });
  }

  console.log(`Converted ${features.length} point features (skipped ${skippedNoCoords} without coordinates)`);

  const byDistrict = new Map<string, number>();
  for (const f of features) {
    const d = String(f.properties["district"] ?? "?");
    byDistrict.set(d, (byDistrict.get(d) ?? 0) + 1);
  }
  console.log("Per district:", Object.fromEntries([...byDistrict.entries()].sort()));

  const geojson = {
    type: "FeatureCollection",
    // Provenance carried in-file so downstream consumers can't lose it.
    metadata: {
      source: "1st Census of Water Bodies / Jal Dharohar, NCT Delhi (enumeration 2022, map released 2023)",
      publisher: "GNCTD / Ministry of Jal Shakti",
      digitization: "OpenCity Urban Data Portal (data.opencity.in), dataset delhi-water-bodies-census-data",
      source_url: "https://data.opencity.in/dataset/delhi-water-bodies-census-data",
      retrieved: new Date().toISOString().slice(0, 10),
    },
    features,
  };

  const outPath = join(process.cwd(), "public/geojson/delhi-water-bodies-census.geojson");
  writeFileSync(outPath, JSON.stringify(geojson, null, 2));
  console.log(`\nSaved ${features.length} features to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
