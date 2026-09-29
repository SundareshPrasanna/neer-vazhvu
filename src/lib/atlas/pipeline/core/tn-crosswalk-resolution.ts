import { readFileSync } from "node:fs";

import {
  CROSSWALK_AXES,
  PROPOSED_MATCH_CLASSES,
  UNVERIFIED_REVIEWER,
  VERIFICATION_STATUSES,
  CROSSWALK_FOLDING_VERSION,
  CROSSWALK_MATCH_PROCEDURE_VERSION,
  CROSSWALK_SCHEMA_VERSION,
  REVIEWED_MATCH_CLASSES,
} from "./tn-crosswalk";
import type {
  CrosswalkAxis,
  VerificationStatus,
  CrosswalkLgdRef,
  CrosswalkMatchClass,
  TnDistrictCrosswalkProposal,
} from "./tn-crosswalk";

/**
 * One human decision about one deferred source unit.
 *
 * A decision may only choose from the closed candidate set the proposal
 * offered, or record `null` to state that no LGD Gram Panchayat corresponds.
 * That keeps review a bounded choice rather than free-text identity authoring.
 */
export interface CrosswalkResolutionDecision {
  axis: CrosswalkAxis;
  sourceUnitId: string;
  lgdGramPanchayatCode: string | null;
  /**
   * `proposed` decisions bind downstream and are labelled as unchecked, so
   * work proceeds without waiting on a domain reviewer. `rejected` never
   * binds. `verified` carries the name of whoever confirmed it.
   */
  status: VerificationStatus;
  matchClass: CrosswalkMatchClass;
  evidence: string;
  question?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface TnDistrictCrosswalkResolution {
  schemaVersion: number;
  id: string;
  planId: string;
  proposalId: string;
  foldingVersion: string;
  matchProcedureVersion: string;
  sourceRecordDigests: {
    tnrdLgd: string;
    jjm: string;
    census: string;
  };
  decisions: CrosswalkResolutionDecision[];
}

export interface CanonicalCrosswalkBinding {
  sourceUnitId: string;
  matchClass: CrosswalkMatchClass;
  status: VerificationStatus;
}

export interface CanonicalCrosswalkRecord extends CrosswalkLgdRef {
  jjm?: CanonicalCrosswalkBinding;
  census?: CanonicalCrosswalkBinding;
}

export interface CanonicalCrosswalk {
  schemaVersion: number;
  planId: string;
  proposalId: string;
  foldingVersion: string;
  matchProcedureVersion: string;
  resolutionIds: string[];
  records: CanonicalCrosswalkRecord[];
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
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export function validateTnDistrictCrosswalkResolution(
  resolution: TnDistrictCrosswalkResolution,
  proposal: TnDistrictCrosswalkProposal,
): string[] {
  const errors: string[] = [];
  if (resolution.schemaVersion !== CROSSWALK_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion: expected ${CROSSWALK_SCHEMA_VERSION}, found ${resolution.schemaVersion}`,
    );
  }
  if (resolution.proposalId !== proposal.id) {
    errors.push(
      `proposalId: ${resolution.proposalId} does not match proposal ${proposal.id}`,
    );
  }
  if (resolution.planId !== proposal.planId) {
    errors.push(`planId: ${resolution.planId} does not match ${proposal.planId}`);
  }
  // A resolution answers one exact proposal. If the sources moved, the
  // candidate sets it chose from may no longer exist, so it must be re-reviewed
  // rather than silently carried forward.
  if (resolution.foldingVersion !== CROSSWALK_FOLDING_VERSION) {
    errors.push(
      `foldingVersion: resolution was reviewed against ${resolution.foldingVersion}`,
    );
  }
  if (resolution.matchProcedureVersion !== CROSSWALK_MATCH_PROCEDURE_VERSION) {
    errors.push(
      `matchProcedureVersion: resolution was reviewed against ${resolution.matchProcedureVersion}`,
    );
  }
  for (const axis of ["tnrdLgd", "jjm", "census"] as const) {
    if (resolution.sourceRecordDigests[axis] !== proposal.sourceRecordDigests[axis]) {
      errors.push(
        `sourceRecordDigests.${axis}: resolution was reviewed against different source records`,
      );
    }
  }
  if (errors.length > 0) return errors;

  const claimedByAxis = new Map<CrosswalkAxis, Set<string>>();
  for (const axis of CROSSWALK_AXES) {
    claimedByAxis.set(
      axis,
      new Set(proposal[axis].accepted.map((match) => match.lgdGramPanchayatCode)),
    );
  }
  const seenUnits = new Set<string>();

  for (const decision of resolution.decisions) {
    const label = `decisions[${decision.axis}/${decision.sourceUnitId}]`;
    if (!CROSSWALK_AXES.includes(decision.axis)) {
      errors.push(`${label}: unknown axis`);
      continue;
    }
    const key = `${decision.axis}/${decision.sourceUnitId}`;
    if (seenUnits.has(key)) {
      errors.push(`${label}: decided more than once`);
    }
    seenUnits.add(key);

    const entry = proposal[decision.axis].review.sourceUnits.find(
      (candidate) => candidate.sourceUnitId === decision.sourceUnitId,
    );
    if (!entry) {
      errors.push(
        `${label}: not a deferred source unit in this proposal; only review-queue entries may be decided`,
      );
      continue;
    }
    if (!VERIFICATION_STATUSES.includes(decision.status)) {
      errors.push(`${label}: unknown verification status`);
      continue;
    }
    if (!decision.evidence || decision.evidence.trim().length === 0) {
      errors.push(`${label}: evidence is required`);
    }
    if (decision.status === "proposed") {
      if (!PROPOSED_MATCH_CLASSES.includes(decision.matchClass as never)) {
        errors.push(
          `${label}: a proposed decision must carry matchClass ` +
            `${PROPOSED_MATCH_CLASSES[0]}, not ${decision.matchClass}`,
        );
      }
      if (decision.verifiedBy !== undefined || decision.verifiedAt !== undefined) {
        errors.push(
          `${label}: a proposed decision must not carry verifiedBy or verifiedAt`,
        );
      }
    } else if (decision.status === "verified") {
      if (!REVIEWED_MATCH_CLASSES.includes(decision.matchClass as never)) {
        errors.push(
          `${label}: a verified decision must carry a reviewed match method`,
        );
      }
      if (!decision.verifiedAt || !DATE_PATTERN.test(decision.verifiedAt)) {
        errors.push(`${label}: verifiedAt must be an ISO date`);
      }
      if (!decision.verifiedBy || UNVERIFIED_REVIEWER.test(decision.verifiedBy)) {
        errors.push(
          `${label}: verifiedBy ${JSON.stringify(decision.verifiedBy)} is a placeholder`,
        );
      }
    }
    if (decision.status === "rejected") continue;
    if (decision.lgdGramPanchayatCode === null) continue;

    const allowed = entry.candidates.some(
      (candidate) =>
        candidate.lgdGramPanchayatCode === decision.lgdGramPanchayatCode,
    );
    if (!allowed) {
      errors.push(
        `${label}: ${decision.lgdGramPanchayatCode} is outside the candidate set offered for this unit`,
      );
      continue;
    }
    const claimed = claimedByAxis.get(decision.axis)!;
    if (claimed.has(decision.lgdGramPanchayatCode)) {
      errors.push(
        `${label}: ${decision.lgdGramPanchayatCode} is already bound on the ${decision.axis} axis`,
      );
      continue;
    }
    claimed.add(decision.lgdGramPanchayatCode);
  }
  return errors;
}

export function loadTnDistrictCrosswalkResolution(
  path: string,
  proposal: TnDistrictCrosswalkProposal,
): TnDistrictCrosswalkResolution {
  const parsed = JSON.parse(
    readFileSync(path, "utf8"),
  ) as TnDistrictCrosswalkResolution;
  const errors = validateTnDistrictCrosswalkResolution(parsed, proposal);
  if (errors.length > 0) {
    throw new Error(
      `Invalid crosswalk resolution ${path}:\n- ${errors.join("\n- ")}`,
    );
  }
  return parsed;
}

/**
 * Merges machine proposals and affirmed decisions into the single identity
 * table downstream generation reads. One record per LGD Gram Panchayat, each
 * axis bound at most once, every binding carrying the method that produced it.
 */
export function buildCanonicalCrosswalk(
  proposal: TnDistrictCrosswalkProposal,
  resolutions: TnDistrictCrosswalkResolution[],
): CanonicalCrosswalk {
  const records = new Map<string, CanonicalCrosswalkRecord>();
  const seed = (ref: CrosswalkLgdRef): CanonicalCrosswalkRecord => {
    const existing = records.get(ref.lgdGramPanchayatCode);
    if (existing) return existing;
    const created: CanonicalCrosswalkRecord = { ...ref };
    records.set(ref.lgdGramPanchayatCode, created);
    return created;
  };

  for (const axis of CROSSWALK_AXES) {
    for (const match of proposal[axis].accepted) {
      const record = seed(match);
      record[axis] = {
        sourceUnitId: match.sourceUnitId,
        matchClass: match.matchClass,
        status: "proposed",
      };
    }
    for (const ref of proposal[axis].review.lgdGramPanchayats) seed(ref);
  }

  for (const resolution of resolutions) {
    for (const decision of resolution.decisions) {
      if (decision.status === "rejected") continue;
      if (decision.lgdGramPanchayatCode === null) continue;
      const record = records.get(decision.lgdGramPanchayatCode);
      if (!record) {
        throw new Error(
          `Resolution ${resolution.id} binds unknown Gram Panchayat ${decision.lgdGramPanchayatCode}`,
        );
      }
      if (record[decision.axis]) {
        throw new Error(
          `Resolution ${resolution.id} rebinds ${decision.lgdGramPanchayatCode} on the ${decision.axis} axis`,
        );
      }
      record[decision.axis] = {
        sourceUnitId: decision.sourceUnitId,
        matchClass: decision.matchClass,
        status: decision.status,
      };
    }
  }

  const ordered = [...records.values()].sort((left, right) =>
    left.lgdGramPanchayatCode.localeCompare(right.lgdGramPanchayatCode),
  );
  const byMatchClass: Record<string, number> = {};
  let jjmBound = 0;
  let censusBound = 0;
  let bothBound = 0;
  let unbound = 0;
  let verifiedBindings = 0;
  let proposedBindings = 0;
  for (const record of ordered) {
    for (const binding of [record.jjm, record.census]) {
      if (!binding) continue;
      if (binding.status === "verified") verifiedBindings += 1;
      else proposedBindings += 1;
    }
    if (record.jjm) {
      jjmBound += 1;
      byMatchClass[record.jjm.matchClass] =
        (byMatchClass[record.jjm.matchClass] ?? 0) + 1;
    }
    if (record.census) {
      censusBound += 1;
      byMatchClass[record.census.matchClass] =
        (byMatchClass[record.census.matchClass] ?? 0) + 1;
    }
    if (record.jjm && record.census) bothBound += 1;
    if (!record.jjm && !record.census) unbound += 1;
  }

  if (ordered.length !== proposal.summary.lgdGramPanchayats) {
    throw new Error(
      `Canonical crosswalk holds ${ordered.length} Gram Panchayats, expected ` +
        `${proposal.summary.lgdGramPanchayats}`,
    );
  }

  return {
    schemaVersion: CROSSWALK_SCHEMA_VERSION,
    planId: proposal.planId,
    proposalId: proposal.id,
    foldingVersion: proposal.foldingVersion,
    matchProcedureVersion: proposal.matchProcedureVersion,
    resolutionIds: resolutions.map((resolution) => resolution.id).sort(),
    records: ordered,
    summary: {
      lgdGramPanchayats: ordered.length,
      jjmBound,
      censusBound,
      bothBound,
      unbound,
      verifiedBindings,
      proposedBindings,
      byMatchClass,
    },
  };
}
