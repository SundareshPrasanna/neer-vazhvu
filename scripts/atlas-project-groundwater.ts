/**
 * Projects the IN-GRES taluk assessment onto Gram Panchayats by spatial
 * intersection (centroid in taluk, vertex fallback) and serves the result as
 * public/data/atlas/<state>/<district>/groundwater-projection.json.
 *
 *   npx tsx scripts/atlas-project-groundwater.ts --district thanjavur --as-of 2026-09-01 [--fetch]
 *
 * Reads the served directory (places) and groundwater-taluks.json, the cached
 * TNGIS panchayat polygons the refresh acquired, and the TNGIS taluk layer
 * (--fetch to re-read it; cached otherwise). The envelope carries a
 * `projection` block: this artifact is a view of district evidence, never
 * direct Panchayat evidence.
 */
import {
  identityFromDirectory,
  type DistrictDirectoryArtifact,
  type GroundwaterTaluksArtifact,
} from "../src/lib/atlas/artifacts";
import { DATAMEET_BOUNDARY_SOURCE_ID } from "../src/lib/atlas/datameet-boundary";
import { BOUNDARY_SOURCE_ID } from "../src/lib/atlas/tn-boundary";
import { validateTnDistrictGroundwaterExtract } from "../src/lib/atlas/tn-groundwater";
import {
  TALUK_BOUNDARY_LAYER,
  buildGroundwaterProjection,
  validateGroundwaterProjection,
} from "../src/lib/atlas/tn-groundwater-projection";
import type { TalukPolygon } from "../src/lib/atlas/tn-groundwater-projection";
import { buildMembershipGroundwaterProjection } from "../src/lib/atlas/tn-groundwater-projection";
import {
  atlasEnvelope,
  cachePath,
  hasFlag,
  readArtifact,
  readCacheText,
  readWfsSnapshot,
  requireAsOf,
  requireDistrict,
  upstreamSource,
  writeAtlasArtifact,
  planIdentityAdapter,
} from "./lib/atlas-producer";
import { districtArtifactPath } from "../src/lib/atlas/artifacts";

const PRODUCED_BY = "scripts/atlas-project-groundwater.ts";
const TALUK_CACHE = "tngis-taluk-boundary.json";
const BOUNDARY_CACHE = "tngis-panchayat-boundary.json";

interface WfsFeature {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
}

function parseTaluks(body: string, districtLgdCode: string): TalukPolygon[] {
  const parsed = JSON.parse(body) as { features: WfsFeature[] };
  const districtNames = new Set(
    parsed.features.map((feature) =>
      String(feature.properties.district_name ?? "").trim().toUpperCase(),
    ),
  );
  if (districtNames.size > 1) {
    throw new Error(
      `Taluk layer returned several districts (${[...districtNames].join(", ")}); ` +
        "the filter is wrong.",
    );
  }
  const taluks: TalukPolygon[] = [];
  for (const feature of parsed.features) {
    if (!feature.geometry) continue;
    const polygons =
      feature.geometry.type === "MultiPolygon"
        ? (feature.geometry.coordinates as number[][][][])
        : [feature.geometry.coordinates as number[][][]];
    for (const rings of polygons) {
      taluks.push({
        talukName: String(feature.properties.taluk_name ?? ""),
        subDistrictCode: String(feature.properties.sub_district_code ?? ""),
        rings,
      });
    }
  }
  if (taluks.length === 0) {
    throw new Error(
      `No taluk polygons for district_lgd_code=${districtLgdCode}. ` +
        "The taluk layer uses LGD district codes, not the Panchayat layer's codes.",
    );
  }
  return taluks;
}

