import type {
  ApplicabilityState,
  CapabilityAssessmentState,
  EvidenceLocalityClass,
  ProjectionMethod,
} from "./capability-assessment";
import type { TnBoundaryRecord } from "./tn-boundary";
import type { GramPanchayatCensusRollup } from "./tn-census-attributes";
import type { CanonicalCrosswalkRecord } from "./tn-crosswalk-resolution";
import { formatExtractionStage } from "./tn-groundwater-projection";
import type { GroundwaterProjectionRecord } from "./tn-groundwater-projection";
import type { JjmGramPanchayatService } from "./tn-jjm-service";
import type { RainfallRecord } from "./tn-rainfall";
import type { TnWaterBodyRecord } from "./tn-water-bodies";

export const GENERATED_ASSESSMENT_SCHEMA_VERSION = 1;

/**
 * Everything the rules may look at for one Gram Panchayat. A rule that needs
 * something absent from this record cannot be written, which keeps generated
 * evidence tied to acquired sources rather than to assumption.
 */
/**
 * Which registers the identity and the boundary came from, so a rule cites
 * the district's own sources rather than Tamil Nadu's. Absent on the Tamil
 * Nadu corpus (the fixtures predate the field) and read as TNRD + TNGIS.
 */
export interface PlaceEvidenceProvenance {
  identityAdapter: "tnrd" | "lgd-directory";
  /** Registry ids the identity binding rests on, in citation order. */
  identitySourceRefs: string[];
  /** Registry id of the polygon source. */
  boundarySourceRef: string;
  /** The polygon source's own caveat, stated on every boundary evidence row. */
  boundaryLimitation: string;
  /** "TNGIS", "DataMeet": the source's short name for prose. */
  boundaryLabel: string;
  /** What the state calls the IN-GRES assessment unit: "taluk", "taluka". */
  assessmentUnitLabel: string;
  /** Registry id of the water-body register a census record cites; absent
   *  where the register is TNGIS. */
  waterBodySourceRef?: string;
}

export const TNRD_PROVENANCE: PlaceEvidenceProvenance = {
  identityAdapter: "tnrd",
  identitySourceRefs: ["tnrd-lgd-snapshot", "jjm-imis"],
  boundarySourceRef: "tngis-tnrd-panchayat-boundary",
  boundaryLimitation:
    "TNGIS requires prior approval from TNGIS/TNeGA before public display or redistribution, and publishes no mapping year.",
  boundaryLabel: "TNGIS",
  assessmentUnitLabel: "taluk",
};

export const LGD_PROVENANCE: PlaceEvidenceProvenance = {
  identityAdapter: "lgd-directory",
  identitySourceRefs: ["lgd-local-bodies-datagovin", "lgd-villages-datagovin", "jjm-imis"],
  boundarySourceRef: "datameet-village-boundaries-mh",
  boundaryLimitation:
    "DataMeet's polygons are a community digitisation of the 2001 Census village map (ODbL): indicative, not survey grade, and boundaries changed since 2001 are not reflected.",
  boundaryLabel: "DataMeet",
  assessmentUnitLabel: "taluka",
  waterBodySourceRef: "water-bodies-census-mh",
};

export interface PlaceEvidenceInputs {
  lgdGramPanchayatCode: string;
  lgdGramPanchayatName: string;
  provenance?: PlaceEvidenceProvenance;
  identity: CanonicalCrosswalkRecord | undefined;
  boundary: TnBoundaryRecord | undefined;
  jjm: JjmGramPanchayatService | undefined;
  census: GramPanchayatCensusRollup | undefined;
  groundwater: GroundwaterProjectionRecord | undefined;
  rainfall: RainfallRecord | undefined;
  rainfallWindow: { start: string; end: string } | undefined;
  waterBodies: TnWaterBodyRecord | undefined;
}

export interface GeneratedEvidence {
  id: string;
  sourceRefs: string[];
  localityClass: EvidenceLocalityClass;
  projectionMethod: ProjectionMethod;
  evidenceDate: string;
  notes: string;
}

export interface GeneratedRequirement {
  requirementId: string;
  applicability: ApplicabilityState;
  state: CapabilityAssessmentState;
  evidence: GeneratedEvidence[];
  limitations: string[];
}

