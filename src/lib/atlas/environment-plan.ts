import {
  ID_PATTERN,
  SHA256_PATTERN,
  isNonEmptyString,
  isPositiveInteger,
  isRecord,
  isValidDate,
  validateStringFields,
  validateUrl,
} from "./acquisition-validation";
import type { AtlasEnvelope } from "./artifacts";

/**
 * A district's Environment Plan, as the state pollution control board
 * publishes it (NGT O.A. 360 of 2018: every district files one on CPCB's
 * model plan, the state collects them). The Atlas serves what the plan
 * STATES about water, transcribed figure by figure with the sentence and
 * the page each came from, and a water balance only where the plan carries
 * one. A plan on the CPCB model (gap-and-action tables) has no balance
 * table; the artifact says so rather than estimating one.
 *
 * The reviewed input under pipeline-inputs/atlas/<state>/<district>/
 * environment-plan.json is the record; the producer envelopes it. Its
 * review status starts as "proposed" (transcribed and page-checked) and a
 * person flips it to "verified" after reading the figures against the PDF.
 */
export const ENVIRONMENT_PLAN_SCHEMA_VERSION = 1;

export interface EnvironmentPlanFigure {
  id: string;
  label: string;
  value: number;
  unit: string;
  detail: string;
  /** The sentence the figure was read from, verbatim. */
  quote: string;
  section: string;
  /** The page a PDF viewer shows, and the number printed on that page. */
  pdfPage: number;
  printedPage: number;
}

export interface EnvironmentPlanActionPoint {
  text: string;
  sector: string;
  priority: string | null;
  pdfPage: number;
}

export interface EnvironmentPlanDocument {
  title: string;
  publisher: string;
  url: string;
  listingUrl: string;
  editionLabel: string;
  editionNote: string;
  documentDate: string;
  pages: number;
  sha256: string;
  bytes: number;
  retrievedAt: string;
  template: string;
  quirks: string[];
}

/** The NGT-template balance, when a plan carries one. Null on the CPCB
 *  model plans, which do not. */
export interface EnvironmentPlanWaterBalance {
  year: string;
  demandMld: number | null;
  supplyMld: number | null;
  deficitMld: number | null;
  quote: string;
  pdfPage: number;
}

export interface EnvironmentPlanReview {
  status: "proposed" | "verified";
  extractedAt: string;
  extractedBy: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

export interface EnvironmentPlanInput {
  schemaVersion: number;
  id: string;
  sourceId: string;
  document: EnvironmentPlanDocument;
  waterBalance: EnvironmentPlanWaterBalance | null;
  figures: EnvironmentPlanFigure[];
  actionPoints: EnvironmentPlanActionPoint[];
  review: EnvironmentPlanReview;
}

export interface EnvironmentPlanArtifact extends AtlasEnvelope, EnvironmentPlanInput {}

export interface EnvironmentPlanReading extends EnvironmentPlanInput {
  hasWaterBalance: boolean;
}

export function validateEnvironmentPlanInput(raw: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(raw)) return ["environment plan: root must be an object"];
  if (raw.schemaVersion !== ENVIRONMENT_PLAN_SCHEMA_VERSION) {
    errors.push(`schemaVersion: expected ${ENVIRONMENT_PLAN_SCHEMA_VERSION}`);
  }
  if (!isNonEmptyString(raw.id) || !ID_PATTERN.test(raw.id)) errors.push("id: invalid identifier");
  if (!isNonEmptyString(raw.sourceId) || !ID_PATTERN.test(raw.sourceId)) errors.push("sourceId: invalid identifier");

  const document = raw.document;
  if (!isRecord(document)) {
    errors.push("document: must be an object");
  } else {
    validateStringFields(document, ["title", "publisher", "editionLabel", "editionNote", "template"], "document", errors);
    validateUrl(document.url, "document.url", errors);
    validateUrl(document.listingUrl, "document.listingUrl", errors);
    if (!isValidDate(document.documentDate)) errors.push("document.documentDate: must be YYYY-MM-DD");
    if (!isValidDate(document.retrievedAt)) errors.push("document.retrievedAt: must be YYYY-MM-DD");
    if (!isPositiveInteger(document.pages)) errors.push("document.pages: must be a positive integer");
    if (!isPositiveInteger(document.bytes)) errors.push("document.bytes: must be a positive integer");
    if (!isNonEmptyString(document.sha256) || !SHA256_PATTERN.test(document.sha256)) {
      errors.push("document.sha256: must be a sha256 hex digest");
    }
    if (!Array.isArray(document.quirks) || !document.quirks.every(isNonEmptyString)) {
      errors.push("document.quirks: must be an array of non-empty strings");
    }
  }

