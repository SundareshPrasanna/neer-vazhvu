/**
 * Atlas district refresh for a district whose identity master is the Local
 * Government Directory (Maharashtra first): acquires the LGD Sub-Districts,
 * Villages and Local Bodies resources from data.gov.in, the JJM citizen
 * corner enumeration and the Census 2011 village release, runs the JJM name
 * crosswalk against the reviewed inputs under pipeline-inputs/atlas/, joins
 * the DataMeet village polygons, and writes the served directory
 * public/data/atlas/<state>/<district>/directory.json.
 *
 *   npx tsx scripts/atlas-refresh-lgd-district.ts --district satara --fetch --as-of 2026-09-01
 *   npx tsx scripts/atlas-refresh-lgd-district.ts --district satara --fetch --as-of 2026-09-01 \
 *       --census-sha <sha256> --census-retrieved 2026-09-01   # reuse a workbook already in the cache
 *   npx tsx scripts/atlas-refresh-lgd-district.ts --district satara --replay
 *   npx tsx scripts/atlas-refresh-lgd-district.ts --district satara --validate
 *
 * --fetch acquires into .cache/atlas/<state>/<district>/ (source-extract.json
 * plus content-addressed raw objects) and fails closed when any count drifts
 * from the reviewed plan. --replay rebuilds from that cache. --fetch-boundary
 * downloads the DataMeet state file (78 MB) and crosswalk once; without it a
 * cached slice is reused. --validate checks the served directory against the
 * plan and exits non-zero on disagreement.
 *
 * The JJM crosswalk is the Tamil Nadu machinery unchanged: it matches source
 * units to an identity list by name within a block, so the LGD Panchayat list
 * is handed to it in that shape (crosswalk-extract.json in the cache, which
 * the staging scripts read too). The Census axis is empty here on purpose:
 * the Maharashtra release carries no Panchayat column, and composition comes
 * from the LGD coverage register instead.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { identityFromDirectory, type DistrictDirectoryArtifact } from "../src/lib/atlas/artifacts";
import {
  buildDataMeetBoundaryExtract,
  buildPanchayatGeometries,
  parseDataMeetCrosswalk,
  sliceDataMeetDistrict,
  validateDataMeetBoundaryExtract,
  type DataMeetBoundaryExtract,
  type DataMeetVillageFeature,
  type PanchayatMembers,
} from "../src/lib/atlas/datameet-boundary";
import {
  validateLgdDistrictRefreshPlan,
  validateLgdDistrictSourceExtract,
  type LgdDistrictRefreshPlan,
  type LgdDistrictSourceExtract,
} from "../src/lib/atlas/lgd-acquisition-model";
import { acquireLgdDistrictSourceExtract } from "../src/lib/atlas/lgd-district-acquisition";
import {
  assertLgdPlanMatchesExtract,
  buildLgdDistrictDirectoryPayload,
  collectLgdGramPanchayats,
  crosswalkExtractOf,
} from "../src/lib/atlas/lgd-district-refresh";
import {
  buildTnDistrictCrosswalk,
  loadReviewedBlockAlignmentTable,
  validateTnDistrictCrosswalkProposal,
} from "../src/lib/atlas/tn-crosswalk";
import {
  buildCanonicalCrosswalk,
  loadTnDistrictCrosswalkResolution,
} from "../src/lib/atlas/tn-crosswalk-resolution";
import { ContentAddressedCache, fetchIntoCache } from "../src/lib/atlas/tn-district-acquisition";
import { validateDirectoryPayload } from "../src/lib/atlas/tn-district-refresh";
import {
  ROOT,
  argValue,
  atlasEnvelope,
  cacheDir,
  cachePath,
  hasFlag,
  readArtifact,
  readCacheJson,
  requireDistrict,
  reviewedInputPath,
  upstreamSource,
  writeAtlasArtifact,
  writeCache,
} from "./lib/atlas-producer";

const PRODUCED_BY = "scripts/atlas-refresh-lgd-district.ts";
const EXTRACT_CACHE = "source-extract.json";
/** The identity list in the crosswalk's shape; the staging scripts read it. */
const CROSSWALK_EXTRACT_CACHE = "crosswalk-extract.json";
const PROPOSAL_CACHE = "crosswalk-proposal.json";
const BOUNDARY_CACHE = "datameet-boundary-extract.json";
/** Per-Panchayat MultiPolygons, for the boundaries producer and the map. */
export const GEOMETRY_CACHE = "datameet-panchayat-geometry.json";

