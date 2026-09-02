/**
 * The flood tier's thin artifact: each state's own disaster-management-plan
 * classification, served as the plan states it and nothing more.
 *
 *   npx tsx scripts/atlas-flood-classification.ts --as-of 2026-09-02
 *
 * Maharashtra's SDMP 2023 names the eight districts that are NOT flood-prone;
 * Tamil Nadu's SDMP 2023 names fourteen coastal districts as highly
 * vulnerable and leaves inland flooding unclassified per district - the
 * artifact carries that asymmetry rather than papering over it. The deep
 * flood family (DDMP tables, HFL) is plan 3.7's follow-up.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { registryLicense } from "./lib/registry-contract";
import { ATLAS_DISTRICTS } from "../src/lib/atlas/registry";

const ROOT = resolve(__dirname, "..");
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_IDS: Record<string, string> = { mh: "mh-sdmp-2023", tn: "tn-sdmp-2023" };
const STATE_SCOPE: Record<string, string> = { mh: "maharashtra", tn: "tamil-nadu" };

interface NamedDistrict { sdmpName: string; currentName: string; registrySlug?: string }
interface Input {
  _doc?: string;
  schemaVersion: number;
  state: string;
  source: { title: string; publisher: string; url: string; pdfSha256: string; bytes: number; pages: number; documentDate: string; retrievedAt: string };
  classification: {
    kind: "flood-prone-except" | "coastal-high-vulnerability";
    statement: string;
    exceptions?: NamedDistrict[];
    districts?: NamedDistrict[];
    quote: string;
    section: string;
    pdfPage: number;
    printedPage: number | null;
  };
  review: { status: string; transcribedAt: string; transcribedBy: string; verifiedAt: string | null; verifiedBy: string | null };
}

function validate(input: Input, label: string): string[] {
  const errors: string[] = [];
  if (input.schemaVersion !== 1) errors.push(`${label}: schemaVersion must be 1`);
  if (!SOURCE_IDS[input.state]) errors.push(`${label}: unknown state ${input.state}`);
  if (!/^[0-9a-f]{64}$/.test(input.source?.pdfSha256 ?? "")) errors.push(`${label}: pdfSha256 must be 64-hex`);
  if (!DATE.test(input.source?.documentDate ?? "")) errors.push(`${label}: documentDate must be YYYY-MM-DD`);
  const c = input.classification;
  const list = c?.kind === "flood-prone-except" ? c.exceptions : c?.districts;
  if (!Array.isArray(list) || list.length === 0) {
    errors.push(`${label}: the classification must name its districts`);
    return errors;
  }
  if (c.kind === "flood-prone-except" && list.length !== 8) errors.push(`${label}: the MH plan names exactly eight exceptions`);
  if (c.kind === "coastal-high-vulnerability" && list.length !== 14) errors.push(`${label}: the TN plan names exactly fourteen districts`);
  const seen = new Set<string>();
  const slugs = new Set(ATLAS_DISTRICTS.filter((D) => D.stateSlug === input.state).map((D) => D.slug));
  for (const [i, row] of list.entries()) {
    const l = `${label}[${i}]`;
    if (!row.sdmpName || !row.currentName) errors.push(`${l}: sdmpName and currentName are required`);
    if (seen.has(row.currentName)) errors.push(`${l}: duplicate ${row.currentName}`);
    seen.add(row.currentName);
    // The plan's own name must appear in the quote: the classification is
    // the document's, so every name it lists has to be checkable against it.
    if (row.sdmpName && !c.quote.includes(row.sdmpName)) errors.push(`${l}: ${row.sdmpName} does not appear in the quote`);
    if (row.registrySlug && !slugs.has(row.registrySlug)) errors.push(`${l}: registrySlug ${row.registrySlug} is not a registered ${input.state} district`);
  }
  if (!c.quote?.trim() || !Number.isInteger(c.pdfPage) || c.pdfPage < 1) errors.push(`${label}: quote and pdfPage are required`);
  if (input.review?.status !== "proposed" && input.review?.status !== "verified") errors.push(`${label}: review.status must be proposed or verified`);
  return errors;
}

function main(): void {
  const asOfIdx = process.argv.indexOf("--as-of");
  const asOf = asOfIdx > -1 ? process.argv[asOfIdx + 1] : undefined;
  if (!asOf || !DATE.test(asOf)) throw new Error("--as-of YYYY-MM-DD is required");
  for (const state of ["mh", "tn"]) {
    const path = join(ROOT, `pipeline-inputs/atlas/flood-classification/${state}.json`);
    const input = JSON.parse(readFileSync(path, "utf8")) as Input;
    const errors = validate(input, `${state}.json`);
    if (errors.length > 0) throw new Error(`flood-classification input invalid:\n- ${errors.join("\n- ")}`);
    const { _doc, ...payload } = input;
    const artifact = {
      nvdm: "1.0",
      dataset: "atlas/flood-classification",
      scope: { kind: "state", id: STATE_SCOPE[state] },
      provenance: {
        sources: [{
          id: SOURCE_IDS[state],
          title: input.source.title,
          publisher: input.source.publisher,
          license: registryLicense(SOURCE_IDS[state]),
          role: "asserts",
          url: input.source.url,
          as_of: input.source.documentDate,
          retrieved: input.source.retrievedAt,
        }],
        method: "manual",
        produced_at: asOf,
        produced_by: "scripts/atlas-flood-classification.ts",
        // The reviewed transcription inputs live in pipeline-inputs/, outside
        // the catalogue: internal_inputs is catalogue lineage only.
        internal_inputs: [],
        note:
          "The state disaster management plan's own flood classification, transcribed with the " +
          "sentence and page it comes from; the Atlas classifies nothing itself. Maharashtra's " +
          "plan names the districts that are NOT flood-prone; Tamil Nadu's names fourteen coastal " +
          "districts as highly vulnerable and leaves inland flood exposure unclassified per " +
          "district, so absence from the Tamil Nadu list is not a statement of safety.",
      },
      ...payload,
    };
    const out = join(ROOT, `public/data/atlas/${state}/flood-classification.json`);
    writeFileSync(out, JSON.stringify(artifact, null, 2) + "\n");
    console.log(`Wrote public/data/atlas/${state}/flood-classification.json (${input.classification.kind})`);
  }
}
main();
