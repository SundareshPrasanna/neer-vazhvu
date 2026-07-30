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

if [[ -n "${CORPUS_REPO_TOKEN:-}" ]]; then
  URL="https://x-access-token:${CORPUS_REPO_TOKEN}@${REPO}.git"
elif [[ "${CORPUS_USE_GIT_AUTH:-0}" == "1" ]]; then
  URL="https://${REPO}.git"
else
  cat >&2 <<'EOF'
fetch-corpus: CORPUS_SOURCE=remote but no credential is configured.
Set CORPUS_REPO_TOKEN (fine-grained PAT with Contents: Read on the data
repo) or, on a developer machine with git auth, CORPUS_USE_GIT_AUTH=1.
Refusing to fall back silently (D4): a build without the real corpus must
fail, not go green against partial data.
EOF
  exit 1
fi

CACHE="$ROOT/.corpus-cache"
mkdir -p "$CACHE"
git -C "$CACHE" init -q 2>/dev/null || true

if ! git -C "$CACHE" cat-file -e "$SHA^{commit}" 2>/dev/null; then
  echo "fetch-corpus: shallow-fetching $REPO @ ${SHA:0:12}"
  git -C "$CACHE" fetch -q --depth 1 "$URL" "$SHA"
fi
git -C "$CACHE" -c advice.detachedHead=false checkout -qf "$SHA"

echo "fetch-corpus: syncing data/ geojson/ -> public/"
python3 - "$CACHE" "$ROOT" <<'EOF'
import filecmp
import shutil
import sys
from pathlib import Path

cache, root = Path(sys.argv[1]), Path(sys.argv[2])
# Local-only trees that are gitignored in both repos (Supabase-served
# imagery); never delete a developer's copies.
protected = ("rich-bodies/imagery", "rich-bodies/tints")
copied = deleted = kept = 0
for src_top, dst_top in (("data", "public/data"), ("geojson", "public/geojson")):
    src_root, dst_root = cache / src_top, root / dst_top
    src_files = {p.relative_to(src_root) for p in src_root.rglob("*") if p.is_file()}
    for rel in sorted(src_files):
        src, dst = src_root / rel, dst_root / rel
        if dst.exists() and filecmp.cmp(src, dst, shallow=False):
            kept += 1
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        copied += 1
    if dst_root.exists():
        for p in sorted(dst_root.rglob("*")):
            if not p.is_file():
                continue
            rel = p.relative_to(dst_root)
            if rel in src_files or str(rel).startswith(protected):
                continue
            p.unlink()
            deleted += 1
print(f"fetch-corpus: synced (copied {copied}, deleted {deleted}, unchanged {kept})")
EOF

echo "fetch-corpus: corpus is now data-repo @ $SHA"
