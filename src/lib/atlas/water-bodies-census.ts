import { createHash } from "node:crypto";

import { computeRecordsSha256, isRecord } from "./acquisition-validation";
import type { DistrictDirectoryArtifact, DistrictIdentity } from "./artifacts";
import type { TnWaterBodyRecord } from "./tn-water-bodies";

/**
 * The First Census of Water Bodies (Ministry of Jal Shakti, reference years
 * 2017-18 to 2020-21, published 2023) as republished per state on
 * data.gov.in under the Government Open Data License. It is the water-body
 * register for districts whose state has no open GIS layer of the TNGIS
 * kind, and it differs from TNGIS in three ways the shapes below carry:
 *
 *   - a row is a water body located in a VILLAGE, not in a Panchayat. The
 *     census `unique_id` embeds the Census 2011 village code, and the LGD
 *     coverage register in the directory says which Panchayat covers that
 *     village. A village under exactly one Panchayat is assigned; a village
 *     the register lists under two, or under none, is counted and never
 *     pooled into a Panchayat by guesswork;
 *   - the licence is open, so the point coordinates the enumerators
 *     recorded are served as geometry rather than withheld;
 *   - the attributes are what an enumerator entered, not what a polygon
 *     measures. A state return can carry template values on every row
 *     (Satara, 2026-09: the same four year/cost/beneficiary combinations on
 *     3,756 rows, waterspread only ever 4, 5, 6 or 8 ha), so the reviewed
 *     plan says whether waterspread is usable and the producer checks the
 *     return against that judgement before it publishes an area.
 */
export const WATER_BODIES_CENSUS_SCHEMA_VERSION = 1;
export const WATER_BODIES_CENSUS_REGISTER = "water-bodies-census" as const;
export const WATER_BODIES_CENSUS_LICENSE = "Government Open Data License - India";

/** Below this many distinct waterspread values over at least this many rows,
 *  a return is read as templated rather than measured. */
export const TEMPLATED_DISTINCT_AREA_MAX = 10;
export const TEMPLATED_MIN_ROWS = 500;

export type WaterspreadBasis = "stated" | "withheld";

export interface WaterBodiesCensusRow {
  uniqueId: string;
  ruralOrUrban: "Rural" | "Urban";
  districtName: string;
  blockName: string;
  villageName: string;
  townName: string;
  /** From `unique_id`: the LGD sub-district code (leading zeros dropped, as
   *  the directory's block codes carry it) and the Census 2011 village code. */
  subdistrictCode: string;
  censusVillageCode: string;
  name: string | null;
  type: string;
  ownership: string;
  nature: string;
  inUse: boolean | null;
  encroached: boolean | null;
  waterSpreadAreaHectares: number | null;
  constructionYear: number | null;
  constructionCost: number | null;
  latitude: number | null;
  longitude: number | null;
}

export type WaterBodyAssignmentKind =
  | "panchayat"
  | "shared-village"
  | "uncovered-village"
  | "census-village-without-lgd-row"
  | "unknown-village"
  | "urban";

export interface UnassignedCounts {
  sharedVillage: number;
  uncoveredVillage: number;
  censusVillageWithoutLgdRow: number;
  unknownVillage: number;
  urban: number;
}

export interface CensusWaterBodyRecord extends TnWaterBodyRecord {
  register: typeof WATER_BODIES_CENSUS_REGISTER;
  lgdBlockCode: string;
  byType: Array<{ type: string; count: number }>;
  areaBasis: WaterspreadBasis;
  /** Rows with a coordinate inside the district's own bounding box; the
   *  MultiPoint geometry holds exactly these. */
  pointCount: number;
  /** [longitude, latitude] pairs, five decimals, sorted. */
  points: Array<[number, number]>;
}

export interface AttributeDiagnostic {
  ruralRows: number;
  distinctWaterspreadValues: number;
  distinctConstructionYears: number;
  distinctConstructionCosts: number;
  waterspreadStatedRows: number;
}

