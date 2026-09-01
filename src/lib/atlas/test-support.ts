/**
 * Shared setup for the Atlas unit tests.
 *
 * The served-artifact readers in data.ts are pinned to public/data/atlas so
 * the build tracer can scope them, and the tests never repoint them. This
 * module reads the one-block fixture corpus under fixtures/atlas/ itself and
 * feeds the pure builders (buildDistrictDirectory, buildDistrictAggregate,
 * buildDistrictReading, assembleDistrictCorpus) exactly as the fs wrappers
 * do. It also loads the mini acquisition inputs (plan, extract, boundary,
 * reviewed inputs) the corpus was cut from. The fixture is derived by
 * slicing the served July corpus by one block per district; it is
 * regenerated, never hand-edited.
 *
 * Imported by tests only, never by production code.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import type { TnDistrictRefreshPlan, TnDistrictSourceExtract } from "./acquisition-model";
import {
  loadTnDistrictRefreshPlan,
  loadTnDistrictSourceExtract,
} from "./acquisition-validation";
import {
  identityFromExtract,
  type AssessmentsShard,
  type AtlasFamily,
  type BriefsShard,
  type CensusShard,
  type DistrictDirectoryArtifact,
  type DistrictIdentity,
  type GroundwaterProjectionArtifact,
  type GroundwaterTaluksArtifact,
  type JjmServiceShard,
  type RainfallArtifact,
  type WaterBodiesShard,
} from "./artifacts";
import type { CuratedBriefsArtifact } from "./curated-briefs";
import { buildDistrictAggregate, type DistrictAggregate } from "./district-aggregate";
import type { DistrictArtifacts } from "./district-assessment";
import { buildDistrictDirectory, type DistrictDirectory } from "./district-directory";
import { buildDistrictReading, districtAsOf, type DistrictReading } from "./district-reading";
import type { PlaceBrief } from "./place-brief";
import { ATLAS_DISTRICTS, type AtlasDistrict } from "./registry";
import { loadTnDistrictBoundaryExtract, type TnDistrictBoundaryExtract } from "./tn-boundary";
import {
  buildTnDistrictCrosswalk,
  loadReviewedBlockAlignmentTable,
  type TnDistrictCrosswalkProposal,
} from "./tn-crosswalk";
import {
  loadTnDistrictCrosswalkResolution,
  type TnDistrictCrosswalkResolution,
} from "./tn-crosswalk-resolution";

export const FIXTURE_ROOT = resolve(process.cwd(), "fixtures/atlas");

export interface FixtureDistrict {
  slug: "thanjavur" | "tiruchirappalli";
  block: string;
  blockName: string;
  panchayats: number;
}

/** One block per district: Sethubavachatram (Thanjavur) and Thiruverambur
 *  (Tiruchirappalli), fifteen Gram Panchayats each. */
export const FIXTURE_DISTRICTS: FixtureDistrict[] = [
  { slug: "thanjavur", block: "6633", blockName: "SETHUBAVACHATRAM", panchayats: 15 },
  { slug: "tiruchirappalli", block: "6684", blockName: "THIRUVERAMBUR", panchayats: 15 },
];

export function districtBySlug(slug: string): AtlasDistrict {
  const district = ATLAS_DISTRICTS.find((entry) => entry.slug === slug);
  if (!district) throw new Error(`${slug} is not a registered district`);
  return district;
}

export function fixturePath(slug: string, ...parts: string[]): string {
  return resolve(FIXTURE_ROOT, "tn", slug, ...parts);
}

export function readFixture<T>(slug: string, ...parts: string[]): T {
  return JSON.parse(readFileSync(fixturePath(slug, ...parts), "utf8")) as T;
}

/* ── the served corpus, read from the fixture tree ─────────────────────── */

/** A whole-district artifact, or undefined when the fixture does not carry it. */
export function readFixtureArtifact<T>(slug: string, family: AtlasFamily): T | undefined {
  const path = fixturePath(slug, `${family}.json`);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : undefined;
}

/** Every block shard of a family, in block-code order, as listShards reads them. */
export function readFixtureShards<T>(slug: string, family: AtlasFamily): T[] {
  const dir = fixturePath(slug, family);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /\.(geo)?json$/.test(name))
    .sort()
    .map((name) => JSON.parse(readFileSync(resolve(dir, name), "utf8")) as T);
}

export interface FixtureArtifacts extends DistrictArtifacts {
  curated: CuratedBriefsArtifact | undefined;
}

const artifactsBySlug = new Map<string, FixtureArtifacts>();

