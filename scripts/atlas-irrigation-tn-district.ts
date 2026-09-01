/**
 * Current district irrigation source mix from the DES Season and Crop
 * Report's Table III-B ("Area irrigated by different sources"), served as
 * public/data/atlas/<state>/<district>/irrigation-current.json.
 *
 *   npm run atlas:irrigation -- --district thanjavur
 *
 * There is no --fetch: the report is a yearly PDF edition behind a Google
 * Drive link, and the extraction is a person reading Table III-B into
 * pipeline-inputs/atlas/<state>/<district>/irrigation-des.json (the reviewed
 * input, with the edition, page cites and PDF sha256). This producer
 * validates that input, computes the shares, and writes the artifact. A new
 * edition is a Headwaters event on tn-des-season-crop-report; its playbook
 * describes the whole chain.
 *
 * The report's supplementary-wells column is NOT a sixth component: it
 * waters land already counted under another source, so it is carried as a
 * separate field and never added to the net total. The five real components
 * may miss the printed net total by a hectare or two of rounding in the
 * report itself (Tiruchirappalli 2024-25: components 90284 vs printed
 * 90283), so the sum check tolerates 2 ha and the printed total is what is
 * served as the denominator.
 */
import { existsSync, readFileSync } from "node:fs";

import { loadTnDistrictRefreshPlan } from "../src/lib/atlas/acquisition-validation";
import type {
  IrrigationCurrentArtifact,
  IrrigationCurrentShare,
} from "../src/lib/atlas/artifacts";
import type { AtlasDistrict } from "../src/lib/atlas/registry";
import {
  atlasEnvelope,
  registeredSource,
  requireDistrict,
  reviewedInputPath,
  writeAtlasArtifact,
} from "./lib/atlas-producer";

const PRODUCED_BY = "scripts/atlas-irrigation-tn-district.ts";
const SOURCE_ID = "tn-des-season-crop-report";
const INPUT_NAME = "irrigation-des.json";
/** Components must reach the printed net total within this: the report has
 *  rounded a district's total a hectare off its own components before. */
const SUM_TOLERANCE_HECTARES = 2;
const EDITION = /^(\d{4})-(\d{2})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface ReviewedIrrigationInput {
  schemaVersion: number;
  district: string;
  reportSpelling: string;
  rowNumber: number;
  edition: string;
  source: {
    listingUrl: string;
    driveFileId: string;
    pdfSha256: string;
    table: string;
  };
  netAreaIrrigatedHectares: {
    canals: number;
    tanks: number;
    tubeAndBoreWells: number;
    openWells: number;
    otherSources: number;
    total: number;
  };
  grossAreaIrrigatedHectares: number;
  areaIrrigatedMoreThanOnceHectares: number;
  irrigationIntensity: number;
  supplementaryWellsNetHectares: number;
  supplementaryWellsNote: string;
  extractedOn: string;
  notes: string[];
}

function loadReviewedInput(district: AtlasDistrict): ReviewedIrrigationInput {
  const path = reviewedInputPath(district, INPUT_NAME);
  if (!existsSync(path)) {
    throw new Error(`No reviewed extraction at ${path}; nothing to produce`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as ReviewedIrrigationInput;
}

/** Every area figure the report prints is a whole hectare, zero included. */
function requireWholeHectares(errors: string[], label: string, value: unknown): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    errors.push(`${label} must be a positive-or-zero integer, got ${JSON.stringify(value)}`);
  }
}

