/**
 * Served Gram Panchayat polygons for an LGD-built district, per LGD block as
 * public/data/atlas/<state>/<district>/boundaries/<blockCode>.geojson.
 *
 *   npx tsx scripts/atlas-boundaries-lgd-district.ts --district satara --as-of 2026-09-01
 *
 * The geometry is what the identity refresh cached from DataMeet
 * (datameet-panchayat-geometry.json: one MultiPolygon per Panchayat over its
 * LGD-listed member villages). DataMeet's ODbL permits publication with
 * attribution and share-alike, so unlike the TNGIS layer these polygons are
 * served, simplified to about 20 m, coordinates rounded to a metre and the
 * file written compact, so a taluka's shard stays in the hundreds of
 * kilobytes (the source has thousands of vertices per village). Every
 * feature states its member villages, drawn and not drawn, so the map never
 * implies a completeness the source lacks.
 */
import type { Feature, MultiPolygon } from "geojson";

import {
  districtArtifactPath,
  identityFromDirectory,
  type DistrictDirectoryArtifact,
} from "../src/lib/atlas/artifacts";
import { DATAMEET_ATTRIBUTION, DATAMEET_LICENSE } from "../src/lib/atlas/datameet-boundary";
import {
  atlasEnvelope,
  planIdentityAdapter,
  pruneShards,
  readArtifact,
  readCacheJson,
  requireAsOf,
  requireDistrict,
  upstreamSource,
  writeAtlasArtifact,
} from "./lib/atlas-producer";

const PRODUCED_BY = "scripts/atlas-boundaries-lgd-district.ts";
const GEOMETRY_CACHE = "datameet-panchayat-geometry.json";
/** Douglas-Peucker tolerance in degrees: about 20 m, well inside the source's
 *  own 2001-digitisation accuracy. */
const SIMPLIFY_TOLERANCE = 0.0002;

interface GeometryCache {
  planId: string;
  acquiredAt: string;
  sourceSha256: string;
  geometries: Record<
    string,
    { geometry: MultiPolygon; memberVillagesDrawn: string[]; memberVillagesNotDrawn: string[] }
  >;
}

export interface BoundaryFeatureProperties {
  lgdCode: string;
  name: string;
  blockCode: string;
  blockName: string;
  areaHectares: number;
  memberVillagesDrawn: string[];
  memberVillagesNotDrawn: string[];
}

/** Five decimals is about a metre, finer than the source; the sixth and
 *  beyond are noise from the projection arithmetic and a third of the bytes. */
