import type {
  DistrictDirectoryArtifact,
  GroundwaterTaluksArtifact,
  RainfallArtifact,
  WaterBodiesShard,
} from "./artifacts";
import { identityAdapterOf, identityMasterVintage, identityVintage } from "./artifacts";
import {
  loadDirectory,
  loadGroundwaterTaluks,
  loadRainfall,
  loadWaterBodyShards,
} from "./data";
import {
  getDistrictBriefs,
  getDistrictDirectory,
  type DistrictDirectory,
} from "./district-directory";
import type { PlaceBrief } from "./place-brief";
import { findAtlasDistrict, type AtlasDistrict } from "./registry";

/**
 * A district read as a district, rather than as 589 places read one at a time.
 *
 * Everything here rolls up artifacts already acquired for the Gram Panchayats,
 * plus the IN-GRES taluk assessment. No new source is involved, which is the
 * point: the block and district views were paid for when the places were
 * acquired and were simply never rendered.
 *
 * Nothing is imputed. A place that does not carry a measure lowers that
 * measure's denominator rather than counting as a zero, and every roll-up
 * reports the number of places that actually contributed.
 */
export const SAMPLE_STALE_AFTER_DAYS = 90;

export interface AggregateMeasure {
  value: number;
  /** How many Gram Panchayats contributed. Never assume it is all of them. */
  places: number;
}

export interface BlockAggregate {
  code: string;
  name: string;
  panchayatCount: number;
  households: number;
  connections: number;
  tapPercent: number | null;
  irrigatedHectares: number;
  canalPercent: number | null;
  wellPercent: number | null;
  tankPercent: number | null;
  landPlaces: number;
  waterBodyCount: number;
  waterBodyAreaHectares: number;
  sampleCount: number;
  stalePlaces: number;
  worstSampleAgeDays: number | null;
}

export interface TalukGroundwater {
  name: string;
  category: string;
  stageOfExtractionPercent: number;
  annualRechargeHam: number;
  availabilityForFutureUseHam: number;
  rainfallMm: number;
}

/**
 * What each figure on the page is as of. Held per district rather than
 * written into the page, because the answer differs by district the moment
 * two are refreshed on different days, and because a reader asking "how old
 * is this" deserves one place that answers for everything at once.
 */
export interface SourceVintage {
  label: string;
  /** What the figures describe, which is not always when they were fetched. */
  represents: string;
  /** When the Atlas last read the source. */
  acquired: string;
  /** True when the reference period is more than three years before the roll-up. */
  historical: boolean;
  note: string;
}

export interface DistrictAggregate {
  slug: string;
  districtName: string;
  vintages: SourceVintage[];
  panchayatCount: number;
  blockCount: number;
  population: AggregateMeasure;
  households: AggregateMeasure;
  connections: number;
  tapPercent: number | null;
  netSownHectares: AggregateMeasure;
  irrigatedHectares: number;
  canalPercent: number | null;
  wellPercent: number | null;
  tankPercent: number | null;
  landPlaces: number;
  waterBodyCount: number;
  waterBodyAreaHectares: number;
  waterBodyPlaces: number;
  placesWithoutWaterBodies: number;
  sampleCount: number;
  unsafeSampleCount: number;
  stalePlaces: number;
  worstSampleAgeDays: number | null;
  blocks: BlockAggregate[];
  taluks: TalukGroundwater[];
  groundwaterAssessmentYear: string | null;
  overExploitedTaluks: number;
}

/** Reference periods more than this far back are called historical on the page. */
const HISTORICAL_AFTER_YEARS = 3;

function isHistorical(representsYear: number | null, asOf: string): boolean {
  if (representsYear === null) return false;
  const asOfYear = Number(asOf.slice(0, 4));
  return asOfYear - representsYear > HISTORICAL_AFTER_YEARS;
}

/**
 * Every date here is read from the artifacts' own fields and envelopes, so a
 * district refreshed on a different day answers for itself.
 */
