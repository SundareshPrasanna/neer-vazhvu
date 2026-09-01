import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { computeRecordsSha256 } from "./acquisition-validation";
import type { DistrictIdentity } from "./artifacts";

export const BOUNDARY_EXTRACT_SCHEMA_VERSION = 1;

export const BOUNDARY_SOURCE_ID = "tngis-tnrd-panchayat-boundary";
export const BOUNDARY_LAYER = "tnrd:panchayat_boundary";

export const TNGIS_TERMS_URL = "https://tngis.tn.gov.in/user.html";

export const TNGIS_TERMS_QUOTE =
  "GIS based data available in TNGIS should be used for informational purpose " +
  "only and Not for legal use/not to be shared / published in the public media " +
  "in any form or in the social media without any prior approval / permission " +
  "from TNGIS/TNeGA.";

/**
 * The TNGIS layer publishes LGD district, block and Gram Panchayat codes on
 * every feature, so boundaries bind by code and need no name folding. That is
 * why this is a separate, simpler artifact than the identity crosswalk rather
 * than a third axis on it.
 */
export interface TnBoundaryRecord {
  lgdGramPanchayatCode: string;
  lgdBlockCode: string;
  name: string;
  type: string;
  geometrySha256: string;
  areaHectares: number;
  bbox: [number, number, number, number];
  ringCount: number;
  vertexCount: number;
}

/**
 * Evidence of a permission actually granted. Without one, internal and
 * informational use is what the terms allow, and nothing may be published.
 */
export interface BoundaryRightsApproval {
  grantedBy: string;
  grantedAt: string;
  reference: string;
  scope: Array<"public-display" | "redistribution" | "derivatives" | "commercial-use">;
}

export interface TnDistrictBoundaryExtract {
  schemaVersion: number;
  planId: string;
  districtLgdCode: string;
  acquiredAt: string;
  source: {
    sourceId: string;
    layer: string;
    sourceUrl: string;
    retrievedAt: string;
    /**
     * TNGIS publishes an explicit restriction, not an absence of terms. Public
     * display, redistribution and commercial use each require prior approval
     * from TNGIS/TNeGA. A grant, if obtained, is recorded in `approval` with
     * its evidence; it is never assumed.
     */
    rights: {
      status: "permission-required";
      termsUrl: string;
      termsQuote: string;
      publicDisplay: "permission-required";
      redistribution: "permission-required";
      commercialUse: "permission-required";
      approval: BoundaryRightsApproval | null;
    };
    mappingYear: null;
  };
  snapshotSha256: string;
  recordsSha256: string;
  recordCount: number;
  records: TnBoundaryRecord[];
}

export interface BoundaryJoinReport {
  districtLgdCode: string;
  lgdGramPanchayats: number;
  boundaryRecords: number;
  joined: number;
  missingBoundary: string[];
  unmatchedBoundary: string[];
  blockMismatches: Array<{
    lgdGramPanchayatCode: string;
    lgdBlockCode: string;
    boundaryBlockCode: string;
  }>;
  duplicateGeometries: string[];
  areaCrossCheck: "not-assessed";
  areaCrossCheckReason: string;
  totalAreaHectares: number;
}

interface GeoJsonFeature {
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: unknown;
  } | null;
}

function countRingsAndVertices(coordinates: unknown): {
  ringCount: number;
  vertexCount: number;
} {
  let ringCount = 0;
  let vertexCount = 0;
  const walk = (node: unknown, depth: number): void => {
    if (!Array.isArray(node)) return;
    if (depth === 0) {
      ringCount += 1;
      vertexCount += node.length;
      return;
    }
    for (const child of node) walk(child, depth - 1);
  };
  // MultiPolygon nests polygon > ring > position; Polygon nests ring > position.
  walk(coordinates, 2);
  if (ringCount === 0) walk(coordinates, 1);
  return { ringCount, vertexCount };
}