function readGramPanchayatGeometries(
  district: ReturnType<typeof requireDistrict>,
): Map<string, { type: string; coordinates: unknown }> {
  const body = readCacheText(district, BOUNDARY_CACHE);
  if (!body) {
    throw new Error(
      `No cached Panchayat geometry at ${cachePath(district, BOUNDARY_CACHE)}. ` +
        "Run atlas-refresh-tn-district.ts --fetch-boundary first.",
    );
  }
  const parsed = JSON.parse(body) as { features: WfsFeature[] };
  const map = new Map<string, { type: string; coordinates: unknown }>();
  for (const feature of parsed.features) {
    if (!feature.geometry) continue;
    map.set(String(feature.properties.village_lgd_code), feature.geometry);
  }
  return map;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const district = requireDistrict(argv);
  const asOf = requireAsOf(argv);
  const directory = readArtifact<DistrictDirectoryArtifact>(district, "directory");
  const groundwater = readArtifact<GroundwaterTaluksArtifact>(district, "groundwater-taluks");
  const groundwaterErrors = validateTnDistrictGroundwaterExtract(groundwater);
  if (groundwaterErrors.length > 0) {
    throw new Error(`Served groundwater-taluks.json is invalid:\n- ${groundwaterErrors.join("\n- ")}`);
  }
  const identity = identityFromDirectory(directory);

  // Both codes come from the served directory (which took them from the
  // reviewed plan). Passing them by hand is how a neighbouring district's
  // taluks got fetched once, silently.
  const talukDistrictLgdCode = directory.district.lgdDistrictCode;

  if (planIdentityAdapter(district) === "lgd-directory") {
    await projectByMembership(district, directory, identity, groundwater, asOf, talukDistrictLgdCode);
    return;
  }
  const snapshot = await readWfsSnapshot({
    district,
    cacheName: TALUK_CACHE,
    layer: TALUK_BOUNDARY_LAYER,
    cqlFilter: `district_lgd_code=${talukDistrictLgdCode}`,
    fetchNow: hasFlag(argv, "--fetch"),
    retrievedAt: asOf,
  });
  const taluks = parseTaluks(snapshot.body, talukDistrictLgdCode);
  const geometries = readGramPanchayatGeometries(district);

  const projection = buildGroundwaterProjection({
    planId: directory.district.planId,
    projectedAt: asOf,
    talukDistrictLgdCode,
    taluks,
    gramPanchayatGeometries: geometries,
    places: directory.panchayats.map((panchayat) => ({
      lgdGramPanchayatCode: panchayat.lgdCode,
      lgdGramPanchayatName: panchayat.name,
      lgdBlockCode: panchayat.blockCode,
    })),
    boundarySourceId: BOUNDARY_SOURCE_ID,
    groundwater,
  });
  const errors = validateGroundwaterProjection(projection, identity, groundwater);
  if (errors.length > 0) {
    throw new Error(`Invalid groundwater projection:\n- ${errors.join("\n- ")}`);
  }
  const summary = projection.summary;
  // A wrong-but-adjacent district silently projects a small share rather than
  // failing outright, so low coverage is treated as a fault, not a result.
  const share = summary.projected / Math.max(1, summary.gramPanchayats);
  if (share < 0.9) {
    throw new Error(
      `Only ${summary.projected} of ${summary.gramPanchayats} Gram Panchayats fell ` +
        `inside a taluk (${(share * 100).toFixed(1)} percent). That usually means ` +
        `district_lgd_code=${talukDistrictLgdCode} is the wrong district for the taluk layer.`,
    );
  }

  const envelope = atlasEnvelope({
    district,
    family: "groundwater-projection",
    sources: [
      upstreamSource("ingres", { role: "input", retrieved: groundwater.acquiredAt }),
      upstreamSource("tngisBoundary", { role: "input", retrieved: snapshot.retrievedAt }),
    ],
    method: "derived",
    producedAt: asOf,
    producedBy: PRODUCED_BY,
    internalInputs: [
      districtArtifactPath(district, "directory"),
      districtArtifactPath(district, "groundwater-taluks"),
    ],
    projection: {
      of: { kind: "district", id: district.scopeId },
      method: "spatial-intersection",
      limitations: [
        "The assessment unit is a revenue taluk, not the Gram Panchayat: each Panchayat inherits its containing taluk's category and stage of extraction unchanged, as containing-area context rather than a measurement of the place.",
        "Containment is decided by the TNGIS polygon centroid (vertex fallback for concave polygons); a Panchayat that falls in no taluk or in a taluk without an assessment is deferred, never guessed.",
        `${summary.blocksSpanningTaluks} TNRD blocks span more than one revenue taluk, so a block-to-taluk name match would have been wrong.`,
      ],
    },
    note:
      `IN-GRES ${projection.assessmentYear} taluk assessment projected onto ${summary.projected} of ` +
      `${summary.gramPanchayats} Gram Panchayats across ${summary.talukCoverage} taluks; ` +
      `${summary.deferred} deferred with a reason in review[].`,
  });
  const rel = writeAtlasArtifact(district, "groundwater-projection", undefined, envelope, projection);
  console.log(
    [
      `Wrote ${rel}`,
      `Projected ${summary.projected} of ${summary.gramPanchayats} Gram Panchayats across ` +
        `${summary.talukCoverage} taluks, ${summary.deferred} deferred`,
      Object.entries(summary.byCategory)
        .sort()
        .map(([category, count]) => `  ${category}: ${count}`)
        .join("\n"),
      `TNRD blocks whose Panchayats span more than one revenue taluk: ${summary.blocksSpanningTaluks}`,
    ].join("\n"),
  );
}