export interface GeneratedAssessment {
  schemaVersion: number;
  profileId: string;
  placeId: string;
  placeKind: "gram-panchayat";
  assessedAt: string;
  mode: "generated";
  generatorVersion: string;
  requirements: GeneratedRequirement[];
  summary: Record<CapabilityAssessmentState, number>;
}

/**
 * Bumped whenever a rule changes what it will call adequate, so a regenerated
 * assessment produces a reviewable diff rather than a silent shift.
 */
export const EVIDENCE_GENERATOR_VERSION = "capability-evidence-v2";

interface RuleResult {
  state: CapabilityAssessmentState;
  evidence: GeneratedEvidence[];
  limitations: string[];
}

type Rule = (
  inputs: PlaceEvidenceInputs,
  evidenceDate: string,
) => RuleResult | null;

const has = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

function adequate(
  evidence: GeneratedEvidence,
  limitations: string[] = [],
): RuleResult {
  return { state: "adequate", evidence: [evidence], limitations };
}

/**
 * Rules are keyed by v2 capability id. A capability with no rule, or whose
 * rule returns null, is reported `unavailable`: the generator never guesses,
 * and a missing rule is visible as a gap rather than as a silent pass.
 */
export const CAPABILITY_RULES: Record<string, Rule> = {
  "place-identity-and-composition": (inputs, date) => {
    const identity = inputs.identity;
    if (!identity?.jjm) return null;
    const provenance = inputs.provenance ?? TNRD_PROVENANCE;
    const lgd = provenance.identityAdapter === "lgd-directory";
    const limitations: string[] = [];
    if (!identity.census) {
      limitations.push(
        lgd
          ? "The LGD register lists no village with a Census 2011 row under this Panchayat, so the 2011 settlement composition is not established."
          : "No Census Gram Panchayat membership is bound, so the 2011 settlement composition is not established.",
      );
    } else if (lgd) {
      limitations.push(
        "The Census composition is the LGD register's own coverage list, which names one covering village for most Panchayats; member villages the register omits are not shown.",
      );
    }
    if (identity.jjm.status !== "verified") {
      limitations.push(
        `The JJM identity binding is ${identity.jjm.status} by ${identity.jjm.matchClass} and has not been checked by a reviewer.`,
      );
    }
    return adequate(
      {
        id: `${inputs.lgdGramPanchayatCode}-identity`,
        sourceRefs: identity.census
          ? [...provenance.identitySourceRefs, "census-village-directory"]
          : provenance.identitySourceRefs,
        localityClass: "direct-place",
        projectionMethod: "identifier-crosswalk",
        evidenceDate: date,
        notes:
          `${lgd ? "LGD" : "TNRD/LGD"} Gram Panchayat ${inputs.lgdGramPanchayatCode} bound to JJM unit ` +
          `${identity.jjm.sourceUnitId}` +
          (identity.census
            ? lgd
              ? ` and to Census 2011 rows through the register's coverage (${identity.census.sourceUnitId}).`
              : ` and Census unit ${identity.census.sourceUnitId}.`
            : "."),
      },
      limitations,
    );
  },

  "place-boundary": (inputs, date) => {
    const boundary = inputs.boundary;
    if (!boundary) return null;
    const provenance = inputs.provenance ?? TNRD_PROVENANCE;
    const lgd = provenance.identityAdapter === "lgd-directory";
    return adequate(
      {
        id: `${inputs.lgdGramPanchayatCode}-boundary`,
        sourceRefs: [provenance.boundarySourceRef],
        localityClass: "within-place",
        projectionMethod: lgd ? "identifier-crosswalk" : "direct-published",
        evidenceDate: date,
        notes: lgd
          ? `${provenance.boundaryLabel} village polygons joined to the LGD-listed member villages give a Panchayat extent of ${boundary.areaHectares} ha for LGD ${boundary.lgdGramPanchayatCode}.`
          : `${provenance.boundaryLabel} publishes an exact Gram Panchayat polygon of ${boundary.areaHectares} ha keyed to LGD ${boundary.lgdGramPanchayatCode}.`,
      },
      [provenance.boundaryLimitation],
    );
  },

  "population-and-settlements": (inputs, date) => {
    const jjm = inputs.jjm;
    if (!jjm || !has(jjm.population) || jjm.habitationCount === 0) return null;
    return adequate({
      id: `${inputs.lgdGramPanchayatCode}-population`,
      sourceRefs: ["jjm-imis"],
      localityClass: "direct-place",
      projectionMethod: "direct-published",
      evidenceDate: date,
      notes:
        `JJM reports ${jjm.population} people in ${jjm.households ?? "an unstated number of"} ` +
        `households across ${jjm.habitationCount} habitations.`,
    });
  },

  "drinking-water-service": (inputs, date) => {
    const jjm = inputs.jjm;
    if (!jjm || !has(jjm.households) || !has(jjm.householdConnections)) return null;
    return adequate({
      id: `${inputs.lgdGramPanchayatCode}-service`,
      sourceRefs: ["jjm-imis"],
      localityClass: "direct-place",
      projectionMethod: "direct-published",
      evidenceDate: date,
      notes:
        `JJM reports ${jjm.householdConnections} tap connections against ` +
        `${jjm.households} households (${jjm.tapCoveragePercent ?? "?"} percent).`,
    });
  },

  "drinking-water-source": (inputs, date) => {
    const jjm = inputs.jjm;
    if (!jjm || jjm.sourceCount === 0) return null;
    return adequate({
      id: `${inputs.lgdGramPanchayatCode}-source`,
      sourceRefs: ["jjm-imis"],
      localityClass: "direct-place",
      projectionMethod: "direct-published",
      evidenceDate: date,
      notes:
        `JJM lists ${jjm.sourceCount} drinking-water sources of type ` +
        `${jjm.sourceTypes.join(", ") || "unstated"}.`,
    });
  },

  "drinking-water-quality": (inputs, date) => {
    const jjm = inputs.jjm;
    if (!jjm || jjm.sampleRowCount === 0) return null;
    const ageDays =
      jjm.latestSampleDate === null
        ? null
        : Math.round(
            (Date.parse(`${date}T00:00:00Z`) -
              Date.parse(`${jjm.latestSampleDate}T00:00:00Z`)) /
              86400000,
          );
    const limitations = [
      "Sample rows are the portal's displayed set and do not establish a sampling regime or laboratory method.",
    ];
    if (ageDays !== null && ageDays > 90) {
      limitations.push(
        `The most recent published sample is ${ageDays} days old, so this describes a past state rather than current water.`,
      );
    }
    // A long series with no failures at all describes the reporting as much as
    // the water, and reads as reassurance if left unsaid.
    if (jjm.unsafeSampleCount === 0 && jjm.sampleRowCount >= 20) {
      limitations.push(
        `All ${jjm.sampleRowCount} published samples are recorded Safe, with none failing, so the series cannot distinguish clean water from undetected contamination.`,
      );
    }
    return adequate(
      {
        id: `${inputs.lgdGramPanchayatCode}-quality`,
        sourceRefs: ["jjm-imis"],
        localityClass: "direct-place",
        projectionMethod: "direct-published",
        evidenceDate: date,
        notes:
          `${jjm.sampleRowCount} samples across ${jjm.sampleYearsCovered} years ` +
          `(${jjm.samplesAtSource} at source, ${jjm.samplesAtHousehold} at households); ` +
          `latest ${jjm.latestSampleStatus ?? "unstated"} on ` +
          `${jjm.latestSampleDate ?? "an unstated date"}` +
          (ageDays === null ? "." : `, ${ageDays} days ago.`) +
          (jjm.unsafeSampleCount > 0
            ? ` ${jjm.unsafeSampleCount} sample(s) recorded not Safe.`
            : ""),
      },
      limitations,
    );
  },

  "connected-supply-system": (inputs, date) => {
    const jjm = inputs.jjm;
    if (!jjm || jjm.sourceCount === 0 || jjm.habitationCount === 0) return null;
    return adequate(
      {
        id: `${inputs.lgdGramPanchayatCode}-supply-system`,
        sourceRefs: ["jjm-imis"],
        localityClass: "connected-system",
        projectionMethod: "service-relation",
        evidenceDate: date,
        notes:
          `JJM associates ${jjm.sourceCount} sources with ${jjm.habitationCount} ` +
          "habitations in this Panchayat's service records.",
      },
      [
        "The source-to-habitation association describes service records, not the physical scheme, headworks or transmission main.",
      ],
    );
  },

  "public-water-works": (inputs, date) => {
    const jjm = inputs.jjm;
    if (!jjm || jjm.sourceCount === 0) return null;
    return adequate(
      {
        id: `${inputs.lgdGramPanchayatCode}-public-works`,
        sourceRefs: ["jjm-imis"],
        localityClass: "within-place",
        projectionMethod: "direct-published",
        evidenceDate: date,
        notes: `${jjm.sourceCount} publicly recorded drinking-water works serve this Panchayat.`,
      },
      [
        "Only drinking-water sources are enumerated; tanks, channels and other public water works are not covered.",
      ],
    );
  },

  "historical-water-access": (inputs, date) => {
    const census = inputs.census;
    if (!census) return null;
    const available = Object.entries(census.drinkingWaterSources)
      .filter(([, value]) => value === "available")
      .map(([key]) => key);
    if (available.length === 0) return null;
    return adequate(
      {
        id: `${inputs.lgdGramPanchayatCode}-historical-access`,
        sourceRefs: ["census-village-directory"],
        localityClass: "direct-place",
        projectionMethod: "identifier-crosswalk",
        evidenceDate: date,
        notes:
          `Census 2011 records ${available.length} drinking-water source types across ` +
          `${census.villageCodes.length} constituent village rows` +
          (census.sourceTypesLostInSummer.length > 0
            ? `, of which ${census.sourceTypesLostInSummer.length} failed in the ` +
              `summer months: ${census.sourceTypesLostInSummer.join(", ")}.`
            : ", all of them reported available through the summer months."),
      },
      [
        "Census figures describe the 2009 reference year and are a historical baseline, not current service.",
        ...(census.sourceTypesLostInSummer.length > 0
          ? [
              "Seasonal failure here is the 2009 pattern for these source types and says nothing about whether today's piped supply holds through summer.",
            ]
          : []),
      ],
    );
  },

  "historical-agricultural-baseline": (inputs, date) => {
    const census = inputs.census;
    if (!census) return null;
    const sown = census.measures.netAreaSownHectares;
    const irrigated = census.measures.irrigatedAreaHectares;
    if (!has(sown) && !has(irrigated)) return null;
    return adequate(
      {
        id: `${inputs.lgdGramPanchayatCode}-agricultural-baseline`,
        sourceRefs: ["census-village-directory"],
        localityClass: "direct-place",
        projectionMethod: "identifier-crosswalk",
        evidenceDate: date,
        notes:
          `Census 2011 records ${sown ?? "an unstated"} ha net sown and ` +
          `${irrigated ?? "an unstated"} ha irrigated, of which ` +
          `${census.measures.canalIrrigatedAreaHectares ?? "an unstated amount"} ha is canal irrigated.`,
      },
      [
        "Census land use describes the 2009 reference year and does not describe current cropping.",
      ],
    );
  },

  "water-body-inventory": (inputs, date) => {
    const waterBodies = inputs.waterBodies;
    if (!waterBodies || waterBodies.count < 1) return null;
    const named = waterBodies.namedCount;
    const departments = waterBodies.byDepartment
      .map((entry) => `${entry.department} ${entry.count}`)
      .join(", ");
    if (waterBodies.register === "water-bodies-census") {
      // The census locates each water body in a Census 2011 village and the
      // LGD coverage register names the village's Panchayat: an identifier
      // join, not a spatial one, and the enumerator's own placement.
      const types = (waterBodies.byType ?? []).map((entry) => `${entry.type} ${entry.count}`).join(", ");
      const points = waterBodies.pointCount ?? 0;
      return adequate(
        {
          id: `${inputs.lgdGramPanchayatCode}-water-bodies`,
          sourceRefs: [inputs.provenance?.waterBodySourceRef ?? "water-bodies-census-mh"],
          localityClass: "within-place",
          projectionMethod: "identifier-crosswalk",
          evidenceDate: date,
          notes:
            `${waterBodies.count} water bodies in the First Census of Water Bodies: ${types}. Owned by ${departments}. ` +
            `${points} of them carry a recorded coordinate` +
            (waterBodies.areaBasis === "stated"
              ? `; stated waterspread ${waterBodies.areaHectares} ha, largest ${waterBodies.largestAreaHectares} ha.`
              : "; waterspread not published."),
        },
        [
          "The census enumerates by village (reference years 2017-18 to 2020-21) and the LGD coverage register names the village's Panchayat; a village the register lists under two Panchayats, or under none, is counted on the taluka and assigned to no Panchayat.",
          waterBodies.areaBasis === "stated"
            ? "Waterspread is what the enumerator entered, not a measured polygon."
            : "The state's return carries template values for waterspread, depth, year and cost on every row, so those attributes are withheld; the count, class, ownership and coordinates are what the register can support.",
          `The register names ${named} of ${waterBodies.count}; a return that names none is a structure register rather than a survey of tanks and lakes.`,
        ],
      );
    }
    return adequate(
      {
        id: `${inputs.lgdGramPanchayatCode}-water-bodies`,
        sourceRefs: ["tngis-all-water-bodies"],
        // The source states which Gram Panchayat each water body belongs to,
        // so this is the register's own assignment rather than an
        // intersection we performed.
        localityClass: "within-place",
        projectionMethod: "direct-published",
        evidenceDate: date,
        notes:
          `${waterBodies.count} water bodies covering ` +
          `${waterBodies.areaHectares} ha, largest ` +
          `${waterBodies.largestAreaHectares} ha. Registered by ${departments}.`,
      },
      [
        `The register names ${named} of ${waterBodies.count}; the rest are unnamed polygons.`,
        "Waterspread is the mapped extent, not storage, and says nothing about whether the water body holds water or is encroached.",
        "Five departments contribute to this layer and it carries no survey date, so the vintage of any one polygon is unstated.",
      ],
    );
  },

  "groundwater-resource-status": (inputs, date) => {
    const groundwater = inputs.groundwater;
    if (!groundwater?.category) return null;
    const unit = inputs.provenance?.assessmentUnitLabel ?? "taluk";
    return adequate(
      {
        id: `${inputs.lgdGramPanchayatCode}-groundwater`,
        sourceRefs: ["ingres-gec-dynamic-groundwater"],
        localityClass: "containing-area",
        projectionMethod: "administrative-proxy",
        evidenceDate: date,
        notes:
          `The containing revenue ${unit} ${groundwater.talukName} is assessed ` +
          `${groundwater.category} at ` +
          `${formatExtractionStage(groundwater.stageOfExtractionPercent)} percent ` +
          "stage of extraction.",
      },
      [
        `The assessment unit is a revenue ${unit}, not this Panchayat, so the category is containing-area context rather than a measurement of this place.`,
      ],
    );
  },

  "current-rainfall": (inputs, date) => {
    const rainfall = inputs.rainfall;
    const window = inputs.rainfallWindow;
    if (!rainfall || !window) return null;
    return adequate(
      {
        id: `${inputs.lgdGramPanchayatCode}-rainfall`,
        sourceRefs: ["open-meteo-grid-rainfall"],
        // The value is computed for a grid point lying inside the Panchayat,
        // which is `within-place`, not a reading taken at the place.
        localityClass: "within-place",
        projectionMethod: "interpolation",
        evidenceDate: date,
        notes:
          `${rainfall.rainfallMm} mm fell over ${window.start} to ${window.end} ` +
          `across ${rainfall.daysWithRain} rain days, wettest ` +
          `${rainfall.wettestDayMm ?? "?"} mm on ${rainfall.wettestDate ?? "an unstated date"}.`,
      },
      [
        `Modelled reanalysis interpolated to a grid point ${rainfall.gridOffsetKm} km from the Panchayat centroid, not a rain gauge in the village.`,
      ],
    );
  },

  "rainfall-anomaly": (inputs, date) => {
    const rainfall = inputs.rainfall;
    const window = inputs.rainfallWindow;
    // Fires only once a normal exists for the same grid point. Without one
    // there is no anomaly to state, and guessing at a baseline would be worse
    // than reporting the capability as unavailable.
    if (!rainfall || !window) return null;
    const normal = rainfall.normalMm ?? null;
    const percent = rainfall.percentOfNormal ?? null;
    if (normal === null || percent === null) return null;
    const direction = percent >= 100 ? "above" : "below";
    return adequate(
      {
        id: `${inputs.lgdGramPanchayatCode}-rainfall-anomaly`,
        sourceRefs: ["open-meteo-grid-rainfall"],
        localityClass: "derived-place",
        projectionMethod: "interpolation",
        evidenceDate: date,
        notes:
          `${rainfall.rainfallMm} mm against a ${rainfall.normalYears}-year normal of ` +
          `${normal} mm for the same window, ${percent} percent of normal ` +
          `(${direction}).`,
      },
      [
        `The normal is a ${rainfall.normalYears}-year mean of modelled reanalysis for the same calendar window, not a long-period gauge climatology.`,
      ],
    );
  },

  "responsibility-and-action": (inputs, date) => {
    if (!inputs.identity?.jjm) return null;
    return adequate(
      {
        id: `${inputs.lgdGramPanchayatCode}-responsibility`,
        sourceRefs: ["tnrd-lgd-snapshot", "jjm-imis"],
        localityClass: "direct-place",
        projectionMethod: "identifier-crosswalk",
        evidenceDate: date,
        notes:
          `${inputs.lgdGramPanchayatName} Gram Panchayat is the recorded service unit ` +
          "for drinking water under TNRD and JJM.",
      },
      [
        "The responsible body is identified, but no accountable officer, budget line or grievance route is published here.",
      ],
    );
  },
};

