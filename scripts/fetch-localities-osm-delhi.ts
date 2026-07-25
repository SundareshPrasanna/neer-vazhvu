/**
 * Fetch Delhi neighborhoods/suburbs/quarters from OpenStreetMap via the
 * Overpass API. Maps each locality to its MCD ward (2022 delimitation) via point-in-polygon
 * and to its zone via madurai-ward-profiles. Output saved to
 * public/data/delhi-localities.json.
 *
 * Mirrors scripts/fetch-localities-osm.ts (Chennai) so the search
 * experience reaches feature-parity: Madurai users searching for
 * "Malviya Nagar", "Sangam Vihar", "Burari" etc. should resolve to the
 * containing ward instead of falling through to ward-number-only match.
 *
 * Run: npx tsx scripts/fetch-localities-osm-delhi.ts
 */

import { writeFileSync, readFileSync } from "fs";
import { join } from "path";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";

// NCT bbox (south,west,north,east) - the ward PIP filter drops localities
// outside MCD wards (NDMC/Cantonment localities fall through by design).
const BBOX = "28.40,76.85,28.90,77.40";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";

// Wikidata SPARQL: localities (village / suburb / neighbourhood / ward
// of a town / human settlement / etc.) under the city or district. We
// over-select on `?type` so that anything settlement-shaped is fetched;
// the PIP filter against MMC ward polygons drops items outside the
// corporation. P131 (located in administrative territorial entity) +
// transitive `+` walks up containment chains.
const WIKIDATA_QUERY = `
SELECT DISTINCT ?item ?itemLabel ?taLabel ?coord WHERE {
  ?item wdt:P131+ ?parent.
  VALUES ?parent { wd:Q1353 wd:Q42941 }
  ?item wdt:P31/wdt:P279* ?type.
  VALUES ?type {
    wd:Q5283  wd:Q123705 wd:Q3957  wd:Q486972
    wd:Q15640612 wd:Q702492 wd:Q1968296
    wd:Q532   wd:Q15259  wd:Q15078955
  }
  ?item wdt:P625 ?coord.
  OPTIONAL { ?item rdfs:label ?taLabel FILTER(LANG(?taLabel) = "hi"). }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 1000
`.trim();

const COMMON_HEADERS = {
  "User-Agent": "neer-vazhvu/1.0 (research; sundareshchandran@gmail.com)",
};

// Delhi note: urban villages (Lal Dora) and JJ-adjacent settlements are
// commonly still tagged `place=village`; the wide taxonomy keeps them. Mapping back
// to a single `type` field below collapses all of these to the existing
// suburb/neighbourhood/quarter union the consumer expects.
const QUERY = `
[out:json][timeout:90];
(
  node["place"~"^(suburb|neighbourhood|quarter|village|hamlet)$"](${BBOX});
  way["place"~"^(suburb|neighbourhood|quarter|village|hamlet)$"](${BBOX});
  relation["place"~"^(suburb|neighbourhood|quarter|village|hamlet)$"](${BBOX});
);
out center tags;
`.trim();

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OsmResponse {
  elements: OsmElement[];
}

interface WardProfile {
  ward_number: number;
  zone_no: string;
  zone_name: string;
}

interface WardFeature {
  type: "Feature";
  properties: {
    ward_no?: number;
    Ward_No?: number;
    ward_number?: number;
    [key: string]: unknown;
  };
  geometry: { type: string; coordinates: unknown };
}

export interface LocalityEntry {
  name: string;
  name_ta?: string;
  type: "suburb" | "neighbourhood" | "quarter";
  lat: number;
  lng: number;
  ward_number: number;
  zone_name: string;
  zone_no: string;
}

interface WikidataBinding {
  item: { value: string };
  itemLabel?: { value: string };
  taLabel?: { value: string };
  coord?: { value: string }; // "Point(lng lat)"
}

interface WikidataResponse {
  results: { bindings: WikidataBinding[] };
}

