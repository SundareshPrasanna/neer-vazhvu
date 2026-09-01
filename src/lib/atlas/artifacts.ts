/**
 * Served Atlas artifacts: the shapes under public/data/atlas/<state>/<district>/
 * and the identity index every family validates against.
 *
 * The district is the NVDM scope. Blocks and Gram Panchayats are records
 * inside district-scoped artifacts. GP-grain families over a megabyte are
 * sharded per LGD block (jjm-service, census-2011, water-bodies, assessments,
 * briefs); district-grain files stay whole. Every artifact carries a complete
 * NVDM envelope written by its producer (scripts/lib/atlas-producer.ts).
 *
 * This module is types and path arithmetic only: no fs, so both the producers
 * under scripts/ and the server-side loaders under src/lib/atlas/data.ts can
 * import it, and the client-safe registry never has to.
 */
import type {
  CensusSettlementKind,
  CensusCompositionExclusionReason,
  RecordSetCompletenessBasis,
  RecordSetCompletenessStatus,
  TnDistrictSourceExtract,
} from "./acquisition-model";
import type { AtlasDistrict } from "./registry";
import type { GeneratedAssessment } from "./capability-evidence";
import type { PlaceBrief } from "./place-brief";
import type { CensusVillageAttributes, GramPanchayatCensusRollup } from "./tn-census-attributes";
import type { GroundwaterAssessmentUnit, GroundwaterCategory } from "./tn-groundwater";
import type {
  GroundwaterProjectionMethod,
  GroundwaterProjectionRecord,
  GroundwaterProjectionReviewEntry,
} from "./tn-groundwater-projection";
import type { JjmVillageService } from "./tn-jjm-service";
import type { RainfallRecord } from "./tn-rainfall";
import type { TnWaterBodyRecord } from "./tn-water-bodies";

export const ATLAS_DATA_ROOT = "public/data/atlas";

export const ATLAS_FAMILIES = {
  directory: "directory",
  boundaries: "boundaries",
  irrigationCurrent: "irrigation-current",
  groundwaterTaluks: "groundwater-taluks",
  groundwaterProjection: "groundwater-projection",
  rainfall: "rainfall",
  jjmService: "jjm-service",
  census: "census-2011",
  waterBodies: "water-bodies",
  assessments: "assessments",
  briefs: "briefs",
  curatedBriefs: "curated-briefs",
} as const;

export type AtlasFamily = (typeof ATLAS_FAMILIES)[keyof typeof ATLAS_FAMILIES];

/** Families sharded per LGD block: one file per block, keyed by block code. */
export const SHARDED_FAMILIES: readonly AtlasFamily[] = [
  "boundaries",
  "jjm-service",
  "census-2011",
  "water-bodies",
  "assessments",
  "briefs",
];

export type DistrictRef = Pick<AtlasDistrict, "stateSlug" | "slug">;

export function districtDataDir(district: DistrictRef): string {
  return `${ATLAS_DATA_ROOT}/${district.stateSlug}/${district.slug}`;
}

/** Repo-relative path of an artifact. Shards take the LGD block code. */
export function districtArtifactPath(
  district: DistrictRef,
  family: AtlasFamily,
  shard?: string,
): string {
  const dir = districtDataDir(district);
  if (shard === undefined) return `${dir}/${family}.json`;
  const extension = family === "water-bodies" || family === "boundaries" ? "geojson" : "json";
  return `${dir}/${family}/${shard}.${extension}`;
}

/* ── Envelope, as read back from a served artifact ─────────────────────── */

export interface AtlasEnvelopeSource {
  id?: string;
  closed?: boolean;
  role?: "asserts" | "input" | "methodology";
  title: string;
  publisher: string;
  url?: string;
  license?: string;
  as_of?: string;
  retrieved?: string;
}

export interface AtlasEnvelope {
  nvdm: string;
  dataset: string;
  scope: { kind: "district"; id: string };
  provenance: {
    sources: AtlasEnvelopeSource[];
    method: string;
    produced_at: string;
    produced_by: string;
    note?: string | string[];
    internal_inputs?: string[];
    conventions?: Record<string, unknown>;
  };
  projection?: {
    of: { kind: string; id: string };
    method: string;
    limitations?: string[];
  };
  ext?: Record<string, unknown>;
}