/** Every served family of a fixture district, read once per process. */
export function readFixtureArtifacts(slug: string): FixtureArtifacts {
  const cached = artifactsBySlug.get(slug);
  if (cached) return cached;
  const directory = readFixtureArtifact<DistrictDirectoryArtifact>(slug, "directory");
  if (!directory) throw new Error(`fixtures/atlas/tn/${slug} has no directory.json`);
  const artifacts: FixtureArtifacts = {
    directory,
    jjm: readFixtureShards<JjmServiceShard>(slug, "jjm-service"),
    census: readFixtureShards<CensusShard>(slug, "census-2011"),
    groundwater: readFixtureArtifact<GroundwaterTaluksArtifact>(slug, "groundwater-taluks"),
    projection: readFixtureArtifact<GroundwaterProjectionArtifact>(slug, "groundwater-projection"),
    rainfall: readFixtureArtifact<RainfallArtifact>(slug, "rainfall"),
    waterBodies: readFixtureShards<WaterBodiesShard>(slug, "water-bodies"),
    assessments: readFixtureShards<AssessmentsShard>(slug, "assessments"),
    briefs: readFixtureShards<BriefsShard>(slug, "briefs"),
    curated: readFixtureArtifact<CuratedBriefsArtifact>(slug, "curated-briefs"),
  };
  artifactsBySlug.set(slug, artifacts);
  return artifacts;
}

/** Every generated brief in the fixture district, across its block shards. */
export function fixtureBriefs(slug: string): PlaceBrief[] {
  return readFixtureArtifacts(slug).briefs.flatMap((shard) => shard.briefs);
}

/** What getDistrictDirectory builds, from the fixture corpus. */
export function buildFixtureDirectory(slug: string): DistrictDirectory {
  return buildDistrictDirectory(
    districtBySlug(slug),
    readFixtureArtifacts(slug).directory,
    fixtureBriefs(slug),
  );
}

/** Directories for every registered district the fixture corpus carries:
 *  the fixture counterpart of getAllDistrictDirectories. */
export function buildAllFixtureDirectories(): DistrictDirectory[] {
  return ATLAS_DISTRICTS.filter((district) =>
    existsSync(fixturePath(district.slug, "directory.json")),
  ).map((district) => buildFixtureDirectory(district.slug));
}

/** What getDistrictAggregate builds, from the fixture corpus. */
export function buildFixtureAggregate(slug: string, asOf: string): DistrictAggregate {
  const artifacts = readFixtureArtifacts(slug);
  return buildDistrictAggregate({
    district: districtBySlug(slug),
    asOf,
    directory: buildFixtureDirectory(slug),
    briefs: fixtureBriefs(slug),
    directoryArtifact: artifacts.directory,
    groundwater: artifacts.groundwater,
    waterBodies: artifacts.waterBodies,
    rainfall: artifacts.rainfall,
  });
}

/** What getDistrictReading builds, from the fixture corpus. */
export function buildFixtureReading(slug: string): DistrictReading {
  const district = districtBySlug(slug);
  const artifacts = readFixtureArtifacts(slug);
  const asOf = districtAsOf(artifacts.briefs, artifacts.directory);
  return buildDistrictReading({
    district,
    aggregate: buildFixtureAggregate(slug, asOf),
    briefs: fixtureBriefs(slug),
    directory: artifacts.directory,
    groundwater: artifacts.groundwater,
    projection: artifacts.projection,
    rainfall: artifacts.rainfall,
    jjm: artifacts.jjm,
    census: artifacts.census,
    waterBodies: artifacts.waterBodies,
    briefShards: artifacts.briefs,
    curated: district.hasCuratedBriefs ? artifacts.curated : undefined,
    asOf,
  });
}

/* ── the mini acquisition inputs the corpus was cut from ───────────────── */

export function loadMiniPlan(slug: string): TnDistrictRefreshPlan {
  return loadTnDistrictRefreshPlan(fixturePath(slug, "refresh-plan.json"));
}

export function loadMiniExtract(slug: string): TnDistrictSourceExtract {
  return loadTnDistrictSourceExtract(fixturePath(slug, "source-extract.json"));
}

export function loadMiniIdentity(slug: string): DistrictIdentity {
  return identityFromExtract(loadMiniExtract(slug));
}

export function loadMiniBoundary(slug: string): TnDistrictBoundaryExtract {
  return loadTnDistrictBoundaryExtract(
    fixturePath(slug, "boundary-extract.json"),
    loadMiniIdentity(slug),
  );
}

export function buildMiniProposal(
  slug: string,
  extract: TnDistrictSourceExtract = loadMiniExtract(slug),
): TnDistrictCrosswalkProposal {
  const alignmentPath = fixturePath(slug, "block-alignment.json");
  const reviewedBlockAlignments = existsSync(alignmentPath)
    ? loadReviewedBlockAlignmentTable(alignmentPath, extract).alignments
    : undefined;
  return buildTnDistrictCrosswalk(extract, {
    id: `${slug}-crosswalk-v1`,
    proposedAt: extract.acquiredAt,
    reviewedBlockAlignments,
  });
}

export function loadMiniResolution(
  slug: string,
  proposal: TnDistrictCrosswalkProposal,
): TnDistrictCrosswalkResolution {
  return loadTnDistrictCrosswalkResolution(
    fixturePath(slug, "crosswalk-resolution.json"),
    proposal,
  );
}