export interface WaterBodiesCensusExtract {
  schemaVersion: number;
  planId: string;
  districtLgdCode: string;
  acquiredAt: string;
  source: {
    sourceId: string;
    resourceId: string;
    /** The export query without the portal's key. */
    sourceUrl: string;
    catalogUrl: string;
    districtName: string;
    retrievedAt: string;
    /** The portal's own edition stamp for the resource. */
    resourceUpdatedOn: string;
    rights: { status: "open"; license: string; termsUrl: string };
  };
  snapshotSha256: string;
  rowCount: number;
  ruralRowCount: number;
  urbanRowCount: number;
  attributes: { waterspread: WaterspreadBasis; note: string; diagnostic: AttributeDiagnostic };
  districtBbox: [number, number, number, number] | null;
  pointsOutsideDistrict: number;
  unassigned: UnassignedCounts;
  unassignedByBlock: Record<string, UnassignedCounts>;
  contributingOwners: string[];
  types: Array<{ type: string; count: number }>;
  recordsSha256: string;
  recordCount: number;
  featureCount: number;
  records: CensusWaterBodyRecord[];
}

/* ── rows ──────────────────────────────────────────────────────────────── */

const NOT_STATED = new Set(["", "NA", "N/A", "-", "NIL", "NULL"]);

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function stated(value: unknown): string | null {
  const s = text(value);
  return NOT_STATED.has(s.toUpperCase()) ? null : s;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = stated(value);
  if (s === null) return null;
  const parsed = Number(s);
  return Number.isFinite(parsed) ? parsed : null;
}

function yesNo(value: unknown): boolean | null {
  const s = stated(value)?.toLowerCase();
  if (s === "yes") return true;
  if (s === "no") return false;
  return null;
}

/** One API record to a row, or the reason it is not one. */
export function parseWaterBodiesCensusRow(raw: unknown): { row: WaterBodiesCensusRow } | { error: string } {
  if (!isRecord(raw)) return { error: "record is not an object" };
  const uniqueId = text(raw.unique_id);
  const parts = uniqueId.split("/");
  if (parts.length !== 6 || parts.some((part) => part.length === 0)) {
    return { error: `unique_id ${JSON.stringify(uniqueId)} does not have six parts` };
  }
  const ruralOrUrban = text(raw.rural_or_urban);
  if (ruralOrUrban !== "Rural" && ruralOrUrban !== "Urban") {
    return { error: `${uniqueId}: rural_or_urban ${JSON.stringify(ruralOrUrban)} is neither Rural nor Urban` };
  }
  const type = text(raw.ref_water_body_type_id_name);
  if (type.length === 0) return { error: `${uniqueId}: no water-body type` };
  return {
    row: {
      uniqueId,
      ruralOrUrban,
      districtName: text(raw.district_name),
      blockName: text(raw.block_tehsil_name),
      villageName: text(raw.village_name),
      townName: text(raw.town_municipalty_name),
      subdistrictCode: parts[3].replace(/^0+/, "") || "0",
      censusVillageCode: parts[4],
      name: stated(raw.water_body_name),
      type,
      ownership: stated(raw.water_body_ownership_name) ?? "unstated",
      nature: stated(raw.water_body_nature_name) ?? "unstated",
      inUse: yesNo(raw.ref_water_body_in_use_id_name),
      encroached: yesNo(raw.ref_selection_id_water_body_encroached_name),
      waterSpreadAreaHectares: numberOrNull(raw.water_spread_area_of_water_body),
      constructionYear: numberOrNull(raw.construcion_year),
      constructionCost: numberOrNull(raw.construction_cost),
      latitude: numberOrNull(raw.latitude_dec),
      longitude: numberOrNull(raw.longitude_dec),
    },
  };
}

export function parseWaterBodiesCensusRows(records: unknown[]): WaterBodiesCensusRow[] {
  const rows: WaterBodiesCensusRow[] = [];
  const errors: string[] = [];
  for (const record of records) {
    const parsed = parseWaterBodiesCensusRow(record);
    if ("error" in parsed) errors.push(parsed.error);
    else rows.push(parsed.row);
  }
  if (errors.length > 0) {
    throw new Error(
      `${errors.length} census rows could not be read (first: ${errors.slice(0, 3).join("; ")})`,
    );
  }
  return rows;
}

/* ── membership ────────────────────────────────────────────────────────── */

export interface VillageMembership {
  /** Census 2011 village code to the Panchayats whose LGD coverage lists it. */
  panchayatsByVillage: Map<string, Set<string>>;
  blockByPanchayat: Map<string, string>;
  uncovered: Set<string>;
  withoutLgdRow: Set<string>;
  /** Union of the served Panchayat bounding boxes, padded; null when the
   *  directory carries no boundary at all. */
  districtBbox: [number, number, number, number] | null;
}