/* ── directory.json ────────────────────────────────────────────────────── */

export interface DirectoryBlock {
  code: string;
  name: string;
  jjmBlockId: string | null;
  jjmBlockName: string | null;
  censusCdBlockCode: string | null;
  censusCdBlockName: string | null;
  panchayatCount: number;
}

export type BindingStatus = "proposed" | "verified";

export interface DirectoryJjmBinding {
  sourceUnitId: string;
  blockId: string;
  gpId: string;
  gpName: string;
  matchClass: string;
  status: BindingStatus;
  villages: Array<{ villageId: string; villageName: string }>;
}

export interface DirectoryCensusBinding {
  sourceUnitId: string;
  cdBlockCode: string;
  gramPanchayatCode: string;
  gramPanchayatName: string;
  matchClass: string;
  status: BindingStatus;
  villages: Array<{
    villageCode: string;
    villageName: string;
    subdistrictCode: string;
  }>;
}

export interface DirectoryCompositionMember {
  kind: CensusSettlementKind;
  code: string;
  name: string;
}

export interface DirectoryCompositionExclusion extends DirectoryCompositionMember {
  reason: CensusCompositionExclusionReason;
  ownerLgdGramPanchayatCode: string;
}

/**
 * How the Panchayat's Census 2011 composition is known. `reviewed` comes from
 * a plan target a person checked (members, exclusions, evidence); `crosswalk`
 * is the machine or staged binding's village set, unreviewed; `unbound` means
 * no Census unit is bound and the 2011 composition is not established.
 */
export interface DirectoryComposition {
  status: "reviewed" | "crosswalk" | "unbound";
  completeness: RecordSetCompletenessStatus;
  basis: RecordSetCompletenessBasis | null;
  reviewedAt: string | null;
  members: DirectoryCompositionMember[];
  exclusions: DirectoryCompositionExclusion[];
}

export interface DirectoryBoundary {
  /** TNGIS feature type, e.g. "Village panchayat". */
  type: string;
  areaHectares: number;
  /** [longitude, latitude] of the bbox centre; the map marker, not a survey point. */
  centroid: [number, number];
  bbox: [number, number, number, number];
  geometrySha256: string;
  ringCount: number;
  vertexCount: number;
}

/** The villages the LGD register lists under a Panchayat (LGD adapter only).
 *  The register names one covering village for most Panchayats rather than
 *  every member, so this is an authoritative but partial composition. */
export interface DirectoryLgdCoverage {
  villages: Array<{
    villageCode: string;
    villageName: string;
    census2011Code: string;
    coverageType: string;
  }>;
}

export interface DirectoryPanchayat {
  lgdCode: string;
  name: string;
  /** The LGD's own local-language name, where the register carries one. */
  nameLocal?: string;
  blockCode: string;
  blockName: string;
  tnrdMaster: {
    blockLocalCode: string;
    gramPanchayatLocalCode: string;
    name: string;
  } | null;
  lgdCoverage?: DirectoryLgdCoverage | null;
  jjm: DirectoryJjmBinding | null;
  census: DirectoryCensusBinding | null;
  composition: DirectoryComposition;
  boundary: DirectoryBoundary | null;
}

export interface DirectorySourceVintage {
  sourceAsOf: string;
  retrievedAt: string;
  recordCount: number;
}

/**
 * Which register is the identity master. Tamil Nadu districts were built from
 * TNRD (the served artifacts carry no adapter field and read as "tnrd");
 * every later state comes from the Local Government Directory as republished
 * on data.gov.in. The adapter decides which vintage keys a directory carries
 * and which upstream ids its consumers cite.
 */
export type IdentityAdapter = "tnrd" | "lgd-directory";

export interface DirectoryBoundaryVintage {
  layer: string;
  retrievedAt: string;
  recordCount: number;
  /** Registry id of the geometry source; absent on the TNGIS-built
   *  directories, which predate the field. */
  sourceId?: string;
  license?: string;
  /** True when the polygons themselves are served (boundaries/<block>.geojson);
   *  false when only derived centroids, areas and digests are published. */
  publicGeometry?: boolean;
}

