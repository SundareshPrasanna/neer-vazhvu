/**
 * Atlas district refresh: acquires the identity sources for one Tamil Nadu
 * district (TNRD LGD PDF, TNRD current master, JJM citizen corner, Census 2011
 * village amenities, TNGIS panchayat boundary), runs the identity crosswalk
 * against the reviewed inputs under pipeline-inputs/atlas/, and writes the
 * served directory artifact public/data/atlas/<state>/<district>/directory.json.
 *
 *   npx tsx scripts/atlas-refresh-tn-district.ts --district thanjavur --fetch --as-of 2026-09-01
 *   npx tsx scripts/atlas-refresh-tn-district.ts --district salem --fetch --as-of 2026-09-01 \
 *       --census-sha <sha256> --census-retrieved 2026-07-25   # first run: reuse the cached workbook
 *   npx tsx scripts/atlas-refresh-tn-district.ts --district thanjavur --replay
 *   npx tsx scripts/atlas-refresh-tn-district.ts --district thanjavur --validate
 *
 * --fetch acquires into .cache/atlas/<state>/<district>/ (source-extract.json,
 * the raw TNGIS response and content-addressed raw objects) and fails closed
 * when any enumeration count drifts from the reviewed plan. --replay rebuilds
 * the directory from that cache without the network; --fetch-boundary refreshes
 * the TNGIS panchayat boundary layer on its own. --validate checks the served
 * directory against the plan and exits non-zero on any disagreement.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  loadTnDistrictRefreshPlan,
  validateTnDistrictSourceExtract,
} from "../src/lib/atlas/acquisition-validation";
import type { TnDistrictSourceExtract } from "../src/lib/atlas/acquisition-model";
import { identityFromDirectory, identityFromExtract } from "../src/lib/atlas/artifacts";
import type { DistrictDirectoryArtifact } from "../src/lib/atlas/artifacts";
import {
  BOUNDARY_LAYER,
  buildTnDistrictBoundaryExtract,
  reportBoundaryJoin,
  validateTnDistrictBoundaryExtract,
} from "../src/lib/atlas/tn-boundary";
import type { TnDistrictBoundaryExtract } from "../src/lib/atlas/tn-boundary";
import {
  buildTnDistrictCrosswalk,
  loadReviewedBlockAlignmentTable,
  validateTnDistrictCrosswalkProposal,
} from "../src/lib/atlas/tn-crosswalk";
import {
  buildCanonicalCrosswalk,
  loadTnDistrictCrosswalkResolution,
} from "../src/lib/atlas/tn-crosswalk-resolution";
import { acquireTnDistrictSourceExtract } from "../src/lib/atlas/tn-district-acquisition";
import {
  buildDistrictDirectoryPayload,
  validateDirectoryPayload,
} from "../src/lib/atlas/tn-district-refresh";
import {
  ROOT,
  TNRD_LGD_EDITION,
  argValue,
  atlasEnvelope,
  cacheDir,
  cachePath,
  hasFlag,
  readArtifact,
  readCacheJson,
  readWfsSnapshot,
  requireDistrict,
  reviewedInputPath,
  upstreamSource,
  writeAtlasArtifact,
  writeCache,
} from "./lib/atlas-producer";

const PRODUCED_BY = "scripts/atlas-refresh-tn-district.ts";
const EXTRACT_CACHE = "source-extract.json";
const PROPOSAL_CACHE = "crosswalk-proposal.json";
const BOUNDARY_CACHE = "tngis-panchayat-boundary.json";

async function readBoundary(
  district: ReturnType<typeof requireDistrict>,
  extract: TnDistrictSourceExtract,
  districtLgdCode: string,
  fetchNow: boolean,
  asOf: string,
): Promise<TnDistrictBoundaryExtract | undefined> {
  if (!fetchNow && !existsSync(cachePath(district, BOUNDARY_CACHE))) {
    console.error(
      "  no cached TNGIS panchayat boundary; centroids will be absent " +
        "(re-run with --fetch-boundary --as-of <date>)",
    );
    return undefined;
  }
  const snapshot = await readWfsSnapshot({
    district,
    cacheName: BOUNDARY_CACHE,
    layer: BOUNDARY_LAYER,
    cqlFilter: `district_lgd_code=${districtLgdCode}`,
    fetchNow,
    retrievedAt: asOf,
  });
  const parsed = JSON.parse(snapshot.body) as { features?: unknown[] };
  if (!Array.isArray(parsed.features) || parsed.features.length === 0) {
    throw new Error("TNGIS boundary response contained no features");
  }
  const { default: area } = await import("@turf/area");
  const { default: bbox } = await import("@turf/bbox");
  const boundary = buildTnDistrictBoundaryExtract(parsed.features as never[], {
    planId: extract.planId,
    districtLgdCode,
    acquiredAt: snapshot.retrievedAt,
    sourceUrl: snapshot.url,
    snapshotSha256: snapshot.sha256,
    area: (feature) => area(feature as never),
    bbox: (feature) => bbox(feature as never) as number[],
  });
  const identity = identityFromExtract(extract);
  const errors = validateTnDistrictBoundaryExtract(boundary, identity);
  if (errors.length > 0) {
    throw new Error(`Invalid boundary extract:\n- ${errors.join("\n- ")}`);
  }
  const report = reportBoundaryJoin(boundary, identity);
  console.error(
    `  boundary: ${report.joined}/${report.lgdGramPanchayats} Gram Panchayats joined ` +
      `by LGD code, ${report.totalAreaHectares.toLocaleString("en-IN")} ha mapped`,
  );
  return boundary;
}

function validateServed(district: ReturnType<typeof requireDistrict>): void {
  const plan = loadTnDistrictRefreshPlan(reviewedInputPath(district, "refresh-plan.json"));
  const directory = readArtifact<DistrictDirectoryArtifact>(district, "directory");
  const errors = validateDirectoryPayload(directory);
  const identity = identityFromDirectory(directory);
  const counts: Array<[string, number, number]> = [
    ["tnrdLgdGramPanchayats", directory.panchayats.length, plan.expectedCounts.tnrdLgdGramPanchayats],
    ["tnrdMasterBlocks", directory.blocks.length, plan.expectedCounts.tnrdMasterBlocks],
    ["jjmVillages", identity.jjmVillagePaths.size, plan.expectedCounts.jjmVillages],
    ["censusVillages", identity.censusVillageCodes.size, plan.expectedCounts.censusVillages],
  ];
  for (const [name, observed, expected] of counts) {
    if (observed !== expected) {
      errors.push(`${name}: served ${observed}, reviewed plan expects ${expected}`);
    }
  }
  if (directory.district.planId !== plan.id) {
    errors.push(`planId: served ${directory.district.planId}, plan is ${plan.id}`);
  }
  for (const target of plan.targets) {
    const panchayat = directory.panchayats.find(
      (entry) => entry.lgdCode === target.tnrdLgdGramPanchayatCode,
    );
    if (!panchayat) {
      errors.push(`reviewed target ${target.id} is not in the directory`);
    } else if (panchayat.composition.status !== "reviewed") {
      errors.push(`reviewed target ${target.id} does not carry its reviewed composition`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`Served directory fails validation:\n- ${errors.join("\n- ")}`);
  }
  console.log(
    `${district.slug}: directory valid, ${directory.panchayats.length} Gram Panchayats in ` +
      `${directory.blocks.length} blocks, ${directory.crosswalk.summary.jjmBound} JJM-bound, ` +
      `${directory.crosswalk.summary.censusBound} Census-bound`,
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const district = requireDistrict(argv);
  if (hasFlag(argv, "--validate")) {
    validateServed(district);
    return;
  }
  const fetchNow = hasFlag(argv, "--fetch");
  const replay = hasFlag(argv, "--replay");
  if (fetchNow === replay) throw new Error("choose exactly one of --fetch or --replay");
  const plan = loadTnDistrictRefreshPlan(reviewedInputPath(district, "refresh-plan.json"));

  let extract: TnDistrictSourceExtract;
  if (fetchNow) {
    const asOf = argValue(argv, "--as-of");
    if (!asOf) throw new Error("--as-of YYYY-MM-DD is required with --fetch");
    // The previous extract lets the CLOSED census workbook be reused from
    // the content-addressed cache instead of re-downloaded every month. A
    // first run has no previous extract: --census-sha names a workbook
    // already placed under .cache/atlas/<state>/<district>/objects/<sha256>
    // (the one state workbook serves every district), --census-retrieved
    // says when it was fetched. Hash-verified either way.
    const previous = readCacheJson<TnDistrictSourceExtract>(district, EXTRACT_CACHE);
    const censusSha = argValue(argv, "--census-sha");
    const censusRetrieved = argValue(argv, "--census-retrieved");
    if ((censusSha === undefined) !== (censusRetrieved === undefined)) {
      throw new Error("--census-sha and --census-retrieved go together");
    }
    extract = await acquireTnDistrictSourceExtract(plan, asOf, {
      cacheDir: cacheDir(district),
      censusExtractorPath: resolve(ROOT, "scripts/atlas_extract_census_village_amenities.py"),
      previousCensus: previous?.sources.census
        ? {
            artifactSha256: previous.sources.census.artifactSha256s[0],
            retrievedAt: previous.sources.census.retrievedAt,
          }
        : censusSha && censusRetrieved
          ? { artifactSha256: censusSha, retrievedAt: censusRetrieved }
          : undefined,
    });
    writeCache(district, EXTRACT_CACHE, extract);
  } else {
    const cached = readCacheJson<TnDistrictSourceExtract>(district, EXTRACT_CACHE);
    if (!cached) {
      throw new Error(
        `No cached extract at ${cachePath(district, EXTRACT_CACHE)}; run with --fetch first`,
      );
    }
    const errors = validateTnDistrictSourceExtract(cached);
    if (errors.length > 0) {
      throw new Error(`Cached extract is invalid:\n- ${errors.join("\n- ")}`);
    }
    extract = cached;
  }
  const asOf = extract.acquiredAt;

  const alignmentPath = reviewedInputPath(district, "block-alignment.json");
  const reviewedBlockAlignments = existsSync(alignmentPath)
    ? loadReviewedBlockAlignmentTable(alignmentPath, extract).alignments
    : undefined;
  const proposal = buildTnDistrictCrosswalk(extract, {
    id: `${district.slug}-crosswalk-v1`,
    proposedAt: asOf,
    reviewedBlockAlignments,
  });
  const proposalErrors = validateTnDistrictCrosswalkProposal(proposal, extract);
  if (proposalErrors.length > 0) {
    throw new Error(`Invalid crosswalk proposal:\n- ${proposalErrors.join("\n- ")}`);
  }
  writeCache(district, PROPOSAL_CACHE, proposal);

  const resolutionPath = reviewedInputPath(district, "crosswalk-resolution.json");
  const resolutions = existsSync(resolutionPath)
    ? [loadTnDistrictCrosswalkResolution(resolutionPath, proposal)]
    : [];
  if (resolutions.length === 0) {
    console.error(
      "  no reviewed crosswalk resolution; deferred identities stay unbound " +
        "(stage one with scripts/atlas-stage-resolution.ts)",
    );
  }
  const canonical = buildCanonicalCrosswalk(proposal, resolutions);

  const boundary = await readBoundary(
    district,
    extract,
    plan.district.tnrdLgdCode,
    hasFlag(argv, "--fetch-boundary"),
    argValue(argv, "--as-of") ?? asOf,
  );

  const payload = buildDistrictDirectoryPayload({
    district,
    plan,
    extract,
    proposal,
    canonical,
    boundary,
  });
  const errors = validateDirectoryPayload(payload);
  if (errors.length > 0) {
    throw new Error(`Directory payload is inconsistent:\n- ${errors.join("\n- ")}`);
  }

  const envelope = atlasEnvelope({
    district,
    family: "directory",
    sources: [
      upstreamSource("tnrdLgd", { as_of: TNRD_LGD_EDITION, retrieved: asOf }),
      upstreamSource("tnrdMaster", {
        as_of: extract.sources.tnrdMaster.sourceAsOf,
        retrieved: asOf,
      }),
      upstreamSource("jjm", { retrieved: asOf }),
      // The extract's own date, not the run's: a reused closed-edition
      // workbook keeps its original retrieval date (reusedCachedArtifact),
      // and the envelope must say the same thing the extract does.
      upstreamSource("census", { as_of: "2011", retrieved: extract.sources.census.retrievedAt }),
      ...(boundary
        ? [upstreamSource("tngisBoundary", { retrieved: boundary.source.retrievedAt })]
        : []),
    ],
    method: "mixed",
    producedAt: asOf,
    producedBy: PRODUCED_BY,
    internalInputs: [],
    note:
      `Identity directory for ${plan.district.displayName}: ${payload.panchayats.length} ` +
      `LGD-coded Gram Panchayats in ${payload.blocks.length} blocks. LGD codes come from ` +
      "the 2021 TNRD PDF (pdf-extract), current membership from the TNRD master (scrape), " +
      "the JJM village enumeration from the citizen corner (scrape), Census 2011 " +
      "identity columns from the DCHB village release (xlsx extract), and centroids " +
      "from the TNGIS panchayat boundary layer (WFS). JJM and Census bindings are the " +
      "crosswalk's: machine matches plus staged pairings, each labelled proposed until a " +
      "reviewer verifies it. Raw responses are content-addressed under .cache/atlas/; " +
      "the reviewed plan, resolution and block alignment live under pipeline-inputs/atlas/.",
    conventions: {
      key: "lgdCode is the LGD Gram Panchayat code; every other identifier is a binding to it",
      bindings:
        "jjm and census bindings carry matchClass (how the pairing was made) and status " +
        "(proposed | verified); a proposed binding is usable but has not been checked by " +
        "someone with local knowledge",
      composition:
        "reviewed = a plan target a person checked; crosswalk = the bound Census unit's " +
        "village set, unreviewed; unbound = no Census unit bound, 2011 composition not established",
      centroid: "[longitude, latitude] of the TNGIS polygon's bounding-box centre",
      tngis:
        "TNGIS terms require prior approval for public display or redistribution; only " +
        "derived centroids, areas and digests of the polygons are published here",
    },
  });
  const rel = writeAtlasArtifact(district, "directory", undefined, envelope, payload);

  const summary = canonical.summary;
  console.log(
    [
      `Wrote ${rel}`,
      `Gram Panchayats: ${payload.panchayats.length} in ${payload.blocks.length} blocks ` +
        `(${extract.sources.tnrdLgd.sourceAsOf} LGD list, master as of ` +
        `${extract.sources.tnrdMaster.sourceAsOf})`,
      `JJM: ${summary.jjmBound} bound of ${extract.sources.jjm.recordCount} villages; ` +
        `Census: ${summary.censusBound} bound of ${extract.sources.census.recordCount} villages; ` +
        `${summary.unbound} Panchayats bound to nothing`,
      `Bindings: ${summary.verifiedBindings} verified, ${summary.proposedBindings} proposed`,
      boundary
        ? `Centroids: ${payload.panchayats.filter((p) => p.boundary).length} from TNGIS (${boundary.acquiredAt})`
        : "Centroids: none (boundary layer not acquired)",
      `Unbound source units kept for review: ${payload.unbound.jjm.length} JJM, ${payload.unbound.census.length} Census`,
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
