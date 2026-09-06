#!/usr/bin/env bash
# The Atlas refresh chain for one district, in the order the producers
# depend on each other. Two identity adapters share it: Tamil Nadu districts
# read TNRD (atlas-refresh-tn-district.ts), districts elsewhere read the
# Local Government Directory as republished on data.gov.in
# (atlas-refresh-lgd-district.ts); the reviewed plan's identityAdapter field
# decides, and the geometry steps follow it (TNGIS for Tamil Nadu, DataMeet
# for an LGD-built district, whose polygons are served). One script, shared by the monthly
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
#   5 project-gw   taluk assessment projected onto GPs          (cached polygons; register membership for LGD)
#   6 rainfall     Open-Meteo 30-day window per GP              (fetch)
#   7 water-bodies TNGIS counts per block (Tamil Nadu) or the
#                  First Census of Water Bodies (LGD-built)     (fetch)
#   7b boundaries  served Panchayat polygons (LGD-built only)   (cached DataMeet)
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

district="${1:?district slug required (thanjavur, tiruchirappalli, salem, tirupathur, erode, namakkal, karur, tiruppur, satara, ahilyanagar, kolhapur)}"
as_of="${2:-$(date -u +%Y-%m-%d)}"
cd "$(dirname "$0")/.."

# The reviewed plan names the adapter; the state directory names the tree.
plan="$(ls pipeline-inputs/atlas/*/"$district"/refresh-plan.json 2>/dev/null | head -1)"
[ -n "$plan" ] || { printf '!! [%s] no reviewed refresh plan under pipeline-inputs/atlas/*/%s/\n' "$district" "$district"; exit 1; }
state="$(basename "$(dirname "$(dirname "$plan")")")"
adapter="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("identityAdapter","tnrd"))' "$plan")"
identity_flags=""
if [ "$adapter" = "lgd-directory" ]; then
  identity_script="scripts/atlas-refresh-lgd-district.ts"
  # The DataMeet polygons (78 MB from GitHub) are fetched once into the cache;
  # a fresh runner has none, and a directory built without them would lose
  # every centroid, so the flag follows the cache rather than the host.
  if [ ! -f ".cache/atlas/$state/$district/datameet-boundary-extract.json" ]; then
    identity_flags="--fetch-boundary"
  fi
else
  identity_script="scripts/atlas-refresh-tn-district.ts"
fi

step() { printf '\n== [%s] %s (%s)\n' "$district" "$1" "$(date -u +%H:%M:%SZ)"; }
must() { "$@" || { printf '\n!! [%s] stopped at: %s\n' "$district" "$*"; exit 1; }; }

identity="refreshed"
step "1 refresh: identity sources -> directory.json"
log="$(mktemp)"
if npx tsx "$identity_script" --district "$district" --fetch --as-of "$as_of" $identity_flags 2>&1 | tee "$log"; then
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
  if [ "$adapter" = "lgd-directory" ]; then
    # The identity refresh downloaded (or reused) the state workbook into the
    # content-addressed cache; its digest is in the extract, so the roll-up
    # reads that object rather than a replay cache a fresh runner lacks.
    workbook_sha="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["sources"]["census"]["artifactSha256s"][0])' ".cache/atlas/$state/$district/source-extract.json")"
    must npx tsx scripts/atlas-census-tn-district.ts --district "$district" --workbook ".cache/atlas/$state/$district/objects/$workbook_sha" --as-of "$as_of"
  else
    if [ -f ".cache/atlas/$state/$district/census-village-attributes.json" ]; then
      must npx tsx scripts/atlas-census-tn-district.ts --district "$district" --replay
    else
      # First run: the attributes cache is cut from the workbook the identity refresh cached.
      workbook_sha="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["sources"]["census"]["artifactSha256s"][0])' ".cache/atlas/$state/$district/source-extract.json")"
      must npx tsx scripts/atlas-census-tn-district.ts --district "$district" --workbook ".cache/atlas/$state/$district/objects/$workbook_sha" --as-of "$as_of"
    fi
  fi
else
  step "3 census: skipped (closed source; identity not refreshed this run)"
fi

