/**
 * Gram Panchayat geometry from DataMeet's village boundaries, for districts
 * with no state GIS layer to read.
 *
 * DataMeet's indian_village_boundaries is a community digitisation of the
 * 2001 Census village map, published under ODbL and keyed on the 2001
 * census code (CEN_2001). Its own crosswalk table maps that to the 2011
 * village code, which is what the LGD carries (villageCensus2011Code), so a
 * Panchayat's polygon is the union of its LGD-listed member villages'
 * polygons: a MultiPolygon of the members, never a dissolved outline, so the
 * source parts stay auditable. Villages the register lists but DataMeet did
 * not draw are recorded as such, and a Panchayat none of whose villages has
 * a polygon carries no boundary rather than a guessed one.
 *
 * Rights: ODbL permits publication with attribution and share-alike on the
 * derived database, which is why these polygons can be served (unlike the
 * TNGIS layer). The licence and attribution ride on every record.
 */
import { createHash } from "node:crypto";

import { computeRecordsSha256 } from "./acquisition-validation";
import type { DistrictIdentity } from "./artifacts";
import { parseCsv } from "./lgd-district-acquisition";
import type { TnBoundaryRecord } from "./tn-boundary";

export const DATAMEET_BOUNDARY_SCHEMA_VERSION = 1;
export const DATAMEET_BOUNDARY_SOURCE_ID = "datameet-village-boundaries-mh";
export const DATAMEET_LICENSE = "ODbL 1.0";
export const DATAMEET_ATTRIBUTION =
  "DataMeet, indian_village_boundaries (github.com/datameet/indian_village_boundaries), ODbL 1.0";
export const DATAMEET_TERMS_URL =
  "https://github.com/datameet/indian_village_boundaries/blob/master/LICENSE";

export interface DataMeetVillageFeature {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
}

export interface DataMeetCrosswalkRow {
  cen2001: string;
  villageCode2011: string;
  villageName2011: string;
  subdistrictCode2011: string;
}

/** The district's rows of mh.csv, keyed on CEN_2001. */
export function parseDataMeetCrosswalk(
  csvText: string,
  districtCode2011: string,
): Map<string, DataMeetCrosswalkRow> {
  const rows = parseCsv(csvText);
  const header = rows[0]?.map((cell) => cell.replace(/"/g, "").trim()) ?? [];
  const column = (name: string): number => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`DataMeet crosswalk has no ${name} column`);
    return index;
  };
  const cen2001 = column("CEN_2001");
  const code2011 = column("village_code_2011");
  const name2011 = column("village_name_2011");
  const district2011 = column("district_code_2011");
  const subdistrict2011 = column("sub_district_code_2011");
  const out = new Map<string, DataMeetCrosswalkRow>();
  for (const cells of rows.slice(1)) {
    if ((cells[district2011] ?? "").trim() !== districtCode2011) continue;
    const key = (cells[cen2001] ?? "").trim();
    if (!key) continue;
    out.set(key, {
      cen2001: key,
      villageCode2011: (cells[code2011] ?? "").trim(),
      villageName2011: (cells[name2011] ?? "").trim(),
      subdistrictCode2011: (cells[subdistrict2011] ?? "").trim(),
    });
  }
  return out;
}

/** The features of one district, by the DISTRICT property. */
export function sliceDataMeetDistrict(
  features: DataMeetVillageFeature[],
  districtName: string,
): DataMeetVillageFeature[] {
  const wanted = districtName.trim().toLowerCase();
  return features.filter(
    (feature) => String(feature.properties.DISTRICT ?? "").trim().toLowerCase() === wanted,
  );
}

type Polygon = number[][][];

function polygonsOf(geometry: { type: string; coordinates: unknown } | null): Polygon[] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates as Polygon];
  if (geometry.type === "MultiPolygon") return geometry.coordinates as Polygon[];
  return [];
}

export interface PanchayatMembers {
  lgdGramPanchayatCode: string;
  name: string;
  lgdBlockCode: string;
  /** Census 2011 codes of the villages the LGD lists under the Panchayat. */
  memberCensusCodes: string[];
}

export interface PanchayatGeometry {
  lgdGramPanchayatCode: string;
  geometry: { type: "MultiPolygon"; coordinates: Polygon[] };
  memberVillagesDrawn: string[];
  memberVillagesNotDrawn: string[];
}

/**
 * Village polygons keyed on the 2011 code (a code may own several parts: a
 * 2011 village that was two 2001 villages, or an exclave), then one
 * MultiPolygon per Panchayat over its drawn members.
 */