function collectVintages(inputs: DistrictAggregateInputs): SourceVintage[] {
  const { asOf, directoryArtifact: directory, groundwater, rainfall } = inputs;
  const waterBodies = inputs.waterBodies[0];

  return [
    {
      label: "Drinking-water service, testing, habitations",
      represents: "current",
      acquired: directory?.vintages.jjm.sourceAsOf ?? "unstated",
      historical: false,
      note: "Jal Jeevan Mission citizen corner. Taps, sources, sample history.",
    },
    {
      label: "Groundwater assessment",
      represents: groundwater?.assessmentYear ?? "unstated",
      acquired: groundwater?.acquiredAt ?? "unstated",
      historical: isHistorical(
        Number(groundwater?.assessmentYear?.slice(0, 4)) || null,
        asOf,
      ),
      note: "IN-GRES, assessed per revenue taluk rather than per Panchayat.",
    },
    directory && identityAdapterOf(directory) === "lgd-directory"
      ? {
          label: "Boundaries",
          represents: "2001",
          acquired: directory.vintages.boundary?.retrievedAt ?? "unstated",
          historical: true,
          note:
            "DataMeet's digitisation of the 2001 Census village map (ODbL), joined to the 2011 codes and to each Panchayat's LGD-listed villages. " +
            (waterBodies?.ext.atlas.register === "water-bodies-census"
              ? "Water bodies are the First Census of Water Bodies (reference years 2017-18 to 2020-21), assigned through the same village list."
              : "No water-body register is wired for this district."),
        }
      : {
          label: "Boundaries and water bodies",
          represents: "as mapped",
          acquired: waterBodies?.ext.atlas.acquiredAt ?? "unstated",
          historical: false,
          note: "TNGIS. The register carries no survey date, so the vintage of any one polygon is unstated.",
        },
    {
      label: "Rainfall",
      represents: rainfall?.window
        ? `${rainfall.window.start} to ${rainfall.window.end}`
        : "recent window",
      acquired: rainfall?.acquiredAt ?? "unstated",
      historical: false,
      note: "Open-Meteo reanalysis interpolated to a grid point, not a gauge.",
    },
    {
      label: "Land, irrigation and seasonal sources",
      represents: "2009",
      acquired: directory?.vintages.census.retrievedAt ?? "unstated",
      historical: true,
      note: "Census 2011 village tables, reference year 2009. The 2021 census did not take place, so no newer village-level enumeration exists.",
    },
    directory && identityAdapterOf(directory) === "lgd-directory"
      ? {
          label: "Panchayat list and codes",
          represents: identityVintage(directory).sourceAsOf,
          acquired: identityVintage(directory).retrievedAt,
          historical: false,
          note: "Local Government Directory as republished monthly on data.gov.in: Panchayats, villages and talukas with their LGD codes.",
        }
      : {
          label: "Panchayat list and codes",
          represents: "2021",
          acquired: directory ? identityMasterVintage(directory).sourceAsOf : "unstated",
          historical: true,
          note: "TNRD LGD list dated 2021, cross-checked against the current TNRD master.",
        },
  ];
}

function share(part: number, whole: number): number | null {
  if (!(whole > 0)) return null;
  return Number(((100 * part) / whole).toFixed(1));
}

