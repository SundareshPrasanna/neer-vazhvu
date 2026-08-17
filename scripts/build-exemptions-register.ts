/**
 * Render the central exemption register to docs/architecture/exemptions.md.
 *
 *   npx tsx scripts/build-exemptions-register.ts           regenerate
 *   npx tsx scripts/build-exemptions-register.ts --check   fail on drift or on
 *                                                          an unexplained entry
 *
 * `--check` runs in `npm run data:check`, so two things are enforced on every
 * PR: the committed register matches the code, and no deliberate omission ships
 * without a reason. The second is the one that matters - a route quietly
 * dropped from FEATURE_AVAILABILITY now fails CI until someone writes down why.
 *
 * Output is deterministic and carries NO timestamp, so regenerating on an
 * unchanged tree is a no-op (the dataset-catalogue pattern).
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  collectExemptions,
  unexplained,
  unrecorded,
  UNRECORDED,
  type Exemption,
} from "./lib/exemptions";

const ROOT = resolve(__dirname, "..");
const OUT_MD = resolve(ROOT, "docs/architecture/exemptions.md");

const KIND_TITLE: Record<string, string> = {
  "freshness-check": "Suppressed freshness checks",
  "unwatched-artifact": "Artifacts with no registered upstream",
  "route-off": "Routes a city deliberately does not ship",
  "declared-absence": "Absences the product states on the page",
};

const KIND_BLURB: Record<string, string> = {
  "freshness-check":
    "A city skipping a derived staleness check. This is the only kind that suppresses a CI failure, " +
    "which is why the map is owned by `scripts/lib/exemptions.ts` rather than by the checker. " +
    "**Empty is the correct steady state.** Every entry should carry the condition that would retire it.",
  "unwatched-artifact":
    "Shipped data with no Headwaters upstream to watch for new editions. Usually correct - a curated " +
    "compilation, a derived product, or a continuously-edited source with no editions to detect - but " +
    "each one is a file that will never alert when its source moves. This is the allowlist itself; a " +
    "few entries are directory prefixes covering many files, so it does not equal the per-artifact " +
    "count that `check-upstream-editions.ts --validate` reports for coverage.",
  "route-off":
    "Derived by diffing each city against the union of every route any city ships, so this table cannot " +
    "drift from `FEATURE_AVAILABILITY`. A route dropped without a reason recorded fails `--check`.",
  "declared-absence":
    "Gaps the UI itself renders rather than hiding: the reason below is the copy a reader actually sees. " +
    "These stay owned by the config they are read from, and are reported here.",
};

function esc(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function render(list: Exemption[]): string {
  const lines: string[] = [];
  lines.push("# Exemption register");
  lines.push("");
  lines.push(
    "> Every deliberate omission on the platform, in one place. **Generated - do not edit by hand.**",
  );
  lines.push(">");
  lines.push("> Regenerate: `npx tsx scripts/build-exemptions-register.ts`");
  lines.push("> Source of truth: `scripts/lib/exemptions.ts`");
  lines.push("");
  lines.push(
    "This exists because a platform that treats data gaps as first-class has to be able to answer " +
      "*what are we not showing, and why?* without reading four unrelated files. It is generated from " +
      "the code that governs each omission, so it cannot drift from behaviour: `npm run data:check` " +
      "fails if the committed copy is stale, or if any entry has no reason recorded.",
  );
  lines.push("");

  const counts = new Map<string, number>();
  for (const e of list) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  lines.push("| Kind | Entries |");
  lines.push("|---|---|");
  for (const kind of Object.keys(KIND_TITLE)) {
    lines.push(`| ${KIND_TITLE[kind]} | ${counts.get(kind) ?? 0} |`);
  }
  lines.push(`| **Total** | **${list.length}** |`);
  lines.push("");

  const todo = unrecorded(list);
  if (todo.length) {
    lines.push(
      `**${todo.length} of these have no recorded rationale.** They are real, deliberate omissions ` +
        `whose original reason was never written down. They are marked rather than back-filled with a ` +
        `guess, because an invented justification reads as authoritative and is worse than an admitted ` +
        `blank. Each is a TODO: record the real reason, or ship the thing.`,
    );
    lines.push("");
    for (const t of todo) {
      lines.push(`- \`${t.scope}\` / ${esc(t.subject)}`);
    }
    lines.push("");
  }

  for (const kind of Object.keys(KIND_TITLE)) {
    const rows = list.filter((e) => e.kind === kind);
    lines.push(`## ${KIND_TITLE[kind]}`);
    lines.push("");
    lines.push(KIND_BLURB[kind]);
    lines.push("");
    if (rows.length === 0) {
      lines.push("_None._");
      lines.push("");
      continue;
    }
    lines.push("| Scope | Subject | Reason |");
    lines.push("|---|---|---|");
    for (const r of rows) {
      lines.push(`| ${esc(r.scope)} | ${esc(r.subject)} | ${esc(r.reason)} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function main(): void {
  const check = process.argv.includes("--check");
  const list = collectExemptions();
  const missing = unexplained(list);
  const md = render(list);

  if (!check) {
    writeFileSync(OUT_MD, md + "\n");
    console.log(
      `exemption register: ${list.length} entries -> docs/architecture/exemptions.md`,
    );
    if (missing.length) {
      console.error(`\n  ${missing.length} entries have NO reason recorded:`);
      for (const m of missing) console.error(`    ${m.kind} ${m.scope}: ${m.subject}`);
      process.exit(1);
    }
    return;
  }

  let failed = false;
  if (missing.length) {
    console.error(`  FAIL: ${missing.length} exemptions have no reason recorded:`);
    for (const m of missing) {
      console.error(`    ${m.kind}  ${m.scope}: ${m.subject}`);
    }
    console.error(
      "  Record why in scripts/lib/exemptions.ts - an omission without a reason is " +
        "indistinguishable from a bug.",
    );
    failed = true;
  }
  const committed = existsSync(OUT_MD) ? readFileSync(OUT_MD, "utf-8") : "";
  if (committed !== md + "\n") {
    console.error(
      "  FAIL: docs/architecture/exemptions.md is stale. Regenerate with " +
        "`npx tsx scripts/build-exemptions-register.ts`.",
    );
    failed = true;
  }
  if (failed) process.exit(1);
  const todo = unrecorded(list);
  console.log(
    `Exemption register: ${list.length} entries, committed copy current` +
      (todo.length
        ? `; ${todo.length} marked ${UNRECORDED.replace(":", "")} (rationale never written down, not a failure).`
        : "; every entry explained."),
  );
}

main();
