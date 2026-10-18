import type { Channel } from "./routing/types";
import type { ActorRole, CaseStatus, ReviewStatus } from "./status";
import type { TestMeta } from "./test-meta";

export type PlaceKind = "city" | "district" | "basin";

/** Mirrors supabase/migrations/062_citizen_reports.sql. */
export interface SightingRow {
  id: string;
  created_at: string;
  updated_at: string;
  /** HMAC of the account id (src/lib/sightings/auth.ts), or "deleted". */
  reporter_key: string;
  place_kind: PlaceKind;
  place_id: string;
  state_code: string;
  corporation_id: string | null;
  ward_id: string | null;
  ward_name: string | null;
  block_code: string | null;
  panchayat_code: string | null;
  panchayat_name: string | null;
  water_body_id: string | null;
  water_body_name: string | null;
  locality: string | null;
  lat: number;
  lng: number;
  location_accuracy_m: number | null;
  category: string;
  subcategory: string | null;
  note: string | null;
  readings: Record<string, number> | null;
  water_source: string | null;
  test_meta: TestMeta | null;
  group_id: string | null;
  candidate_label: string | null;
  authority_role: string | null;
  review_status: ReviewStatus;
  case_status: CaseStatus | null;
  reviewed_at: string | null;
  exif_captured_at: string | null;
  exif_lat: number | null;
  exif_lng: number | null;
}

export interface PhotoRow {
  id: string;
  sighting_id: string;
  kind: "report" | "fixed";
  storage_path: string;
  public_path: string | null;
  ordinal: number;
}

export interface EventRow {
  sighting_id: string;
  created_at: string;
  actor_role: ActorRole;
  event: string;
  authority_body: string | null;
  reference: string | null;
  reason: string | null;
}

export interface Handler {
  body: string;
  acronym?: string;
  channels: Channel[];
  source: string;
}

/** Safe for anyone: no reporter, no note, no exact point, no time of day. */
/** A planned clean-up as the public sees it: the group, when, where to meet, and how many are coming. Never who. */
export interface PublicFixit {
  id: string;
  groupName: string;
  startsAt: string;
  meetingPoint: string;
  note: string | null;
  going: number;
}

export interface PublicReport {
  id: string;
  /** YYYY-MM-DD only. */
  createdAt: string;
  placeKind: PlaceKind;
  placeId: string;
  placeName: string;
  where: string | null;
  category: string;
  subcategory: string | null;
  label: string;
  caseStatus: CaseStatus | null;
  /** Resident's own test results, each with how it sits against BIS limits. */
  readings: { text: string; assessment: string | null }[];
  waterSource: string | null;
  /** How the test was done, as one public line; null without readings or details. */
  test: string | null;
  photoUrls: string[];
  /** `by` says who recorded it: the reporter, another resident, the handling department or our reviewer. */
  events: { event: string; at: string; authorityBody: string | null; by: ActorRole }[];
  handler: Handler | null;
  /** [lat, lng] rounded to 3 decimals (about 100 m) for the public map; null for tap water and water tests. */
  point: [number, number] | null;
  /** People other than the reporter who said "seen this too", and thanks once fixed. */
  seenCount: number;
  thanksCount: number;
  /** The group it was sent with, by name only; null when sent alone. */
  groupName: string | null;
  /** The next planned clean-up at this spot, if a group has planned one. */
  fixit: PublicFixit | null;
  /** The most specific place key to follow for this report (water body, panchayat, ward or place); see follows.ts. */
  followTarget: string;
  /** The public page it shows on and that page's name (src/lib/sightings/place-url.ts); null where none does. */
  placeHref: string | null;
  placeLabel: string | null;
}

/** What the reporter sees of their own report. */
export interface OwnReport extends PublicReport {
  lat: number;
  lng: number;
  reviewStatus: ReviewStatus;
  rejectReason: string | null;
  references: { authorityBody: string | null; reference: string; at: string }[];
  nationalChannels: Channel[];
  /** The full test details, for the reporter's own list and download. */
  testMeta: TestMeta | null;
}
