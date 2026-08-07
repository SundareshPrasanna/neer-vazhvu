#!/usr/bin/env bash
# Corpus source switch (serving-hardening P1). Runs at the front of
# `npm run build`; the DEFAULT is a no-op so nothing changes for anyone
# until the switch is flipped per-environment.
#
#   CORPUS_SOURCE=repo    (default) no-op - public/data + public/geojson come
#                         from the git checkout exactly as before.
#   CORPUS_SOURCE=remote  shallow-fetch the private data repo at the SHA
#                         pinned in corpus.lock and sync it into public/.
#                         Fails LOUDLY if no credential is configured - it
#                         never falls back to the checkout or to the sample
#                         corpus (review addendum D4: no misleading green).
#
# Credentials for remote mode (exactly one):
#   CORPUS_REPO_TOKEN     token with read access to the data repo - a
#                         fine-grained PAT (Contents: Read on
#                         neer-vazhvu-data) or an installation token.
#                         This is what Vercel / GitHub Actions should set.
#   CORPUS_USE_GIT_AUTH=1 explicit opt-in to ambient git credentials
#                         (developer machines with gh auth / ssh keys).
#
# Idempotent: re-running against the same lock SHA re-syncs to the same
# state. The fetch cache lives in .corpus-cache/ (gitignored).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK="$ROOT/corpus.lock"
MODE="${CORPUS_SOURCE:-repo}"

case "$MODE" in
  repo)
    echo "fetch-corpus: CORPUS_SOURCE=repo (default) - corpus comes from the checkout, no-op"
    exit 0
    ;;
  remote) ;;
  *)
    echo "fetch-corpus: unknown CORPUS_SOURCE='$MODE' (expected 'repo' or 'remote')" >&2
    exit 1
    ;;
esac

REPO="$(python3 -c "import json; print(json.load(open('$LOCK'))['repo'])")"
SHA="$(python3 -c "import json; print(json.load(open('$LOCK'))['sha'])")"
EXPECTED_REPO="github.com/SundareshPrasanna/neer-vazhvu-data"

# The read credential must never be sent to a repository selected by a changed
# lock file. P2 full-corpus CI runs only for branches in this repository, but
# this allowlist remains the credential's final fail-closed boundary.
if [[ "$REPO" != "$EXPECTED_REPO" ]]; then
  echo "fetch-corpus: corpus.lock names unsupported repo '$REPO'" >&2
  exit 1
fi
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "fetch-corpus: corpus.lock sha must be a full lowercase Git SHA" >&2
  exit 1
fi

CACHE="$ROOT/.corpus-cache"
mkdir -p "$CACHE"
git -C "$CACHE" init -q 2>/dev/null || true

if ! git -C "$CACHE" cat-file -e "$SHA^{commit}" 2>/dev/null; then
  if [[ -n "${CORPUS_REPO_TOKEN:-}" ]]; then
    URL="https://x-access-token:${CORPUS_REPO_TOKEN}@${REPO}.git"
  elif [[ "${CORPUS_USE_GIT_AUTH:-0}" == "1" ]]; then
    URL="https://${REPO}.git"
  else
    cat >&2 <<'EOF'
fetch-corpus: CORPUS_SOURCE=remote but the locked commit is not cached and no
credential is configured. Set CORPUS_REPO_TOKEN (fine-grained PAT with
Contents: Read on the data repo) or, on a developer machine with git auth,
CORPUS_USE_GIT_AUTH=1. Refusing to fall back silently: a build without the
real corpus must fail, not go green against partial data.
EOF
    exit 1
  fi
  echo "fetch-corpus: shallow-fetching $REPO @ ${SHA:0:12}"
  git -C "$CACHE" fetch -q --depth 1 "$URL" "$SHA"
fi
git -C "$CACHE" -c advice.detachedHead=false checkout -qf "$SHA"

echo "fetch-corpus: syncing data/ geojson/ -> public/"
python3 - "$CACHE" "$ROOT" "$LOCK" <<'EOF'
import json
import shutil
import sys
from pathlib import Path

cache, root, lock_path = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
lock = json.loads(lock_path.read_text())
expected = lock["expected_files"]
# Local-only trees that are gitignored in both repos (Supabase-served
# imagery); never delete a developer's copies.
protected = ("rich-bodies/imagery", "rich-bodies/tints")
pairs = (("data", "public/data"), ("geojson", "public/geojson"))

# Preflight BEFORE touching public/: every source root must exist and match
# the file count pinned in corpus.lock. An absent or truncated root must
# fail here - it must never empty the destination and report success.
counts = {}
for src_top, _ in pairs:
    src_root = cache / src_top
    if not src_root.is_dir():
        sys.exit(f"fetch-corpus: PREFLIGHT FAILED - {src_top}/ missing from the fetched corpus")
    counts[src_top] = sum(1 for p in src_root.rglob("*") if p.is_file())
    if counts[src_top] != expected[src_top]:
        sys.exit(
            f"fetch-corpus: PREFLIGHT FAILED - {src_top}/ has {counts[src_top]} files, "
            f"corpus.lock expects {expected[src_top]}; refusing to sync a corpus that "
            "does not match the lock"
        )

# Stage-then-swap per root: build the new tree beside the destination, then
# swap via renames, then restore the protected local-only trees. A failure
# before the swap leaves the destination untouched; the tiny swap window is
# two renames, and any interruption leaves an intact '.corpus-old' tree to
# recover from rather than a half-synced destination.
for src_top, dst_top in pairs:
    src_root, dst_root = cache / src_top, root / dst_top
    stage = dst_root.with_name(dst_root.name + ".corpus-stage")
    old = dst_root.with_name(dst_root.name + ".corpus-old")
    shutil.rmtree(stage, ignore_errors=True)
    shutil.rmtree(old, ignore_errors=True)
    shutil.copytree(src_root, stage)
    if dst_root.exists():
        dst_root.rename(old)
    stage.rename(dst_root)
    for rel in protected:
        keep = old / rel
        if keep.is_dir():
            (dst_root / rel).parent.mkdir(parents=True, exist_ok=True)
            keep.rename(dst_root / rel)
    shutil.rmtree(old, ignore_errors=True)
    print(f"fetch-corpus: {dst_top} <- {src_top}/ ({counts[src_top]} files)")
EOF

echo "fetch-corpus: corpus is now data-repo @ $SHA"
