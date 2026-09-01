import { readFileSync } from "node:fs";

import { computeRecordsSha256 } from "./acquisition-validation";
import { foldTamilPlaceName } from "./tn-crosswalk";
import type { GroundwaterCategory, TnDistrictGroundwaterExtract } from "./tn-groundwater";
import type { DistrictIdentity } from "./artifacts";

export const GROUNDWATER_PROJECTION_SCHEMA_VERSION = 1;

export const TALUK_BOUNDARY_LAYER =
  "admin_master:administrative_boundary_taluk";

/**
 * How a Gram Panchayat was placed inside a revenue taluk.
 *
 * `centroid-in-taluk` is the ordinary case. `vertex-in-taluk` covers concave
 * Panchayats whose centroid falls outside their own polygon. Anything else is
 * deferred rather than guessed, because a wrong containment silently attaches
 * the wrong groundwater category to a place.
 */
export const CONTAINMENT_METHODS = [
  "centroid-in-taluk",
  "vertex-in-taluk",
  /** The register places the Panchayat's villages in a taluka by code (LGD
   *  adapter): no geometry is consulted, and none is needed. */
  "village-subdistrict-code",
] as const;

/**
 * How a taluk figure reaches a Panchayat. Tamil Nadu intersects TNGIS
 * polygons because TNRD blocks cut across revenue taluks and no register
 * says which taluk a Panchayat is in. Where the identity register itself
 * lists each Panchayat's villages with their sub-district (the LGD), the
 * membership is administrative fact and the projection says so.
 */
export const PROJECTION_METHODS = ["spatial-intersection", "administrative-membership"] as const;
export type GroundwaterProjectionMethod = (typeof PROJECTION_METHODS)[number];

export type ContainmentMethod = (typeof CONTAINMENT_METHODS)[number];

export const PROJECTION_REVIEW_REASONS = [
  "no-containing-taluk",
  "taluk-has-no-assessment",
  "ambiguous-containment",
] as const;

export type ProjectionReviewReason =
  (typeof PROJECTION_REVIEW_REASONS)[number];

export interface GroundwaterProjectionRecord {
  lgdGramPanchayatCode: string;
  lgdGramPanchayatName: string;
  lgdBlockCode: string;
  talukName: string;
  subDistrictCode: string;
  containment: ContainmentMethod;
  category: GroundwaterCategory | null;
  stageOfExtractionPercent: number | null;
}

/**
 * IN-GRES publishes the stage of extraction to four decimals, which reads as
 * a precision the assessment does not have: it is a taluk-wide ratio of two
 * estimated volumes. The stored value keeps the source's own digits so the
 * record stays faithful; everything shown to a reader goes through here.
 */
export function formatExtractionStage(
  value: number | null | undefined,
): string {
  if (typeof value !== "number") return "not stated";
  return value.toFixed(1);
}

export interface GroundwaterProjectionReviewEntry {
  lgdGramPanchayatCode: string;
  lgdGramPanchayatName: string;
  lgdBlockCode: string;
  reason: ProjectionReviewReason;
  detail: string;
}

export interface TnGroundwaterProjection {
  schemaVersion: number;
  planId: string;
  assessmentYear: string;
  projectedAt: string;
  /**
   * Named for the place-water model's vocabulary. This is emphatically not
   * direct-published evidence: the Panchayat inherits its containing revenue
   * taluk's figure.
   */
  projectionMethod: GroundwaterProjectionMethod;
  source: {
    talukLayer: string;
    talukDistrictLgdCode: string;
    groundwaterSourceId: string;
    boundarySourceId: string;
  };
  recordsSha256: string;
  recordCount: number;
  records: GroundwaterProjectionRecord[];
  review: GroundwaterProjectionReviewEntry[];
  summary: {
    gramPanchayats: number;
    projected: number;
    deferred: number;
    byCategory: Record<string, number>;
    /**
     * TNRD blocks whose Panchayats fall in more than one revenue taluk. Any
     * non-zero count is the proof that a block-to-taluk name match would have
     * been wrong.
     */
    blocksSpanningTaluks: number;
    talukCoverage: number;
  };
}

export interface TalukPolygon {
  talukName: string;
  subDistrictCode: string;
  rings: number[][][];
}

/** The Gram Panchayats to place: LGD code, name and block, from the directory. */
export interface ProjectionPlace {
  lgdGramPanchayatCode: string;
  lgdGramPanchayatName: string;
  lgdBlockCode: string;
}