export interface DistrictDirectoryArtifact extends AtlasEnvelope {
  schemaVersion: number;
  district: {
    slug: string;
    name: string;
    stateSlug: string;
    stateName: string;
    planId: string;
    /** Absent on TNRD-built directories. */
    identityAdapter?: IdentityAdapter;
    /** TNRD's own district codes; Tamil Nadu only. */
    tnrdLgdCode?: string;
    tnrdMasterCode?: string;
    jjmStateId: string;
    jjmDistrictId: string;
    censusDistrictCode: string;
    lgdDistrictCode: string;
    lgdStateCode?: string;
    ingresDistrictName: string;
    ingresStateName?: string;
    ingresAssessmentUnitType?: string;
    /** "sub-district" when the block layer is the LGD taluka (Maharashtra). */
    blockModel?: string;
  };
  acquiredAt: string;
  vintages: {
    /** Tamil Nadu: the 2021 LGD-coded TNRD list and the current TNRD master. */
    tnrdLgd?: DirectorySourceVintage;
    tnrdMaster?: DirectorySourceVintage;
    /** LGD adapter: the Local Bodies (Panchayat) list, the village list and
     *  the sub-district list, each with the portal's own edition date. */
    lgdLocalBodies?: DirectorySourceVintage;
    /** The coverage rows (Panchayat-village pairs) behind the Panchayat list. */
    lgdCoverage?: DirectorySourceVintage;
    lgdVillages?: DirectorySourceVintage;
    lgdSubdistricts?: DirectorySourceVintage;
    jjm: DirectorySourceVintage;
    census: DirectorySourceVintage;
    boundary: DirectoryBoundaryVintage | null;
  };
  crosswalk: {
    proposalId: string;
    foldingVersion: string;
    matchProcedureVersion: string;
    resolutionIds: string[];
    summary: {
      lgdGramPanchayats: number;
      jjmBound: number;
      censusBound: number;
      bothBound: number;
      unbound: number;
      verifiedBindings: number;
      proposedBindings: number;
      byMatchClass: Record<string, number>;
    };
  };
  blocks: DirectoryBlock[];
  panchayats: DirectoryPanchayat[];
  /** LGD adapter: villages of the district the Local Bodies register lists
   *  under no Panchayat (uninhabited or forest villages, urban villages, and
   *  members the register's one-village-per-Panchayat coverage omits). Kept
   *  so the enumeration stays complete and the gap is visible. */
  uncoveredVillages?: Array<{
    villageCode: string;
    villageName: string;
    /** As the LGD states it; a code the Census release has no row for is
     *  kept as stated and flagged below. */
    census2011Code: string;
    subdistrictCode: string;
    /** True when the district's Census 2011 release has a row for that code. */
    censusRow: boolean;
  }>;
  /** LGD adapter: Census 2011 village rows of the district that no current
   *  LGD village carries as its 2011 code (merged, renumbered or urbanised
   *  since 2011). Kept so the Census enumeration stays complete. */
  censusVillagesWithoutLgdRow?: Array<{
    villageCode: string;
    villageName: string;
    subdistrictCode: string;
  }>;
  /** Source units no LGD Gram Panchayat is bound to; kept so the enumeration
   *  stays complete and a later review can bind them. */
  unbound: {
    jjm: Array<{
      sourceUnitId: string;
      blockId: string;
      blockName: string;
      gpId: string;
      gpName: string;
      villages: Array<{ villageId: string; villageName: string }>;
    }>;
    census: Array<{
      sourceUnitId: string;
      cdBlockCode: string;
      cdBlockName: string;
      gramPanchayatCode: string;
      gramPanchayatName: string;
      villages: Array<{
        villageCode: string;
        villageName: string;
        subdistrictCode: string;
      }>;
    }>;
  };
}

/* ── district-grain families ───────────────────────────────────────────── */

/** One source's slice of the current district irrigation mix. Percent is the
 *  share of the printed net total, to one decimal. */
