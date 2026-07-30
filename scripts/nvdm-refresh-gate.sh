#!/usr/bin/env bash
# Refresh gate for direct-push scheduled workflows (review 2026-07-30 round 2:
# report mode exits 0 regardless, so the workflows were not actually gated).
#
# Invariant enforced: every target file that carried an NVDM envelope at HEAD
# (the committed state before this refresh) must still reach L2 via
# `validate_nvdm.py --check` after the producer ran. Files not yet enveloped
# at HEAD (unmigrated cities) are skipped - migration will bring them under
# the gate. A producer stripping an envelope therefore fails the workflow
# before anything is committed.
#
# Usage: scripts/nvdm-refresh-gate.sh <file...>   (after the producer, before git add)
# NVDM_CHECK_CMD overrides the checker (selftest uses a stub).
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: nvdm-refresh-gate.sh <file...>" >&2
  exit 2
fi

MUST=()
for f in "$@"; do
  if git show "HEAD:$f" 2>/dev/null | head -c 400 | grep -q '"nvdm"'; then
    MUST+=("$f")
  else
    echo "refresh-gate: $f not enveloped at HEAD - skipped (unmigrated)"
  fi
done

if [ "${#MUST[@]}" -eq 0 ]; then
  echo "refresh-gate: no enveloped targets at HEAD."
  exit 0
fi

echo "refresh-gate: enforcing L2 on ${#MUST[@]} enveloped target(s):"
printf '  %s\n' "${MUST[@]}"
# shellcheck disable=SC2086
exec ${NVDM_CHECK_CMD:-python3 scripts/validate_nvdm.py --check} "${MUST[@]}"