export function buildPanchayatGeometries(options: {
  features: DataMeetVillageFeature[];
  crosswalk: Map<string, DataMeetCrosswalkRow>;
  panchayats: PanchayatMembers[];
}): { geometries: Map<string, PanchayatGeometry>; villagePolygons: number; unmatchedFeatures: number } {
  const byCensusCode = new Map<string, Polygon[]>();
  let unmatched = 0;
  for (const feature of options.features) {
    const row = options.crosswalk.get(String(feature.properties.CEN_2001 ?? "").trim());
    if (!row || !row.villageCode2011) {
      unmatched += 1;
      continue;
    }
    const parts = polygonsOf(feature.geometry);
    if (parts.length === 0) continue;
    const bucket = byCensusCode.get(row.villageCode2011) ?? [];
    bucket.push(...parts);
    byCensusCode.set(row.villageCode2011, bucket);
  }
  const geometries = new Map<string, PanchayatGeometry>();
  for (const panchayat of options.panchayats) {
    const drawn: string[] = [];
    const notDrawn: string[] = [];
    const coordinates: Polygon[] = [];
    for (const code of [...panchayat.memberCensusCodes].sort()) {
      const parts = byCensusCode.get(code);
      if (!parts) {
        notDrawn.push(code);
        continue;
      }
      drawn.push(code);
      coordinates.push(...parts);
    }
    if (coordinates.length === 0) continue;
    geometries.set(panchayat.lgdGramPanchayatCode, {
      lgdGramPanchayatCode: panchayat.lgdGramPanchayatCode,
      geometry: { type: "MultiPolygon", coordinates },
      memberVillagesDrawn: drawn,
      memberVillagesNotDrawn: notDrawn,
    });
  }
  return { geometries, villagePolygons: byCensusCode.size, unmatchedFeatures: unmatched };
}

export interface DataMeetBoundaryRecord extends TnBoundaryRecord {
  memberVillagesDrawn: string[];
  memberVillagesNotDrawn: string[];
}

export interface DataMeetBoundaryExtract {
  schemaVersion: number;
  planId: string;
  districtLgdCode: string;
  acquiredAt: string;
  source: {
    sourceId: string;
    layer: string;
    sourceUrl: string;
    crosswalkUrl: string;
    retrievedAt: string;
    rights: {
      status: "share-alike";
      license: string;
      attribution: string;
      termsUrl: string;
      publicDisplay: "permitted-with-attribution";
      redistribution: "permitted-share-alike";
      commercialUse: "permitted-share-alike";
    };
    /** DataMeet digitised the 2001 map; the polygons are that vintage. */
    mappingYear: "2001";
  };
  snapshotSha256: string;
  recordsSha256: string;
  recordCount: number;
  /** Panchayats the register lists that no member polygon was drawn for. */
  panchayatsWithoutGeometry: string[];
  records: DataMeetBoundaryRecord[];
}

function countRingsAndVertices(coordinates: Polygon[]): { ringCount: number; vertexCount: number } {
  let ringCount = 0;
  let vertexCount = 0;
  for (const polygon of coordinates) {
    for (const ring of polygon) {
      ringCount += 1;
      vertexCount += ring.length;
    }
  }
  return { ringCount, vertexCount };
}

export function buildDataMeetBoundaryExtract(options: {
  planId: string;
  districtLgdCode: string;
  acquiredAt: string;
  sourceUrl: string;
  crosswalkUrl: string;
  snapshotSha256: string;
  geometries: Map<string, PanchayatGeometry>;
  panchayats: PanchayatMembers[];
  area: (feature: unknown) => number;
  bbox: (feature: unknown) => number[];
}): DataMeetBoundaryExtract {
  const byCode = new Map(options.panchayats.map((panchayat) => [panchayat.lgdGramPanchayatCode, panchayat]));
  const records: DataMeetBoundaryRecord[] = [];
  const without: string[] = [];
  for (const panchayat of options.panchayats) {
    const entry = options.geometries.get(panchayat.lgdGramPanchayatCode);
    if (!entry) {
      without.push(panchayat.lgdGramPanchayatCode);
      continue;
    }
    const feature = { type: "Feature", properties: {}, geometry: entry.geometry };
    const squareMetres = options.area(feature);
    const box = options.bbox(feature);
    const { ringCount, vertexCount } = countRingsAndVertices(entry.geometry.coordinates);
    const owner = byCode.get(panchayat.lgdGramPanchayatCode)!;
    records.push({
      lgdGramPanchayatCode: owner.lgdGramPanchayatCode,
      lgdBlockCode: owner.lgdBlockCode,
      name: owner.name,
      type: "Village Panchayat (union of DataMeet village polygons)",
      geometrySha256: createHash("sha256").update(JSON.stringify(entry.geometry)).digest("hex"),
      areaHectares: Number((squareMetres / 10000).toFixed(4)),
      bbox: [
        Number(box[0].toFixed(6)),
        Number(box[1].toFixed(6)),
        Number(box[2].toFixed(6)),
        Number(box[3].toFixed(6)),
      ],
      ringCount,
      vertexCount,
      memberVillagesDrawn: entry.memberVillagesDrawn,
      memberVillagesNotDrawn: entry.memberVillagesNotDrawn,
    });
  }
  records.sort((left, right) => left.lgdGramPanchayatCode.localeCompare(right.lgdGramPanchayatCode));
  without.sort();
  return {
    schemaVersion: DATAMEET_BOUNDARY_SCHEMA_VERSION,
    planId: options.planId,
    districtLgdCode: options.districtLgdCode,
    acquiredAt: options.acquiredAt,
    source: {
      sourceId: DATAMEET_BOUNDARY_SOURCE_ID,
      layer: "datameet/indian_village_boundaries mh2.geojson",
      sourceUrl: options.sourceUrl,
      crosswalkUrl: options.crosswalkUrl,
      retrievedAt: options.acquiredAt,
      rights: {
        status: "share-alike",
        license: DATAMEET_LICENSE,
        attribution: DATAMEET_ATTRIBUTION,
        termsUrl: DATAMEET_TERMS_URL,
        publicDisplay: "permitted-with-attribution",
        redistribution: "permitted-share-alike",
        commercialUse: "permitted-share-alike",
      },
      mappingYear: "2001",
    },
    snapshotSha256: options.snapshotSha256,
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    panchayatsWithoutGeometry: without,
    records,
  };
}