export interface IrrigationCurrentShare {
  key: "canals" | "tanks" | "tube-bore-wells" | "open-wells" | "other-sources";
  label: string;
  netHectares: number;
  percent: number;
}

/**
 * The current district irrigation source mix, from the DES Season and Crop
 * Report's Table III-B ("Area irrigated by different sources"). District
 * grain, one edition per artifact; the Census 2011 village pattern stays the
 * block-level baseline beside it. Produced by
 * scripts/atlas-irrigation-tn-district.ts from a reviewed extraction under
 * pipeline-inputs/atlas/<state>/<district>/irrigation-des.json.
 */
export interface IrrigationCurrentArtifact extends AtlasEnvelope {
  schemaVersion: number;
  planId: string;
  /** The report edition, e.g. "2024-25" (an agricultural year, not a date). */
  edition: string;
  district: {
    name: string;
    /** As the report prints it (it spells "Tiruchirapalli"). */
    reportSpelling: string;
    /** The district's Sl. No. row in Table III-B. */
    rowNumber: number;
  };
  bySource: IrrigationCurrentShare[];
  /** The report's printed net total, the denominator of every share. */
  netAreaIrrigatedHectares: number;
  /** What the five components sum to; may miss the printed total by a
   *  hectare or two of rounding in the report itself. */
  componentSumHectares: number;
  grossAreaIrrigatedHectares: number;
  areaIrrigatedMoreThanOnceHectares: number;
  irrigationIntensity: number;
  /** NOT additive to the net total: supplementary wells water land already
   *  counted under another source. */
  supplementaryWells: { netHectares: number; note: string };
  extractedOn: string;
  notes: string[];
}

export interface GroundwaterTaluksArtifact extends AtlasEnvelope {
  schemaVersion: number;
  planId: string;
  assessmentYear: string;
  acquiredAt: string;
  source: {
    sourceId: string;
    sourceUrl: string;
    portalUrl: string;
    assessmentUnitType: string;
    hierarchy: "revenue";
  };
  district: {
    locationName: string;
    locationUUID: string;
    category: GroundwaterCategory | null;
    stageOfExtractionPercent: number | null;
  };
  recordsSha256: string;
  recordCount: number;
  records: GroundwaterAssessmentUnit[];
}

export interface GroundwaterProjectionArtifact extends AtlasEnvelope {
  schemaVersion: number;
  planId: string;
  assessmentYear: string;
  projectedAt: string;
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
    blocksSpanningTaluks: number;
    talukCoverage: number;
  };
}

export interface RainfallArtifact extends AtlasEnvelope {
  schemaVersion: number;
  planId: string;
  acquiredAt: string;
  source: {
    sourceId: string;
    sourceUrl: string;
    measurement: "modelled-reanalysis";
    windowDays: number;
  };
  window: { start: string; end: string };
  recordsSha256: string;
  recordCount: number;
  records: RainfallRecord[];
}

/* ── per-block shards ──────────────────────────────────────────────────── */

export interface ShardHeader {
  schemaVersion: number;
  planId: string;
  blockCode: string;
  blockName: string;
}

export interface JjmServiceShard extends AtlasEnvelope, ShardHeader {
  jjmStateId: string;
  jjmDistrictId: string;
  jjmBlockId: string | null;
  acquiredAt: string;
  source: { sourceId: string; sourceUrl: string; pageMethods: string[] };
  coverage: {
    villagesInBlock: number;
    villagesAcquired: number;
    partialReason: string | null;
  };
  recordsSha256: string;
  recordCount: number;
  records: JjmVillageService[];
}

export interface CensusShardRecord extends GramPanchayatCensusRollup {
  villages: CensusVillageAttributes[];
}

export interface CensusShard extends AtlasEnvelope, ShardHeader {
  censusDistrictCode: string;
  acquiredAt: string;
  source: { sourceId: string; sourceUrl: string; sourceAsOf: string };
  recordsSha256: string;
  recordCount: number;
  records: CensusShardRecord[];
}

export interface WaterBodyFeature {
  type: "Feature";
  /** Null until TNGIS approves public display; the derived counts and areas
   *  in properties are what is published meanwhile. */
  geometry: null;
  properties: TnWaterBodyRecord & { lgdBlockCode: string };
}

