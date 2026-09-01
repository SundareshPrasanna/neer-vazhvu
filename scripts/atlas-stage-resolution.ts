import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { validateTnDistrictSourceExtract } from "../src/lib/atlas/acquisition-validation";
import type { TnDistrictSourceExtract } from "../src/lib/atlas/acquisition-model";
import { bestCandidate } from "../src/lib/atlas/name-similarity";
import { validateTnDistrictCrosswalkProposal } from "../src/lib/atlas/tn-crosswalk";
import type { TnDistrictCrosswalkProposal } from "../src/lib/atlas/tn-crosswalk";
import { validateTnDistrictCrosswalkResolution } from "../src/lib/atlas/tn-crosswalk-resolution";
import type { CrosswalkResolutionDecision } from "../src/lib/atlas/tn-crosswalk-resolution";
import {
  argValue,
  cachePath,
  readCacheJson,
  requireDistrict,
  reviewedInputPath,
} from "./lib/atlas-producer";

function usage(): string {
  return [
    "Usage:",
    "  npm run atlas:stage-resolution -- --district <slug> [--axis jjm] [--force]",
    "",
    "Reads the cached extract and crosswalk proposal the refresh wrote and",
    "writes pipeline-inputs/atlas/<state>/<district>/crosswalk-resolution.json",
    "plus review-queue.md beside it.",
    "",
    "Turns a crosswalk proposal's review queue into proposed pairings, each",
    "binding downstream and labelled unverified, plus a markdown queue a",
    "reviewer can read.",
    "",
    "A deferred unit whose best candidate is weak or tied is left with no",
    "proposal at all. Forcing a pairing onto whatever candidate remains is how",
    "a Panchayat gets matched to an unrelated neighbour.",
  ].join("\n");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) {
    console.log(usage());
    return;
  }
  const district = requireDistrict(argv);
  const axis = (argValue(argv, "--axis") ?? "jjm") as "jjm" | "census";
  const out = reviewedInputPath(district, "crosswalk-resolution.json");
  const queueOut = reviewedInputPath(district, "review-queue.md");
  if (existsSync(out) && !argv.includes("--force")) {
    throw new Error(
      `${out} already exists. It may hold verified decisions, so pass --force ` +
        "only if you mean to discard them.",
    );
  }

  const extract = readCacheJson<TnDistrictSourceExtract>(district, "source-extract.json");
  const proposal = readCacheJson<TnDistrictCrosswalkProposal>(district, "crosswalk-proposal.json");
  if (!extract || !proposal) {
    throw new Error(
      `No cached extract and proposal under ${cachePath(district, "")}; ` +
        "run atlas-refresh-tn-district.ts first",
    );
  }
  const inputErrors = [
    ...validateTnDistrictSourceExtract(extract),
    ...validateTnDistrictCrosswalkProposal(proposal, extract),
  ];
  if (inputErrors.length > 0) {
    throw new Error(`Cached inputs are invalid:\n- ${inputErrors.join("\n- ")}`);
  }

  const queue = [...proposal[axis].review.sourceUnits].sort((left, right) =>
    `${left.lgdBlockName ?? ""}${left.sourceName}`.localeCompare(
      `${right.lgdBlockName ?? ""}${right.sourceName}`,
    ),
  );
  const claimed = new Set<string>();
  const decisions: CrosswalkResolutionDecision[] = [];
  const rows: string[] = [];
  const unproposed: string[] = [];

  for (const entry of queue) {
    const available = entry.candidates.filter(
      (candidate) => !claimed.has(candidate.lgdGramPanchayatCode),
    );
    const choice = bestCandidate(
      entry.sourceName,
      available,
      (candidate) => candidate.lgdGramPanchayatName,
    );
    if (!choice) {
      unproposed.push(`${entry.sourceName} (${entry.lgdBlockName ?? "?"})`);
      rows.push(
        `| ${entry.lgdBlockName ?? ""} | ${entry.sourceName} | none proposed | | ` +
          `${available.map((c) => c.lgdGramPanchayatName).join(", ") || "none"} |`,
      );
      continue;
    }
    claimed.add(choice.candidate.lgdGramPanchayatCode);
    decisions.push({
      axis,
      sourceUnitId: entry.sourceUnitId,
      lgdGramPanchayatCode: choice.candidate.lgdGramPanchayatCode,
      status: "proposed",
      matchClass: "proposed-pairing",
      evidence:
        `Closest surviving candidate in ${entry.lgdBlockName ?? "this block"} ` +
        `at similarity ${choice.similarity}: source "${entry.sourceName}" ` +
        `against TNRD/LGD "${choice.candidate.lgdGramPanchayatName}". ` +
        "Suggested by name similarity, not confirmed.",
      question:
        `In ${entry.lgdBlockName ?? "this block"}, is "${entry.sourceName}" the ` +
        `same Panchayat as "${choice.candidate.lgdGramPanchayatName}"?`,
    });
    rows.push(
      `| ${entry.lgdBlockName ?? ""} | ${entry.sourceName} | ` +
        `${choice.candidate.lgdGramPanchayatName} | ${choice.similarity} | ` +
        `${available
          .filter(
            (c) =>
              c.lgdGramPanchayatCode !== choice.candidate.lgdGramPanchayatCode,
          )
          .map((c) => c.lgdGramPanchayatName)
          .join(", ") || "none"} |`,
    );
  }

  const resolution = {
    schemaVersion: 1,
    id: `${district.slug}-crosswalk-resolution-v1`,
    planId: proposal.planId,
    proposalId: proposal.id,
    foldingVersion: proposal.foldingVersion,
    matchProcedureVersion: proposal.matchProcedureVersion,
    sourceRecordDigests: proposal.sourceRecordDigests,
    decisions,
  };
  const errors = validateTnDistrictCrosswalkResolution(resolution, proposal);
  if (errors.length > 0) {
    throw new Error(`Invalid resolution:\n- ${errors.join("\n- ")}`);
  }

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(resolution, null, 2)}\n`, "utf8");
  await writeFile(
    queueOut,
    [
      `# ${district.slug} ${axis} identity review queue`,
      "",
      `${queue.length} Gram Panchayats the machine would not match on its own.`,
      "A proposed pairing binds downstream and is labelled unverified.",
      "A row with none proposed had no candidate close enough to suggest.",
      "",
      "| Block | Source name | Proposed LGD | Similarity | Other candidates |",
      "|---|---|---|---|---|",
      ...rows,
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(
    [
      `Staged ${decisions.length} proposed pairings of ${queue.length} deferred ` +
        `units on the ${axis} axis for ${district.slug}`,
      unproposed.length > 0
        ? `Left unproposed because nothing was close enough: ${unproposed.join(", ")}`
        : "Every deferred unit had a candidate close enough to propose",
      `Queue written to ${queueOut}`,
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