/**
 * A boundary that no Panchayat claims is a defect; a Panchayat with no
 * boundary is a named gap (DataMeet did not draw every village), so it is
 * reported, not rejected.
 */
export function validateDataMeetBoundaryExtract(
  boundary: DataMeetBoundaryExtract,
  identity: DistrictIdentity,
): string[] {
  const errors: string[] = [];
  if (boundary.schemaVersion !== DATAMEET_BOUNDARY_SCHEMA_VERSION) {
    errors.push(`schemaVersion: expected ${DATAMEET_BOUNDARY_SCHEMA_VERSION}, found ${boundary.schemaVersion}`);
  }
  if (boundary.planId !== identity.planId) {
    errors.push(`planId: boundary ${boundary.planId} does not match district ${identity.planId}`);
  }
  if (boundary.recordCount !== boundary.records.length) {
    errors.push(`recordCount: declared ${boundary.recordCount}, found ${boundary.records.length}`);
  }
  if (boundary.recordsSha256 !== computeRecordsSha256(boundary.records)) {
    errors.push("recordsSha256: records do not match their digest");
  }
  const rights = boundary.source.rights;
  if (rights?.status !== "share-alike" || rights.license !== DATAMEET_LICENSE) {
    errors.push(`source.rights: DataMeet polygons are ${DATAMEET_LICENSE}, share-alike; the record may not say otherwise`);
  }
  if (!rights?.attribution?.includes("DataMeet")) {
    errors.push("source.rights.attribution: must credit DataMeet");
  }
  const seen = new Set<string>();
  for (const record of boundary.records) {
    if (seen.has(record.lgdGramPanchayatCode)) {
      errors.push(`records: Gram Panchayat ${record.lgdGramPanchayatCode} has more than one boundary`);
    }
    seen.add(record.lgdGramPanchayatCode);
    if (!(record.areaHectares > 0)) errors.push(`records[${record.lgdGramPanchayatCode}]: area must be positive`);
    if (record.ringCount < 1 || record.vertexCount < 4) {
      errors.push(`records[${record.lgdGramPanchayatCode}]: geometry is degenerate`);
    }
    const known = identity.gramPanchayats.get(record.lgdGramPanchayatCode);
    if (!known) {
      errors.push(`join: boundary ${record.lgdGramPanchayatCode} matches no Gram Panchayat`);
    } else if (known.blockCode !== record.lgdBlockCode) {
      errors.push(`join: boundary ${record.lgdGramPanchayatCode} disagrees with the LGD block`);
    }
    if (record.memberVillagesDrawn.length === 0) {
      errors.push(`records[${record.lgdGramPanchayatCode}]: a boundary with no drawn member village`);
    }
  }
  for (const code of boundary.panchayatsWithoutGeometry) {
    if (seen.has(code)) errors.push(`panchayatsWithoutGeometry: ${code} also has a boundary`);
    if (!identity.gramPanchayats.has(code)) {
      errors.push(`panchayatsWithoutGeometry: ${code} is not a Gram Panchayat`);
    }
  }
  if (seen.size + boundary.panchayatsWithoutGeometry.length !== identity.gramPanchayats.size) {
    errors.push(
      `coverage: ${seen.size + boundary.panchayatsWithoutGeometry.length} Panchayats accounted for, ` +
        `expected ${identity.gramPanchayats.size}`,
    );
  }
  return errors;
}
