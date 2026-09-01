/**
 * Assembles the per-Panchayat evidence inputs from a district's served
 * artifacts and runs the capability rules and brief builder over every
 * place. Shared by scripts/atlas-generate-assessments.ts and by the tests,
 * which regenerate the fixture corpus and expect byte-equal output: the
 * assessment pipeline is a pure function of the served inputs.
 */
import type {
  AssessmentsShard,
  BriefsShard,
  CensusShard,
  DistrictDirectoryArtifact,
  DistrictIdentity,
  DistrictRef,
  GroundwaterProjectionArtifact,
  GroundwaterTaluksArtifact,
  JjmServiceShard,
  RainfallArtifact,
  WaterBodiesShard,
} from "./artifacts";
import { identityFromDirectory } from "./artifacts";
import { villageWaterProfileV2 } from "./capability-assessment";
import { LGD_PROVENANCE, generateCapabilityAssessment } from "./capability-evidence";
import type { GeneratedAssessment, PlaceEvidenceInputs } from "./capability-evidence";
import { identityAdapterOf } from "./artifacts";
import {
  loadAssessmentShards,
  loadBriefShards,
  loadCensusShards,
  loadDirectory,
  loadGroundwaterProjection,
  loadGroundwaterTaluks,
  loadJjmServiceShards,
  loadRainfall,
  loadWaterBodyShards,
} from "./data";
import { buildPlaceBrief, validatePlaceBrief } from "./place-brief";
import type { PlaceBrief } from "./place-brief";
import type { TnBoundaryRecord } from "./tn-boundary";
import type { CanonicalCrosswalkRecord } from "./tn-crosswalk-resolution";
import { validateTnDistrictGroundwaterExtract } from "./tn-groundwater";
import { validateGroundwaterProjection } from "./tn-groundwater-projection";
import { rollUpJjmServiceByGramPanchayat, validateJjmServiceRecords } from "./tn-jjm-service";
import { validateTnDistrictRainfallExtract } from "./tn-rainfall";
import type { TnWaterBodyRecord } from "./tn-water-bodies";

export interface DistrictCorpus {
  directory: DistrictDirectoryArtifact;
  identity: DistrictIdentity;
  jjm: JjmServiceShard[];
  census: CensusShard[];
  groundwater: GroundwaterTaluksArtifact | undefined;
  projection: GroundwaterProjectionArtifact | undefined;
  rainfall: RainfallArtifact | undefined;
  waterBodies: WaterBodiesShard[];
  assessments: AssessmentsShard[];
  briefs: BriefsShard[];
}

/** The served families of one district, as read from disk or from a fixture.
 *  The directory is required; every other family is optional, so a district
 *  can be assessed before all its sources are in. */
export interface DistrictArtifacts {
  directory: DistrictDirectoryArtifact;
  jjm: JjmServiceShard[];
  census: CensusShard[];
  groundwater: GroundwaterTaluksArtifact | undefined;
  projection: GroundwaterProjectionArtifact | undefined;
  rainfall: RainfallArtifact | undefined;
  waterBodies: WaterBodiesShard[];
  assessments: AssessmentsShard[];
  briefs: BriefsShard[];
}

/** Check every served input against the directory's identity. Pure: the
 *  artifacts are handed in, by loadDistrictCorpus from disk and by the tests
 *  from the fixture corpus. */