const BBOX_PADDING_DEGREES = 0.05;

export function buildVillageMembership(directory: DistrictDirectoryArtifact): VillageMembership {
  const panchayatsByVillage = new Map<string, Set<string>>();
  const blockByPanchayat = new Map<string, string>();
  let bbox: [number, number, number, number] | null = null;
  for (const panchayat of directory.panchayats) {
    blockByPanchayat.set(panchayat.lgdCode, panchayat.blockCode);
    for (const village of panchayat.lgdCoverage?.villages ?? []) {
      if (!/^[0-9]{6}$/.test(village.census2011Code) || village.census2011Code === "000000") continue;
      const set = panchayatsByVillage.get(village.census2011Code) ?? new Set<string>();
      set.add(panchayat.lgdCode);
      panchayatsByVillage.set(village.census2011Code, set);
    }
    const b = panchayat.boundary?.bbox;
    if (b) {
      bbox = bbox
        ? [Math.min(bbox[0], b[0]), Math.min(bbox[1], b[1]), Math.max(bbox[2], b[2]), Math.max(bbox[3], b[3])]
        : [b[0], b[1], b[2], b[3]];
    }
  }
  return {
    panchayatsByVillage,
    blockByPanchayat,
    uncovered: new Set((directory.uncoveredVillages ?? []).map((village) => village.census2011Code)),
    withoutLgdRow: new Set((directory.censusVillagesWithoutLgdRow ?? []).map((village) => village.villageCode)),
    districtBbox: bbox
      ? [
          Number((bbox[0] - BBOX_PADDING_DEGREES).toFixed(4)),
          Number((bbox[1] - BBOX_PADDING_DEGREES).toFixed(4)),
          Number((bbox[2] + BBOX_PADDING_DEGREES).toFixed(4)),
          Number((bbox[3] + BBOX_PADDING_DEGREES).toFixed(4)),
        ]
      : null,
  };
}

export function assignRow(
  row: WaterBodiesCensusRow,
  membership: VillageMembership,
): { kind: WaterBodyAssignmentKind; lgdGramPanchayatCode?: string; blockCode?: string } {
  if (row.ruralOrUrban === "Urban") return { kind: "urban" };
  const panchayats = membership.panchayatsByVillage.get(row.censusVillageCode);
  if (panchayats && panchayats.size === 1) {
    const code = [...panchayats][0];
    return { kind: "panchayat", lgdGramPanchayatCode: code, blockCode: membership.blockByPanchayat.get(code) };
  }
  if (panchayats && panchayats.size > 1) return { kind: "shared-village", blockCode: row.subdistrictCode };
  if (membership.uncovered.has(row.censusVillageCode)) {
    return { kind: "uncovered-village", blockCode: row.subdistrictCode };
  }
  if (membership.withoutLgdRow.has(row.censusVillageCode)) {
    return { kind: "census-village-without-lgd-row", blockCode: row.subdistrictCode };
  }
  return { kind: "unknown-village", blockCode: row.subdistrictCode };
}

/* ── attributes ────────────────────────────────────────────────────────── */

export function diagnoseAttributes(rows: WaterBodiesCensusRow[]): AttributeDiagnostic {
  const rural = rows.filter((row) => row.ruralOrUrban === "Rural");
  const distinct = (pick: (row: WaterBodiesCensusRow) => number | null): number =>
    new Set(rural.map(pick).filter((value): value is number => value !== null)).size;
  return {
    ruralRows: rural.length,
    distinctWaterspreadValues: distinct((row) => row.waterSpreadAreaHectares),
    distinctConstructionYears: distinct((row) => row.constructionYear),
    distinctConstructionCosts: distinct((row) => row.constructionCost),
    waterspreadStatedRows: rural.filter((row) => row.waterSpreadAreaHectares !== null).length,
  };
}

/** True when the return's waterspread column reads as a template rather
 *  than a measurement: a handful of values over hundreds of rows. */
export function looksTemplated(diagnostic: AttributeDiagnostic): boolean {
  return (
    diagnostic.ruralRows >= TEMPLATED_MIN_ROWS &&
    diagnostic.waterspreadStatedRows > 0 &&
    diagnostic.distinctWaterspreadValues <= TEMPLATED_DISTINCT_AREA_MAX
  );
}

/* ── the extract ───────────────────────────────────────────────────────── */