/** Ray casting against one linear ring. */
function pointInRing(point: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Outer ring minus holes, for a polygon expressed as an array of rings. */
export function pointInPolygonRings(
  point: [number, number],
  rings: number[][][],
): boolean {
  if (rings.length === 0) return false;
  if (!pointInRing(point, rings[0])) return false;
  for (let index = 1; index < rings.length; index += 1) {
    if (pointInRing(point, rings[index])) return false;
  }
  return true;
}

export function polygonCentroid(rings: number[][][]): [number, number] {
  const ring = rings[0] ?? [];
  let area = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    area += cross;
    x += (ring[j][0] + ring[i][0]) * cross;
    y += (ring[j][1] + ring[i][1]) * cross;
  }
  if (area === 0) {
    const first = ring[0] ?? [0, 0];
    return [first[0], first[1]];
  }
  area *= 0.5;
  return [x / (6 * area), y / (6 * area)];
}

function collectPolygons(geometry: {
  type: string;
  coordinates: unknown;
}): number[][][][] {
  if (geometry.type === "Polygon") return [geometry.coordinates as number[][][]];
  if (geometry.type === "MultiPolygon") return geometry.coordinates as number[][][][];
  return [];
}

export function buildGroundwaterProjection(options: {
  planId: string;
  projectedAt: string;
  talukDistrictLgdCode: string;
  taluks: TalukPolygon[];
  gramPanchayatGeometries: Map<string, { type: string; coordinates: unknown }>;
  places: ProjectionPlace[];
  boundarySourceId: string;
  groundwater: TnDistrictGroundwaterExtract;
}): TnGroundwaterProjection {
  const assessments = new Map(
    options.groundwater.records.map((record) => [
      foldTamilPlaceName(record.locationName),
      record,
    ]),
  );

  const records: GroundwaterProjectionRecord[] = [];
  const review: GroundwaterProjectionReviewEntry[] = [];

  for (const place of options.places) {
    const geometry = options.gramPanchayatGeometries.get(
      place.lgdGramPanchayatCode,
    );
    const base = {
      lgdGramPanchayatCode: place.lgdGramPanchayatCode,
      lgdGramPanchayatName: place.lgdGramPanchayatName,
      lgdBlockCode: place.lgdBlockCode,
    };
    if (!geometry) {
      review.push({
        ...base,
        reason: "no-containing-taluk",
        detail: "No geometry was available for this Gram Panchayat.",
      });
      continue;
    }
    const polygons = collectPolygons(geometry);
    const centroid = polygonCentroid(polygons[0] ?? []);

    let match: { taluk: TalukPolygon; containment: ContainmentMethod } | null =
      null;
    for (const taluk of options.taluks) {
      if (pointInPolygonRings(centroid, taluk.rings)) {
        match = { taluk, containment: "centroid-in-taluk" };
        break;
      }
    }
    if (!match) {
      // A concave Panchayat can have a centroid outside its own polygon.
      // Fall back to a point that is definitely on the Panchayat.
      const vertex = polygons[0]?.[0]?.[0] as [number, number] | undefined;
      if (vertex) {
        for (const taluk of options.taluks) {
          if (pointInPolygonRings(vertex, taluk.rings)) {
            match = { taluk, containment: "vertex-in-taluk" };
            break;
          }
        }
      }
    }
    if (!match) {
      review.push({
        ...base,
        reason: "no-containing-taluk",
        detail:
          `Neither the centroid (${centroid[0].toFixed(4)}, ${centroid[1].toFixed(4)}) ` +
          "nor a boundary vertex fell inside any revenue taluk.",
      });
      continue;
    }

    const assessment = assessments.get(
      foldTamilPlaceName(match.taluk.talukName),
    );
    if (!assessment) {
      review.push({
        ...base,
        reason: "taluk-has-no-assessment",
        detail: `Taluk ${match.taluk.talukName} has no IN-GRES assessment record.`,
      });
      continue;
    }
    records.push({
      ...base,
      talukName: match.taluk.talukName,
      subDistrictCode: match.taluk.subDistrictCode,
      containment: match.containment,
      category: assessment.category,
      stageOfExtractionPercent: assessment.stageOfExtractionPercent,
    });
  }

  records.sort((left, right) =>
    left.lgdGramPanchayatCode.localeCompare(right.lgdGramPanchayatCode),
  );
  review.sort((left, right) =>
    left.lgdGramPanchayatCode.localeCompare(right.lgdGramPanchayatCode),
  );

  const byCategory: Record<string, number> = {};
  for (const record of records) {
    const key = record.category ?? "not-stated";
    byCategory[key] = (byCategory[key] ?? 0) + 1;
  }
  const taluksByBlock = new Map<string, Set<string>>();
  for (const record of records) {
    const bucket = taluksByBlock.get(record.lgdBlockCode) ?? new Set<string>();
    bucket.add(record.talukName);
    taluksByBlock.set(record.lgdBlockCode, bucket);
  }

  return {
    schemaVersion: GROUNDWATER_PROJECTION_SCHEMA_VERSION,
    planId: options.planId,
    assessmentYear: options.groundwater.assessmentYear,
    projectedAt: options.projectedAt,
    projectionMethod: "spatial-intersection",
    source: {
      talukLayer: TALUK_BOUNDARY_LAYER,
      talukDistrictLgdCode: options.talukDistrictLgdCode,
      groundwaterSourceId: options.groundwater.source.sourceId,
      boundarySourceId: options.boundarySourceId,
    },
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    records,
    review,
    summary: {
      gramPanchayats: options.places.length,
      projected: records.length,
      deferred: review.length,
      byCategory,
      blocksSpanningTaluks: [...taluksByBlock.values()].filter(
        (taluks) => taluks.size > 1,
      ).length,
      talukCoverage: new Set(records.map((record) => record.talukName)).size,
    },
  };
}

