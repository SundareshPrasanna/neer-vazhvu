/**
 * CPCB polluted river stretches as a district layer.
 *
 * One national reviewed input (pipeline-inputs/atlas/prs/cpcb-<edition>.json)
 * carries every stretch and single-location PRS CPCB lists for the states the
 * Atlas covers, with its monitoring stations, its change class since 2018 and
 * the districts it touches. The producer serves each district the entries
 * whose district list names it; a district with none gets a zero-count
 * artifact, because "CPCB lists no polluted stretch here" is a statement.
 */
import type { AtlasEnvelope } from "./artifacts";

export const POLLUTED_STRETCHES_SCHEMA_VERSION = 1;

export type PrsPriority = "I" | "II" | "III" | "IV" | "V";
export type PrsChangeClass = "improved" | "same" | "deteriorated" | "new" | "dropped";
/** How an entry was joined to a district: a place CPCB prints, or the
 *  maintainer's reading of the river's course. */
export type PrsDistrictBasisKind = "named" | "course";

export interface PrsStation {
  code: string;
  location: string;
  bod2024: number | null;
}

export interface PrsDistrictLink {
  name: string;
  kind: PrsDistrictBasisKind;
  basis: string;
  scopeId?: string;
}

export interface PrsSince2018 {
  class: PrsChangeClass;
  stretch2018: string | null;
  priority2018: PrsPriority | null;
  annexure: string;
  sno: number;
  pdfPage: number;
}

export interface PrsEntry {
  id: string;
  state: string;
  stateSlug: string;
  kind: "stretch" | "location";
  river: string;
  text: string;
  priority: PrsPriority;
  maxBod2022_23: number | null;
  serial: { annexure: string; sno: number; pdfPage: number };
  stations: PrsStation[];
  since2018: PrsSince2018 | null;
  districts: PrsDistrictLink[];
  review: { status: "proposed" | "verified"; reviewedAt: string | null; reviewedBy: string | null; note: string };
}

export interface PrsEdition {
  label: string;
  reportTitle: string;
  publishedLabel: string;
  bodObservedYears: string;
  followUpBodYear: string;
  url: string;
  pdfSha256: string;
  pdfBytes: number;
  pdfPages: number;
  retrievedAt: string;
  annexures: Record<string, string>;
  priorityBands: Record<PrsPriority, string>;
}

export interface PrsStateNote {
  stateSlug: string;
  text: string;
  districts: PrsDistrictLink[];
  basis: string;
}

export interface PollutedStretchesInput {
  schemaVersion: number;
  id: string;
  sourceId: string;
  edition: PrsEdition;
  states: { slug: string; name: string; cpcbName: string; stretches: number; locations: number; tableRef: string }[];
  stateNotes: PrsStateNote[];
  entries: PrsEntry[];
}

/** One district's slice: the entries whose district list names it, each
 *  carrying only this district's join basis. */
export interface PollutedStretchesPayload {
  schemaVersion: number;
  planId: string;
  districtName: string;
  edition: PrsEdition;
  count: number;
  entries: (Omit<PrsEntry, "districts"> & { district: PrsDistrictLink })[];
  notes: Omit<PrsStateNote, "districts">[];
}

export interface PollutedStretchesArtifact extends AtlasEnvelope, PollutedStretchesPayload {}