function emptyUnassigned(): UnassignedCounts {
  return { sharedVillage: 0, uncoveredVillage: 0, censusVillageWithoutLgdRow: 0, unknownVillage: 0, urban: 0 };
}

const UNASSIGNED_KEY: Record<Exclude<WaterBodyAssignmentKind, "panchayat">, keyof UnassignedCounts> = {
  "shared-village": "sharedVillage",
  "uncovered-village": "uncoveredVillage",
  "census-village-without-lgd-row": "censusVillageWithoutLgdRow",
  "unknown-village": "unknownVillage",
  urban: "urban",
};

function sortedCounts<K extends string>(
  map: Map<string, number>,
  key: K,
): Array<Record<K, string> & { count: number }> {
  return [...map.entries()]
    .map(([label, count]) => ({ [key]: label, count }) as Record<K, string> & { count: number })
    .sort((left, right) => right.count - left.count || left[key].localeCompare(right[key]));
}

function round5(value: number): number {
  return Number(value.toFixed(5));
}

function inBbox(bbox: [number, number, number, number] | null, lon: number, lat: number): boolean {
  if (!bbox) return true;
  return lon >= bbox[0] && lat >= bbox[1] && lon <= bbox[2] && lat <= bbox[3];
}

export function buildWaterBodiesCensusExtract(
  rows: WaterBodiesCensusRow[],
  directory: DistrictDirectoryArtifact,
  options: {
    planId: string;
    districtLgdCode: string;
    acquiredAt: string;
    sourceId: string;
    resourceId: string;
    sourceUrl: string;
    catalogUrl: string;
    districtName: string;
    resourceUpdatedOn: string;
    snapshotSha256: string;
    /** The reviewed plan's judgement of the waterspread column. */
    waterspread: WaterspreadBasis;
    waterspreadNote: string;
  },
): WaterBodiesCensusExtract {
  const diagnostic = diagnoseAttributes(rows);
  if (options.waterspread === "stated" && looksTemplated(diagnostic)) {
    throw new Error(
      `the return states only ${diagnostic.distinctWaterspreadValues} distinct waterspread values over ` +
        `${diagnostic.ruralRows} rural rows; the plan calls the column stated, and that needs a review before an area is published`,
    );
  }
  const withheld = options.waterspread === "withheld";
  const membership = buildVillageMembership(directory);

  interface Bucket {
    blockCode: string;
    count: number;
    names: string[];
    area: number;
    largest: number;
    owners: Map<string, number>;
    types: Map<string, number>;
    points: Array<[number, number]>;
  }
  const buckets = new Map<string, Bucket>();
  const unassigned = emptyUnassigned();
  const unassignedByBlock = new Map<string, UnassignedCounts>();
  const owners = new Map<string, number>();
  const types = new Map<string, number>();
  let pointsOutside = 0;
  let rural = 0;

  for (const row of rows) {
    if (row.ruralOrUrban === "Rural") rural += 1;
    const assignment = assignRow(row, membership);
    if (assignment.kind !== "panchayat") {
      unassigned[UNASSIGNED_KEY[assignment.kind]] += 1;
      if (assignment.blockCode) {
        const block = unassignedByBlock.get(assignment.blockCode) ?? emptyUnassigned();
        block[UNASSIGNED_KEY[assignment.kind]] += 1;
        unassignedByBlock.set(assignment.blockCode, block);
      }
      continue;
    }
    const code = assignment.lgdGramPanchayatCode!;
    const blockCode = assignment.blockCode;
    if (!blockCode) throw new Error(`Gram Panchayat ${code} has no block in the directory`);
    const bucket = buckets.get(code) ?? {
      blockCode,
      count: 0,
      names: [],
      area: 0,
      largest: 0,
      owners: new Map<string, number>(),
      types: new Map<string, number>(),
      points: [],
    };
    bucket.count += 1;
    if (row.name) bucket.names.push(row.name);
    if (!withheld && row.waterSpreadAreaHectares !== null) {
      bucket.area += row.waterSpreadAreaHectares;
      bucket.largest = Math.max(bucket.largest, row.waterSpreadAreaHectares);
    }
    bucket.owners.set(row.ownership, (bucket.owners.get(row.ownership) ?? 0) + 1);
    bucket.types.set(row.type, (bucket.types.get(row.type) ?? 0) + 1);
    owners.set(row.ownership, (owners.get(row.ownership) ?? 0) + 1);
    types.set(row.type, (types.get(row.type) ?? 0) + 1);
    if (row.latitude !== null && row.longitude !== null) {
      if (inBbox(membership.districtBbox, row.longitude, row.latitude)) {
        bucket.points.push([round5(row.longitude), round5(row.latitude)]);
      } else {
        pointsOutside += 1;
      }
    }
    buckets.set(code, bucket);
  }

  const records: CensusWaterBodyRecord[] = [...buckets.entries()]
    .map(([code, bucket]) => ({
      lgdGramPanchayatCode: code,
      count: bucket.count,
      namedCount: bucket.names.length,
      areaHectares: Number(bucket.area.toFixed(4)),
      largestAreaHectares: Number(bucket.largest.toFixed(4)),
      byDepartment: sortedCounts(bucket.owners, "department"),
      namesSha256: createHash("sha256").update(JSON.stringify([...bucket.names].sort())).digest("hex"),
      register: WATER_BODIES_CENSUS_REGISTER,
      lgdBlockCode: bucket.blockCode,
      byType: sortedCounts(bucket.types, "type"),
      areaBasis: options.waterspread,
      pointCount: bucket.points.length,
      points: bucket.points.sort((left, right) => left[0] - right[0] || left[1] - right[1]),
    }))
    .sort((left, right) => left.lgdGramPanchayatCode.localeCompare(right.lgdGramPanchayatCode));

  const featureCount = records.reduce((total, record) => total + record.count, 0);
  return {
    schemaVersion: WATER_BODIES_CENSUS_SCHEMA_VERSION,
    planId: options.planId,
    districtLgdCode: options.districtLgdCode,
    acquiredAt: options.acquiredAt,
    source: {
      sourceId: options.sourceId,
      resourceId: options.resourceId,
      sourceUrl: options.sourceUrl,
      catalogUrl: options.catalogUrl,
      districtName: options.districtName,
      retrievedAt: options.acquiredAt,
      resourceUpdatedOn: options.resourceUpdatedOn,
      rights: { status: "open", license: WATER_BODIES_CENSUS_LICENSE, termsUrl: options.catalogUrl },
    },
    snapshotSha256: options.snapshotSha256,
    rowCount: rows.length,
    ruralRowCount: rural,
    urbanRowCount: rows.length - rural,
    attributes: { waterspread: options.waterspread, note: options.waterspreadNote, diagnostic },
    districtBbox: membership.districtBbox,
    pointsOutsideDistrict: pointsOutside,
    unassigned,
    unassignedByBlock: Object.fromEntries([...unassignedByBlock.entries()].sort()),
    contributingOwners: [...owners.keys()].sort(),
    types: sortedCounts(types, "type"),
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    featureCount,
    records,
  };
}

