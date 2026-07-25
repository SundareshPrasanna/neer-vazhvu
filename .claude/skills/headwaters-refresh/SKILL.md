---
name: headwaters-refresh
description: Headwaters Stage 3 assisted update - drafts human-reviewed data edits when an upstream source publishes a new edition. Use when a Headwaters edition-alert issue names any source id, or when asked to refresh data from a watched source. One generic skill for every family; per-source knowledge lives in the registry entry's playbook field.
---

# Headwaters refresh (generic, all source families)

You are drafting a human-reviewed data update from a newly detected upstream
edition. The human reviews your diff; your job is correct, cited edits - not
speed. Design notes: `docs/specs/headwaters.md` (local-only).

## Procedure

1. **Load the source's registry entry** from `scripts/source-registry/`
   (the source id comes from the edition-alert issue or the user). Read ALL
   of it: `refreshMethod` (the family tool and how to run it), `playbook`
   (source-specific traps - every entry is a hard rule for this run),
   `dependsOn` (the only files you may edit), `notes`.
2. **Status.** If the family tool has a `--status` mode, run it; if the repo
   is already current, report that and stop.
3. **Extract.** Run the family tool's extract step for the new edition (it
   writes a snapshot into `scripts/source-registry/extractions/`). If there
   is no family tool yet (refreshMethod says manual), fetch the artifact,
   read it, and treat this run as extraction-by-hand with citations noted.
4. **Diff** the new snapshot against the one matching the oldest repo asOf.
   The change report lists changed metrics with page/table citations.
5. **SCHEMA BREAK => stop.** Do NOT edit data. Summarize the break and ask
   the user how to proceed. Skipping an unusable edition (recorded in the
   registry entry's notes) is a valid outcome.
6. **Verify every change against the cited source page** (pdftotext the page
   and read it) before editing. Extraction is mechanical; the document is
   the truth.
7. **Draft the edits** on a branch (never main), one logical commit,
   touching only `dependsOn` files: update values, bump the relevant asOf
   to the new edition, keep citation and provenance structures intact,
   follow every playbook rule. No em-dashes in user-facing text.
8. **Accept** in the same commit:
   `npx tsx scripts/check-upstream-editions.ts --accept <id> --edition "<label>"`.
9. **Check.** `npm run data:check` must pass.
10. **Present** the git diff and the change report to the user for review.
    Do not push or open a PR unless asked.

## When NOT to use this skill

A family whose workflow is structurally different (e.g. digitising PRS
geometry from gpkg files rather than reading numeric tables) gets its own
skill; that is the exception. Adding a normal family never means a new
skill - it means a `refresh-<family>.ts` tool plus `playbook` entries on
the registry entry.