export function buildTnDistrictBoundaryExtract(
  features: GeoJsonFeature[],
  options: {
    planId: string;
    districtLgdCode: string;
    acquiredAt: string;
    sourceUrl: string;
    snapshotSha256: string;
    area: (feature: unknown) => number;
    bbox: (feature: unknown) => number[];
  },
): TnDistrictBoundaryExtract {
  const records: TnBoundaryRecord[] = [];
  for (const feature of features) {
    if (!feature.geometry) {
      throw new Error(
        `Boundary feature ${String(feature.properties.village_lgd_code)} has no geometry`,
      );
    }
    const squareMetres = options.area(feature);
    const box = options.bbox(feature);
    const { ringCount, vertexCount } = countRingsAndVertices(
      feature.geometry.coordinates,
    );
    records.push({
      lgdGramPanchayatCode: String(feature.properties.village_lgd_code),
      lgdBlockCode: String(feature.properties.block_lgd_code),
      name: String(feature.properties.village_name ?? ""),
      type: String(feature.properties.type ?? ""),
      geometrySha256: createHash("sha256")
        .update(JSON.stringify(feature.geometry))
        .digest("hex"),
      areaHectares: Number((squareMetres / 10000).toFixed(4)),
      bbox: [
        Number(box[0].toFixed(6)),
        Number(box[1].toFixed(6)),
        Number(box[2].toFixed(6)),
        Number(box[3].toFixed(6)),
      ],
      ringCount,
      vertexCount,
    });
  }
  records.sort((left, right) =>
    left.lgdGramPanchayatCode.localeCompare(right.lgdGramPanchayatCode),
  );
  return {
    schemaVersion: BOUNDARY_EXTRACT_SCHEMA_VERSION,
    planId: options.planId,
    districtLgdCode: options.districtLgdCode,
    acquiredAt: options.acquiredAt,
    source: {
      sourceId: BOUNDARY_SOURCE_ID,
      layer: BOUNDARY_LAYER,
      sourceUrl: options.sourceUrl,
      retrievedAt: options.acquiredAt,
      rights: {
        status: "permission-required",
        termsUrl: TNGIS_TERMS_URL,
        termsQuote: TNGIS_TERMS_QUOTE,
        publicDisplay: "permission-required",
        redistribution: "permission-required",
        commercialUse: "permission-required",
        approval: null,
      },
      mappingYear: null,
    },
    snapshotSha256: options.snapshotSha256,
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    records,
  };
}

/**
 * Joins boundaries to the LGD hierarchy by code and reports both directions.
 * A boundary that no Gram Panchayat claims is as much a defect as a Gram
 * Panchayat with no boundary, so neither is allowed to pass silently.
 */
export function reportBoundaryJoin(
  boundary: TnDistrictBoundaryExtract,
  identity: DistrictIdentity,
): BoundaryJoinReport {
  const lgdByCode = identity.gramPanchayats;
  const boundaryByCode = new Map(
    boundary.records.map((record) => [record.lgdGramPanchayatCode, record]),
  );
  const blockMismatches: BoundaryJoinReport["blockMismatches"] = [];
  let joined = 0;
  for (const [code, record] of boundaryByCode) {
    const lgd = lgdByCode.get(code);
    if (!lgd) continue;
    joined += 1;
    if (lgd.blockCode !== record.lgdBlockCode) {
      blockMismatches.push({
        lgdGramPanchayatCode: code,
        lgdBlockCode: lgd.blockCode,
        boundaryBlockCode: record.lgdBlockCode,
      });
    }
  }
  const digests = new Map<string, number>();
  for (const record of boundary.records) {
    digests.set(
      record.geometrySha256,
      (digests.get(record.geometrySha256) ?? 0) + 1,
    );
  }
  return {
    districtLgdCode: boundary.districtLgdCode,
    lgdGramPanchayats: lgdByCode.size,
    boundaryRecords: boundary.records.length,
    joined,
    missingBoundary: [...lgdByCode.keys()]
      .filter((code) => !boundaryByCode.has(code))
      .sort(),
    unmatchedBoundary: [...boundaryByCode.keys()]
      .filter((code) => !lgdByCode.has(code))
      .sort(),
    blockMismatches,
    duplicateGeometries: [...digests.entries()]
      .filter(([, count]) => count > 1)
      .map(([digest]) => digest)
      .sort(),
    areaCrossCheck: "not-assessed",
    areaCrossCheckReason:
      "Census village areas are not in the tracked extract yet; the identity columns were extracted without the land-use block.",
    totalAreaHectares: Number(
      boundary.records
        .reduce((total, record) => total + record.areaHectares, 0)
        .toFixed(2),
    ),
  };
}

