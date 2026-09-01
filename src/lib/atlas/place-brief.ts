import { formatExtractionStage } from "./tn-groundwater-projection";
import type { GeneratedAssessment, PlaceEvidenceInputs } from "./capability-evidence";

export const PLACE_BRIEF_SCHEMA_VERSION = 1;

export const BRIEF_STATUSES = ["brief-ready", "directory-only"] as const;

export type BriefStatus = (typeof BRIEF_STATUSES)[number];

export type BriefTone = "positive" | "warning" | "neutral" | "blocked";

/**
 * Capabilities a place must hold before it gets a public brief rather than a
 * directory entry. Identity is first because a brief about a place we cannot
 * identify is worse than no brief.
 */
export const BRIEF_REQUIRED_CAPABILITIES = [
  "place-identity-and-composition",
  "population-and-settlements",
  "drinking-water-service",
] as const;

export interface BriefFact {
  value: string;
  label: string;
  note: string;
}

export interface BriefVerdict {
  title: string;
  body: string;
  tone: BriefTone;
}

export interface BriefGap {
  capabilityId: string;
  reason: "unavailable" | "not-assessed";
}

/**
 * The detail behind the verdict.
 *
 * A verdict and five headline numbers threw away most of what was acquired:
 * for Poondi we hold roughly 319 values and were rendering five. These are the
 * ones a person reading about their own Panchayat would ask for by name.
 */
export interface BriefDetail {
  habitations: Array<{
    name: string;
    population: number | null;
    households: number | null;
    connections: number | null;
  }>;
  sources: Array<{ type: string; category: string; count: number }>;
  sampling: {
    total: number;
    unsafe: number;
    atSource: number;
    atHousehold: number;
    earliest: string | null;
    latest: string | null;
    byYear: Array<{ year: string; count: number }>;
  } | null;
  land: {
    totalAreaHectares: number | null;
    netSownHectares: number | null;
    irrigatedHectares: number | null;
    canalHectares: number | null;
    wellHectares: number | null;
    tankHectares: number | null;
    forestHectares: number | null;
    barrenHectares: number | null;
    culturableWasteHectares: number | null;
  } | null;
  seasonal: {
    annualSourceTypes: number;
    summerSourceTypes: number;
    lostInSummer: string[];
  } | null;
  boundary: {
    areaHectares: number;
    latitude: number;
    longitude: number;
  } | null;
  rainfall: {
    windowMm: number;
    daysWithRain: number;
    wettestDate: string | null;
    wettestDayMm: number | null;
  } | null;
  /**
   * Counts and mapped extent only. TNGIS names the water bodies, but naming
   * them here would publish source content the terms reserve, so the names
   * stay in the digest until an approval is recorded.
   */
  waterBodies: {
    count: number;
    namedCount: number;
    areaHectares: number;
    largestAreaHectares: number;
    byDepartment: Array<{ department: string; count: number }>;
    /** Present on a First Census of Water Bodies record only. */
    register?: "water-bodies-census";
    byType?: Array<{ type: string; count: number }>;
    areaBasis?: "stated" | "withheld";
    pointCount?: number;
  } | null;
}

export interface PlaceBrief {
  schemaVersion: number;
  placeId: string;
  name: string;
  blockCode: string;
  status: BriefStatus;
  statusReason: string;
  verdict: BriefVerdict | null;
  headlineFacts: BriefFact[];
  gaps: BriefGap[];
  adequateCapabilities: number;
  assessedCapabilities: number;
  detail: BriefDetail;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-IN");
}

function capabilityState(
  assessment: GeneratedAssessment,
  capabilityId: string,
): string | undefined {
  return assessment.requirements.find(
    (requirement) => requirement.requirementId === capabilityId,
  )?.state;
}

/**
 * The verdict is the point of the brief, so it is derived from the tension
 * between how a place is served and what it is drawing from, rather than
 * restating either number. A Panchayat with universal taps sitting on an
 * over-exploited aquifer is the finding; "1,143 tap connections" is not.
 */
