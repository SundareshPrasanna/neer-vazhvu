/**
 * Server-side readers for the served Atlas artifacts.
 *
 * Reads public/data/atlas/<state>/<district>/ from disk at build time (the
 * CORPUS_SOURCE=repo tree locally, the corpus-swapped tree in the frontend
 * job), the way the cascade and ward-profile loaders do. Never imported by
 * client components: the registry is the only atlas module they may touch.
 *
 * The base directory is a module-level constant built from literal segments,
 * exactly like src/lib/cascade-stats-loader.ts, and every path handed to fs
 * is joined onto it here. Turbopack's file tracer can scope an fs read to a
 * subfolder only when the base is static: an environment override, a
 * NODE_ENV branch, a reassignable binding and an ignore comment each made it
 * trace the whole project into every route that reaches this module. The
 * unit tests therefore never repoint these readers; they read the fixture
 * corpus themselves (src/lib/atlas/test-support.ts) and feed the pure
 * builders these readers feed.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  ATLAS_DATA_ROOT,
  districtArtifactPath,
  type AtlasFamily,
  type AssessmentsShard,
  type BriefsShard,
  type CensusShard,
  type DistrictDirectoryArtifact,
  type DistrictRef,
  type GroundwaterProjectionArtifact,
  type GroundwaterTaluksArtifact,
  type JjmServiceShard,
  type RainfallArtifact,
  type WaterBodiesShard,
} from "./artifacts";
import type { PlaceBrief } from "./place-brief";

const DATA_DIR = join(process.cwd(), "public", "data", "atlas");

const cache = new Map<string, unknown>();

function fileFor(district: DistrictRef, family: AtlasFamily, shard?: string): string {
  const rel = districtArtifactPath(district, family, shard).slice(ATLAS_DATA_ROOT.length + 1);
  return join(DATA_DIR, rel);
}

/** Drop everything read so far. */
export function clearAtlasDataCache(): void {
  cache.clear();
}

export function hasDistrictData(district: DistrictRef): boolean {
  return existsSync(fileFor(district, "directory"));
}

export function readDistrictArtifact<T>(
  district: DistrictRef,
  family: AtlasFamily,
  shard?: string,
): T | undefined {
  const path = fileFor(district, family, shard);
  if (cache.has(path)) return cache.get(path) as T;
  if (!existsSync(path)) return undefined;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as T;
  cache.set(path, parsed);
  return parsed;
}

export function listShards(district: DistrictRef, family: AtlasFamily): string[] {
  const dir = join(DATA_DIR, district.stateSlug, district.slug, family);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /\.(geo)?json$/.test(name))
    .map((name) => name.replace(/\.(geo)?json$/, ""))
    .sort();
}

export function readShards<T>(district: DistrictRef, family: AtlasFamily): T[] {
  const shards: T[] = [];
  for (const code of listShards(district, family)) {
    const shard = readDistrictArtifact<T>(district, family, code);
    if (shard) shards.push(shard);
  }
  return shards;
}

export function loadDirectory(district: DistrictRef): DistrictDirectoryArtifact | undefined {
  return readDistrictArtifact<DistrictDirectoryArtifact>(district, "directory");
}

export function loadGroundwaterTaluks(
  district: DistrictRef,
): GroundwaterTaluksArtifact | undefined {
  return readDistrictArtifact<GroundwaterTaluksArtifact>(district, "groundwater-taluks");
}

export function loadGroundwaterProjection(
  district: DistrictRef,
): GroundwaterProjectionArtifact | undefined {
  return readDistrictArtifact<GroundwaterProjectionArtifact>(
    district,
    "groundwater-projection",
  );
}

export function loadRainfall(district: DistrictRef): RainfallArtifact | undefined {
  return readDistrictArtifact<RainfallArtifact>(district, "rainfall");
}

export function loadJjmServiceShards(district: DistrictRef): JjmServiceShard[] {
  return readShards<JjmServiceShard>(district, "jjm-service");
}

export function loadCensusShards(district: DistrictRef): CensusShard[] {
  return readShards<CensusShard>(district, "census-2011");
}

export function loadWaterBodyShards(district: DistrictRef): WaterBodiesShard[] {
  return readShards<WaterBodiesShard>(district, "water-bodies");
}

export function loadAssessmentShards(district: DistrictRef): AssessmentsShard[] {
  return readShards<AssessmentsShard>(district, "assessments");
}

export function loadBriefShards(district: DistrictRef): BriefsShard[] {
  return readShards<BriefsShard>(district, "briefs");
}

/** Every generated brief in the district, across its block shards. */
export function loadBriefs(district: DistrictRef): PlaceBrief[] {
  return loadBriefShards(district).flatMap((shard) => shard.briefs);
}