export function validateTnDistrictBoundaryExtract(
  boundary: TnDistrictBoundaryExtract,
  identity: DistrictIdentity,
): string[] {
  const errors: string[] = [];
  if (boundary.schemaVersion !== BOUNDARY_EXTRACT_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion: expected ${BOUNDARY_EXTRACT_SCHEMA_VERSION}, found ${boundary.schemaVersion}`,
    );
  }
  if (boundary.planId !== identity.planId) {
    errors.push(
      `planId: boundary ${boundary.planId} does not match district ${identity.planId}`,
    );
  }
  if (boundary.recordCount !== boundary.records.length) {
    errors.push(
      `recordCount: declared ${boundary.recordCount}, found ${boundary.records.length}`,
    );
  }
  if (boundary.recordsSha256 !== computeRecordsSha256(boundary.records)) {
    errors.push("recordsSha256: records do not match their digest");
  }
  const rights = boundary.source.rights;
  if (!rights || rights.status !== "permission-required") {
    errors.push(
      "source.rights.status: TNGIS requires prior approval for public display, " +
        "redistribution and commercial use; that restriction may not be downgraded",
    );
  } else {
    if (rights.termsUrl !== TNGIS_TERMS_URL) {
      errors.push(`source.rights.termsUrl: must cite ${TNGIS_TERMS_URL}`);
    }
    if (!rights.termsQuote.includes("prior approval")) {
      errors.push(
        "source.rights.termsQuote: must carry the published restriction verbatim",
      );
    }
    if (rights.approval !== null) {
      const approval = rights.approval;
      if (!approval.grantedBy || !approval.reference) {
        errors.push(
          "source.rights.approval: a grant needs a grantor and a written reference",
        );
      }
      if (!Array.isArray(approval.scope) || approval.scope.length === 0) {
        errors.push(
          "source.rights.approval: a grant must state what it permits",
        );
      }
    }
  }

  const seen = new Set<string>();
  for (const record of boundary.records) {
    if (seen.has(record.lgdGramPanchayatCode)) {
      errors.push(
        `records: Gram Panchayat ${record.lgdGramPanchayatCode} has more than one boundary`,
      );
    }
    seen.add(record.lgdGramPanchayatCode);
    if (!(record.areaHectares > 0)) {
      errors.push(
        `records[${record.lgdGramPanchayatCode}]: area must be positive`,
      );
    }
    if (record.ringCount < 1 || record.vertexCount < 4) {
      errors.push(
        `records[${record.lgdGramPanchayatCode}]: geometry is degenerate`,
      );
    }
  }
  if (errors.length > 0) return errors;

  const report = reportBoundaryJoin(boundary, identity);
  if (report.missingBoundary.length > 0) {
    errors.push(
      `join: ${report.missingBoundary.length} Gram Panchayats have no boundary ` +
        `(first: ${report.missingBoundary.slice(0, 3).join(", ")})`,
    );
  }
  if (report.unmatchedBoundary.length > 0) {
    errors.push(
      `join: ${report.unmatchedBoundary.length} boundaries match no Gram Panchayat ` +
        `(first: ${report.unmatchedBoundary.slice(0, 3).join(", ")})`,
    );
  }
  if (report.blockMismatches.length > 0) {
    errors.push(
      `join: ${report.blockMismatches.length} boundaries disagree with the LGD block`,
    );
  }
  if (report.duplicateGeometries.length > 0) {
    errors.push(
      `records: ${report.duplicateGeometries.length} geometries are byte-identical across Panchayats`,
    );
  }
  return errors;
}

export function loadTnDistrictBoundaryExtract(
  path: string,
  identity: DistrictIdentity,
): TnDistrictBoundaryExtract {
  const parsed = JSON.parse(
    readFileSync(path, "utf8"),
  ) as TnDistrictBoundaryExtract;
  const errors = validateTnDistrictBoundaryExtract(parsed, identity);
  if (errors.length > 0) {
    throw new Error(
      `Invalid district boundary extract ${path}:\n- ${errors.join("\n- ")}`,
    );
  }
  return parsed;
}