export function deriveVerdict(inputs: PlaceEvidenceInputs): BriefVerdict | null {
  const coverage = inputs.jjm?.tapCoveragePercent ?? null;
  const category = inputs.groundwater?.category ?? null;
  const stage = formatExtractionStage(
    inputs.groundwater?.stageOfExtractionPercent,
  );
  if (coverage === null && category === null) return null;

  const overdrawn = category === "over_exploited" || category === "critical";
  const unit = inputs.provenance?.assessmentUnitLabel ?? "taluk";
  const taluk = inputs.groundwater?.talukName ?? `the containing ${unit}`;

  if (coverage !== null && coverage >= 100 && overdrawn) {
    return {
      title: "Every household has a tap, drawn from an aquifer in deficit",
      body:
        `All ${formatNumber(inputs.jjm?.households ?? 0)} households report a tap connection, ` +
        `while ${taluk} is assessed ${String(category).replace(/_/g, " ")} at ` +
        `${stage} percent of extraction. Service is complete; the source is not secure.`,
      tone: "warning",
    };
  }
  if (coverage !== null && coverage < 100 && overdrawn) {
    return {
      title: "Taps are incomplete and the aquifer is already in deficit",
      body:
        `${coverage} percent of households report a tap connection, and ${taluk} is ` +
        `assessed ${String(category).replace(/_/g, " ")} at ${stage} percent of ` +
        "extraction. Closing the service gap draws on a source already over-drawn.",
      tone: "blocked",
    };
  }
  if (coverage !== null && coverage >= 100 && category === "safe") {
    return {
      title: "Universal taps on a source still within its limit",
      body:
        `All ${formatNumber(inputs.jjm?.households ?? 0)} households report a tap ` +
        `connection and ${taluk} remains assessed safe at ${stage} percent of extraction.`,
      tone: "positive",
    };
  }
  if (coverage !== null && coverage < 100) {
    return {
      title: "Tap coverage is incomplete",
      body:
        `${coverage} percent of ${formatNumber(inputs.jjm?.households ?? 0)} households ` +
        "report a tap connection.",
      tone: "warning",
    };
  }
  if (coverage !== null && coverage >= 100 && category === null) {
    return {
      title: "Every household has a tap; the source is not characterised",
      body:
        `All ${formatNumber(inputs.jjm?.households ?? 0)} households report a tap ` +
        "connection, but no groundwater assessment covers this place, so the " +
        "security of what those taps draw on is unestablished.",
      tone: "neutral",
    };
  }
  if (category !== null) {
    return {
      title: `Containing ${unit} assessed ${String(category).replace(/_/g, " ")}`,
      body:
        `${taluk} is assessed ${String(category).replace(/_/g, " ")} at ${stage} percent ` +
        "of extraction. This is containing-area context, not a measurement of this place.",
      tone: overdrawn ? "warning" : "neutral",
    };
  }
  return null;
}

export function buildHeadlineFacts(
  inputs: PlaceEvidenceInputs,
  asOf?: string,
): BriefFact[] {
  const facts: BriefFact[] = [];
  const jjm = inputs.jjm;
  if (jjm && jjm.households !== null) {
    facts.push({
      value: `${jjm.tapCoveragePercent ?? "?"}%`,
      label: "Households with a tap connection",
      note:
        `${formatNumber(jjm.householdConnections ?? 0)} of ` +
        `${formatNumber(jjm.households)} households, across ${jjm.habitationCount} habitations.`,
    });
  }
  if (jjm && jjm.sourceCount > 0) {
    facts.push({
      value: formatNumber(jjm.sourceCount),
      label: "Drinking-water sources",
      note: jjm.sourceTypes.join(", ") || "Type not stated.",
    });
  }
  if (inputs.groundwater?.stageOfExtractionPercent !== undefined) {
    facts.push({
      value: `${formatExtractionStage(inputs.groundwater.stageOfExtractionPercent)}%`,
      label: `Groundwater extraction, containing ${inputs.provenance?.assessmentUnitLabel ?? "taluk"}`,
      note:
        `${inputs.groundwater.talukName} is assessed ` +
        `${String(inputs.groundwater.category).replace(/_/g, " ")}. This describes the ` +
        `${inputs.provenance?.assessmentUnitLabel ?? "taluk"}, not this Panchayat.`,
    });
  }
  if (inputs.rainfall && inputs.rainfallWindow) {
    facts.push({
      value: `${inputs.rainfall.rainfallMm} mm`,
      label: "Rainfall, last 30 days",
      note:
        `${inputs.rainfall.daysWithRain} rain days between ${inputs.rainfallWindow.start} ` +
        `and ${inputs.rainfallWindow.end}, modelled rather than gauged.`,
    });
  }
  if (jjm && jjm.sampleRowCount > 0) {
    const ageDays =
      jjm.latestSampleDate === null || asOf === undefined
        ? null
        : Math.round(
            (Date.parse(`${asOf}T00:00:00Z`) -
              Date.parse(`${jjm.latestSampleDate}T00:00:00Z`)) /
              86400000,
          );
    facts.push({
      value:
        ageDays === null
          ? (jjm.latestSampleStatus ?? "Unstated")
          : `${ageDays}d ago`,
      label: "Last water-quality sample",
      note:
        `${jjm.latestSampleStatus ?? "Result unstated"} on ` +
        `${jjm.latestSampleDate ?? "an unstated date"}. ` +
        `${formatNumber(jjm.sampleRowCount)} samples over ${jjm.sampleYearsCovered} years` +
        (jjm.unsafeSampleCount === 0
          ? ", none of them recorded unsafe."
          : `, ${jjm.unsafeSampleCount} recorded unsafe.`),
    });
  }
  return facts;
}