export interface WaterBodiesCensusJoinReport {
  lgdGramPanchayats: number;
  panchayatsWithWaterBodies: number;
  panchayatsWithout: string[];
  unmatchedPanchayatCodes: string[];
  assignedRows: number;
  unassignedRows: number;
  pointsServed: number;
}

export function reportWaterBodiesCensusJoin(
  extract: WaterBodiesCensusExtract,
  identity: DistrictIdentity,
): WaterBodiesCensusJoinReport {
  const codes = new Set(identity.gramPanchayats.keys());
  const held = new Set(extract.records.map((record) => record.lgdGramPanchayatCode));
  const unassigned = Object.values(extract.unassigned).reduce((total, count) => total + count, 0);
  return {
    lgdGramPanchayats: codes.size,
    panchayatsWithWaterBodies: [...held].filter((code) => codes.has(code)).length,
    panchayatsWithout: [...codes].filter((code) => !held.has(code)).sort(),
    unmatchedPanchayatCodes: [...held].filter((code) => !codes.has(code)).sort(),
    assignedRows: extract.featureCount,
    unassignedRows: unassigned,
    pointsServed: extract.records.reduce((total, record) => total + record.pointCount, 0),
  };
}

export function validateWaterBodiesCensusExtract(
  extract: WaterBodiesCensusExtract,
  identity: DistrictIdentity,
): string[] {
  const errors: string[] = [];
  if (extract.schemaVersion !== WATER_BODIES_CENSUS_SCHEMA_VERSION) {
    errors.push(`schemaVersion: expected ${WATER_BODIES_CENSUS_SCHEMA_VERSION}, found ${extract.schemaVersion}`);
  }
  if (extract.planId !== identity.planId) {
    errors.push(`planId: extract ${extract.planId} does not match district ${identity.planId}`);
  }
  if (extract.source.rights.status !== "open" || extract.source.rights.license !== WATER_BODIES_CENSUS_LICENSE) {
    errors.push("source.rights: the census is republished under the Government Open Data License; anything else is a different source");
  }
  if (/api-key=/.test(extract.source.sourceUrl)) {
    errors.push("source.sourceUrl: carries an API key; the served url must not");
  }
  if (extract.recordCount !== extract.records.length) {
    errors.push(`recordCount: declared ${extract.recordCount}, found ${extract.records.length}`);
  }
  if (extract.recordsSha256 !== computeRecordsSha256(extract.records)) {
    errors.push("recordsSha256: records do not match their digest");
  }
  if (extract.ruralRowCount + extract.urbanRowCount !== extract.rowCount) {
    errors.push("rowCount: rural and urban rows do not add up");
  }
  const unassigned = Object.values(extract.unassigned).reduce((total, count) => total + count, 0);
  if (extract.featureCount + unassigned !== extract.rowCount) {
    errors.push(
      `rowCount: ${extract.rowCount} rows, but ${extract.featureCount} assigned and ${unassigned} unassigned`,
    );
  }
  if (extract.attributes.waterspread === "stated" && looksTemplated(extract.attributes.diagnostic)) {
    errors.push("attributes.waterspread: stated, but the return's diagnostic reads as templated");
  }
  const seen = new Set<string>();
  let tally = 0;
  for (const record of extract.records) {
    const label = record.lgdGramPanchayatCode;
    if (seen.has(label)) errors.push(`records: Gram Panchayat ${label} appears more than once`);
    seen.add(label);
    if (record.register !== WATER_BODIES_CENSUS_REGISTER) errors.push(`records[${label}]: not a census record`);
    if (!(record.count > 0)) errors.push(`records[${label}]: a record with no water body is not a record`);
    if (record.namedCount > record.count) errors.push(`records[${label}]: more names than water bodies`);
    if (record.pointCount !== record.points.length) {
      errors.push(`records[${label}]: pointCount ${record.pointCount} but ${record.points.length} points`);
    }
    if (record.pointCount > record.count) errors.push(`records[${label}]: more points than water bodies`);
    if (record.areaBasis !== extract.attributes.waterspread) {
      errors.push(`records[${label}]: areaBasis disagrees with the extract`);
    }
    if (record.areaBasis === "withheld" && (record.areaHectares !== 0 || record.largestAreaHectares !== 0)) {
      errors.push(`records[${label}]: waterspread is withheld but an area is stated`);
    }
    if (record.largestAreaHectares > record.areaHectares + 0.0001) {
      errors.push(`records[${label}]: largest water body exceeds the summed waterspread`);
    }
    const ownerTotal = record.byDepartment.reduce((total, entry) => total + entry.count, 0);
    if (ownerTotal !== record.count) {
      errors.push(`records[${label}]: ownership counts total ${ownerTotal}, expected ${record.count}`);
    }
    const typeTotal = record.byType.reduce((total, entry) => total + entry.count, 0);
    if (typeTotal !== record.count) {
      errors.push(`records[${label}]: type counts total ${typeTotal}, expected ${record.count}`);
    }
    const block = identity.gramPanchayats.get(label)?.blockCode;
    if (block && block !== record.lgdBlockCode) {
      errors.push(`records[${label}]: block ${record.lgdBlockCode} but the directory places it in ${block}`);
    }
    tally += record.count;
  }
  if (tally !== extract.featureCount) {
    errors.push(`featureCount: declared ${extract.featureCount}, records total ${tally}`);
  }
  if (errors.length > 0) return errors;

  const report = reportWaterBodiesCensusJoin(extract, identity);
  // A Panchayat with no water body is an answer; a water body assigned to a
  // Panchayat this district does not have means the membership index is wrong.
  if (report.unmatchedPanchayatCodes.length > 0) {
    errors.push(
      `join: ${report.unmatchedPanchayatCodes.length} records name a Gram Panchayat outside this district ` +
        `(first: ${report.unmatchedPanchayatCodes.slice(0, 3).join(", ")})`,
    );
  }
  return errors;
}
