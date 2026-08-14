/**
 * Simplify flood hazard and return-period GeoJSON files for web delivery.
 *
 * - Simplifies chennai-flood-hazard-zones.geojson (tolerance 0.0005, ~50m)
 * - Merges and simplifies all return-period files into a single
 *   chennai-flood-return-periods.geojson (tolerance 0.001, ~100m)
 *
 * Run: npx tsx scripts/simplify-flood-geojson.ts
 */

import { readFileSync, statSync } from "fs";
import { writeArtifact } from "./lib/nvdm-write";
import { resolve } from "path";
import simplify from "@turf/simplify";
import type {
  FeatureCollection,
  Feature,
  Polygon,
  MultiPolygon,
  GeometryCollection,
  Geometry,
} from "geojson";

const GEOJSON_DIR = resolve(
  new URL(".", import.meta.url).pathname,
  "..",
  "public",
  "geojson"
);

// -- Helpers ------------------------------------------------------------------

function fileSizeMB(path: string): string {
  const bytes = statSync(path).size;
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

/**
 * Flatten GeometryCollection features into individual Polygon/MultiPolygon
 * features so @turf/simplify can process them (it does not support
 * GeometryCollection).
 */
function flattenFeature(
  feature: Feature
): Feature<Polygon | MultiPolygon>[] {
  const geom = feature.geometry;
  if (geom.type === "Polygon" || geom.type === "MultiPolygon") {
    return [feature as Feature<Polygon | MultiPolygon>];
  }
  if (geom.type === "GeometryCollection") {
    const gc = geom as GeometryCollection;
    const results: Feature<Polygon | MultiPolygon>[] = [];
    for (const g of gc.geometries) {
      if (g.type === "Polygon" || g.type === "MultiPolygon") {
        results.push({
          type: "Feature",
          properties: { ...feature.properties },
          geometry: g as Polygon | MultiPolygon,
        });
      }
    }
    return results;
  }
  return [];
}

/** Strip Z coordinate (3D -> 2D) from coordinate arrays in-place. */
function stripZ(coords: number[] | number[][] | number[][][] | number[][][][]): void {
  if (typeof coords[0] === "number") {
    // Single position - truncate to [lng, lat]
    (coords as number[]).length = Math.min((coords as number[]).length, 2);
    return;
  }
  for (const c of coords as (number[] | number[][] | number[][][] )[]) {
    stripZ(c);
  }
}

function simplifyFeatures(
  features: Feature[],
  tolerance: number,
  props: (f: Feature) => Record<string, unknown>
): Feature[] {
  const output: Feature[] = [];

  for (const f of features) {
    const flat = flattenFeature(f);
    for (const piece of flat) {
      // Strip Z coordinates before simplifying
      stripZ(piece.geometry.coordinates as number[][][][]);

      try {
        const simplified = simplify(piece, {
          tolerance,
          highQuality: true,
        });

        // Skip degenerate polygons (less than 4 coordinates in outer ring)
        const coords =
          simplified.geometry.type === "Polygon"
            ? simplified.geometry.coordinates
            : simplified.geometry.coordinates[0];
        if (coords[0].length < 4) continue;

        output.push({
          type: "Feature",
          properties: props(f),
          geometry: simplified.geometry,
        });
      } catch {
        // Skip features that fail simplification (degenerate geometry)
      }
    }
  }

  return output;
}

function normalizeHazardCategory(cat: string): string {
  const normalized: Record<string, string> = {
    "Very High": "very_high",
    "High": "high",
    "Moderate": "moderate",
    "Low": "low",
    "Very Low": "very_low",
    "VERY HIGH": "very_high",
    "HIGH": "high",
    "MODERATE": "moderate",
    "LOW": "low",
    "VERY LOW": "very_low",
  };
  return normalized[cat] || cat.toLowerCase().replace(/\s+/g, "_");
}

function normalizeRiskLevel(cat: string): string {
  const normalized: Record<string, string> = {
    HIGH: "high",
    MODERATE: "moderate",
    LOW: "low",
  };
  return normalized[cat] || cat.toLowerCase();
}

// -- Main ---------------------------------------------------------------------

function main() {
  console.log("=== Simplify flood hazard zones ===\n");

  // 1. Hazard zones
  const hazardPath = resolve(GEOJSON_DIR, "chennai-flood-hazard-zones.geojson");
  const beforeSize = fileSizeMB(hazardPath);

  const hazardData: FeatureCollection = JSON.parse(
    readFileSync(hazardPath, "utf8")
  );
  console.log(`Hazard zones: ${hazardData.features.length} features, ${beforeSize}`);

  const simplifiedHazard = simplifyFeatures(
    hazardData.features,
    0.0005,
    (f) => ({
      category: normalizeHazardCategory(f.properties?.CATEGORY || ""),
      area: f.properties?.["SHAPE.AREA"] ?? null,
    })
  );

  const hazardOut: FeatureCollection = {
    type: "FeatureCollection",
    features: simplifiedHazard,
  };
  writeArtifact(hazardPath, hazardOut, { compact: true });
  const afterSize = fileSizeMB(hazardPath);
  console.log(
    `  -> ${simplifiedHazard.length} features, ${beforeSize} -> ${afterSize}\n`
  );

  // 2. Return period maps -> single merged file
  console.log("=== Simplify and merge return-period maps ===\n");

  const returnPeriods = [
    { file: "chennai-flood-return-5yr.geojson", period: 5 },
    { file: "chennai-flood-return-10yr.geojson", period: 10 },
    { file: "chennai-flood-return-25yr.geojson", period: 25 },
    { file: "chennai-flood-return-50yr.geojson", period: 50 },
    { file: "chennai-flood-return-100yr.geojson", period: 100 },
    { file: "chennai-flood-return-200yr.geojson", period: 200 },
  ];

  const mergedFeatures: Feature[] = [];

  for (const rp of returnPeriods) {
    const rpPath = resolve(GEOJSON_DIR, rp.file);
    const rpSize = fileSizeMB(rpPath);
    const rpData: FeatureCollection = JSON.parse(
      readFileSync(rpPath, "utf8")
    );

    const simplified = simplifyFeatures(rpData.features, 0.001, (f) => ({
      return_period: rp.period,
      risk_level: normalizeRiskLevel(f.properties?.CATEGORY || ""),
    }));

    console.log(
      `  ${rp.file}: ${rpData.features.length} -> ${simplified.length} features (was ${rpSize})`
    );

    mergedFeatures.push(...simplified);
  }

  const mergedPath = resolve(GEOJSON_DIR, "chennai-flood-return-periods.geojson");
  const mergedOut: FeatureCollection = {
    type: "FeatureCollection",
    features: mergedFeatures,
  };
  writeArtifact(mergedPath, mergedOut, { compact: true });
  const mergedSize = fileSizeMB(mergedPath);
  console.log(
    `\n  -> Merged: ${mergedFeatures.length} features, ${mergedSize}\n`
  );

  console.log("=== Summary ===");
  console.log(`  Hazard zones:     ${beforeSize} -> ${afterSize}`);
  console.log(`  Return periods:   ${mergedSize} (merged)`);
  console.log("  Done.");
}

main();
