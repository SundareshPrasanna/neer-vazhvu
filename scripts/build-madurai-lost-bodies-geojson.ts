/**
 * Build public/geojson/madurai-water-bodies-lost.geojson from the
 * narrative file public/data/water-bodies-lost-madurai.json so the
 * shared UnifiedMap can render lost-tank markers on /madurai/water-bodies
 * the same way Chennai's /water-bodies renders chennai-water-bodies-lost.
 *
 * Each lost tank gets a Point feature at a hand-curated centroid (most
 * are documented neighborhoods or temples in Madurai city - centroids
 * accurate to ~100 m via OSM lookup). Tanks we couldn't place yet are
 * skipped and logged so the reader knows what's still missing.
 *
 * Run: npx tsx scripts/build-madurai-lost-bodies-geojson.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const root = process.cwd();

interface NarrativeBody {
  name: string;
  status: "Fully lost" | "Severely reduced" | "Partially encroached";
  side?: string;
  note?: string;
}

interface NarrativeFile {
  lost_bodies: NarrativeBody[];
}

/**
 * Centroid lookup per lost tank. Sourced in this order of confidence:
 *
 *   (a) OSM polygon centroid - tank still has a mapped polygon under
 *       the same name in madurai-water-bodies-current.geojson.
 *       Most accurate.
 *   (b) OSM Nominatim search bounded to the Madurai-district bbox -
 *       tank name resolves to a present-day locality of the same
 *       name. ~50 to 200 m accuracy.
 *   (c) Hand-estimated from public maps and the Vencatesan paper's
 *       side hint (north / central / south of Vaigai). ~200 to 500 m
 *       accuracy. Used when (a) and (b) both miss.
 *
 * Re-derive any time by running scripts/_geocode-lost-tanks.ts.
 */
const CENTROIDS: Record<string, [number, number]> = {
  // ── OSM polygon centroids (confidence A) ──────────────────────────
  "tallakulam tank":            [9.9333, 78.1390], // OSM "Tallakulam" (1.4 ha)
  "vandiyur tank":              [9.9331, 78.1570], // OSM "Vandiyur Lake" (227.9 ha)
  "madakulam tank":             [9.9179, 78.0744], // OSM "Madakulam Kanmai" (123.7 ha)
  "sellur tank":                [9.9423, 78.1178], // OSM "Sellur Kanmai" (37.5 ha)
  "thenkal kanmoi":             [9.8903, 78.0705], // OSM "Thenkal Kanmai" (157.1 ha)

  // ── Nominatim (Madurai-bbox) centroids (confidence B) ─────────────
  "thathaneri tank":            [9.9396, 78.1064], // Thathaneri / Arappalayam
  "managiri tank":              [9.9289, 78.1459], // Managiri / KK Nagar
  "athikulam tank":             [9.9559, 78.1368], // Athikulam, Madurai North
  "sathamangalam tank":         [9.9231, 78.1431], // Sathamangalam PHC
  "villapuram tank":            [9.8974, 78.1208], // Villapuram, Madurai South
  "s. kodikulam tank":          [9.9576, 78.1563], // Kodikulam, north-east
  "kosakulam tank":             [9.9626, 78.1188], // Kosakulam, Anaiyur
  "avaniyapuram tank":          [9.9290, 78.0979], // Avaniyapuram Canal
  "chinthamani tank":           [9.8947, 78.1394], // Chinthamani

  // ── Hand-estimated from Vencatesan side hint + map (confidence C) ─
  // Bibikulam, Chinna Chokkikulam, Sengulam, Pudhukulam, Mudakkaththan,
  // Tirayathi - all "north" of Vaigai per Vencatesan; localities are
  // close to north-Madurai's old tank network.
  "bibikulam tank":             [9.9286, 78.1153], // Bibikulam neighborhood, SW of Sellur Kanmai
  "chinna chokkikulam tank":    [9.9425, 78.1192],
  "sengulam tank":              [9.9460, 78.1075], // Nominatim returned a Theni hit, ignored
  "pudhukulam tank":            [9.9516, 78.1250],
  "mudakkaththan tank":         [9.9420, 78.1395],
  "tirayathi tank":             [9.9582, 78.1115],
  // Anuppanady cluster (south of Vaigai)
  "anuppanady big tank":        [9.8950, 78.1550],
  "anuppanady small tank":      [9.8980, 78.1520],
  // Veeramudiyan (south, off Vaigai)
  "veeramudiyan tank":          [9.8995, 78.1605],
  // Puliyankulam tank in north Madurai (Nominatim returned a Virudhunagar
  // hit 60 km away, ignored)
  "puliyankulam tank":          [9.9550, 78.1050],
  // Thenkaal tank, central
  "thenkaal tank":              [9.9050, 78.1380],
  // Koodal Azhagar Temple sits between West & South Masi Streets near
  // Periyar Bus Stand
  "koodal alagar temple tank":  [9.9189, 78.1208],
};

