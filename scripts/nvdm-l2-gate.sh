#!/usr/bin/env bash
# NVDM L2 gate (enforcing since v1 acceptance 2026-07-30).
#
# Selects data artifacts that are newly ADDED or RENAMED INTO serving between
# a base commit and HEAD, and requires each to reach NVDM L2 via
# validate_nvdm.py --check. Extracted from the workflow so the selector has
# regression coverage (2026-07-30 review: the inline version used
# --diff-filter=A only - a `git mv` into public/ bypassed the gate entirely -
# and unprefixed pathspecs missed nested/direct combinations).
#
# Usage: scripts/nvdm-l2-gate.sh <base-sha> [head-ref]
# NVDM_CHECK_CMD overrides the checker (selector tests use a stub).
set -euo pipefail

BASE="${1:?usage: nvdm-l2-gate.sh <base-sha> [head-ref]}"
HEAD_REF="${2:-HEAD}"

NEW=$(git diff --name-only --diff-filter=AR "$BASE"..."$HEAD_REF" -- \
  ':(glob)public/data/**/*.json' \
  ':(glob)public/data/**/*.geojson' \
  ':(glob)public/geojson/**/*.json' \
  ':(glob)public/geojson/**/*.geojson')

if [ -z "$NEW" ]; then
  echo "No new or renamed-in data artifacts."
  exit 0
fi

echo "New/renamed-in data artifacts:"
echo "$NEW"
# shellcheck disable=SC2086
exec ${NVDM_CHECK_CMD:-python3 scripts/validate_nvdm.py --check} $NEW