const PRIORITIES: PrsPriority[] = ["I", "II", "III", "IV", "V"];
const CHANGE_CLASSES: PrsChangeClass[] = ["improved", "same", "deteriorated", "new", "dropped"];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export function validatePollutedStretchesInput(raw: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(raw)) return ["input: must be an object"];
  if (raw.schemaVersion !== POLLUTED_STRETCHES_SCHEMA_VERSION) errors.push(`schemaVersion: expected ${POLLUTED_STRETCHES_SCHEMA_VERSION}`);
  for (const key of ["id", "sourceId"]) if (!isText(raw[key])) errors.push(`${key}: required`);
  const edition = raw.edition;
  if (!isRecord(edition)) errors.push("edition: must be an object");
  else {
    for (const key of ["label", "reportTitle", "url", "pdfSha256", "retrievedAt", "bodObservedYears", "followUpBodYear"]) {
      if (!isText(edition[key])) errors.push(`edition.${key}: required`);
    }
    if (!isRecord(edition.priorityBands) || PRIORITIES.some((p) => !isText((edition.priorityBands as Record<string, unknown>)[p]))) {
      errors.push("edition.priorityBands: one band per priority I to V");
    }
  }
  if (!Array.isArray(raw.entries) || raw.entries.length === 0) errors.push("entries: must be a non-empty array");
  else {
    const ids = new Set<string>();
    raw.entries.forEach((entry, index) => {
      const label = `entries[${index}]`;
      if (!isRecord(entry)) return void errors.push(`${label}: must be an object`);
      if (!isText(entry.id)) errors.push(`${label}.id: required`);
      else if (ids.has(entry.id)) errors.push(`${label}.id: duplicate ${entry.id}`);
      else ids.add(entry.id);
      for (const key of ["state", "stateSlug", "river", "text"]) if (!isText(entry[key])) errors.push(`${label}.${key}: required`);
      if (entry.kind !== "stretch" && entry.kind !== "location") errors.push(`${label}.kind: stretch or location`);
      if (!PRIORITIES.includes(entry.priority as PrsPriority)) errors.push(`${label}.priority: I to V`);
      if (entry.maxBod2022_23 !== null && typeof entry.maxBod2022_23 !== "number") errors.push(`${label}.maxBod2022_23: number or null`);
      if (!isRecord(entry.serial) || typeof entry.serial.sno !== "number" || typeof entry.serial.pdfPage !== "number") {
        errors.push(`${label}.serial: annexure, sno and pdfPage`);
      }
      if (!Array.isArray(entry.stations)) errors.push(`${label}.stations: must be an array`);
      if (entry.since2018 !== null) {
        if (!isRecord(entry.since2018) || !CHANGE_CLASSES.includes(entry.since2018.class as PrsChangeClass)) {
          errors.push(`${label}.since2018: null or a change class with its annexure`);
        }
      }
      if (!Array.isArray(entry.districts)) errors.push(`${label}.districts: must be an array`);
      else {
        entry.districts.forEach((district, i) => {
          if (!isRecord(district) || !isText(district.name) || !isText(district.basis)) {
            errors.push(`${label}.districts[${i}]: name and basis required`);
          } else if (district.kind !== "named" && district.kind !== "course") {
            errors.push(`${label}.districts[${i}].kind: named or course`);
          }
        });
      }
      if (!isRecord(entry.review) || (entry.review.status !== "proposed" && entry.review.status !== "verified")) {
        errors.push(`${label}.review.status: proposed or verified`);
      }
    });
  }
  return errors;
}

const fold = (s: string): string => s.toLowerCase().replace(/[^a-z]/g, "");

function linkFor(links: PrsDistrictLink[], scopeId: string, name: string): PrsDistrictLink | undefined {
  return links.find((d) => d.scopeId === scopeId) ?? links.find((d) => !d.scopeId && fold(d.name) === fold(name));
}

/** The entries and notes that name one district, by scope id first and by
 *  folded name otherwise; entries of other states never match. */
export function selectForDistrict(
  input: PollutedStretchesInput,
  district: { scopeId: string; stateSlug: string; name: string },
): Pick<PollutedStretchesPayload, "entries" | "notes" | "count"> {
  const entries: PollutedStretchesPayload["entries"] = [];
  for (const entry of input.entries) {
    if (entry.stateSlug !== district.stateSlug) continue;
    const link = linkFor(entry.districts, district.scopeId, district.name);
    if (!link) continue;
    const { districts: _districts, ...rest } = entry;
    void _districts;
    entries.push({ ...rest, district: link });
  }
  entries.sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || a.river.localeCompare(b.river));
  const notes = input.stateNotes
    .filter((note) => note.stateSlug === district.stateSlug && linkFor(note.districts, district.scopeId, district.name))
    .map(({ districts: _d, ...note }) => (void _d, note));
  return { entries, notes, count: entries.length };
}

export interface PollutedStretchesReading {
  editionLabel: string;
  bodObservedYears: string;
  followUpBodYear: string;
  url: string;
  count: number;
  worstPriority: PrsPriority | null;
  /** True when at least one entry is joined by a place CPCB prints. */
  named: boolean;
  entries: PollutedStretchesPayload["entries"];
  notes: PollutedStretchesPayload["notes"];
  /** One line for the district verdict, or null when nothing is listed. */
  sentence: string | null;
}

export function pollutedStretchesReading(artifact: PollutedStretchesArtifact): PollutedStretchesReading {
  const worst = artifact.entries[0]?.priority ?? null;
  const parts = artifact.entries.map((e) => `${e.river} (Priority ${e.priority})`);
  const sentence =
    artifact.count === 0
      ? null
      : `CPCB's ${artifact.edition.publishedLabel} report lists ${artifact.count === 1 ? "one polluted stretch" : `${artifact.count} polluted stretches`} touching the district: ${parts.join(", ")}.`;
  return {
    editionLabel: artifact.edition.label,
    bodObservedYears: artifact.edition.bodObservedYears,
    followUpBodYear: artifact.edition.followUpBodYear,
    url: artifact.edition.url,
    count: artifact.count,
    worstPriority: worst,
    named: artifact.entries.some((e) => e.district.kind === "named"),
    entries: artifact.entries,
    notes: artifact.notes,
    sentence,
  };
}
