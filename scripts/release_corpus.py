#!/usr/bin/env python3
"""Corpus release helper: carry a refreshed public/data tree to production.

Production serves the corpus pinned by corpus.lock, fetched from the private
data repository at build time. A refreshed artifact committed here, by a
scheduled workflow or by hand, changes nothing on the site until it has gone
through the data-repo release. This script does the mechanical half of that
release and leaves the human half where it belongs.

  python3 scripts/release_corpus.py prepare --slug atlas-tn            # dry run
  python3 scripts/release_corpus.py prepare --slug atlas-tn --execute  # branch + data PR
  python3 scripts/release_corpus.py pin --sha <data-repo merge sha>    # dry run
  python3 scripts/release_corpus.py pin --sha <sha> --execute          # write corpus.lock

prepare
  Shallow-clones the data repository, copies every file under public/data and
  public/geojson over data/ and geojson/ byte for byte (never deleting: the
  data repository carries artifacts the platform tree does not, such as
  basins/arkavathi/mpr-reviewed.json), points toolchain.lock at the platform
  commit the corpus was produced with (which must be pushed and fetchable),
  commits on a release branch, pushes it and opens the data PR through the
  REST API. It prints the diff before doing any of that, and does none of it
  without --execute.

pin
  After a person has reviewed and merged the data PR: reads the merged tree,
  counts the data/ and geojson/ blobs exactly as fetch-corpus.sh will preflight
  them, and rewrites corpus.lock (sha + expected_files). The platform PR that
  carries the new pin is opened by hand; corpus.lock is a single pointer, so
  the order of merges matters and stays a human decision.

Every step that touches a remote is gated on --execute; the default is a
report. Ambient git and gh credentials are used, never a stored token.
"""

from __future__ import annotations

import argparse
import datetime as dt
import filecmp
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_REPO = "SundareshPrasanna/neer-vazhvu-data"
DATA_REPO_URL = f"https://github.com/{DATA_REPO}.git"
ROOTS = {"public/data": "data", "public/geojson": "geojson"}
CORPUS_LOCK = ROOT / "corpus.lock"


def run(cmd: list[str], cwd: Path | None = None, capture: bool = True) -> str:
    result = subprocess.run(cmd, cwd=cwd, check=True, text=True, capture_output=capture)
    return result.stdout.strip() if capture else ""


def gh_json(path: str, *args: str) -> object:
    return json.loads(run(["gh", "api", path, *args]))


def platform_head() -> tuple[str, str]:
    sha = run(["git", "rev-parse", "HEAD"], cwd=ROOT)
    branch = run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=ROOT)
    return sha, branch


def sha_is_on_remote(sha: str) -> bool:
    """toolchain.lock must point at a commit the data repo's CI can fetch."""
    try:
        run(["git", "fetch", "origin", sha], cwd=ROOT)
        return True
    except subprocess.CalledProcessError:
        return False


def clone_data_repo(tmp: Path) -> Path:
    dest = tmp / "neer-vazhvu-data"
    run(["git", "clone", "--quiet", "--depth", "1", DATA_REPO_URL, str(dest)])
    return dest


def plan_copy(data_repo: Path) -> dict[str, list[str]]:
    """Files that would be added or changed, and data-repo-only files left alone."""
    added: list[str] = []
    changed: list[str] = []
    data_only: list[str] = []
    for src_root, dst_root in ROOTS.items():
        src_dir = ROOT / src_root
        dst_dir = data_repo / dst_root
        src_files = {p.relative_to(src_dir) for p in src_dir.rglob("*") if p.is_file()}
        dst_files = (
            {p.relative_to(dst_dir) for p in dst_dir.rglob("*") if p.is_file()}
            if dst_dir.exists()
            else set()
        )
        for rel in sorted(src_files):
            target = dst_dir / rel
            if not target.exists():
                added.append(f"{dst_root}/{rel}")
            elif not filecmp.cmp(src_dir / rel, target, shallow=False):
                changed.append(f"{dst_root}/{rel}")
        for rel in sorted(dst_files - src_files):
            data_only.append(f"{dst_root}/{rel}")
    return {"added": added, "changed": changed, "data_only": data_only}


def apply_copy(data_repo: Path, plan: dict[str, list[str]]) -> None:
    for rel in plan["added"] + plan["changed"]:
        dst_root, _, tail = rel.partition("/")
        src_root = next(s for s, d in ROOTS.items() if d == dst_root)
        src = ROOT / src_root / tail
        dst = data_repo / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        if not filecmp.cmp(src, dst, shallow=False):
            raise SystemExit(f"copy verification failed for {rel}")


def bump_toolchain_lock(data_repo: Path, sha: str, today: str) -> None:
    """Change values only: check-corpus.py enforces the exact key set."""
    path = data_repo / "toolchain.lock"
    lock = json.loads(path.read_text())
    lock["toolchain_sha"] = sha
    synced = lock.get("corpus_synced_from", {})
    if "sha" in synced:
        synced["sha"] = sha
    if "date" in synced:
        synced["date"] = today
    path.write_text(json.dumps(lock, indent=2) + "\n")