  const balance = raw.waterBalance;
  if (balance !== null) {
    if (!isRecord(balance)) {
      errors.push("waterBalance: must be null (no balance in the plan) or an object");
    } else {
      validateStringFields(balance, ["year", "quote"], "waterBalance", errors);
      for (const field of ["demandMld", "supplyMld", "deficitMld"]) {
        const value = balance[field];
        if (value !== null && !(typeof value === "number" && Number.isFinite(value))) {
          errors.push(`waterBalance.${field}: must be a number or null`);
        }
      }
      if (!isPositiveInteger(balance.pdfPage)) errors.push("waterBalance.pdfPage: must be a positive integer");
    }
  }

  if (!Array.isArray(raw.figures) || raw.figures.length === 0) {
    errors.push("figures: must be a non-empty array");
  } else {
    const ids = new Set<string>();
    raw.figures.forEach((figure, index) => {
      const label = `figures[${index}]`;
      if (!isRecord(figure)) {
        errors.push(`${label}: must be an object`);
        return;
      }
      if (!isNonEmptyString(figure.id) || !ID_PATTERN.test(figure.id)) errors.push(`${label}.id: invalid identifier`);
      else if (ids.has(figure.id)) errors.push(`${label}.id: ${figure.id} repeats`);
      else ids.add(figure.id);
      validateStringFields(figure, ["label", "unit", "quote", "section"], label, errors);
      // A figure may need no gloss beyond its label; the quote is what is required.
      if (typeof figure.detail !== "string") errors.push(`${label}.detail: must be a string (empty allowed)`);
      if (!(typeof figure.value === "number" && Number.isFinite(figure.value))) errors.push(`${label}.value: must be a number`);
      if (!isPositiveInteger(figure.pdfPage)) errors.push(`${label}.pdfPage: must be a positive integer`);
      if (!isPositiveInteger(figure.printedPage)) errors.push(`${label}.printedPage: must be a positive integer`);
      if (isRecord(document) && isPositiveInteger(document.pages) && isPositiveInteger(figure.pdfPage) && figure.pdfPage > document.pages) {
        errors.push(`${label}.pdfPage: beyond the document's ${document.pages} pages`);
      }
    });
  }

  if (!Array.isArray(raw.actionPoints)) {
    errors.push("actionPoints: must be an array");
  } else {
    raw.actionPoints.forEach((point, index) => {
      const label = `actionPoints[${index}]`;
      if (!isRecord(point)) {
        errors.push(`${label}: must be an object`);
        return;
      }
      validateStringFields(point, ["text", "sector"], label, errors);
      if (point.priority !== null && !isNonEmptyString(point.priority)) errors.push(`${label}.priority: must be a string or null`);
      if (!isPositiveInteger(point.pdfPage)) errors.push(`${label}.pdfPage: must be a positive integer`);
    });
  }

  const review = raw.review;
  if (!isRecord(review)) {
    errors.push("review: must be an object");
  } else {
    if (review.status !== "proposed" && review.status !== "verified") errors.push("review.status: must be proposed or verified");
    if (!isValidDate(review.extractedAt)) errors.push("review.extractedAt: must be YYYY-MM-DD");
    if (!isNonEmptyString(review.extractedBy)) errors.push("review.extractedBy: must be non-empty");
    if (review.status === "verified") {
      if (!isValidDate(review.verifiedAt)) errors.push("review.verifiedAt: required with status verified");
      if (!isNonEmptyString(review.verifiedBy)) errors.push("review.verifiedBy: required with status verified");
    } else {
      if (review.verifiedAt !== null) errors.push("review.verifiedAt: must be null until verified");
      if (review.verifiedBy !== null) errors.push("review.verifiedBy: must be null until verified");
    }
  }
  return errors;
}

export function environmentPlanReading(artifact: EnvironmentPlanArtifact): EnvironmentPlanReading {
  return {
    schemaVersion: artifact.schemaVersion,
    id: artifact.id,
    sourceId: artifact.sourceId,
    document: artifact.document,
    waterBalance: artifact.waterBalance,
    figures: artifact.figures,
    actionPoints: artifact.actionPoints,
    review: artifact.review,
    hasWaterBalance: artifact.waterBalance !== null,
  };
}