export function loadLgdDistrictRefreshPlan(path: string): LgdDistrictRefreshPlan {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const errors = validateLgdDistrictRefreshPlan(parsed);
  if (errors.length > 0) throw new Error(`Invalid LGD district refresh plan:\n- ${errors.join("\n- ")}`);
  return parsed as LgdDistrictRefreshPlan;
}

interface BoundaryInputs {
  plan: LgdDistrictRefreshPlan;
  extract: LgdDistrictSourceExtract;
  panchayats: PanchayatMembers[];
}

async function readBoundary(
  district: ReturnType<typeof requireDistrict>,
  inputs: BoundaryInputs,
  fetchNow: boolean,
  asOf: string,
): Promise<DataMeetBoundaryExtract | undefined> {
  const { plan, extract, panchayats } = inputs;
  if (!fetchNow) {
    const cached = readCacheJson<DataMeetBoundaryExtract>(district, BOUNDARY_CACHE);
    if (!cached) {
      console.error(
        "  no cached DataMeet boundary; centroids will be absent (re-run with --fetch-boundary --as-of <date>)",
      );
      return undefined;
    }
    return cached;
  }
  const cache = new ContentAddressedCache(cacheDir(district));
  const geojson = await fetchIntoCache(cache, plan.sources.boundary.geojsonUrl);
  const crosswalkCsv = await fetchIntoCache(cache, plan.sources.boundary.crosswalkUrl);
  const parsed = JSON.parse(new TextDecoder().decode(geojson.artifact.bytes)) as {
    features?: DataMeetVillageFeature[];
  };
  const features = sliceDataMeetDistrict(parsed.features ?? [], plan.sources.boundary.districtName);
  if (features.length === 0) {
    throw new Error(`DataMeet file has no features for DISTRICT=${plan.sources.boundary.districtName}`);
  }
  const crosswalk = parseDataMeetCrosswalk(
    new TextDecoder().decode(crosswalkCsv.artifact.bytes),
    plan.district.censusDistrictCode,
  );
  const { geometries, villagePolygons, unmatchedFeatures } = buildPanchayatGeometries({
    features,
    crosswalk,
    panchayats,
  });
  const { default: area } = await import("@turf/area");
  const { default: bbox } = await import("@turf/bbox");
  const boundary = buildDataMeetBoundaryExtract({
    planId: plan.id,
    districtLgdCode: plan.district.lgdDistrictCode,
    acquiredAt: asOf,
    sourceUrl: plan.sources.boundary.geojsonUrl,
    crosswalkUrl: plan.sources.boundary.crosswalkUrl,
    snapshotSha256: geojson.artifact.sha256,
    geometries,
    panchayats,
    area: (feature) => area(feature as never),
    bbox: (feature) => bbox(feature as never) as number[],
  });
  writeCache(district, BOUNDARY_CACHE, boundary);
  writeCache(district, GEOMETRY_CACHE, {
    planId: plan.id,
    acquiredAt: asOf,
    sourceSha256: geojson.artifact.sha256,
    geometries: Object.fromEntries(
      [...geometries.values()].map((entry) => [
        entry.lgdGramPanchayatCode,
        {
          geometry: entry.geometry,
          memberVillagesDrawn: entry.memberVillagesDrawn,
          memberVillagesNotDrawn: entry.memberVillagesNotDrawn,
        },
      ]),
    ),
  });
  console.error(
    `  boundary: ${features.length} DataMeet features (${unmatchedFeatures} without a 2011 code), ` +
      `${villagePolygons} villages drawn, ${boundary.recordCount} of ${panchayats.length} Panchayats ` +
      `with a polygon, ${extract.sources.lgdVillages.recordCount} LGD villages`,
  );
  return boundary;
}

