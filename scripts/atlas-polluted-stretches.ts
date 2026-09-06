/**
 * CPCB polluted river stretches per district, served as
 * public/data/atlas/<state>/<district>/polluted-stretches.json from the
 * national reviewed input pipeline-inputs/atlas/prs/cpcb-2025.json.
 *
 *   npx tsx scripts/atlas-polluted-stretches.ts --district erode --as-of 2026-09-06
 *   npx tsx scripts/atlas-polluted-stretches.ts --all --as-of 2026-09-06
 *
 * Nothing is computed: each district gets the entries whose district list
 * names it, with the basis for that join. A new CPCB edition is a new input
 * file and a rerun with --all.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ATLAS_DISTRICTS, type AtlasDistrict } from "../src/lib/atlas/registry";
import {
  POLLUTED_STRETCHES_SCHEMA_VERSION,
  selectForDistrict,
  validatePollutedStretchesInput,
  type PollutedStretchesInput,
  type PollutedStretchesPayload,
} from "../src/lib/atlas/polluted-stretches";
import { ROOT, atlasEnvelope, hasFlag, requireAsOf, requireDistrict, upstreamSource, writeAtlasArtifact } from "./lib/atlas-producer";

const PRODUCED_BY = "scripts/atlas-polluted-stretches.ts";
const INPUT = "pipeline-inputs/atlas/prs/cpcb-2025.json";

function loadInput(): PollutedStretchesInput {
  const path = resolve(ROOT, INPUT);
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const errors = validatePollutedStretchesInput(raw);
  if (errors.length > 0) throw new Error(`Invalid polluted-stretches input ${path}:\n- ${errors.join("\n- ")}`);
  const { _doc, ...input } = raw as unknown as PollutedStretchesInput & { _doc?: string };
  void _doc;
  return input;
}

function produce(district: AtlasDistrict, input: PollutedStretchesInput, asOf: string): void {
  const slice = selectForDistrict(input, district);
  const payload: PollutedStretchesPayload = {
    schemaVersion: POLLUTED_STRETCHES_SCHEMA_VERSION,
    planId: input.id,
    districtName: district.name,
    edition: input.edition,
    ...slice,
  };
  const envelope = atlasEnvelope({
    district,
    family: "polluted-stretches",
    sources: [upstreamSource("cpcbPrs", { as_of: input.edition.retrievedAt, retrieved: input.edition.retrievedAt })],
    method: "pdf-extract",
    producedAt: asOf,
    producedBy: PRODUCED_BY,
    internalInputs: [],
    note:
      `${input.edition.reportTitle}, ${input.edition.label}: ${slice.count === 0 ? "no listed stretch or location touches" : `${slice.count} listed stretches or locations touch`} ` +
      `${district.name}. Priority is CPCB's BOD band on the ${input.edition.bodObservedYears} maximum; station BOD for ${input.edition.followUpBodYear} is the report's ` +
      "follow-up annexure. Each entry names how it was joined to the district: a place CPCB prints, or the river's course as read by the maintainer. " +
      "The report PDF is not mirrored; annexure serials and PDF pages are the citation.",
    conventions: {
      priority: "I (BOD above 30 mg/L) to V (3.1 to 6 mg/L), as CPCB assigns it to the stretch or location",
      district: "kind 'named' when CPCB prints a place in the district; 'course' when the join is the maintainer's reading of the river's course; basis says which",
      since2018: "CPCB's own change class against its 2018 list: improved, same, deteriorated, new, dropped; null when the report tables carry no match",
      review: "each entry's district list is proposed until a person confirms it; the page shows the basis, not the review state",
    },
  });
  const rel = writeAtlasArtifact(district, "polluted-stretches", undefined, envelope, payload);
  console.log(`Wrote ${rel}: ${slice.count} entries for ${district.name}${slice.notes.length ? `, ${slice.notes.length} edition note(s)` : ""}`);
}

function main(): void {
  const argv = process.argv.slice(2);
  const asOf = requireAsOf(argv);
  const input = loadInput();
  const districts = hasFlag(argv, "--all") ? ATLAS_DISTRICTS : [requireDistrict(argv)];
  for (const district of districts) produce(district, input, asOf);
}

main();