function roundCoordinates<T extends Feature<MultiPolygon, BoundaryFeatureProperties>>(feature: T): T {
  return {
    ...feature,
    geometry: {
      type: "MultiPolygon",
      coordinates: feature.geometry.coordinates.map((polygon) =>
        polygon.map((ring) => ring.map(([x, y]) => [Number(x.toFixed(5)), Number(y.toFixed(5))])),
      ),
    },
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const district = requireDistrict(argv);
  if (planIdentityAdapter(district) !== "lgd-directory") {
    throw new Error(`${district.slug}: boundaries are served only for LGD-built districts (DataMeet, ODbL); TNGIS polygons stay withheld`);
  }
  const asOf = requireAsOf(argv);
  const directory = readArtifact<DistrictDirectoryArtifact>(district, "directory");
  const identity = identityFromDirectory(directory);
  const cache = readCacheJson<GeometryCache>(district, GEOMETRY_CACHE);
  if (!cache) {
    throw new Error(`No cached Panchayat geometry; run atlas-refresh-lgd-district.ts --fetch-boundary first`);
  }
  if (cache.planId !== directory.district.planId) {
    throw new Error(`cached geometry is for ${cache.planId}, directory is ${directory.district.planId}`);
  }
  const { default: simplify } = await import("@turf/simplify");
  const { default: area } = await import("@turf/area");

  const byBlock = new Map<string, Feature<MultiPolygon, BoundaryFeatureProperties>[]>();
  let vertices = 0;
  let simplifiedVertices = 0;
  for (const panchayat of directory.panchayats) {
    const entry = cache.geometries[panchayat.lgdCode];
    if (!entry || !panchayat.boundary) continue;
    const feature: Feature<MultiPolygon, BoundaryFeatureProperties> = {
      type: "Feature",
      properties: {
        lgdCode: panchayat.lgdCode,
        name: panchayat.name,
        blockCode: panchayat.blockCode,
        blockName: panchayat.blockName,
        areaHectares: panchayat.boundary.areaHectares,
        memberVillagesDrawn: entry.memberVillagesDrawn,
        memberVillagesNotDrawn: entry.memberVillagesNotDrawn,
      },
      geometry: entry.geometry,
    };
    vertices += entry.geometry.coordinates.flat(2).length;
    const simplified = simplify(feature, { tolerance: SIMPLIFY_TOLERANCE, highQuality: true }) as Feature<
      MultiPolygon,
      BoundaryFeatureProperties
    >;
    simplifiedVertices += simplified.geometry.coordinates.flat(2).length;
    // A simplification that moved the area by more than a percent has eaten a
    // village; the source polygon is served instead.
    const drift = Math.abs(area(simplified) - area(feature)) / Math.max(1, area(feature));
    const served = roundCoordinates(drift > 0.01 ? feature : simplified);
    const bucket = byBlock.get(panchayat.blockCode) ?? [];
    bucket.push(served);
    byBlock.set(panchayat.blockCode, bucket);
  }

  const written = new Set<string>();
  for (const [blockCode, features] of [...byBlock.entries()].sort()) {
    const blockName = identity.blocks.get(blockCode) ?? blockCode;
    const envelope = atlasEnvelope({
      district,
      family: "boundaries",
      sources: [upstreamSource("datameetMh", { role: "input", as_of: "2001", retrieved: cache.acquiredAt })],
      method: "derived",
      producedAt: asOf,
      producedBy: PRODUCED_BY,
      internalInputs: [districtArtifactPath(district, "directory")],
      note:
        `Gram Panchayat polygons for ${features.length} Panchayats in ${blockName} taluka: each is the ` +
        "MultiPolygon of its LGD-listed member villages as DataMeet drew them from the 2001 Census village " +
        "map, joined to the 2011 codes through DataMeet's own crosswalk, simplified to about 20 m " +
        "(source polygons kept where simplification moved the area by more than a percent). Member " +
        "villages the source did not draw are named on the feature. Indicative, not survey grade.",
      conventions: {
        license: `${DATAMEET_LICENSE}; ${DATAMEET_ATTRIBUTION}. Derived polygons are share-alike under the same licence.`,
        geometry: "MultiPolygon of member villages, never dissolved, so the source parts stay auditable",
        vintage: "the 2001 Census village map; boundaries changed since are not reflected",
      },
    });
    const collection: { type: "FeatureCollection"; features: typeof features; ext: Record<string, unknown> } = {
      type: "FeatureCollection",
      features,
      ext: {
        atlas: {
          schemaVersion: 1,
          planId: directory.district.planId,
          blockCode,
          blockName,
          acquiredAt: cache.acquiredAt,
          sourceSha256: cache.sourceSha256,
          featureCount: features.length,
          rights: {
            status: "share-alike",
            license: DATAMEET_LICENSE,
            attribution: DATAMEET_ATTRIBUTION,
          },
        },
      },
    };
    writeAtlasArtifact(district, "boundaries", blockCode, envelope, collection, { compact: true });
    written.add(blockCode);
  }
  const pruned = pruneShards(district, "boundaries", written);
  console.log(
    `Wrote ${written.size} boundaries shards for ${district.slug}: ` +
      `${[...byBlock.values()].reduce((total, list) => total + list.length, 0)} Panchayat polygons, ` +
      `${vertices.toLocaleString("en-IN")} source vertices simplified to ${simplifiedVertices.toLocaleString("en-IN")}` +
      (pruned.length ? ` (pruned ${pruned.join(", ")})` : ""),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
