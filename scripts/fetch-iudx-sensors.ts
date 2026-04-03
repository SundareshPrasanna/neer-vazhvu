/**
 * Fetch all 241 IUDX water level sensor metadata from the catalogue API.
 * Outputs public/data/iudx-sensors.json with sensor IDs, names, and locations.
 *
 * Usage: npx tsx scripts/fetch-iudx-sensors.ts
 *
 * The catalogue API is public (no auth needed) - only the resource server
 * (live readings) requires credentials.
 */

const CATALOGUE_URL = "https://api.catalogue.iudx.org.in/iudx/cat/v1";
const RESOURCE_GROUP_ID = "257aab1b-1258-445a-a37e-058486a2fa13";

interface CatResult {
  id: string;
  label: string;
  description?: string;
  tags?: string[];
  location?: {
    geometry?: {
      type: string;
      coordinates: number[];
    };
    address?: string;
  };
}

interface Sensor {
  id: string;
  label: string;
  lat: number | null;
  lng: number | null;
  category: "canal" | "lake" | "subway" | "river" | "other";
}

function categorize(label: string): Sensor["category"] {
  const l = label.toLowerCase();
  if (l.includes("canal") || l.includes("odai") || l.includes("nullah")) return "canal";
  if (l.includes("lake") || l.includes("eri")) return "lake";
  if (l.includes("subway") || l.includes("underpass")) return "subway";
  if (
    l.includes("adyar") ||
    l.includes("cooum") ||
    l.includes("kosasthala") ||
    l.includes("buckingham")
  )
    return "river";
  return "other";
}

async function main() {
  console.log("Fetching sensor list from IUDX catalogue...");

  // Get all child resources of the resource group
  const url = `${CATALOGUE_URL}/relationship?id=${RESOURCE_GROUP_ID}&rel=resource`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    // Fallback: search by tags
    console.log("Relationship endpoint failed, trying search...");
    const searchUrl = `${CATALOGUE_URL}/search?property=[tags]&value=[[water,flood]]&filter=[id,label,location]`;
    const searchRes = await fetch(searchUrl, { redirect: "follow" });
    const searchData = await searchRes.json();
    processResults(searchData.results ?? []);
    return;
  }

  const data = await res.json();
  processResults(data.results ?? []);
}

function processResults(results: CatResult[]) {
  // Filter out the resource group itself (keep only individual sensors)
  const sensors: Sensor[] = results
    .filter((r) => r.id !== RESOURCE_GROUP_ID)
    .map((r) => {
      const coords = r.location?.geometry?.coordinates;
      return {
        id: r.id,
        label: r.label,
        lat: coords ? coords[1] : null,
        lng: coords ? coords[0] : null,
        category: categorize(r.label),
      };
    });

  // Summary
  const cats = sensors.reduce(
    (acc, s) => {
      acc[s.category] = (acc[s.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log(`Found ${sensors.length} sensors:`);
  Object.entries(cats).forEach(([cat, count]) => console.log(`  ${cat}: ${count}`));

  const withCoords = sensors.filter((s) => s.lat !== null);
  console.log(`${withCoords.length} have coordinates, ${sensors.length - withCoords.length} missing`);

  // Write output
  const fs = require("fs");
  const path = require("path");
  const outPath = path.resolve(__dirname, "../public/data/iudx-sensors.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        source: "IUDX Catalogue API",
        resource_group_id: RESOURCE_GROUP_ID,
        fetched_at: new Date().toISOString(),
        total_sensors: sensors.length,
        sensors,
      },
      null,
      2
    )
  );
  console.log(`Written to ${outPath}`);
}

main().catch(console.error);
