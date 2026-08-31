#!/usr/bin/env bash
# The Atlas refresh chain for one Tamil Nadu district, in the order the
# producers depend on each other. One script, shared by the monthly
# workflow (.github/workflows/atlas-refresh.yml), the launchd fallback when
# a government host blocks GitHub runners, and a person at a terminal.
#
#   bash scripts/atlas-refresh-district.sh thanjavur            # as of today
#   bash scripts/atlas-refresh-district.sh thanjavur 2026-09-01 # as of a date
#
# Fail-closed by design: every producer stops on a count that drifts from
# the reviewed refresh plan (a new Gram Panchayat, a reorganised block, a
# changed portal), on a malformed response, or on an incomplete enumeration.
# This script stops at the first failure and leaves the served artifacts of
# the earlier steps in place, so a partial run is visible in git diff and
# never silently published as complete. Resolving a stop is a human step:
# review the drift, update pipeline-inputs/atlas/<state>/<district>/, rerun.
#
# Steps (each writes public/data/atlas/<state>/<district>/...):
#   1 refresh      identity sources -> directory.json           (fetch)
#   2 jjm          JJM service per block                        (fetch, paced)
#   3 census       Census 2011 roll-up per block                (replay: closed source)
#   4 groundwater  IN-GRES taluk assessment                     (fetch)
#   5 project-gw   taluk assessment projected onto GPs          (cached polygons)
#   6 rainfall     Open-Meteo 30-day window per GP              (fetch)
#   7 water-bodies TNGIS counts per block                       (fetch)
#   8 assess       40-capability assessments + briefs per block (derived)
#   9 validate     whole-corpus assertions over the served tree
#
# Two failure classes, treated differently:
#   drift        a count or a payload that disagrees with the reviewed plan.
#                Stops the chain. A person reviews and updates the plan.
#   unreachable  a government host that does not answer (TNRD has been down
#                for hours at a time). Only the identity step tolerates it:
#                identity changes rarely, the served directory stays valid,
#                and the register steps that move monthly still run against
#                it. The skip is announced here and, if it persists, the
#                45-day freshness gate on directory.json turns it into an
#                alert. Every other step stops on any failure.
set -uo pipefail

district="${1:?district slug required (thanjavur, tiruchirappalli)}"
as_of="${2:-$(date -u +%Y-%m-%d)}"
cd "$(dirname "$0")/.."

step() { printf '\n== [%s] %s (%s)\n' "$district" "$1" "$(date -u +%H:%M:%SZ)"; }
must() { "$@" || { printf '\n!! [%s] stopped at: %s\n' "$district" "$*"; exit 1; }; }

identity="refreshed"
step "1 refresh: identity sources -> directory.json"
log="$(mktemp)"
if npx tsx scripts/atlas-refresh-tn-district.ts --district "$district" --fetch --as-of "$as_of" 2>&1 | tee "$log"; then
  :
elif grep -q -E 'Fetch failed after|curl failed after|Connect Timeout|ECONNREFUSED|ENOTFOUND|ETIMEDOUT' "$log"; then
  identity="skipped: identity host unreachable; served directory reused"
  printf '\n!! [%s] identity refresh SKIPPED (host unreachable), continuing with the served directory\n' "$district"
else
  printf '\n!! [%s] stopped at: identity refresh (drift or defect, not an outage)\n' "$district"
  rm -f "$log"
  exit 1
fi
rm -f "$log"

step "2 jjm: service register per block"
must npx tsx scripts/atlas-jjm-tn-district.ts --district "$district" --fetch --as-of "$as_of"

# Census 2011 is a closed source: its roll-up changes only when the
# directory's bindings change, and the replay needs the locally cached DCHB
# workbook, which a fresh CI runner does not have (learned from the first
# runner dry run, 2026-08-29). So it re-runs only after a real identity
# refresh; otherwise the served shards stand.
if [ "$identity" = "refreshed" ]; then
  step "3 census: 2011 roll-up per block (closed source, replayed after an identity refresh)"
  must npx tsx scripts/atlas-census-tn-district.ts --district "$district" --replay
else
  step "3 census: skipped (closed source; identity not refreshed this run)"
fi

step "4 groundwater: IN-GRES taluk assessment"
must npx tsx scripts/atlas-groundwater-tn-district.ts --district "$district" --fetch --as-of "$as_of"

step "5 project-gw: taluk assessment onto Gram Panchayats"
must npx tsx scripts/atlas-project-groundwater.ts --district "$district" --as-of "$as_of"

step "6 rainfall: Open-Meteo 30-day window per Gram Panchayat"
must npx tsx scripts/atlas-rainfall-tn-district.ts --district "$district" --fetch --as-of "$as_of"

step "7 water-bodies: TNGIS counts per block"
must npx tsx scripts/atlas-water-bodies-tn-district.ts --district "$district" --as-of "$as_of" --fetch

step "8 assess: assessments and briefs per block"
must npx tsx scripts/atlas-generate-assessments.ts --district "$district" --as-of "$as_of"

step "9 validate: whole-corpus assertions"
must npx tsx scripts/atlas-generate-assessments.ts --district "$district" --validate

step "done: identity ${identity}"
git status --short "public/data/atlas" | head -20