export interface WaterBodiesShard extends AtlasEnvelope {
  type: "FeatureCollection";
  features: WaterBodyFeature[];
  ext: {
    atlas: ShardHeader & {
      districtLgdCode: string;
      acquiredAt: string;
      layer: string;
      sourceUrl: string;
      rights: {
        status: "permission-required";
        termsUrl: string;
        termsQuote: string;
        approval: unknown;
      };
      contributingDepartments: string[];
      snapshotSha256: string;
      featureCount: number;
      recordCount: number;
      recordsSha256: string;
    };
  };
}

/** Served Panchayat polygons (LGD-built districts, DataMeet ODbL): one
 *  FeatureCollection per block, the envelope at the top level beside
 *  type/features and the atlas metadata under ext.atlas, the water-bodies
 *  convention. */
export interface BoundaryFeature {
  type: "Feature";
  properties: {
    lgdCode: string;
    name: string;
    blockCode: string;
    blockName: string;
    areaHectares: number;
    memberVillagesDrawn: string[];
    memberVillagesNotDrawn: string[];
  };
  geometry: { type: "MultiPolygon"; coordinates: number[][][][] };
}

export interface BoundariesShard extends AtlasEnvelope {
  type: "FeatureCollection";
  features: BoundaryFeature[];
  ext: {
    atlas: ShardHeader & {
      acquiredAt: string;
      sourceSha256: string;
      featureCount: number;
      rights: { status: "share-alike"; license: string; attribution: string };
    };
  };
}

export interface AssessmentsShard extends AtlasEnvelope, ShardHeader {
  profileId: string;
  assessedAt: string;
  generatorVersion: string;
  requirementIds: string[];
  recordCount: number;
  assessments: GeneratedAssessment[];
}

export interface BriefsShard extends AtlasEnvelope, ShardHeader {
  assessedAt: string;
  recordCount: number;
  briefs: PlaceBrief[];
}

/* ── identity index ────────────────────────────────────────────────────── */

/**
 * What a family validator needs to know about the district it belongs to.
 * Built from the acquisition extract on the producer side and from the
 * served directory on the consumer side, so a shard is checked against the
 * same enumeration either way.
 */
export interface DistrictIdentity {
  planId: string;
  gramPanchayats: Map<
    string,
    { name: string; blockCode: string; blockName: string }
  >;
  blocks: Map<string, string>;
  /** `blockId/gpId/villageId` for every enumerated JJM village. */
  jjmVillagePaths: Set<string>;
  censusVillageCodes: Set<string>;
}

export function identityFromExtract(
  extract: TnDistrictSourceExtract,
): DistrictIdentity {
  const gramPanchayats = new Map<
    string,
    { name: string; blockCode: string; blockName: string }
  >();
  const blocks = new Map<string, string>();
  for (const record of extract.sources.tnrdLgd.records) {
    gramPanchayats.set(record.gramPanchayatCode, {
      name: record.gramPanchayatName,
      blockCode: record.blockCode,
      blockName: record.blockName,
    });
    blocks.set(record.blockCode, record.blockName);
  }
  return {
    planId: extract.planId,
    gramPanchayats,
    blocks,
    jjmVillagePaths: new Set(
      extract.sources.jjm.records.map(
        (record) => `${record.blockId}/${record.gpId}/${record.villageId}`,
      ),
    ),
    censusVillageCodes: new Set(
      extract.sources.census.records.map((record) => record.villageCode),
    ),
  };
}