export function assembleDistrictCorpus(artifacts: DistrictArtifacts): {
  corpus: DistrictCorpus;
  errors: string[];
} {
  const errors: string[] = [];
  const { directory, jjm, census, groundwater, rainfall, waterBodies } = artifacts;
  const identity = identityFromDirectory(directory);
  for (const shard of jjm) {
    errors.push(
      ...validateJjmServiceRecords(shard.records, identity).map(
        (error) => `jjm-service/${shard.blockCode}: ${error}`,
      ),
    );
  }
  for (const shard of census) {
    for (const record of shard.records) {
      if (!identity.gramPanchayats.has(record.lgdGramPanchayatCode)) {
        errors.push(
          `census-2011/${shard.blockCode}: ${record.lgdGramPanchayatCode} is not a Gram Panchayat`,
        );
      }
      for (const village of record.villages) {
        if (!identity.censusVillageCodes.has(village.villageCode)) {
          errors.push(
            `census-2011/${shard.blockCode}: village ${village.villageCode} is not enumerated`,
          );
        }
      }
    }
  }
  if (groundwater) {
    errors.push(
      ...validateTnDistrictGroundwaterExtract(groundwater).map((e) => `groundwater-taluks: ${e}`),
    );
  }
  const projection = groundwater ? artifacts.projection : undefined;
  if (projection && groundwater) {
    errors.push(
      ...validateGroundwaterProjection(projection, identity, groundwater).map(
        (e) => `groundwater-projection: ${e}`,
      ),
    );
  }
  if (rainfall) {
    errors.push(
      ...validateTnDistrictRainfallExtract(rainfall, identity).map((e) => `rainfall: ${e}`),
    );
  }
  for (const shard of waterBodies) {
    for (const feature of shard.features) {
      const code = feature.properties.lgdGramPanchayatCode;
      if (!identity.gramPanchayats.has(code)) {
        errors.push(`water-bodies/${shard.ext.atlas.blockCode}: ${code} is not a Gram Panchayat`);
      }
    }
  }
  return {
    corpus: {
      directory,
      identity,
      jjm,
      census,
      groundwater,
      projection,
      rainfall,
      waterBodies,
      assessments: artifacts.assessments,
      briefs: artifacts.briefs,
    },
    errors,
  };
}

/** Read every served input for a district from disk. */
export function loadDistrictCorpus(district: DistrictRef): {
  corpus: DistrictCorpus;
  errors: string[];
} {
  const directory = loadDirectory(district);
  if (!directory) {
    throw new Error(`${district.stateSlug}/${district.slug}: directory.json is not present`);
  }
  const groundwater = loadGroundwaterTaluks(district);
  return assembleDistrictCorpus({
    directory,
    jjm: loadJjmServiceShards(district),
    census: loadCensusShards(district),
    groundwater,
    projection: groundwater ? loadGroundwaterProjection(district) : undefined,
    rainfall: loadRainfall(district),
    waterBodies: loadWaterBodyShards(district),
    assessments: loadAssessmentShards(district),
    briefs: loadBriefShards(district),
  });
}

function boundaryRecord(
  panchayat: DistrictDirectoryArtifact["panchayats"][number],
): TnBoundaryRecord | undefined {
  if (!panchayat.boundary) return undefined;
  return {
    lgdGramPanchayatCode: panchayat.lgdCode,
    lgdBlockCode: panchayat.blockCode,
    name: panchayat.name,
    type: panchayat.boundary.type,
    geometrySha256: panchayat.boundary.geometrySha256,
    areaHectares: panchayat.boundary.areaHectares,
    bbox: panchayat.boundary.bbox,
    ringCount: panchayat.boundary.ringCount,
    vertexCount: panchayat.boundary.vertexCount,
  };
}

function identityRecord(
  panchayat: DistrictDirectoryArtifact["panchayats"][number],
): CanonicalCrosswalkRecord {
  const record: CanonicalCrosswalkRecord = {
    lgdGramPanchayatCode: panchayat.lgdCode,
    lgdGramPanchayatName: panchayat.name,
    lgdBlockCode: panchayat.blockCode,
    lgdBlockName: panchayat.blockName,
  };
  type Binding = NonNullable<CanonicalCrosswalkRecord["jjm"]>;
  if (panchayat.jjm) {
    record.jjm = {
      sourceUnitId: panchayat.jjm.sourceUnitId,
      matchClass: panchayat.jjm.matchClass as Binding["matchClass"],
      status: panchayat.jjm.status,
    };
  }
  if (panchayat.census) {
    record.census = {
      sourceUnitId: panchayat.census.sourceUnitId,
      matchClass: panchayat.census.matchClass as Binding["matchClass"],
      status: panchayat.census.status,
    };
  }
  return record;
}

