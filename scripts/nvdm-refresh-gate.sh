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
  # NOTE: no `git show | head -c` pipeline here - under pipefail, head's early
  # close SIGPIPEs git show on any artifact bigger than a pipe buffer, and the
  # whole condition reads false: large ENVELOPED files were silently skipped
  # (found gating the 331 KB coastal transects, 2026-07-31). Command
  # substitution with `|| true` keeps only grep's verdict.
  head_bytes=$(git show "HEAD:$f" 2>/dev/null | head -c 400 || true)
  if printf '%s' "$head_bytes" | grep -q '"nvdm"'; then
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