function validate(
  district: AtlasDistrict,
  planId: string,
  input: ReviewedIrrigationInput,
): string[] {
  const errors: string[] = [];
  if (input.schemaVersion !== 1) errors.push(`schemaVersion must be 1, got ${input.schemaVersion}`);
  if (input.district !== district.slug) {
    errors.push(`input is for ${input.district}, producer was asked for ${district.slug}`);
  }
  if (!EDITION.test(input.edition)) {
    errors.push(`edition must look like "2024-25", got ${JSON.stringify(input.edition)}`);
  } else {
    const [, first, second] = EDITION.exec(input.edition)!;
    if ((Number(first) + 1) % 100 !== Number(second)) {
      errors.push(`edition ${input.edition} is not a consecutive agricultural year`);
    }
  }
  if (!input.source.table.includes("III-B")) {
    errors.push(`source.table must cite Table III-B, got ${JSON.stringify(input.source.table)}`);
  }
  if (!/^[0-9a-f]{64}$/.test(input.source.pdfSha256)) {
    errors.push("source.pdfSha256 must be a 64-hex sha256 of the report PDF");
  }
  if (!DATE.test(input.extractedOn)) errors.push("extractedOn must be YYYY-MM-DD");
  const net = input.netAreaIrrigatedHectares;
  requireWholeHectares(errors, "canals", net.canals);
  requireWholeHectares(errors, "tanks", net.tanks);
  requireWholeHectares(errors, "tubeAndBoreWells", net.tubeAndBoreWells);
  requireWholeHectares(errors, "openWells", net.openWells);
  requireWholeHectares(errors, "otherSources", net.otherSources);
  requireWholeHectares(errors, "total", net.total);
  requireWholeHectares(errors, "grossAreaIrrigatedHectares", input.grossAreaIrrigatedHectares);
  requireWholeHectares(
    errors,
    "areaIrrigatedMoreThanOnceHectares",
    input.areaIrrigatedMoreThanOnceHectares,
  );
  requireWholeHectares(errors, "supplementaryWellsNetHectares", input.supplementaryWellsNetHectares);
  if (typeof input.irrigationIntensity !== "number" || input.irrigationIntensity < 1) {
    errors.push(`irrigationIntensity must be a number >= 1, got ${input.irrigationIntensity}`);
  }
  if (errors.length > 0) return errors;
  const componentSum =
    net.canals + net.tanks + net.tubeAndBoreWells + net.openWells + net.otherSources;
  if (Math.abs(componentSum - net.total) > SUM_TOLERANCE_HECTARES) {
    errors.push(
      `the five components sum to ${componentSum} ha but the printed net total is ` +
        `${net.total} ha; more than ${SUM_TOLERANCE_HECTARES} ha apart, so one of them ` +
        "was misread - re-verify against the PDF",
    );
  }
  if (componentSum !== net.total && !input.notes.some((n) => /round/i.test(n))) {
    errors.push(
      `components (${componentSum} ha) and printed total (${net.total} ha) differ; ` +
        "a note must state the report's rounding artifact so the discrepancy is on the record",
    );
  }
  if (net.total > 0 && input.grossAreaIrrigatedHectares < net.total) {
    errors.push("gross area irrigated cannot be below the net total");
  }
  if (!planId.startsWith(`${district.scopeId}-`)) {
    errors.push(`refresh plan ${planId} does not belong to ${district.scopeId}`);
  }
  return errors;
}

/** Share of the printed net total, to one decimal. */
function shareOf(netHectares: number, total: number): number {
  return total > 0 ? Number(((100 * netHectares) / total).toFixed(1)) : 0;
}