/** A Panchayat to place by its register-stated taluka (LGD adapter). */
export interface MembershipProjectionPlace extends ProjectionPlace {
  subDistrictCode: string;
  subDistrictName: string;
}

/**
 * The register already says which taluka each Panchayat's villages sit in,
 * so the projection is a code join: no polygon, no centroid, and nothing to
 * defer except a taluka IN-GRES does not assess.
 */
export function buildMembershipGroundwaterProjection(options: {
  planId: string;
  projectedAt: string;
  talukDistrictLgdCode: string;
  talukLayer: string;
  places: MembershipProjectionPlace[];
  boundarySourceId: string;
  groundwater: TnDistrictGroundwaterExtract;
}): TnGroundwaterProjection {
  const assessments = new Map(
    options.groundwater.records.map((record) => [foldTamilPlaceName(record.locationName), record]),
  );
  const records: GroundwaterProjectionRecord[] = [];
  const review: GroundwaterProjectionReviewEntry[] = [];
  for (const place of options.places) {
    const base = {
      lgdGramPanchayatCode: place.lgdGramPanchayatCode,
      lgdGramPanchayatName: place.lgdGramPanchayatName,
      lgdBlockCode: place.lgdBlockCode,
    };
    const assessment = assessments.get(foldTamilPlaceName(place.subDistrictName));
    if (!assessment) {
      review.push({
        ...base,
        reason: "taluk-has-no-assessment",
        detail: `Taluka ${place.subDistrictName} has no IN-GRES assessment record.`,
      });
      continue;
    }
    records.push({
      ...base,
      talukName: place.subDistrictName,
      subDistrictCode: place.subDistrictCode,
      containment: "village-subdistrict-code",
      category: assessment.category,
      stageOfExtractionPercent: assessment.stageOfExtractionPercent,
    });
  }
  records.sort((left, right) => left.lgdGramPanchayatCode.localeCompare(right.lgdGramPanchayatCode));
  review.sort((left, right) => left.lgdGramPanchayatCode.localeCompare(right.lgdGramPanchayatCode));
  const byCategory: Record<string, number> = {};
  for (const record of records) {
    const key = record.category ?? "not-stated";
    byCategory[key] = (byCategory[key] ?? 0) + 1;
  }
  const taluksByBlock = new Map<string, Set<string>>();
  for (const record of records) {
    const bucket = taluksByBlock.get(record.lgdBlockCode) ?? new Set<string>();
    bucket.add(record.talukName);
    taluksByBlock.set(record.lgdBlockCode, bucket);
  }
  return {
    schemaVersion: GROUNDWATER_PROJECTION_SCHEMA_VERSION,
    planId: options.planId,
    assessmentYear: options.groundwater.assessmentYear,
    projectedAt: options.projectedAt,
    projectionMethod: "administrative-membership",
    source: {
      talukLayer: options.talukLayer,
      talukDistrictLgdCode: options.talukDistrictLgdCode,
      groundwaterSourceId: options.groundwater.source.sourceId,
      boundarySourceId: options.boundarySourceId,
    },
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    records,
    review,
    summary: {
      gramPanchayats: options.places.length,
      projected: records.length,
      deferred: review.length,
      byCategory,
      blocksSpanningTaluks: [...taluksByBlock.values()].filter((taluks) => taluks.size > 1).length,
      talukCoverage: new Set(records.map((record) => record.talukName)).size,
    },
  };
}