def cmd_prepare(args: argparse.Namespace) -> int:
    today = dt.date.today().isoformat()
    sha, branch = platform_head()
    print(f"platform: {branch} @ {sha[:12]}")
    if run(
        ["git", "status", "--porcelain", "--", "public/data", "public/geojson"],
        cwd=ROOT,
    ):
        print(
            "refusing: public/data or public/geojson has uncommitted changes; commit them first"
        )
        return 2
    if not sha_is_on_remote(sha):
        print(
            "refusing: HEAD is not on origin; the data repo's CI validates against toolchain.lock, so push first"
        )
        return 2

    with tempfile.TemporaryDirectory(prefix="nv-corpus-") as tmp_str:
        tmp = Path(tmp_str)
        data_repo = clone_data_repo(tmp)
        plan = plan_copy(data_repo)
        print(f"\nadded   {len(plan['added'])}")
        for rel in plan["added"][:40]:
            print(f"  + {rel}")
        if len(plan["added"]) > 40:
            print(f"  ... {len(plan['added']) - 40} more")
        print(f"changed {len(plan['changed'])}")
        for rel in plan["changed"][:40]:
            print(f"  ~ {rel}")
        if len(plan["changed"]) > 40:
            print(f"  ... {len(plan['changed']) - 40} more")
        print(f"data-repo only (left in place) {len(plan['data_only'])}")
        for rel in plan["data_only"]:
            print(f"  = {rel}")
        if not plan["added"] and not plan["changed"]:
            print("\nnothing to release: the data repository already matches public/")
            return 0
        if not args.execute:
            print("\ndry run; add --execute to create the release branch and data PR")
            return 0

        release_branch = f"release/{today}-{args.slug}"
        run(["git", "checkout", "-b", release_branch], cwd=data_repo)
        apply_copy(data_repo, plan)
        bump_toolchain_lock(data_repo, sha, today)
        run(["git", "add", "-A"], cwd=data_repo)
        title = f"Corpus release {today}: {args.slug}"
        body = (
            f"{len(plan['added'])} added, {len(plan['changed'])} changed, from "
            f"SundareshPrasanna/neer-vazhvu {branch} @ {sha}.\n\n"
            f"toolchain.lock now pins {sha} (the platform commit these artifacts were produced with). "
            "After merging, create the immutable corpus tag and run "
            "`python3 scripts/release_corpus.py pin --sha <merge sha> --execute` in the platform repo."
        )
        run(
            [
                "git",
                "-c",
                "user.name=neer-vazhvu-release",
                "-c",
                "user.email=contact@neervazhvu.org",
                "commit",
                "-q",
                "-m",
                title,
            ],
            cwd=data_repo,
        )
        run(["git", "push", "-u", "origin", release_branch], cwd=data_repo)
        pr = gh_json(
            f"repos/{DATA_REPO}/pulls",
            "--method",
            "POST",
            "-f",
            f"title={title}",
            "-f",
            f"head={release_branch}",
            "-f",
            "base=main",
            "-f",
            f"body={body}",
        )
        print(f"\ndata PR opened: {pr['html_url']}")  # type: ignore[index]
        print("next: a data owner reviews and merges; then tag, then `pin`.")
    return 0


def cmd_pin(args: argparse.Namespace) -> int:
    tree = gh_json(f"repos/{DATA_REPO}/git/trees/{args.sha}?recursive=1")
    blobs = [t["path"] for t in tree["tree"] if t["type"] == "blob"]  # type: ignore[index]
    if tree.get("truncated"):  # type: ignore[union-attr]
        print(
            "refusing: the tree listing was truncated; count blobs from a clone instead"
        )
        return 2
    counts = {
        root: sum(1 for p in blobs if p.startswith(f"{root}/"))
        for root in ROOTS.values()
    }
    lock = json.loads(CORPUS_LOCK.read_text())
    print(
        f"corpus.lock: {lock['sha'][:12]} {lock['expected_files']} -> {args.sha[:12]} {counts}"
    )
    if not args.execute:
        print("dry run; add --execute to rewrite corpus.lock")
        return 0
    lock["sha"] = args.sha
    lock["expected_files"] = counts
    CORPUS_LOCK.write_text(json.dumps(lock, indent=2) + "\n")
    print(
        "corpus.lock rewritten; verify with CORPUS_SOURCE=remote CORPUS_USE_GIT_AUTH=1 bash scripts/fetch-corpus.sh in a throwaway worktree, then open the platform PR"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = parser.add_subparsers(dest="command", required=True)
    prep = sub.add_parser("prepare", help="stage a data-repo release branch and PR")
    prep.add_argument("--slug", required=True, help="short release name, e.g. atlas-tn")
    prep.add_argument(
        "--execute",
        action="store_true",
        help="create the branch and PR (default: report)",
    )
    prep.set_defaults(func=cmd_prepare)
    pin = sub.add_parser("pin", help="rewrite corpus.lock to a merged data-repo commit")
    pin.add_argument(
        "--sha", required=True, help="the data-repo merge commit or tag sha"
    )
    pin.add_argument(
        "--execute", action="store_true", help="write corpus.lock (default: report)"
    )
    pin.set_defaults(func=cmd_pin)
    args = parser.parse_args()
    if shutil.which("gh") is None:
        print("gh is required", file=sys.stderr)
        return 2
    os.chdir(ROOT)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