async function fetchOverpass(): Promise<OsmElement[]> {
  console.log("Fetching Delhi localities from OpenStreetMap (Overpass)...");
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    body: new URLSearchParams({ data: QUERY }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      ...COMMON_HEADERS,
    },
  });
  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
  const data: OsmResponse = await res.json();
  console.log(`  OSM raw elements: ${data.elements.length}`);
  return data.elements;
}

async function fetchWikidata(): Promise<WikidataBinding[]> {
  console.log("Fetching Delhi localities from Wikidata (SPARQL)...");
  const url = `${WIKIDATA_SPARQL_URL}?format=json&query=${encodeURIComponent(WIKIDATA_QUERY)}`;

  // The Wikidata SPARQL endpoint occasionally returns 504/429 under
  // load. Retry up to 3 times with exponential backoff.
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "Accept": "application/sparql-results+json", ...COMMON_HEADERS },
      });
      if (!res.ok) throw new Error(`Wikidata SPARQL error: ${res.status}`);
      const data = (await res.json()) as WikidataResponse;
      console.log(`  Wikidata bindings: ${data.results.bindings.length}`);
      return data.results.bindings;
    } catch (err) {
      lastErr = err;
      if (attempt < 3) {
        const delayMs = 2000 * attempt;
        console.warn(`  attempt ${attempt} failed (${err}); retrying in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function parseWktPoint(wkt: string): { lat: number; lng: number } | null {
  // "Point(lng lat)"
  const m = wkt.match(/Point\(([\d.\-]+)\s+([\d.\-]+)\)/);
  if (!m) return null;
  return { lng: parseFloat(m[1]), lat: parseFloat(m[2]) };
}

async function fetchLocalities(): Promise<void> {
  const [osmElements, wikidataBindings] = await Promise.all([
    fetchOverpass(),
    fetchWikidata().catch((err) => {
      console.warn(`  Wikidata fetch failed (continuing with OSM only): ${err}`);
      return [] as WikidataBinding[];
    }),
  ]);

  const wardGeoPath = join(process.cwd(), "public/geojson/delhi-wards-2022.geojson");
  const wardGeo = JSON.parse(readFileSync(wardGeoPath, "utf-8"));

  const profilesPath = join(process.cwd(), "public/data/delhi-ward-profiles.json");
  const profiles: WardProfile[] = JSON.parse(readFileSync(profilesPath, "utf-8"));
  const profileMap = new Map<number, WardProfile>(profiles.map((p) => [p.ward_number, p]));

  function getCoords(el: OsmElement): { lat: number; lng: number } | null {
    if (el.type === "node" && el.lat != null && el.lon != null) {
      return { lat: el.lat, lng: el.lon };
    }
    if ((el.type === "way" || el.type === "relation") && el.center) {
      return { lat: el.center.lat, lng: el.center.lon };
    }
    return null;
  }

  function findWard(lat: number, lng: number): number | null {
    const pt = point([lng, lat]);
    for (const feature of wardGeo.features as WardFeature[]) {
      try {
        if (booleanPointInPolygon(pt, feature as Parameters<typeof booleanPointInPolygon>[1])) {
          const wardNo =
            feature.properties?.ward_no ??
            feature.properties?.Ward_No ??
            feature.properties?.ward_number;
          return typeof wardNo === "number" ? wardNo : null;
        }
      } catch {
        // skip malformed features
      }
    }
    return null;
  }

  const seen = new Set<string>();
  const localities: LocalityEntry[] = [];
  const stats: Record<string, Record<string, number>> = {
    osm: { kept: 0, noName: 0, noCoord: 0, outsideMcd: 0, dupe: 0 },
    wikidata: { kept: 0, noName: 0, noCoord: 0, outsideMcd: 0, dupe: 0 },
  };

  /** Common per-record handler. Returns true when the record was kept. */
  function consider(args: {
    source: "osm" | "wikidata";
    name: string;
    nameTa?: string;
    coords: { lat: number; lng: number } | null;
    rawType?: string;
  }): boolean {
    const s = stats[args.source];
    if (!args.name) { s.noName++; return false; }
    const key = args.name.toLowerCase().trim();
    if (seen.has(key)) { s.dupe++; return false; }
    if (!args.coords) { s.noCoord++; return false; }

    const wardNum = findWard(args.coords.lat, args.coords.lng);
    if (!wardNum) { s.outsideMcd++; return false; }
    const profile = profileMap.get(wardNum);
    if (!profile) { s.outsideMcd++; return false; }

    const rawType = args.rawType;
    const localityType: LocalityEntry["type"] =
      rawType === "neighbourhood" ? "neighbourhood"
        : rawType === "quarter" ? "quarter"
        : "suburb";

    seen.add(key);
    localities.push({
      name: args.name.trim(),
      name_ta: args.nameTa,
      type: localityType,
      lat: args.coords.lat,
      lng: args.coords.lng,
      ward_number: wardNum,
      zone_name: profile.zone_name,
      zone_no: profile.zone_no,
    });
    s.kept++;
    return true;
  }

  // 1. Apply OSM elements first - they have richer place taxonomy and
  //    consistent name:ta coverage.
  for (const el of osmElements) {
    const tags = el.tags || {};
    const name = tags["name:en"] || tags["name"] || "";
    consider({
      source: "osm",
      name,
      nameTa: tags["name:hi"] || undefined,
      coords: getCoords(el),
      rawType: tags["place"],
    });
  }

  // 2. Wikidata fills the long tail. We only keep entries with explicit
  //    P625 coordinates; many district-level Wikidata items have no
  //    coords or coords far outside MMC, both of which are dropped by
  //    the consider() filter.
  for (const b of wikidataBindings) {
    consider({
      source: "wikidata",
      name: b.itemLabel?.value ?? "",
      nameTa: b.taLabel?.value || undefined,
      coords: b.coord ? parseWktPoint(b.coord.value) : null,
    });
  }

  localities.sort((a, b) => a.name.localeCompare(b.name));

  const outPath = join(process.cwd(), "public/data/delhi-localities.json");
  writeFileSync(outPath, JSON.stringify(localities, null, 2));
  console.log(`\nWrote ${localities.length} localities to public/data/delhi-localities.json`);
  for (const [src, s] of Object.entries(stats)) {
    console.log(`  ${src}: kept=${s.kept}, dupe=${s.dupe}, noName=${s.noName}, noCoord=${s.noCoord}, outsideMCD=${s.outsideMcd}`);
  }

  // Type breakdown
  const byType: Record<string, number> = {};
  for (const l of localities) byType[l.type] = (byType[l.type] || 0) + 1;
  console.log("By type:", byType);

  // Zone coverage - useful to spot zones with zero localities (search blind spots)
  const byZone = new Map<string, number>();
  for (const l of localities) {
    byZone.set(l.zone_name || "(no zone)", (byZone.get(l.zone_name || "(no zone)") || 0) + 1);
  }
  console.log("\nLocalities per zone:");
  for (const [zone, count] of [...byZone.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${zone}: ${count}`);
  }

  // Tamil-name coverage
  const withTa = localities.filter((l) => l.name_ta).length;
  console.log(`\nTamil-name coverage: ${withTa}/${localities.length}`);

  // Ward coverage - show wards with zero localities (still searchable by
  // number/zone but won't match a locality query)
  const wardsCovered = new Set(localities.map((l) => l.ward_number));
  const allWards = new Set(profiles.map((p) => p.ward_number));
  const uncovered = [...allWards].filter((w) => !wardsCovered.has(w)).sort((a, b) => a - b);
  console.log(`\nWards with at least one locality: ${wardsCovered.size}/${allWards.size}`);
  if (uncovered.length > 0) {
    console.log(`Wards without any locality: ${uncovered.join(", ")}`);
  }
}

fetchLocalities().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