function buildDetail(inputs: PlaceEvidenceInputs): BriefDetail {
  const jjm = inputs.jjm;
  const census = inputs.census;
  const boundary = inputs.boundary;
  const rainfall = inputs.rainfall;
  const waterBodies = inputs.waterBodies;

  const sourceCounts = new Map<string, { category: string; count: number }>();
  for (const source of jjm?.sourceDetail ?? []) {
    const existing = sourceCounts.get(source.type);
    if (existing) existing.count += 1;
    else sourceCounts.set(source.type, { category: source.category, count: 1 });
  }

  return {
    habitations: jjm?.habitationDetail ?? [],
    sources: [...sourceCounts.entries()]
      .map(([type, value]) => ({ type, category: value.category, count: value.count }))
      .sort((left, right) => right.count - left.count),
    sampling:
      jjm && jjm.sampleRowCount > 0
        ? {
            total: jjm.sampleRowCount,
            unsafe: jjm.unsafeSampleCount,
            atSource: jjm.samplesAtSource,
            atHousehold: jjm.samplesAtHousehold,
            earliest: jjm.earliestSampleDate,
            latest: jjm.latestSampleDate,
            byYear: jjm.samplesByYear ?? [],
          }
        : null,
    land: census
      ? {
          totalAreaHectares: census.measures.totalGeographicalAreaHectares,
          netSownHectares: census.measures.netAreaSownHectares,
          irrigatedHectares: census.measures.irrigatedAreaHectares,
          canalHectares: census.measures.canalIrrigatedAreaHectares,
          wellHectares: census.measures.wellIrrigatedAreaHectares,
          tankHectares: census.measures.tankIrrigatedAreaHectares,
          forestHectares: census.measures.forestAreaHectares,
          barrenHectares: census.measures.barrenAreaHectares,
          culturableWasteHectares: census.measures.culturableWasteAreaHectares,
        }
      : null,
    seasonal: census
      ? {
          annualSourceTypes: census.annualSourceTypes,
          summerSourceTypes: census.summerSourceTypes,
          lostInSummer: census.sourceTypesLostInSummer,
        }
      : null,
    boundary: boundary
      ? {
          areaHectares: boundary.areaHectares,
          latitude: Number(((boundary.bbox[1] + boundary.bbox[3]) / 2).toFixed(6)),
          longitude: Number(((boundary.bbox[0] + boundary.bbox[2]) / 2).toFixed(6)),
        }
      : null,
    rainfall: rainfall
      ? {
          windowMm: rainfall.rainfallMm,
          daysWithRain: rainfall.daysWithRain,
          wettestDate: rainfall.wettestDate,
          wettestDayMm: rainfall.wettestDayMm,
        }
      : null,
    waterBodies: waterBodies
      ? {
          count: waterBodies.count,
          namedCount: waterBodies.namedCount,
          areaHectares: waterBodies.areaHectares,
          largestAreaHectares: waterBodies.largestAreaHectares,
          byDepartment: waterBodies.byDepartment,
          // The census fields travel only where the record carries them, so
          // a TNGIS brief is byte-for-byte what it was.
          ...(waterBodies.register
            ? {
                register: waterBodies.register,
                byType: waterBodies.byType ?? [],
                areaBasis: waterBodies.areaBasis ?? "withheld",
                pointCount: waterBodies.pointCount ?? 0,
              }
            : {}),
        }
      : null,
  };
}