export interface RequirementPolicy {
  id: string;
  /** `always` means the capability applies everywhere; `evaluate` means
   * applicability is a question about this place that must be answered. */
  applicabilityPolicy: "always" | "evaluate";
}

export function generateCapabilityAssessment(options: {
  profileId: string;
  requirements: RequirementPolicy[];
  inputs: PlaceEvidenceInputs;
  assessedAt: string;
  placeId: string;
}): GeneratedAssessment {
  const requirements: GeneratedRequirement[] = options.requirements.map(
    (requirement) => {
      const requirementId = requirement.id;
      const hasRule = Object.hasOwn(CAPABILITY_RULES, requirementId);
      const rule: Rule | undefined = hasRule
        ? CAPABILITY_RULES[requirementId]
        : undefined;
      const result = rule ? rule(options.inputs, options.assessedAt) : null;
      if (result) {
        // Evidence exists, so the capability demonstrably applies here.
        return {
          requirementId,
          applicability: "applicable" as ApplicabilityState,
          state: result.state,
          evidence: result.evidence,
          limitations: result.limitations,
        };
      }
      if (requirement.applicabilityPolicy === "evaluate") {
        // Whether this applies to this place is itself unanswered. Calling it
        // `unavailable` would claim we looked for something we know belongs
        // here, which for coastal data on an inland Panchayat is simply false.
        return {
          requirementId,
          applicability: "not-assessed" as ApplicabilityState,
          state: "not-assessed" as CapabilityAssessmentState,
          evidence: [],
          limitations: [
            "Whether this capability applies to this place has not been determined, so its absence is not evidence of a gap.",
          ],
        };
      }
      return {
        requirementId,
        applicability: "applicable" as ApplicabilityState,
        state: "unavailable" as CapabilityAssessmentState,
        evidence: [],
        limitations: hasRule
          ? ["No acquired source carries this capability for this place."]
          : ["No evidence rule is defined for this capability yet."],
      };
    },
  );

  const summary = {
    adequate: 0,
    unavailable: 0,
    "not-applicable": 0,
    "not-assessed": 0,
  } as Record<CapabilityAssessmentState, number>;
  for (const requirement of requirements) {
    summary[requirement.state] = (summary[requirement.state] ?? 0) + 1;
  }

  return {
    schemaVersion: GENERATED_ASSESSMENT_SCHEMA_VERSION,
    profileId: options.profileId,
    placeId: options.placeId,
    placeKind: "gram-panchayat",
    assessedAt: options.assessedAt,
    mode: "generated",
    generatorVersion: EVIDENCE_GENERATOR_VERSION,
    requirements,
    summary,
  };
}
