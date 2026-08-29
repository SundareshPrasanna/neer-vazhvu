/**
 * Briefs a reviewer wrote, served beside the generated ones as
 * public/data/atlas/<state>/<district>/curated-briefs.json.
 *
 * A generated brief states what the evidence supports. A reviewed brief adds
 * what a person understood about the place, which no rule derives: that
 * Koviladi holds joint Census memberships, or that a Panchayat's canal
 * dependence is historical rather than current. Where one exists the page
 * prefers it and says so; the generated brief stays underneath for the named
 * gaps. The file is data with an NVDM envelope (method manual), so a reviewer
 * edits prose, not TypeScript.
 */
import type { AtlasEnvelope } from "./artifacts";
import { readDistrictArtifact } from "./data";
import { listAtlasDistricts, type AtlasDistrict } from "./registry";

export type AtlasBriefStatus = "brief-ready" | "review-blocked";

export interface AtlasInsight {
  id: string;
  domain:
    | "identity"
    | "drinking-water"
    | "groundwater"
    | "agriculture"
    | "pollution";
  title: string;
  text: string;
}

export interface AtlasEvidenceSource {
  id: string;
  name: string;
  sourceUrl: string;
  sourceAsOf: string;
  supports: string[];
  limitations: string[];
}

export interface CuratedBrief {
  lgdCode: string;
  /** The reviewed target id (refresh-plan.json), e.g. "poondi". */
  placeId: string;
  name: string;
  blockName: string;
  status: AtlasBriefStatus;
  thesis: string;
  verdictTitle: string;
  verdictBody: string;
  headlineFacts: Array<{ value: string; label: string; note: string }>;
  insights: AtlasInsight[];
  nextEvidence: string[];
  reviewedAt: string;
  evidence: AtlasEvidenceSource[];
}

export interface CuratedBriefsArtifact extends AtlasEnvelope {
  schemaVersion: number;
  briefs: CuratedBrief[];
}

function districtBySlug(districtSlug: string): AtlasDistrict | undefined {
  return listAtlasDistricts().find((district) => district.slug === districtSlug);
}

/**
 * The reviewed briefs a district serves. The registry flag is the gate: a
 * district not marked as carrying reviewed briefs shows none even when a
 * file is present, so a stray artifact cannot publish itself.
 */
export function curatedBriefsOf(
  district: AtlasDistrict,
  artifact: CuratedBriefsArtifact | undefined,
): CuratedBrief[] {
  if (!district.hasCuratedBriefs) return [];
  return artifact?.briefs ?? [];
}

export function findCuratedBrief(
  briefs: CuratedBrief[],
  lgdCode: string,
): CuratedBrief | undefined {
  return briefs.find((brief) => brief.lgdCode === lgdCode);
}

export function getCuratedBriefs(districtSlug: string): CuratedBrief[] {
  const district = districtBySlug(districtSlug);
  if (!district || !district.hasCuratedBriefs) return [];
  return curatedBriefsOf(
    district,
    readDistrictArtifact<CuratedBriefsArtifact>(district, "curated-briefs"),
  );
}

export function getCuratedBrief(
  districtSlug: string,
  lgdCode: string,
): CuratedBrief | undefined {
  return findCuratedBrief(getCuratedBriefs(districtSlug), lgdCode);
}

export function curatedBriefCount(districtSlug: string): number {
  return getCuratedBriefs(districtSlug).length;
}