/**
 * LGD-built districts: the register states each Panchayat's taluka (its
 * covered villages carry the sub-district code and the block layer is the
 * taluka), so the taluka figure reaches the Panchayat by membership, not by
 * intersecting polygons. Nothing is fetched.
 */
async function projectByMembership(
  district: ReturnType<typeof requireDistrict>,
  directory: DistrictDirectoryArtifact,
  identity: ReturnType<typeof identityFromDirectory>,
  groundwater: GroundwaterTaluksArtifact,
  asOf: string,
  talukDistrictLgdCode: string,
): Promise<void> {
  const blockNames = new Map(directory.blocks.map((block) => [block.code, block.name]));
  const projection = buildMembershipGroundwaterProjection({
    planId: directory.district.planId,
    projectedAt: asOf,
    talukDistrictLgdCode,
    talukLayer: "lgd-subdistricts-datagovin",
    places: directory.panchayats.map((panchayat) => ({
      lgdGramPanchayatCode: panchayat.lgdCode,
      lgdGramPanchayatName: panchayat.name,
      lgdBlockCode: panchayat.blockCode,
      subDistrictCode: panchayat.blockCode,
      subDistrictName: blockNames.get(panchayat.blockCode) ?? panchayat.blockName,
    })),
    boundarySourceId: DATAMEET_BOUNDARY_SOURCE_ID,
    groundwater,
  });
  const errors = validateGroundwaterProjection(projection, identity, groundwater);
  if (errors.length > 0) throw new Error(`Invalid groundwater projection:\n- ${errors.join("\n- ")}`);
  const summary = projection.summary;
  const unit = (groundwater.source.assessmentUnitType || "taluka").toLowerCase();
  const envelope = atlasEnvelope({
    district,
    family: "groundwater-projection",
    sources: [
      upstreamSource("ingresMh", { role: "input", retrieved: groundwater.acquiredAt }),
      upstreamSource("lgdSubdistricts", { role: "input", retrieved: directory.acquiredAt }),
    ],
    method: "derived",
    producedAt: asOf,
    producedBy: PRODUCED_BY,
    internalInputs: [
      districtArtifactPath(district, "directory"),
      districtArtifactPath(district, "groundwater-taluks"),
    ],
    projection: {
      of: { kind: "district", id: district.scopeId },
      method: "administrative-rollup",
      limitations: [
        `The assessment unit is a revenue ${unit}, not the Gram Panchayat: each Panchayat inherits its ${unit}'s category and stage of extraction unchanged, as containing-area context rather than a measurement of the place.`,
        `Membership is the Local Government Directory's own statement: the ${unit} the Panchayat's covered villages sit in, joined to the IN-GRES unit by name. No polygon is intersected; a Panchayat whose ${unit} IN-GRES does not assess is deferred, never guessed.`,
        summary.blocksSpanningTaluks === 0
          ? `Blocks are the ${unit}s themselves in this district, so no block spans more than one assessment unit.`
          : `${summary.blocksSpanningTaluks} blocks span more than one ${unit}.`,
      ],
    },
    note:
      `IN-GRES ${projection.assessmentYear} ${unit} assessment attached to ${summary.projected} of ` +
      `${summary.gramPanchayats} Gram Panchayats across ${summary.talukCoverage} ${unit}s by register membership; ` +
      `${summary.deferred} deferred with a reason in review[].`,
  });
  const rel = writeAtlasArtifact(district, "groundwater-projection", undefined, envelope, projection);
  console.log(
    [
      `Wrote ${rel}`,
      `Attached ${summary.projected} of ${summary.gramPanchayats} Gram Panchayats across ${summary.talukCoverage} ${unit}s by membership, ${summary.deferred} deferred`,
      Object.entries(summary.byCategory).sort().map(([category, count]) => `  ${category}: ${count}`).join("\n"),
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