export function buildPlaceBrief(options: {
  assessment: GeneratedAssessment;
  inputs: PlaceEvidenceInputs;
  name: string;
  blockCode: string;
}): PlaceBrief {
  const { assessment, inputs } = options;
  const missingRequired = BRIEF_REQUIRED_CAPABILITIES.filter(
    (capabilityId) => capabilityState(assessment, capabilityId) !== "adequate",
  );

  // Fail closed. A place that cannot clear the floor keeps its directory entry
  // and its evidence stays visible for review, but it does not get a brief
  // that reads as though we know it.
  const status: BriefStatus =
    missingRequired.length === 0 ? "brief-ready" : "directory-only";
  const statusReason =
    missingRequired.length === 0
      ? "Identity, population and drinking-water service are all established."
      : `Held back because ${missingRequired.join(", ")} ${
          missingRequired.length === 1 ? "is" : "are"
        } not established for this place.`;

  const gaps: BriefGap[] = assessment.requirements
    .filter(
      (requirement) =>
        requirement.state === "unavailable" ||
        requirement.state === "not-assessed",
    )
    .map((requirement) => ({
      capabilityId: requirement.requirementId,
      reason: requirement.state as "unavailable" | "not-assessed",
    }));

  return {
    schemaVersion: PLACE_BRIEF_SCHEMA_VERSION,
    placeId: assessment.placeId,
    name: options.name,
    blockCode: options.blockCode,
    status,
    statusReason,
    verdict: status === "brief-ready" ? deriveVerdict(inputs) : null,
    headlineFacts:
      status === "brief-ready"
        ? buildHeadlineFacts(inputs, assessment.assessedAt)
        : [],
    gaps,
    adequateCapabilities: assessment.summary.adequate,
    assessedCapabilities: assessment.requirements.length,
    detail: buildDetail(inputs),
  };
}

export function validatePlaceBrief(brief: PlaceBrief): string[] {
  const errors: string[] = [];
  if (brief.schemaVersion !== PLACE_BRIEF_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion: expected ${PLACE_BRIEF_SCHEMA_VERSION}, found ${brief.schemaVersion}`,
    );
  }
  if (!BRIEF_STATUSES.includes(brief.status)) {
    errors.push(`status: unknown brief status ${brief.status}`);
  }
  if (brief.status === "directory-only") {
    // A held-back place must not leak a verdict or headline numbers, which is
    // the whole point of holding it back.
    if (brief.verdict !== null) {
      errors.push("verdict: a directory-only place must not publish a verdict");
    }
    if (brief.headlineFacts.length > 0) {
      errors.push(
        "headlineFacts: a directory-only place must not publish headline facts",
      );
    }
  }
  if (brief.status === "brief-ready" && brief.headlineFacts.length === 0) {
    errors.push("headlineFacts: a published brief needs at least one fact");
  }
  // A brief without a verdict is a pile of numbers. If the evidence cleared
  // the floor, it has to say something.
  if (brief.status === "brief-ready" && brief.verdict === null) {
    errors.push("verdict: a published brief must reach a verdict");
  }
  if (brief.statusReason.trim().length === 0) {
    errors.push("statusReason: every status must say why");
  }
  for (const fact of brief.headlineFacts) {
    if (fact.note.trim().length === 0) {
      errors.push(`headlineFacts[${fact.label}]: a fact without its caveat`);
    }
  }
  return errors;
}

export interface BriefDistrictSummary {
  places: number;
  briefReady: number;
  directoryOnly: number;
  byTone: Record<string, number>;
  commonestGaps: Array<{ capabilityId: string; places: number }>;
}

export function summarizeBriefs(briefs: PlaceBrief[]): BriefDistrictSummary {
  const byTone: Record<string, number> = {};
  const gapCounts = new Map<string, number>();
  for (const brief of briefs) {
    if (brief.verdict) {
      byTone[brief.verdict.tone] = (byTone[brief.verdict.tone] ?? 0) + 1;
    }
    for (const gap of brief.gaps) {
      gapCounts.set(gap.capabilityId, (gapCounts.get(gap.capabilityId) ?? 0) + 1);
    }
  }
  return {
    places: briefs.length,
    briefReady: briefs.filter((brief) => brief.status === "brief-ready").length,
    directoryOnly: briefs.filter((brief) => brief.status === "directory-only")
      .length,
    byTone,
    commonestGaps: [...gapCounts.entries()]
      .map(([capabilityId, places]) => ({ capabilityId, places }))
      .sort((left, right) => right.places - left.places)
      .slice(0, 5),
  };
}