function ageInDays(from: string, asOf: string): number | null {
  const start = Date.parse(from);
  const end = Date.parse(asOf);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

interface Bucket {
  panchayatCount: number;
  population: number;
  populationPlaces: number;
  households: number;
  householdPlaces: number;
  connections: number;
  netSown: number;
  netSownPlaces: number;
  irrigated: number;
  canal: number;
  well: number;
  tank: number;
  landPlaces: number;
  waterBodyCount: number;
  waterBodyArea: number;
  waterBodyPlaces: number;
  sampleCount: number;
  unsafeSampleCount: number;
  stalePlaces: number;
  worstSampleAgeDays: number | null;
}

function emptyBucket(): Bucket {
  return {
    panchayatCount: 0,
    population: 0,
    populationPlaces: 0,
    households: 0,
    householdPlaces: 0,
    connections: 0,
    netSown: 0,
    netSownPlaces: 0,
    irrigated: 0,
    canal: 0,
    well: 0,
    tank: 0,
    landPlaces: 0,
    waterBodyCount: 0,
    waterBodyArea: 0,
    waterBodyPlaces: 0,
    sampleCount: 0,
    unsafeSampleCount: 0,
    stalePlaces: 0,
    worstSampleAgeDays: null,
  };
}

function accumulate(bucket: Bucket, brief: PlaceBrief, asOf: string): void {
  bucket.panchayatCount += 1;
  const detail = brief.detail;
  if (!detail) return;

  if (detail.habitations.length > 0) {
    let population = 0;
    let households = 0;
    let connections = 0;
    for (const habitation of detail.habitations) {
      population += habitation.population ?? 0;
      households += habitation.households ?? 0;
      connections += habitation.connections ?? 0;
    }
    bucket.population += population;
    bucket.populationPlaces += 1;
    bucket.households += households;
    bucket.householdPlaces += 1;
    bucket.connections += connections;
  }

  if (detail.land) {
    bucket.landPlaces += 1;
    bucket.netSown += detail.land.netSownHectares ?? 0;
    if (detail.land.netSownHectares !== null) bucket.netSownPlaces += 1;
    bucket.irrigated += detail.land.irrigatedHectares ?? 0;
    bucket.canal += detail.land.canalHectares ?? 0;
    bucket.well += detail.land.wellHectares ?? 0;
    bucket.tank += detail.land.tankHectares ?? 0;
  }

  if (detail.waterBodies) {
    bucket.waterBodyPlaces += 1;
    bucket.waterBodyCount += detail.waterBodies.count;
    bucket.waterBodyArea += detail.waterBodies.areaHectares;
  }

  if (detail.sampling) {
    bucket.sampleCount += detail.sampling.total;
    bucket.unsafeSampleCount += detail.sampling.unsafe;
    if (detail.sampling.latest) {
      const age = ageInDays(detail.sampling.latest, asOf);
      if (age !== null) {
        if (age > SAMPLE_STALE_AFTER_DAYS) bucket.stalePlaces += 1;
        bucket.worstSampleAgeDays =
          bucket.worstSampleAgeDays === null
            ? age
            : Math.max(bucket.worstSampleAgeDays, age);
      }
    }
  }
}

/**
 * Everything the roll-up reads, handed in rather than read here so the
 * builder is a pure function of the served artifacts: getDistrictAggregate
 * supplies them from disk, the tests from the fixture corpus.
 */
export interface DistrictAggregateInputs {
  district: AtlasDistrict;
  asOf: string;
  /** The public directory, as district-directory builds it. */
  directory: DistrictDirectory;
  briefs: PlaceBrief[];
  /** The served directory artifact, read for its vintages. */
  directoryArtifact: DistrictDirectoryArtifact | undefined;
  groundwater: GroundwaterTaluksArtifact | undefined;
  waterBodies: WaterBodiesShard[];
  rainfall: RainfallArtifact | undefined;
}

export function buildDistrictAggregate(inputs: DistrictAggregateInputs): DistrictAggregate {
  const { district, asOf, directory, groundwater } = inputs;
  const briefsByCode = new Map(inputs.briefs.map((brief) => [brief.placeId, brief]));

  const districtBucket = emptyBucket();
  const blockBuckets = new Map<string, Bucket>();
  for (const panchayat of directory.panchayats) {
    const blockBucket = blockBuckets.get(panchayat.blockCode) ?? emptyBucket();
    const brief = briefsByCode.get(panchayat.lgdCode);
    if (brief) {
      accumulate(districtBucket, brief, asOf);
      accumulate(blockBucket, brief, asOf);
    } else {
      // Counted as a place, credited with no measure. A directory-only
      // Panchayat is still part of the block.
      districtBucket.panchayatCount += 1;
      blockBucket.panchayatCount += 1;
    }
    blockBuckets.set(panchayat.blockCode, blockBucket);
  }

  const blockNames = new Map(
    directory.blocks.map((block) => [block.code, block.name]),
  );
  const collator = new Intl.Collator("en-IN", { sensitivity: "base" });
  const blocks: BlockAggregate[] = [...blockBuckets.entries()]
    .map(([code, bucket]) => ({
      code,
      name: blockNames.get(code) ?? code,
      panchayatCount: bucket.panchayatCount,
      households: bucket.households,
      connections: bucket.connections,
      tapPercent: share(bucket.connections, bucket.households),
      irrigatedHectares: Math.round(bucket.irrigated),
      canalPercent: share(bucket.canal, bucket.irrigated),
      wellPercent: share(bucket.well, bucket.irrigated),
      tankPercent: share(bucket.tank, bucket.irrigated),
      landPlaces: bucket.landPlaces,
      waterBodyCount: bucket.waterBodyCount,
      waterBodyAreaHectares: Number(bucket.waterBodyArea.toFixed(1)),
      sampleCount: bucket.sampleCount,
      stalePlaces: bucket.stalePlaces,
      worstSampleAgeDays: bucket.worstSampleAgeDays,
    }))
    .sort((left, right) => collator.compare(left.name, right.name));

  const taluks: TalukGroundwater[] = (groundwater?.records ?? [])
    .map((record) => ({
      name: record.locationName,
      category: record.category ?? "not-stated",
      stageOfExtractionPercent: record.stageOfExtractionPercent ?? 0,
      annualRechargeHam: record.annualRechargeHam ?? 0,
      availabilityForFutureUseHam: record.availabilityForFutureUseHam ?? 0,
      rainfallMm: record.rainfallMm ?? 0,
    }))
    .sort(
      (left, right) =>
        right.stageOfExtractionPercent - left.stageOfExtractionPercent,
    );

  return {
    slug: district.slug,
    districtName: directory.districtName,
    vintages: collectVintages(inputs),
    panchayatCount: directory.panchayats.length,
    blockCount: directory.blocks.length,
    population: {
      value: districtBucket.population,
      places: districtBucket.populationPlaces,
    },
    households: {
      value: districtBucket.households,
      places: districtBucket.householdPlaces,
    },
    connections: districtBucket.connections,
    tapPercent: share(districtBucket.connections, districtBucket.households),
    netSownHectares: {
      value: Math.round(districtBucket.netSown),
      places: districtBucket.netSownPlaces,
    },
    irrigatedHectares: Math.round(districtBucket.irrigated),
    canalPercent: share(districtBucket.canal, districtBucket.irrigated),
    wellPercent: share(districtBucket.well, districtBucket.irrigated),
    tankPercent: share(districtBucket.tank, districtBucket.irrigated),
    landPlaces: districtBucket.landPlaces,
    waterBodyCount: districtBucket.waterBodyCount,
    waterBodyAreaHectares: Number(districtBucket.waterBodyArea.toFixed(1)),
    waterBodyPlaces: districtBucket.waterBodyPlaces,
    placesWithoutWaterBodies:
      directory.panchayats.length - districtBucket.waterBodyPlaces,
    sampleCount: districtBucket.sampleCount,
    unsafeSampleCount: districtBucket.unsafeSampleCount,
    stalePlaces: districtBucket.stalePlaces,
    worstSampleAgeDays: districtBucket.worstSampleAgeDays,
    blocks,
    taluks,
    groundwaterAssessmentYear: groundwater?.assessmentYear ?? null,
    overExploitedTaluks: taluks.filter(
      (taluk) => taluk.stageOfExtractionPercent > 100,
    ).length,
  };
}

const cache = new Map<string, DistrictAggregate>();

export function getDistrictAggregate(
  stateSlug: string,
  districtSlug: string,
  asOf: string,
): DistrictAggregate | undefined {
  const district = findAtlasDistrict(stateSlug, districtSlug);
  if (!district) return undefined;
  const key = `${district.stateSlug}/${district.slug}/${asOf}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const directory = getDistrictDirectory(stateSlug, districtSlug);
  if (!directory) return undefined;
  const built = buildDistrictAggregate({
    district,
    asOf,
    directory,
    briefs: getDistrictBriefs(district.slug),
    directoryArtifact: loadDirectory(district),
    groundwater: loadGroundwaterTaluks(district),
    waterBodies: loadWaterBodyShards(district),
    rainfall: loadRainfall(district),
  });
  cache.set(key, built);
  return built;
}

/** Drop the built aggregates. */
export function clearDistrictAggregateCache(): void {
  cache.clear();
}