function panchayatMembersOf(extract: LgdDistrictSourceExtract): PanchayatMembers[] {
  const census2011Of = new Map(
    extract.sources.lgdVillages.records.map((village) => [village.villageCode, village.villageCensus2011Code]),
  );
  return collectLgdGramPanchayats(extract).map((panchayat) => ({
    lgdGramPanchayatCode: panchayat.lgdCode,
    name: panchayat.name,
    lgdBlockCode: panchayat.subdistrictCode,
    memberCensusCodes: panchayat.coverage
      .map((row) => census2011Of.get(row.entityCode) ?? "")
      .filter((code) => code.length > 0),
  }));
}

function validateServed(district: ReturnType<typeof requireDistrict>): void {
  const plan = loadLgdDistrictRefreshPlan(reviewedInputPath(district, "refresh-plan.json"));
  const directory = readArtifact<DistrictDirectoryArtifact>(district, "directory");
  const errors = validateDirectoryPayload(directory);
  const identity = identityFromDirectory(directory);
  const counts: Array<[string, number, number]> = [
    ["lgdGramPanchayats", directory.panchayats.length, plan.expectedCounts.lgdGramPanchayats],
    ["lgdSubdistricts", directory.blocks.length, plan.expectedCounts.lgdSubdistricts],
    ["jjmVillages", identity.jjmVillagePaths.size, plan.expectedCounts.jjmVillages],
  ];
  for (const [name, observed, expected] of counts) {
    if (observed !== expected) errors.push(`${name}: served ${observed}, reviewed plan expects ${expected}`);
  }
  if (directory.district.planId !== plan.id) {
    errors.push(`planId: served ${directory.district.planId}, plan is ${plan.id}`);
  }
  if (directory.district.identityAdapter !== "lgd-directory") {
    errors.push("identityAdapter: served directory was not built by the LGD adapter");
  }
  for (const target of plan.targets) {
    const panchayat = directory.panchayats.find((entry) => entry.lgdCode === target.lgdGramPanchayatCode);
    if (!panchayat) errors.push(`reviewed target ${target.id} is not in the directory`);
    else if (panchayat.composition.status !== "reviewed") {
      errors.push(`reviewed target ${target.id} does not carry its reviewed composition`);
    }
  }
  if (errors.length > 0) throw new Error(`Served directory fails validation:\n- ${errors.join("\n- ")}`);
  console.log(
    `${district.slug}: directory valid, ${directory.panchayats.length} Gram Panchayats in ` +
      `${directory.blocks.length} talukas, ${directory.crosswalk.summary.jjmBound} JJM-bound, ` +
      `${directory.crosswalk.summary.censusBound} with LGD-listed villages`,
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
  const plan = loadLgdDistrictRefreshPlan(reviewedInputPath(district, "refresh-plan.json"));

  let extract: LgdDistrictSourceExtract;
  if (fetchNow) {
    const asOf = argValue(argv, "--as-of");
    if (!asOf) throw new Error("--as-of YYYY-MM-DD is required with --fetch");
    const previous = readCacheJson<LgdDistrictSourceExtract>(district, EXTRACT_CACHE);
    // The Census workbook is a CLOSED release (82 MB for Maharashtra from a
    // host that serves it at about 200 KB/s). A previous extract lets it be
    // reused from the content-addressed cache; so does --census-sha for a
    // first run when the file was already downloaded and placed under
    // .cache/atlas/<state>/<district>/objects/<sha256>, with --census-retrieved
    // stating when. The bytes are hash-verified either way.
    const censusSha = argValue(argv, "--census-sha");
    const censusRetrieved = argValue(argv, "--census-retrieved");
    if ((censusSha === undefined) !== (censusRetrieved === undefined)) {
      throw new Error("--census-sha and --census-retrieved go together");
    }
    extract = await acquireLgdDistrictSourceExtract(plan, asOf, {
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
    const cached = readCacheJson<LgdDistrictSourceExtract>(district, EXTRACT_CACHE);
    if (!cached) throw new Error(`No cached extract at ${cachePath(district, EXTRACT_CACHE)}; run with --fetch first`);
    const errors = validateLgdDistrictSourceExtract(cached);
    if (errors.length > 0) throw new Error(`Cached extract is invalid:\n- ${errors.join("\n- ")}`);
    extract = cached;
  }
  assertLgdPlanMatchesExtract(plan, extract);
  const asOf = extract.acquiredAt;

  const crosswalkExtract = crosswalkExtractOf(plan, extract);
  writeCache(district, CROSSWALK_EXTRACT_CACHE, crosswalkExtract);
  const alignmentPath = reviewedInputPath(district, "block-alignment.json");
  const reviewedBlockAlignments = existsSync(alignmentPath)
    ? loadReviewedBlockAlignmentTable(alignmentPath, crosswalkExtract).alignments
    : undefined;
  const proposal = buildTnDistrictCrosswalk(crosswalkExtract, {
    id: `${district.slug}-crosswalk-v1`,
    proposedAt: asOf,
    reviewedBlockAlignments,
  });
  const proposalErrors = validateTnDistrictCrosswalkProposal(proposal, crosswalkExtract);
  if (proposalErrors.length > 0) throw new Error(`Invalid crosswalk proposal:\n- ${proposalErrors.join("\n- ")}`);
  writeCache(district, PROPOSAL_CACHE, proposal);

  const resolutionPath = reviewedInputPath(district, "crosswalk-resolution.json");
  const resolutions = existsSync(resolutionPath) ? [loadTnDistrictCrosswalkResolution(resolutionPath, proposal)] : [];
  if (resolutions.length === 0) {
    console.error("  no reviewed crosswalk resolution; deferred JJM identities stay unbound (stage one with scripts/atlas-stage-resolution.ts)");
  }
  const canonical = buildCanonicalCrosswalk(proposal, resolutions);

  const boundary = await readBoundary(
    district,
    { plan, extract, panchayats: panchayatMembersOf(extract) },
    hasFlag(argv, "--fetch-boundary"),
    argValue(argv, "--as-of") ?? asOf,
  );
  if (boundary) {
    const identityForBoundary = {
      planId: plan.id,
      gramPanchayats: new Map(
        collectLgdGramPanchayats(extract).map((panchayat) => [
          panchayat.lgdCode,
          { name: panchayat.name, blockCode: panchayat.subdistrictCode, blockName: panchayat.subdistrictName },
        ]),
      ),
      blocks: new Map(extract.sources.lgdSubdistricts.records.map((row) => [row.subdistrictCode, row.subdistrictName])),
      jjmVillagePaths: new Set<string>(),
      censusVillageCodes: new Set<string>(),
    };
    const boundaryErrors = validateDataMeetBoundaryExtract(boundary, identityForBoundary);
    if (boundaryErrors.length > 0) throw new Error(`Invalid boundary extract:\n- ${boundaryErrors.join("\n- ")}`);
  }

  const payload = buildLgdDistrictDirectoryPayload({ district, plan, extract, proposal, canonical, boundary });
  const errors = validateDirectoryPayload(payload);
  if (errors.length > 0) throw new Error(`Directory payload is inconsistent:\n- ${errors.join("\n- ")}`);

  const envelope = atlasEnvelope({
    district,
    family: "directory",
    sources: [
      upstreamSource("lgdLocalBodies", { as_of: extract.sources.lgdLocalBodies.sourceAsOf, retrieved: asOf }),
      upstreamSource("lgdVillages", { as_of: extract.sources.lgdVillages.sourceAsOf, retrieved: asOf }),
      upstreamSource("lgdSubdistricts", { as_of: extract.sources.lgdSubdistricts.sourceAsOf, retrieved: asOf }),
      upstreamSource("jjm", { retrieved: asOf }),
      upstreamSource("censusMh", { as_of: "2011", retrieved: extract.sources.census.retrievedAt }),
      ...(boundary ? [upstreamSource("datameetMh", { as_of: "2001", retrieved: boundary.source.retrievedAt })] : []),
    ],
    method: "mixed",
    producedAt: asOf,
    producedBy: PRODUCED_BY,
    internalInputs: [],
    note:
      `Identity directory for ${plan.district.displayName}: ${payload.panchayats.length} LGD-coded Gram ` +
      `Panchayats in ${payload.blocks.length} talukas. The Panchayat list, each Panchayat's covered ` +
      "villages and the taluka list come from the Local Government Directory as republished monthly on " +
      "data.gov.in (api, bulk CSV export); the JJM village enumeration from the citizen corner (scrape); " +
      "Census 2011 village rows from the Maharashtra DCHB release (xlsx extract), joined by village code " +
      "because that release carries no Panchayat column; centroids and areas from DataMeet's village " +
      "polygons (ODbL) joined through its 2001-to-2011 crosswalk. Blocks are LGD sub-districts: Satara's " +
      "Panchayat Samitis are coterminous with its talukas. JJM bindings are the name crosswalk's, each " +
      "labelled proposed until a reviewer verifies it; Census bindings are the register's own coverage " +
      "(match class lgd-coverage), authoritative but partial because the export names one covering village " +
      "for most Panchayats. Raw responses are content-addressed under .cache/atlas/; the reviewed plan, " +
      "resolution and block alignment live under pipeline-inputs/atlas/.",
    conventions: {
      key: "lgdCode is the LGD local-body code of the Gram Panchayat; blockCode is the LGD sub-district (taluka) code",
      bindings:
        "jjm bindings carry matchClass (how the pairing was made) and status (proposed | verified); a census " +
        "binding with matchClass lgd-coverage is the LGD register's own statement of which villages the " +
        "Panchayat covers, joined to Census 2011 rows by village code, and is marked proposed only because " +
        "no person has re-checked it",
      composition:
        "reviewed = a plan target a person checked; crosswalk = the LGD-covered villages, authoritative but " +
        "possibly incomplete; unbound = the register lists no village with a Census row",
      uncoveredVillages: "district villages the Local Bodies register lists under no Panchayat, kept so the enumeration stays complete",
      centroid: "[longitude, latitude] of the DataMeet MultiPolygon's bounding-box centre",
      datameet: "ODbL 1.0: attribution required, share-alike on the derived polygons, which are served under boundaries/<block>.geojson",
    },
  });
  const rel = writeAtlasArtifact(district, "directory", undefined, envelope, payload);
  const summary = payload.crosswalk.summary;
  console.log(
    [
      `Wrote ${rel}`,
      `Gram Panchayats: ${payload.panchayats.length} in ${payload.blocks.length} talukas (LGD edition ${extract.sources.lgdLocalBodies.sourceAsOf})`,
      `JJM: ${summary.jjmBound} bound of ${extract.sources.jjm.recordCount} villages; LGD coverage with Census rows: ${summary.censusBound} Panchayats; ${summary.unbound} bound to nothing`,
      `Bindings: ${summary.verifiedBindings} verified, ${summary.proposedBindings} proposed`,
      boundary
        ? `Centroids: ${payload.panchayats.filter((p) => p.boundary).length} from DataMeet (${boundary.acquiredAt}); ${boundary.panchayatsWithoutGeometry.length} Panchayats without a drawn village`
        : "Centroids: none (boundary not acquired)",
      `Uncovered villages kept for review: ${payload.uncoveredVillages?.length ?? 0}; unbound JJM units: ${payload.unbound.jjm.length}`,
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
