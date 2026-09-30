#!/usr/bin/env bash
# NVDM gate on every changed served artifact under public/data and public/geojson
# (added, renamed, modified or untracked), judged against the merge-base with <base-rev>:
#   new at base -> must reach L2 | L2+ at base -> must keep its level (L3 stays L3)
#   below L2 at base -> skipped until it is migrated
# validate_nvdm.py --check --base assesses both sides under today's rules.
#
#   scripts/nvdm-gate.sh <base-sha>          a PR, or a local preflight against main
#   scripts/nvdm-gate.sh HEAD [path...]      a direct push, after the producer and before git add
# The checker reads the catalogue: run scripts/build_dataset_catalogue.py first when files are new.
# NVDM_CHECK_CMD overrides the checker (the selftest uses a stub).
set -euo pipefail

base=$(git merge-base "${1:?usage: nvdm-gate.sh <base-rev> [path...]}" HEAD)
shift
files=$({ git diff --name-only --diff-filter=d "$base" -- "${@:-public}"
          git ls-files --others --exclude-standard -- "${@:-public}"; } |
        grep -E '^public/(data|geojson)/.+\.(geo)?json$' | sort -u || true)
if [ -z "$files" ]; then
  echo "nvdm-gate: no changed served artifacts"
  exit 0
fi
echo "nvdm-gate: changed served artifacts against $base:"
echo "$files"
# shellcheck disable=SC2086
exec ${NVDM_CHECK_CMD:-python3 scripts/validate_nvdm.py --check} --base "$base" $files
