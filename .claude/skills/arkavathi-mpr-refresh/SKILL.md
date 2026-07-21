---
name: arkavathi-mpr-refresh
description: Headwaters Stage 3 assisted update for the NGT MPR family (Arkavathi). Use when a Headwaters edition-alert issue names nmcg-ngt-mpr-listing, or when asked to refresh Arkavathi MPR data. Extracts the new edition, diffs it, and drafts the data edits for human review - never blind-writes numbers.
---

# Arkavathi NGT MPR refresh (Headwaters Stage 3)

You are drafting a human-reviewed data update from a new NMCG Karnataka MPR
edition. The human reviews your diff; your job is correct, cited edits - not
speed. Registry entry: `nmcg-ngt-mpr-listing` in `scripts/source-registry/basins.json`.
Design notes: `docs/specs/headwaters.md` (local-only).

## Procedure

1. **Status.** `npx tsx scripts/refresh-arkavathi-mpr.ts --status`.
   If the repo is current, report that and stop.
2. **Extract.** Run the `--extract` command the status output suggests (it
   downloads the PDF and writes a snapshot into
   `scripts/source-registry/extractions/`). If metrics come back incomplete,
   check whether the PDF is the consolidated state layout before touching regexes.
3. **Diff.** `--diff <snapshot-matching-oldest-repo-asOf> <new-snapshot>`.
   The change report lists changed metrics with PDF page citations.
4. **SCHEMA BREAK => stop.** If the report declares a schema break, do NOT
   edit any data. Summarize the break to the user and ask how to proceed.
   Consolidated state-annexure editions have contradicted per-stretch reports
   before; skipping an unusable edition is a valid outcome (record it in the
   registry entry's notes).
5. **Verify each change against the PDF page cited** (pdftotext the page and
   read it) before editing. Extraction is regex-based; the PDF is the truth.
6. **Draft the edits** on a branch (never main), one logical commit:
   - `public/data/basins/arkavathi/gaps.json` - update numbers inside the
     prose metric values; extend year ranges only when values actually held
     ("4.0 MLD (2021-2025)" -> "(2021-2026)" only if unchanged).
   - `public/data/basins/arkavathi/accountability.json` - update affected
     `mpr.summary` texts and bump their `mpr.asOf` to the new edition.
   - `public/data/basins/arkavathi/prs.json` - only if the MPR priority or
     stretch framing changed, and only in the MPR/KSPCB-attributed notes.
   - Update the extraction snapshot dir and the registry acceptance in the
     same commit: `npx tsx scripts/check-upstream-editions.ts --accept
     nmcg-ngt-mpr-listing --edition "<Month Year>"`.
7. **Check.** `npm run data:check` must pass.
8. **Present** the git diff and the change report to the user for review.
   Do not push or open a PR unless asked.

## Known traps (all have burned this dataset before)

- **Collected vs generated:** MPR solid-waste tables interleave "Current MSW
  Generation" and "Quantity of MSW generated"; the repo reads generated=40,
  collected=35, processed=15 for Ramanagara (June 2025). Never swap the pair
  (the 35/20-vs-40/15 mix-up).
- **Priority divergence is content, not conflict:** CPCB reads Priority I,
  KSPCB/MPR reads III-IV. The MPR value updates only the MPR-attributed
  fields; never overwrite the CPCB priority in `prs.json` comparisons.
- **Compound asOf strings** ("August 2025 (stretch-wise); April 2026 (STP
  annexures)") are deliberate - preserve the qualifier structure when bumping.
- **No em-dashes** in any user-facing text; regular hyphens.
- Absence in the MPR means "not recorded in the documents", not "not
  happening" - keep the reportingCaveat framing intact.
