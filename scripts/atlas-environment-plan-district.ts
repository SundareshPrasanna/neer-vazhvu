/**
 * A district's Environment Plan, served as
 * public/data/atlas/<state>/<district>/environment-plan.json from the
 * reviewed transcription under pipeline-inputs/atlas/<state>/<district>/
 * environment-plan.json.
 *
 *   npx tsx scripts/atlas-environment-plan-district.ts --district satara --as-of 2026-09-01
 *
 * The input is the record: every figure with the sentence and the page it
 * was read from, the balance only where the plan carries one, the review
 * status a person sets. This script validates it, envelopes it against the
 * registered upstream and writes it; it computes nothing. Re-run it when
 * the transcription is verified or a new edition of the plan is read.
 */
import { readFileSync } from "node:fs";

import {
  validateEnvironmentPlanInput,
  type EnvironmentPlanInput,
} from "../src/lib/atlas/environment-plan";
import {
  atlasEnvelope,
  requireAsOf,
  requireDistrict,
  reviewedInputPath,
  upstreamSource,
  writeAtlasArtifact,
  type UpstreamKey,
} from "./lib/atlas-producer";

const PRODUCED_BY = "scripts/atlas-environment-plan-district.ts";

/** The registered upstream each plan source id resolves to. */
const UPSTREAM_BY_SOURCE: Record<string, UpstreamKey> = {
  "mpcb-district-environment-plans": "mpcbEnvironmentPlans",
  "ngt-dep-tn-namakkal": "ngtDepTnNamakkal",
  "ngt-dep-tn-karur": "ngtDepTnKarur",
};

function main(): void {
  const argv = process.argv.slice(2);
  const district = requireDistrict(argv);
  const asOf = requireAsOf(argv);
  const path = reviewedInputPath(district, "environment-plan.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const errors = validateEnvironmentPlanInput(raw);
  if (errors.length > 0) throw new Error(`Invalid environment plan input ${path}:\n- ${errors.join("\n- ")}`);
  const { _doc, ...payload } = raw as unknown as EnvironmentPlanInput & { _doc?: string };
  void _doc;
  const upstream = UPSTREAM_BY_SOURCE[payload.sourceId];
  if (!upstream) throw new Error(`${payload.sourceId}: no registered upstream; add it to atlas-producer.ts and the registry`);

  const balance = payload.waterBalance ? "with the plan's water-balance table" : "which carries no water-balance table";
  const envelope = atlasEnvelope({
    district,
    family: "environment-plan",
    sources: [
      upstreamSource(upstream, {
        as_of: payload.document.documentDate,
        retrieved: payload.document.retrievedAt,
      }),
    ],
    method: "pdf-extract",
    producedAt: asOf,
    producedBy: PRODUCED_BY,
    internalInputs: [],
    note:
      `${payload.document.title} (${payload.document.editionLabel}, ${payload.document.publisher}), ${balance}: ` +
      `${payload.figures.length} figures the plan states about water, each transcribed with the sentence it was read ` +
      `from and the PDF page it sits on, and ${payload.actionPoints.length} of its water action points. Nothing is ` +
      `computed from the plan; a balance is served only where the plan prints one. Review status ${payload.review.status}` +
      (payload.review.verifiedAt ? ` (checked against the document on ${payload.review.verifiedAt}).` : " (transcribed, awaiting a reviewer's check)."),
    conventions: {
      figures: "value and unit as the plan states them; quote is the sentence verbatim; pdfPage is the viewer's page, printedPage the number printed on it",
      waterBalance: "null when the plan carries no NGT-template balance; the page says so rather than estimating one",
      review: "proposed until a person reads every figure against the PDF; then verified with the date",
      document: "sha256 and byte length of the PDF as retrieved, so a re-posted file is detected; the PDF itself is not mirrored",
    },
  });
  const rel = writeAtlasArtifact(district, "environment-plan", undefined, envelope, payload);
  console.log(
    `Wrote ${rel}: ${payload.document.title}, ${payload.document.editionLabel}; ${payload.figures.length} figures, ` +
      `${payload.actionPoints.length} action points, water balance ${payload.waterBalance ? "present" : "absent"}, review ${payload.review.status}`,
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