step "4 groundwater: IN-GRES taluk assessment"
must npx tsx scripts/atlas-groundwater-tn-district.ts --district "$district" --fetch --as-of "$as_of"

# The projection and the water-body counts are geometry steps: they read the
# TNGIS Panchayat polygons the identity refresh cached and the TNGIS taluk
# and water-body layers. A fresh CI runner has no cache and the identity
# step skips there, so they run only when this run refreshed identity (a
# local run, where the cache lives) or, for the projection, when the taluk
# assessment itself changed (IN-GRES publishes yearly). Otherwise the served
# artifacts stand: the projection is a view of two inputs that did not move,
# and the register refresh (JJM, IN-GRES, rainfall) is what a monthly run is
# for. Learned from the second runner dry run, 2026-08-31.
# "Changed" means the assessment itself: a re-fetch always rewrites the
# envelope dates AND the artifact's own acquiredAt, so neither a byte
# comparison nor a provenance-stripped one holds (the third and fourth runner
# dry runs fired on those). The artifact carries a digest of its records and
# the assessment year; those two are what "the taluk assessment changed"
# means.
gw_file="public/data/atlas/$state/$district/groundwater-taluks.json"
gw_changed=$(python3 - "$gw_file" <<'PY'
import json, subprocess, sys
path = sys.argv[1]
def identity(text):
    doc = json.loads(text)
    return (doc.get("assessmentYear"), doc.get("recordsSha256"), doc.get("recordCount"))
try:
    head = subprocess.run(["git", "show", f"HEAD:{path}"], check=True, capture_output=True, text=True).stdout
except subprocess.CalledProcessError:
    print(1); sys.exit(0)   # no committed version: treat as changed
with open(path) as f:
    print(0 if identity(head) == identity(f.read()) else 1)
PY
)
if [ "$identity" = "refreshed" ] || [ "$gw_changed" = 1 ]; then
  step "5 project-gw: taluk assessment onto Gram Panchayats"
  # First run: no cached taluk layer yet, so the projection fetches it.
  taluk_flags=""
  [ -f ".cache/atlas/$state/$district/tngis-taluk-boundary.json" ] || taluk_flags="--fetch"
  must npx tsx scripts/atlas-project-groundwater.ts --district "$district" --as-of "$as_of" $taluk_flags
else
  step "5 project-gw: skipped (identity and taluk assessment unchanged; served projection stands)"
fi

step "6 rainfall: Open-Meteo 30-day window per Gram Panchayat"
must npx tsx scripts/atlas-rainfall-tn-district.ts --district "$district" --fetch --as-of "$as_of"

if [ "$adapter" = "lgd-directory" ]; then
  # The First Census of Water Bodies is a closed edition read from
  # data.gov.in; the producer joins it through the served directory, so it
  # follows the identity refresh like the other geometry steps. A plan that
  # names no census resource makes the producer a no-op.
  if [ "$identity" = "refreshed" ]; then
    step "7 water-bodies: First Census of Water Bodies per taluka (data.gov.in)"
    must npx tsx scripts/atlas-water-bodies-census-district.ts --district "$district" --as-of "$as_of" --fetch
  else
    step "7 water-bodies: skipped (closed edition; runs with an identity refresh)"
  fi
  if [ "$identity" = "refreshed" ]; then
    step "7b boundaries: served Panchayat polygons per taluka (DataMeet, ODbL)"
    must npx tsx scripts/atlas-boundaries-lgd-district.ts --district "$district" --as-of "$as_of"
  else
    step "7b boundaries: skipped (geometry step; runs with an identity refresh)"
  fi
elif [ "$identity" = "refreshed" ]; then
  step "7 water-bodies: TNGIS counts per block"
  must npx tsx scripts/atlas-water-bodies-tn-district.ts --district "$district" --as-of "$as_of" --fetch
else
  step "7 water-bodies: skipped (geometry step; runs with an identity refresh)"
fi

step "8 assess: assessments and briefs per block"
must npx tsx scripts/atlas-generate-assessments.ts --district "$district" --as-of "$as_of"

step "9 validate: whole-corpus assertions"
must npx tsx scripts/atlas-generate-assessments.ts --district "$district" --validate

step "done: identity ${identity}"
git status --short "public/data/atlas" | head -20
