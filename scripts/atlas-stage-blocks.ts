import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { validateTnDistrictSourceExtract } from "../src/lib/atlas/acquisition-validation";
import type { TnDistrictSourceExtract } from "../src/lib/atlas/acquisition-model";
import { bestCandidate, foldedSimilarity } from "../src/lib/atlas/name-similarity";
import { validateReviewedBlockAlignmentTable } from "../src/lib/atlas/tn-crosswalk";
import type { ReviewedBlockAlignment } from "../src/lib/atlas/tn-crosswalk";
import {
  cachePath,
  readCacheJson,
  requireDistrict,
  reviewedInputPath,
} from "./lib/atlas-producer";

function usage(): string {
  return [
    "Usage:",
    "  npm run atlas:stage-blocks -- --district <slug> [--force]",
    "",
    "Reads the cached source extract the refresh acquired (crosswalk-extract.json for an LGD-built district) and writes",
    "pipeline-inputs/atlas/<state>/<district>/block-alignment.json.",
    "",
    "Proposes a block alignment table: which JJM block and which Census CD",
    "block each TNRD block corresponds to. Every row is proposed and carries",
    "the question a reviewer answers. A block whose best match is weak or tied",
    "is left out rather than guessed at.",
    "",
    "Refuses to overwrite an existing table unless --force, because a reviewer",
    "may have supplied rows this command cannot derive.",
  ].join("\n");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) {
    console.log(usage());
    return;
  }
  const district = requireDistrict(argv);
  const out = reviewedInputPath(district, "block-alignment.json");
  if (existsSync(out) && !argv.includes("--force")) {
    throw new Error(
      `${out} already exists. A reviewer may have supplied rows this command ` +
        "cannot derive, so pass --force only if you mean to discard them.",
    );
  }

  const extract = (readCacheJson<TnDistrictSourceExtract>(district, "crosswalk-extract.json") ??
    readCacheJson<TnDistrictSourceExtract>(district, "source-extract.json"));
  if (!extract) {
    throw new Error(
      `No cached extract at ${cachePath(district, "source-extract.json")}; ` +
        "run atlas-refresh-tn-district.ts --fetch first",
    );
  }
  // An LGD-built district's crosswalk-extract.json is the identity list in
  // the crosswalk's shape with an empty Census axis; its real extract was
  // validated by the refresh, and the TNRD rules (non-empty Census units) do
  // not describe it.
  const crosswalkShaped = readCacheJson<unknown>(district, "crosswalk-extract.json") !== undefined;
  const extractErrors = crosswalkShaped ? [] : validateTnDistrictSourceExtract(extract);
  if (extractErrors.length > 0) {
    throw new Error(`Cached extract is invalid:\n- ${extractErrors.join("\n- ")}`);
  }

  const lgdBlocks = new Map<string, string>();
  for (const record of extract.sources.tnrdLgd.records) {
    lgdBlocks.set(record.blockCode, record.blockName);
  }
  const jjmBlocks = new Map<string, string>();
  for (const record of extract.sources.jjm.records) {
    jjmBlocks.set(record.blockId, record.blockName);
  }
  const censusBlocks = new Map<string, string>();
  for (const record of extract.sources.census.records) {
    for (const cdBlock of record.cdBlocks) {
      censusBlocks.set(cdBlock.code, cdBlock.name);
    }
  }

  const alignments: ReviewedBlockAlignment[] = [];
  const skipped: string[] = [];
  const usedJjm = new Set<string>();
  const usedCensus = new Set<string>();

  for (const [lgdCode, lgdName] of [...lgdBlocks.entries()].sort()) {
    const jjm = bestCandidate(
      lgdName,
      [...jjmBlocks.entries()].filter(([id]) => !usedJjm.has(id)),
      ([, name]) => name,
    );
    const census = bestCandidate(
      lgdName,
      [...censusBlocks.entries()].filter(([code]) => !usedCensus.has(code)),
      ([, name]) => name,
    );
    if (!jjm && !census) {
      skipped.push(`${lgdName} (${lgdCode})`);
      continue;
    }
    if (jjm) usedJjm.add(jjm.candidate[0]);
    if (census) usedCensus.add(census.candidate[0]);
    alignments.push({
      lgdBlockCode: lgdCode,
      ...(jjm ? { jjmBlockId: jjm.candidate[0] } : {}),
      ...(census ? { censusCdBlockCode: census.candidate[0] } : {}),
      status: "proposed",
      question:
        `Is TNRD/LGD block "${lgdName}" the same block as ` +
        `${jjm ? `JJM "${jjm.candidate[1]}"` : "no JJM block"} and ` +
        `${census ? `Census "${census.candidate[1]}"` : "no Census block"}?`,
      note:
        `Proposed on name similarity ` +
        `${jjm ? `(JJM ${jjm.similarity})` : ""}` +
        `${census ? ` (Census ${census.similarity})` : ""}`.trim() + ".",
    });
  }

  const table = {
    schemaVersion: 1,
    planId: extract.planId,
    alignments,
  };
  const errors = validateReviewedBlockAlignmentTable(table, extract);
  if (errors.length > 0) {
    throw new Error(`Invalid block alignment table:\n- ${errors.join("\n- ")}`);
  }
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(table, null, 2)}\n`, "utf8");

  const exact = alignments.filter((alignment) => {
    const lgdName = lgdBlocks.get(alignment.lgdBlockCode) ?? "";
    const jjmName = alignment.jjmBlockId
      ? (jjmBlocks.get(alignment.jjmBlockId) ?? "")
      : "";
    return foldedSimilarity(lgdName, jjmName) === 1;
  }).length;
  console.log(
    [
      `Staged ${alignments.length} of ${lgdBlocks.size} block rows for ${district.slug} at ${out}`,
      `${exact} align on the folded name alone; ${alignments.length - exact} ` +
        "differ enough that a reviewer should look",
      skipped.length > 0
        ? `Left unproposed: ${skipped.join(", ")}`
        : "No block was left unproposed",
      "Every row is proposed and binds downstream until verified.",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