export function validateGroundwaterProjection(
  projection: TnGroundwaterProjection,
  identity: DistrictIdentity,
  groundwater: TnDistrictGroundwaterExtract,
): string[] {
  const errors: string[] = [];
  if (projection.schemaVersion !== GROUNDWATER_PROJECTION_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion: expected ${GROUNDWATER_PROJECTION_SCHEMA_VERSION}, found ${projection.schemaVersion}`,
    );
  }
  if (!PROJECTION_METHODS.includes(projection.projectionMethod)) {
    errors.push(
      "projectionMethod: a taluk figure reaches a Panchayat by spatial " +
        "intersection or by the register's own sub-district membership; " +
        "any other method would overstate the evidence",
    );
  }
  for (const record of projection.records) {
    const spatial = record.containment !== "village-subdistrict-code";
    if (spatial !== (projection.projectionMethod === "spatial-intersection")) {
      errors.push(
        `records[${record.lgdGramPanchayatCode}]: containment ${record.containment} ` +
          `does not belong to a ${projection.projectionMethod} projection`,
      );
    }
  }
  if (projection.assessmentYear !== groundwater.assessmentYear) {
    errors.push(
      `assessmentYear: projection ${projection.assessmentYear} does not match ` +
        `the groundwater extract ${groundwater.assessmentYear}`,
    );
  }
  if (projection.recordsSha256 !== computeRecordsSha256(projection.records)) {
    errors.push("recordsSha256: records do not match their digest");
  }
  if (errors.length > 0) return errors;

  const known = identity.gramPanchayats;
  const categories = new Map(
    groundwater.records.map((record) => [
      foldTamilPlaceName(record.locationName),
      record,
    ]),
  );
  const seen = new Set<string>();
  for (const record of projection.records) {
    if (seen.has(record.lgdGramPanchayatCode)) {
      errors.push(
        `records: ${record.lgdGramPanchayatCode} is projected more than once`,
      );
    }
    seen.add(record.lgdGramPanchayatCode);
    if (!known.has(record.lgdGramPanchayatCode)) {
      errors.push(
        `records: ${record.lgdGramPanchayatCode} is not a mapped Gram Panchayat`,
      );
    }
    const assessment = categories.get(foldTamilPlaceName(record.talukName));
    if (!assessment) {
      errors.push(
        `records[${record.lgdGramPanchayatCode}]: taluk ${record.talukName} has no assessment`,
      );
      continue;
    }
    // The projection must carry the taluk's figure unchanged. Any drift here
    // would mean a Panchayat showing a category its taluk never reported.
    if (record.category !== assessment.category) {
      errors.push(
        `records[${record.lgdGramPanchayatCode}]: category ${record.category} ` +
          `does not match taluk ${record.talukName} (${assessment.category})`,
      );
    }
    if (
      record.stageOfExtractionPercent !== assessment.stageOfExtractionPercent
    ) {
      errors.push(
        `records[${record.lgdGramPanchayatCode}]: stage of extraction drifted from its taluk`,
      );
    }
  }
  for (const entry of projection.review) {
    if (seen.has(entry.lgdGramPanchayatCode)) {
      errors.push(
        `review: ${entry.lgdGramPanchayatCode} is both projected and deferred`,
      );
    }
    seen.add(entry.lgdGramPanchayatCode);
  }
  if (seen.size !== known.size) {
    errors.push(
      `coverage: ${seen.size} Gram Panchayats accounted for, expected ${known.size}`,
    );
  }
  return errors;
}

export function loadGroundwaterProjection(
  path: string,
  identity: DistrictIdentity,
  groundwater: TnDistrictGroundwaterExtract,
): TnGroundwaterProjection {
  const parsed = JSON.parse(
    readFileSync(path, "utf8"),
  ) as TnGroundwaterProjection;
  const errors = validateGroundwaterProjection(parsed, identity, groundwater);
  if (errors.length > 0) {
    throw new Error(
      `Invalid groundwater projection ${path}:\n- ${errors.join("\n- ")}`,
    );
  }
  return parsed;
}
