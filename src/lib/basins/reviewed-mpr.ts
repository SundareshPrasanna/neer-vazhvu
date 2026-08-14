export type ReviewedMprValue =
  | { kind: "quantity"; value: number; unit: string; qualifier: string }
  | { kind: "text"; value: string }
  | { kind: "relationship"; objectId: string; objectLabel: string };

export type ReviewedMprRecord = {
  claimId: string;
  concept: string;
  subjectId: string;
  subjectLabel: string;
  value: ReviewedMprValue;
  pageNumber: number;
};

export type ReviewedMprEdition = {
  editionId: string;
  period: { start: string; end: string };
  source: { title: string; publisher: string; url: string; asOf: string };
  records: ReviewedMprRecord[];
};

export type ReviewedMprSeries = {
  schema: "neer-vazhvu.public-mpr-series";
  schemaVersion: "1";
  surfaceId: "arkavathi-progress";
  scope: { kind: "basin"; id: "arkavathi" };
  editions: ReviewedMprEdition[];
  summary: { editionCount: number; recordCount: number };
};

const CONCEPT_LABELS: Record<string, string> = {
  "alternate-treatment-quantity": "Alternate treatment",
  "capacity-utilized": "Capacity utilised",
  "complying-treatment-facility-count": "Complying STPs",
  "estimated-sewage-generation": "Estimated sewage generation",
  "facility-design-capacity": "Design capacity",
  "facility-location": "Location",
  "facility-operational-status": "Operational status",
  "non-complying-treatment-facility-count": "Non-complying STPs",
  "operational-treatment-facility-count": "Operational STPs",
  "pollution-priority": "Pollution priority",
  "population": "Population",
  "reported-local-body-context": "Local body",
  "sewage-treatment-capacity-gap": "Treatment capacity gap",
  "solid-waste-collected": "Solid waste collected",
  "solid-waste-management-gap": "Solid-waste management gap",
  "solid-waste-processed": "Solid waste processed",
  "solid-waste-secured-landfill": "Secured landfill",
  "solid-waste-segregated-and-transported": "Segregated and transported",
  "treatment-capacity": "Treatment capacity",
  "treatment-facility-count": "STPs",
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseValue(value: unknown): ReviewedMprValue | null {
  const candidate = record(value);
  if (!candidate) return null;
  if (candidate.kind === "quantity") {
    if (!Number.isFinite(candidate.value) || !text(candidate.unit) || !text(candidate.qualifier)) return null;
    return {
      kind: "quantity",
      value: Number(candidate.value),
      unit: String(candidate.unit),
      qualifier: String(candidate.qualifier),
    };
  }
  if (candidate.kind === "text" && text(candidate.value)) {
    return { kind: "text", value: String(candidate.value) };
  }
  if (candidate.kind === "relationship" && text(candidate.objectId) && text(candidate.objectLabel)) {
    return {
      kind: "relationship",
      objectId: String(candidate.objectId),
      objectLabel: String(candidate.objectLabel),
    };
  }
  return null;
}

function parseRecord(value: unknown): ReviewedMprRecord | null {
  const candidate = record(value);
  if (!candidate) return null;
  const parsedValue = parseValue(candidate.value);
  if (
    !text(candidate.claimId)
    || !text(candidate.concept)
    || !text(candidate.subjectId)
    || !text(candidate.subjectLabel)
    || !Number.isInteger(candidate.pageNumber)
    || Number(candidate.pageNumber) < 1
    || !parsedValue
  ) return null;
  return {
    claimId: String(candidate.claimId),
    concept: String(candidate.concept),
    subjectId: String(candidate.subjectId),
    subjectLabel: String(candidate.subjectLabel),
    value: parsedValue,
    pageNumber: Number(candidate.pageNumber),
  };
}

function parseEdition(value: unknown): ReviewedMprEdition | null {
  const candidate = record(value);
  const period = record(candidate?.period);
  const source = record(candidate?.source);
  if (!candidate || !period || !source || !Array.isArray(candidate.records)) return null;
  const records = candidate.records.map(parseRecord);
  if (
    !text(candidate.editionId)
    || !text(period.start)
    || !text(period.end)
    || !text(source.title)
    || !text(source.publisher)
    || !text(source.url)
    || !String(source.url).startsWith("https://")
    || !text(source.asOf)
    || records.some((item) => item === null)
  ) return null;
  return {
    editionId: String(candidate.editionId),
    period: { start: String(period.start), end: String(period.end) },
    source: {
      title: String(source.title),
      publisher: String(source.publisher),
      url: String(source.url),
      asOf: String(source.asOf),
    },
    records: records as ReviewedMprRecord[],
  };
}

export function parseReviewedMprSeries(value: unknown): ReviewedMprSeries | null {
  const candidate = record(value);
  const scope = record(candidate?.scope);
  const summary = record(candidate?.summary);
  if (
    !candidate
    || candidate.schema !== "neer-vazhvu.public-mpr-series"
    || candidate.schemaVersion !== "1"
    || candidate.surfaceId !== "arkavathi-progress"
    || scope?.kind !== "basin"
    || scope.id !== "arkavathi"
    || !summary
    || !Array.isArray(candidate.editions)
  ) return null;
  const editions = candidate.editions.map(parseEdition);
  const editionCount = Number(summary.editionCount);
  const recordCount = Number(summary.recordCount);
  if (
    editions.some((item) => item === null)
    || !Number.isInteger(editionCount)
    || !Number.isInteger(recordCount)
    || editionCount !== editions.length
    || recordCount !== editions.reduce((total, edition) => total + (edition?.records.length ?? 0), 0)
  ) return null;
  return {
    schema: "neer-vazhvu.public-mpr-series",
    schemaVersion: "1",
    surfaceId: "arkavathi-progress",
    scope: { kind: "basin", id: "arkavathi" },
    editions: editions as ReviewedMprEdition[],
    summary: { editionCount, recordCount },
  };
}

export function reviewedMprConceptLabel(concept: string): string {
  const local = concept.includes(":") ? concept.slice(concept.lastIndexOf(":") + 1) : concept;
  return CONCEPT_LABELS[local]
    ?? local.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function reviewedMprValueLabel(value: ReviewedMprValue): string {
  if (value.kind === "text") return value.value;
  if (value.kind === "relationship") return value.objectLabel;
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value.value)} ${value.unit}`;
}
