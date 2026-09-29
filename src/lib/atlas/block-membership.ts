/**
 * The reviewed block membership of an LGD-built district whose development
 * blocks cut across its taluks (Kerala: Chittur taluk holds the Chittur,
 * Kollengode and Nenmara blocks). The LGD republication on data.gov.in has no
 * development-block resource, so under blockModel "development-block" a Gram
 * Panchayat's block comes from here, read from the state's own statement of
 * which Panchayats form each Block Panchayat and bound to LGD codes by a
 * person. The identity refresh fails closed when the LGD Panchayat list and
 * this file disagree: a new Panchayat is a review, never a guess.
 *
 * Lives at pipeline-inputs/atlas/<state>/<district>/block-membership.json.
 */
import { readFileSync } from "node:fs";

import { isNonEmptyString, isRecord, isValidDate, validateUrl } from "./json-guards";

export const BLOCK_MEMBERSHIP_SCHEMA_VERSION = 1;

export interface BlockMembershipBlock {
  /** Numeric, as the Atlas schemas require: the LGD code of the Block Panchayat. */
  code: string;
  name: string;
}

export interface BlockMembershipMember {
  lgdGramPanchayatCode: string;
  /** The LGD name, repeated so a reader can check the row without a lookup. */
  name: string;
  blockCode: string;
  /** The Panchayat's name in the plan's boundary layer, when polygons are
   *  read from a state layer keyed by name (Kerala: KSREC's LB_NAME_EN). */
  boundaryName?: string;
  /** Why this row is what it is, when the sources disagree. */
  note?: string;
}

export interface BlockMembership {
  schemaVersion: number;
  planId: string;
  authority: {
    title: string;
    publisher: string;
    urls: string[];
    asOf: string;
  };
  review: {
    status: "proposed" | "verified";
    stagedAt: string;
    verifiedAt: string | null;
    verifiedBy: string | null;
  };
  blocks: BlockMembershipBlock[];
  members: BlockMembershipMember[];
}

const NUMERIC = /^[0-9]+$/;

export function validateBlockMembership(raw: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(raw)) return ["block membership: root must be an object"];
  if (raw.schemaVersion !== BLOCK_MEMBERSHIP_SCHEMA_VERSION) {
    errors.push(`schemaVersion: expected ${BLOCK_MEMBERSHIP_SCHEMA_VERSION}`);
  }
  if (!isNonEmptyString(raw.planId)) errors.push("planId: must be non-empty");
  const authority = raw.authority;
  if (!isRecord(authority)) errors.push("authority: must be an object");
  else {
    for (const field of ["title", "publisher"]) {
      if (!isNonEmptyString(authority[field])) errors.push(`authority.${field}: must be non-empty`);
    }
    if (!Array.isArray(authority.urls) || authority.urls.length === 0) {
      errors.push("authority.urls: must be a non-empty array");
    } else authority.urls.forEach((url, index) => validateUrl(url, `authority.urls[${index}]`, errors));
    if (!isValidDate(authority.asOf)) errors.push("authority.asOf: must be YYYY-MM-DD");
  }
  const review = raw.review;
  if (!isRecord(review)) errors.push("review: must be an object");
  else {
    if (review.status !== "proposed" && review.status !== "verified") {
      errors.push("review.status: must be proposed or verified");
    }
    if (!isValidDate(review.stagedAt)) errors.push("review.stagedAt: must be YYYY-MM-DD");
    if (review.status === "verified") {
      if (!isValidDate(review.verifiedAt)) errors.push("review.verifiedAt: required with status verified");
      if (!isNonEmptyString(review.verifiedBy)) errors.push("review.verifiedBy: required with status verified");
    } else if (review.verifiedAt !== null || review.verifiedBy !== null) {
      errors.push("review.verifiedAt and verifiedBy: must be null until verified");
    }
  }
  const blockCodes = new Set<string>();
  if (!Array.isArray(raw.blocks) || raw.blocks.length === 0) errors.push("blocks: must be a non-empty array");
  else {
    for (const [index, block] of raw.blocks.entries()) {
      if (!isRecord(block) || !isNonEmptyString(block.name) || !isNonEmptyString(block.code)) {
        errors.push(`blocks[${index}]: needs code and name`);
        continue;
      }
      if (!NUMERIC.test(block.code)) errors.push(`blocks[${index}].code: must be numeric (${block.code})`);
      if (blockCodes.has(block.code)) errors.push(`blocks[${index}].code: ${block.code} repeats`);
      blockCodes.add(block.code);
    }
  }
  const members = new Set<string>();
  const perBlock = new Map<string, number>();
  if (!Array.isArray(raw.members) || raw.members.length === 0) errors.push("members: must be a non-empty array");
  else {
    for (const [index, member] of raw.members.entries()) {
      const label = `members[${index}]`;
      if (!isRecord(member)) {
        errors.push(`${label}: must be an object`);
        continue;
      }
      const code = member.lgdGramPanchayatCode;
      if (!isNonEmptyString(code) || !/^[0-9]{6}$/.test(code)) errors.push(`${label}.lgdGramPanchayatCode: must be a 6-digit LGD code`);
      else if (members.has(code)) errors.push(`${label}.lgdGramPanchayatCode: ${code} repeats`);
      else members.add(code);
      if (!isNonEmptyString(member.name)) errors.push(`${label}.name: must be non-empty`);
      if (!isNonEmptyString(member.blockCode) || !blockCodes.has(member.blockCode)) {
        errors.push(`${label}.blockCode: ${String(member.blockCode)} is not a listed block`);
      } else perBlock.set(member.blockCode, (perBlock.get(member.blockCode) ?? 0) + 1);
      for (const field of ["boundaryName", "note"]) {
        if (member[field] !== undefined && !isNonEmptyString(member[field])) errors.push(`${label}.${field}: must be non-empty when present`);
      }
    }
  }
  for (const code of blockCodes) {
    if (!perBlock.has(code)) errors.push(`blocks: ${code} has no member Panchayat`);
  }
  return errors;
}

export function loadBlockMembership(path: string, planId: string): BlockMembership {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const errors = validateBlockMembership(parsed);
  if (errors.length > 0) throw new Error(`Invalid block membership ${path}:\n- ${errors.join("\n- ")}`);
  const membership = parsed as BlockMembership;
  if (membership.planId !== planId) throw new Error(`block membership is for ${membership.planId}, the plan is ${planId}`);
  return membership;
}

/** The membership must name exactly the Panchayats the LGD register lists:
 *  a Panchayat added or dissolved upstream stops the refresh for review. */
export function assertMembershipCoversPanchayats(membership: BlockMembership, lgdCodes: string[]): void {
  const listed = new Set(membership.members.map((member) => member.lgdGramPanchayatCode));
  const register = new Set(lgdCodes);
  const missing = [...register].filter((code) => !listed.has(code)).sort();
  const extra = [...listed].filter((code) => !register.has(code)).sort();
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      "block membership and the LGD register disagree: " +
        [
          missing.length > 0 ? `not in the membership: ${missing.join(", ")}` : "",
          extra.length > 0 ? `not in the register: ${extra.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("; ") +
        " (review pipeline-inputs/atlas/<state>/<district>/block-membership.json)",
    );
  }
}