export function identityFromDirectory(
  directory: DistrictDirectoryArtifact,
): DistrictIdentity {
  const gramPanchayats = new Map<
    string,
    { name: string; blockCode: string; blockName: string }
  >();
  const jjmVillagePaths = new Set<string>();
  const censusVillageCodes = new Set<string>();
  for (const panchayat of directory.panchayats) {
    gramPanchayats.set(panchayat.lgdCode, {
      name: panchayat.name,
      blockCode: panchayat.blockCode,
      blockName: panchayat.blockName,
    });
    if (panchayat.jjm) {
      for (const village of panchayat.jjm.villages) {
        jjmVillagePaths.add(
          `${panchayat.jjm.blockId}/${panchayat.jjm.gpId}/${village.villageId}`,
        );
      }
    }
    if (panchayat.census) {
      for (const village of panchayat.census.villages) {
        censusVillageCodes.add(village.villageCode);
      }
    }
  }
  for (const unit of directory.unbound.jjm) {
    for (const village of unit.villages) {
      jjmVillagePaths.add(`${unit.blockId}/${unit.gpId}/${village.villageId}`);
    }
  }
  for (const unit of directory.unbound.census) {
    for (const village of unit.villages) censusVillageCodes.add(village.villageCode);
  }
  // LGD adapter: the Census villages under no Panchayat are tracked too, so a
  // Census roll-up neither drops nor invents a row.
  for (const village of directory.uncoveredVillages ?? []) {
    if (village.censusRow) censusVillageCodes.add(village.census2011Code);
  }
  for (const village of directory.censusVillagesWithoutLgdRow ?? []) {
    censusVillageCodes.add(village.villageCode);
  }
  return {
    planId: directory.district.planId,
    gramPanchayats,
    blocks: new Map(directory.blocks.map((block) => [block.code, block.name])),
    jjmVillagePaths,
    censusVillageCodes,
  };
}

/** LGD block code of a Gram Panchayat, for choosing its shard. */
export function blockCodeOf(identity: DistrictIdentity, lgdCode: string): string | undefined {
  return identity.gramPanchayats.get(lgdCode)?.blockCode;
}

/* ── adapter-aware readers of the directory ────────────────────────────── */

export function identityAdapterOf(directory: DistrictDirectoryArtifact): IdentityAdapter {
  return directory.district.identityAdapter ?? "tnrd";
}

/** The vintage of the identity master: the LGD-coded TNRD list in Tamil
 *  Nadu, the LGD Local Bodies list elsewhere. Every directory carries one. */
export function identityVintage(directory: DistrictDirectoryArtifact): DirectorySourceVintage {
  const vintage =
    identityAdapterOf(directory) === "tnrd"
      ? directory.vintages.tnrdLgd
      : directory.vintages.lgdLocalBodies;
  if (!vintage) {
    throw new Error(`${directory.district.slug}: directory carries no identity vintage`);
  }
  return vintage;
}

/** The current-membership check beside the identity master: the TNRD master
 *  in Tamil Nadu; for an LGD directory the register is itself current, so the
 *  identity vintage answers. */
export function identityMasterVintage(directory: DistrictDirectoryArtifact): DirectorySourceVintage {
  return directory.vintages.tnrdMaster ?? identityVintage(directory);
}

/** The district code of the identity master (TNRD's for Tamil Nadu, the LGD
 *  district code otherwise). */
export function identityDistrictCode(directory: DistrictDirectoryArtifact): string {
  return directory.district.tnrdLgdCode ?? directory.district.lgdDistrictCode;
}

export interface BoundaryProvenance {
  /** Registry id of the polygon source. */
  sourceId: string;
  /** Short name for prose: "TNGIS", "DataMeet". */
  label: string;
  /** What the polygons are: a survey layer or a community digitisation. */
  description: string;
  publicGeometry: boolean;
}

/** Who drew the polygons a directory's centroids come from, with the copy
 *  the pages need. TNGIS-built directories predate the vintage's sourceId. */
export function boundaryProvenance(directory: DistrictDirectoryArtifact): BoundaryProvenance | null {
  const boundary = directory.vintages.boundary;
  if (!boundary) return null;
  if (boundary.sourceId === "datameet-village-boundaries-mh") {
    return {
      sourceId: boundary.sourceId,
      label: "DataMeet",
      description:
        "DataMeet's community digitisation of the 2001 Census village map (ODbL), joined to the 2011 codes and dissolved to each Panchayat's member villages",
      publicGeometry: boundary.publicGeometry ?? false,
    };
  }
  return {
    sourceId: boundary.sourceId ?? "tngis-tnrd-panchayat-boundary",
    label: "TNGIS",
    description: "the TNGIS Panchayat boundary layer",
    publicGeometry: boundary.publicGeometry ?? false,
  };
}
