/**
 * Shared setup for the Atlas unit tests: points the served-artifact readers
 * at the one-block fixture corpus under fixtures/atlas/ and loads the mini
 * acquisition inputs (plan, extract, boundary, reviewed inputs) that corpus
 * was cut from. The fixture is derived by slicing the served July corpus by
 * one block per district; it is regenerated, never hand-edited.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { TnDistrictRefreshPlan, TnDistrictSourceExtract } from "./acquisition-model";
import {
  loadTnDistrictRefreshPlan,
  loadTnDistrictSourceExtract,
} from "./acquisition-validation";
import { identityFromExtract, type DistrictIdentity } from "./artifacts";
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
process.env.NV_ATLAS_DATA_ROOT = FIXTURE_ROOT;

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