/** Match the LostWaterBodyProperties shape Chennai's UnifiedMap consumes. */
type WaterBodyStatus = "fully_lost" | "severely_reduced" | "partially_encroached";

interface Feature {
  type: "Feature";
  properties: {
    name: string;
    name_ta: string;
    type: string;
    status: WaterBodyStatus;
    historical_area_ha: number;
    current_area_ha?: number;
    replaced_by: string;
    approx_radius_m: number;
    source: string;
    notes: string;
    notes_ta?: string;
    /** Madurai-specific: which side of the Vaigai (north / central / south). */
    side?: string;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
}

function statusToProp(s: string): WaterBodyStatus {
  if (s.toLowerCase().startsWith("fully")) return "fully_lost";
  if (s.toLowerCase().startsWith("severely")) return "severely_reduced";
  return "partially_encroached";
}

/** Best-effort historical area in hectares. Where the narrative note
 *  cites "X acres", we convert (1 acre = 0.4047 ha). Otherwise null. */
function parseHistoricalAreaHa(note: string | undefined): number {
  if (!note) return 0;
  const m = note.match(/(\d+(?:\.\d+)?)\s*acres?/i);
  if (m) return Math.round(Number(m[1]) * 0.4047 * 10) / 10;
  return 0;
}

function main() {
  const narrative = JSON.parse(
    readFileSync(resolve(root, "public/data/water-bodies-lost-madurai.json"), "utf-8"),
  ) as NarrativeFile;

  const features: Feature[] = [];
  const skipped: string[] = [];

  for (const b of narrative.lost_bodies) {
    const key = b.name.toLowerCase().trim();
    const centroid = CENTROIDS[key];
    if (!centroid) {
      skipped.push(b.name);
      continue;
    }
    const historicalAreaHa = parseHistoricalAreaHa(b.note);
    features.push({
      type: "Feature",
      properties: {
        name: b.name,
        name_ta: "",
        type: "tank",
        status: statusToProp(b.status),
        historical_area_ha: historicalAreaHa,
        replaced_by: b.note ?? "",
        approx_radius_m: 200,
        source: "Vencatesan (2014) urban tanks audit + DHAN field studies",
        notes: b.note ?? "",
        side: b.side,
      },
      geometry: {
        type: "Point",
        coordinates: [centroid[1], centroid[0]], // [lng, lat]
      },
    });
  }

  const out = {
    type: "FeatureCollection" as const,
    features,
  };
  const outPath = resolve(root, "public/geojson/madurai-water-bodies-lost.geojson");
  writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log(`Wrote ${features.length} features to ${outPath}`);
  if (skipped.length > 0) {
    console.log(`Skipped (no curated centroid): ${skipped.join(", ")}`);
  }
  const counts = features.reduce(
    (acc, f) => {
      acc[f.properties.status]++;
      return acc;
    },
    { fully_lost: 0, severely_reduced: 0, partially_encroached: 0 } as Record<string, number>,
  );
  console.log(`  fully_lost: ${counts.fully_lost}`);
  console.log(`  severely_reduced: ${counts.severely_reduced}`);
  console.log(`  partially_encroached: ${counts.partially_encroached}`);
}

main();