/** The evidence every rule may look at, one record per Gram Panchayat. */
export function assembleEvidenceInputs(corpus: DistrictCorpus): PlaceEvidenceInputs[] {
  const jjmByGp = new Map(
    rollUpJjmServiceByGramPanchayat({
      records: corpus.jjm.flatMap((shard) => shard.records),
    }).map((rollup) => [rollup.gpId, rollup]),
  );
  const censusByGp = new Map(
    corpus.census
      .flatMap((shard) => shard.records)
      .map((record) => [record.lgdGramPanchayatCode, record]),
  );
  const groundwaterByGp = new Map(
    (corpus.projection?.records ?? []).map((record) => [record.lgdGramPanchayatCode, record]),
  );
  const rainfallByGp = new Map(
    (corpus.rainfall?.records ?? []).map((record) => [record.lgdGramPanchayatCode, record]),
  );
  const waterBodiesByGp = new Map<string, TnWaterBodyRecord>(
    corpus.waterBodies
      .flatMap((shard) => shard.features)
      .map((feature) => [feature.properties.lgdGramPanchayatCode, feature.properties]),
  );
  // The Tamil Nadu corpus predates the provenance field and its fixtures
  // are byte-compared, so only an LGD-built directory sets it.
  const provenance =
    identityAdapterOf(corpus.directory) === "lgd-directory" ? LGD_PROVENANCE : undefined;
  return corpus.directory.panchayats.map((panchayat) => ({
    lgdGramPanchayatCode: panchayat.lgdCode,
    lgdGramPanchayatName: panchayat.name,
    ...(provenance ? { provenance } : {}),
    identity: identityRecord(panchayat),
    boundary: boundaryRecord(panchayat),
    jjm: panchayat.jjm ? jjmByGp.get(panchayat.jjm.gpId) : undefined,
    census: censusByGp.get(panchayat.lgdCode),
    groundwater: groundwaterByGp.get(panchayat.lgdCode),
    rainfall: rainfallByGp.get(panchayat.lgdCode),
    rainfallWindow: corpus.rainfall?.window,
    waterBodies: waterBodiesByGp.get(panchayat.lgdCode),
  }));
}

export interface DistrictAssessmentRun {
  profileId: string;
  requirementIds: string[];
  assessments: GeneratedAssessment[];
  briefs: PlaceBrief[];
}

export function generateDistrictAssessments(
  corpus: DistrictCorpus,
  assessedAt: string,
): DistrictAssessmentRun {
  const profile = villageWaterProfileV2;
  const requirementPolicies = profile.requirements.map((requirement) => ({
    id: requirement.id,
    applicabilityPolicy: requirement.applicabilityPolicy,
  }));
  const assessments: GeneratedAssessment[] = [];
  const briefs: PlaceBrief[] = [];
  for (const inputs of assembleEvidenceInputs(corpus)) {
    const place = corpus.identity.gramPanchayats.get(inputs.lgdGramPanchayatCode)!;
    const assessment = generateCapabilityAssessment({
      profileId: profile.id,
      requirements: requirementPolicies,
      placeId: inputs.lgdGramPanchayatCode,
      assessedAt,
      inputs,
    });
    assessments.push(assessment);
    const brief = buildPlaceBrief({
      assessment,
      inputs,
      name: inputs.lgdGramPanchayatName,
      blockCode: place.blockCode,
    });
    const briefErrors = validatePlaceBrief(brief);
    if (briefErrors.length > 0) {
      throw new Error(
        `Invalid brief for ${inputs.lgdGramPanchayatCode}:\n- ${briefErrors.join("\n- ")}`,
      );
    }
    briefs.push(brief);
  }
  return {
    profileId: profile.id,
    requirementIds: profile.requirements.map((requirement) => requirement.id),
    assessments,
    briefs,
  };
}