function main(): void {
  const argv = process.argv.slice(2);
  const district = requireDistrict(argv);
  const plan = loadTnDistrictRefreshPlan(reviewedInputPath(district, "refresh-plan.json"));
  const input = loadReviewedInput(district);
  const errors = validate(district, plan.id, input);
  if (errors.length > 0) {
    throw new Error(`Invalid ${INPUT_NAME} for ${district.slug}:\n- ${errors.join("\n- ")}`);
  }

  const net = input.netAreaIrrigatedHectares;
  const components: Array<Omit<IrrigationCurrentShare, "percent">> = [
    { key: "canals", label: "Canals", netHectares: net.canals },
    { key: "tanks", label: "Tanks", netHectares: net.tanks },
    { key: "tube-bore-wells", label: "Tube and bore wells", netHectares: net.tubeAndBoreWells },
    { key: "open-wells", label: "Open wells", netHectares: net.openWells },
    { key: "other-sources", label: "Other sources", netHectares: net.otherSources },
  ];
  const bySource: IrrigationCurrentShare[] = components.map((share) => ({
    ...share,
    percent: shareOf(share.netHectares, net.total),
  }));
  const componentSum = bySource.reduce((sum, share) => sum + share.netHectares, 0);

  const envelope = atlasEnvelope({
    district,
    family: "irrigation-current",
    sources: [
      registeredSource({
        id: SOURCE_ID,
        title:
          `Season and Crop Report of Tamil Nadu ${input.edition}, Table III-B: ` +
          "area irrigated by different sources",
        publisher: "Department of Economics and Statistics, Government of Tamil Nadu",
        url: input.source.listingUrl,
        // The envelope schema's as_of is a date form (YYYY[-MM[-DD]]), so the
        // agricultural year "2024-25" cannot sit here verbatim; its opening
        // year does, and the full edition is in the title, the payload and
        // conventions.edition.
        as_of: input.edition.slice(0, 4),
        retrieved: input.extractedOn,
      }),
    ],
    method: "pdf-extract",
    producedAt: input.extractedOn,
    producedBy: PRODUCED_BY,
    internalInputs: [],
    note:
      `Table ${input.source.table} of the DES Season and Crop Report ${input.edition} ` +
      `(PDF sha256 ${input.source.pdfSha256}, Google Drive file ` +
      `${input.source.driveFileId} from the DES listing): the ${input.reportSpelling} row ` +
      `(Sl. No. ${input.rowNumber}), net area irrigated per source with the report's ` +
      "printed net total, gross total, area irrigated more than once and irrigation " +
      "intensity, read into a reviewed extraction " +
      `(pipeline-inputs/atlas/${district.stateSlug}/${district.slug}/${INPUT_NAME}) ` +
      "and validated here. Supplementary wells water land already counted under " +
      "another source and are recorded separately, never added to the net total.",
    conventions: {
      units: "hectares, whole, as the report prints them; shares in percent of the printed net total, one decimal",
      edition: `${input.edition} is the report's agricultural year, not a publication date`,
      supplementary_wells: "not a component of the net total; they supplement land under other sources",
      rounding: `component sums may miss the printed net total by up to ${SUM_TOLERANCE_HECTARES} ha of the report's own rounding; the printed total is served`,
    },
  });

  const payload: Omit<IrrigationCurrentArtifact, keyof typeof envelope> = {
    schemaVersion: 1,
    planId: plan.id,
    edition: input.edition,
    district: {
      name: district.name,
      reportSpelling: input.reportSpelling,
      rowNumber: input.rowNumber,
    },
    bySource,
    netAreaIrrigatedHectares: net.total,
    componentSumHectares: componentSum,
    grossAreaIrrigatedHectares: input.grossAreaIrrigatedHectares,
    areaIrrigatedMoreThanOnceHectares: input.areaIrrigatedMoreThanOnceHectares,
    irrigationIntensity: input.irrigationIntensity,
    supplementaryWells: {
      netHectares: input.supplementaryWellsNetHectares,
      note: input.supplementaryWellsNote,
    },
    extractedOn: input.extractedOn,
    notes: input.notes,
  };
  const rel = writeAtlasArtifact(district, "irrigation-current", undefined, envelope, payload);
  console.log(
    [
      `Wrote ${rel}`,
      `${district.name}, Season and Crop Report ${input.edition}: net ` +
        `${net.total.toLocaleString("en-IN")} ha irrigated, ` +
        bySource
          .filter((share) => share.netHectares > 0)
          .map((share) => `${share.label.toLowerCase()} ${share.percent}%`)
          .join(", "),
      `Gross ${input.grossAreaIrrigatedHectares.toLocaleString("en-IN")} ha, ` +
        `${input.areaIrrigatedMoreThanOnceHectares.toLocaleString("en-IN")} ha irrigated ` +
        `more than once, intensity ${input.irrigationIntensity}`,
    ].join("\n"),
  );
}

main();
