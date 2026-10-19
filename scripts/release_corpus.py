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
  python3 scripts/release_corpus.py live                               # dry run
  python3 scripts/release_corpus.py live --execute                     # the weekly feed release

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

live
  The weekly release of what scheduled jobs write (LIVE_FEEDS), run by the
  maintainer's local scheduled job: prepare restricted to those paths, then it
  waits for the data repo's checks, squash-merges, tags corpus-<date>-live,
  and moves corpus.lock through a pin PR that it merges once the platform's
  CI has built against the new corpus. Anything else that differs from the
  data repository is listed and left for a person's release; so is a feed
  file that shrinks below half its size. A failed check leaves the PR open.

Every step that touches a remote is gated on --execute; the default is a
report. Ambient git and gh credentials are used, never a stored token.
"""

from __future__ import annotations

import argparse
import datetime as dt
import filecmp
import fnmatch
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_REPO = "SundareshPrasanna/neer-vazhvu-data"
PLATFORM_REPO = "SundareshPrasanna/neer-vazhvu"
RELEASE_GIT = ["git", "-c", "user.name=neer-vazhvu-release", "-c", "user.email=contact@neervazhvu.org"]
DATA_REPO_URL = f"https://github.com/{DATA_REPO}.git"
ROOTS = {"public/data": "data", "public/geojson": "geojson"}
CORPUS_LOCK = ROOT / "corpus.lock"
# Files only scheduled jobs write: `live` ships these without a person's merge.
LIVE_FEEDS = (
    "data/rainfall-recent-*.json", "data/*-dam-storage.json", "data/surat-flood-chain*.json",
    "data/kolkata-waterlogging-register.json", "data/mumbai-flood-hotspots.geojson",
    *(f"data/basins/*/{f}" for f in ("groundwater-wells.geojson", "gauging-stations.geojson", "realtime-stations.geojson",
                                     "reservoirs.geojson", "monitoring-points.geojson", "inventory.json", "readings/*.json")),
)
LIVE_NEW_FILES = ("data/basins/*/readings/*.json",)  # a station's first pack; any other new file is onboarding
LIVE_MIN_SIZE_SHARE = 0.5
CHECKS_TIMEOUT_S = 1800


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

        pr = open_data_pr(data_repo, plan, args.slug, sha, branch, today, (
            "After merging, create the immutable corpus tag and run "
            "`python3 scripts/release_corpus.py pin --sha <merge sha> --execute` in the platform repo."))
        print(f"\ndata PR opened: {pr['html_url']}")
        print("next: a data owner reviews and merges; then tag, then `pin`.")
    return 0


def open_data_pr(data_repo: Path, plan: dict[str, list[str]], slug: str, sha: str, branch: str, today: str, next_step: str) -> dict:
    release_branch = f"release/{today}-{slug}"
    run(["git", "checkout", "-b", release_branch], cwd=data_repo)
    apply_copy(data_repo, plan)
    bump_toolchain_lock(data_repo, sha, today)
    run(["git", "add", "-A"], cwd=data_repo)
    title = f"Corpus release {today}: {slug}"
    body = (
        f"{len(plan['added'])} added, {len(plan['changed'])} changed, from "
        f"SundareshPrasanna/neer-vazhvu {branch} @ {sha}.\n\n"
        f"toolchain.lock now pins {sha} (the platform commit these artifacts were produced with). {next_step}"
    )
    run([*RELEASE_GIT, "commit", "-q", "-m", title], cwd=data_repo)
    run(["git", "push", "-u", "origin", release_branch], cwd=data_repo)
    pr = gh_json(f"repos/{DATA_REPO}/pulls", "--method", "POST", "-f", f"title={title}", "-f", f"head={release_branch}", "-f", "base=main", "-f", f"body={body}")
    return pr  # type: ignore[return-value]


def tree_counts(sha: str) -> dict[str, int] | None:
    """data/ and geojson/ blob counts at a data-repo commit, as fetch-corpus.sh preflights them."""
    tree = gh_json(f"repos/{DATA_REPO}/git/trees/{sha}?recursive=1")
    if tree.get("truncated"):  # type: ignore[union-attr]
        return None
    blobs = [t["path"] for t in tree["tree"] if t["type"] == "blob"]  # type: ignore[index]
    return {root: sum(1 for p in blobs if p.startswith(f"{root}/")) for root in ROOTS.values()}


def write_lock(sha: str, counts: dict[str, int], doc_line: str | None = None) -> None:
    lock = json.loads(CORPUS_LOCK.read_text())
    lock["sha"], lock["expected_files"] = sha, counts
    if doc_line:  # one automatic line at most: the latest live release replaces the previous one
        lock["_doc"] = [d for d in lock["_doc"] if "automatic live-feed release" not in d] + [doc_line]
    CORPUS_LOCK.write_text(json.dumps(lock, indent=2) + "\n")


def cmd_pin(args: argparse.Namespace) -> int:
    counts = tree_counts(args.sha)
    if counts is None:
        print("refusing: the tree listing was truncated; count blobs from a clone instead")
        return 2
    lock = json.loads(CORPUS_LOCK.read_text())
    print(
        f"corpus.lock: {lock['sha'][:12]} {lock['expected_files']} -> {args.sha[:12]} {counts}"
    )
    if not args.execute:
        print("dry run; add --execute to rewrite corpus.lock")
        return 0
    write_lock(args.sha, counts)
    print(
        "corpus.lock rewritten; verify with CORPUS_SOURCE=remote CORPUS_USE_GIT_AUTH=1 bash scripts/fetch-corpus.sh in a throwaway worktree, then open the platform PR"
    )
    return 0


def live_plan(data_repo: Path, plan: dict[str, list[str]]) -> tuple[dict[str, list[str]], list[str]]:
    """The feed files to ship, and everything else that differs, held for a person's release."""
    is_feed = lambda rel, globs: any(fnmatch.fnmatch(rel, g) for g in globs)  # noqa: E731
    src = lambda rel: ROOT / next(s for s, d in ROOTS.items() if d == rel.split("/")[0]) / rel.partition("/")[2]  # noqa: E731
    ship = {"added": [r for r in plan["added"] if is_feed(r, LIVE_NEW_FILES)], "changed": [], "data_only": []}
    held = [r for r in plan["added"] if r not in ship["added"]]
    for rel in plan["changed"]:
        shrunk = src(rel).stat().st_size < LIVE_MIN_SIZE_SHARE * (data_repo / rel).stat().st_size
        (ship["changed"] if is_feed(rel, LIVE_FEEDS) and not shrunk else held).append(rel + (" (shrank by more than half)" if shrunk else ""))
    # A basin's inventory counts every family: it waits while any of that basin's other files wait.
    waiting = {r.split("/")[2] for r in held if r.startswith("data/basins/")}
    held += [r for r in ship["changed"] if r.endswith("/inventory.json") and r.split("/")[2] in waiting]
    ship["changed"] = [r for r in ship["changed"] if r not in held]
    return ship, held


def wait_for_checks(repo: str, head_sha: str) -> str:
    """A PR head's check runs: 'success', or what stopped them. Settled = all completed on two polls a minute apart."""
    deadline, seen = time.time() + CHECKS_TIMEOUT_S, -1
    while time.time() < deadline:
        time.sleep(60)
        runs = gh_json(f"repos/{repo}/commits/{head_sha}/check-runs?per_page=100")["check_runs"]  # type: ignore[index]
        if runs and all(r["status"] == "completed" for r in runs):
            if len(runs) == seen:
                bad = [f"{r['name']}: {r['conclusion']}" for r in runs if r["conclusion"] not in ("success", "skipped", "neutral")]
                return "; ".join(bad) or "success"
            seen = len(runs)
    return f"checks still running after {CHECKS_TIMEOUT_S // 60} min"


def merge_when_green(repo: str, pr: dict, title: str) -> str | None:
    """Squash-merge a PR once its checks pass and delete its branch; the merge sha, or None (PR left open)."""
    verdict = wait_for_checks(repo, pr["head"]["sha"])
    if verdict != "success":
        print(f"{pr['html_url']} not merged ({verdict}); it stays open for a person")
        return None
    merged = gh_json(f"repos/{repo}/pulls/{pr['number']}/merge", "--method", "PUT", "-f", "merge_method=squash", "-f", f"commit_title={title}", "-f", "commit_message=")
    run(["gh", "api", "--method", "DELETE", f"repos/{repo}/git/refs/heads/{pr['head']['ref']}"])
    return merged["sha"]  # type: ignore[index]


def cmd_live(args: argparse.Namespace) -> int:
    today = dt.date.today().isoformat()
    sha, branch = platform_head()
    if branch != "main" or not sha_is_on_remote(sha):
        print(f"refusing: live releases run from a pushed main checkout, not {branch} @ {sha[:12]}")
        return 2
    if run(["git", "status", "--porcelain", "--", *ROOTS], cwd=ROOT):
        print("refusing: public/data or public/geojson has uncommitted changes; only what is on main ships")
        return 2
    with tempfile.TemporaryDirectory(prefix="nv-corpus-") as tmp_str:
        data_repo = clone_data_repo(Path(tmp_str))
        ship, held = live_plan(data_repo, plan_copy(data_repo))
        print(f"feeds to release: {len(ship['changed'])} changed, {len(ship['added'])} new station packs")
        for rel in ship["added"] + ship["changed"]:
            print(f"  ~ {rel}")
        print(f"held for a person's release: {len(held)}")
        for rel in held[:40]:
            print(f"  = {rel}")
        if not ship["added"] and not ship["changed"]:
            print("nothing to release")
            return 0
        if not args.execute:
            print("dry run; add --execute to release")
            return 0
        pr = open_data_pr(data_repo, ship, "live", sha, branch, today,
                          "Automatic live-feed release: only files scheduled jobs write; it merges itself once the checks pass.")
    print(f"data PR opened: {pr['html_url']}")
    merge_sha = merge_when_green(DATA_REPO, pr, pr["title"])
    if not merge_sha:
        return 1
    tag = f"corpus-{today}-live"
    try:
        run(["gh", "api", f"repos/{DATA_REPO}/git/refs", "-f", f"ref=refs/tags/{tag}", "-f", f"sha={merge_sha}"])
    except subprocess.CalledProcessError:
        tag = f"{tag}-{merge_sha[:7]}"  # a second release the same day
        run(["gh", "api", f"repos/{DATA_REPO}/git/refs", "-f", f"ref=refs/tags/{tag}", "-f", f"sha={merge_sha}"])
    counts = tree_counts(merge_sha)
    if counts is None:
        print(f"merged and tagged {tag}, but the tree listing was truncated: pin by hand")
        return 1
    n = len(ship["changed"]) + len(ship["added"])
    write_lock(merge_sha, counts, f"{today}: {tag} (data#{pr['number']}, squash {merge_sha}), automatic live-feed release: "
                                  f"{n} feed files from main @ {sha[:12]}; expected_files {counts['data']}/{counts['geojson']}.")
    title = f"Corpus pin: {tag}, the weekly live-feed release"
    pin_branch = f"corpus-pin/{tag}"
    run(["git", "checkout", "-q", "-b", pin_branch], cwd=ROOT)
    run([*RELEASE_GIT, "commit", "-q", "-m", title, "--", "corpus.lock"], cwd=ROOT)
    run(["git", "push", "-q", "origin", pin_branch], cwd=ROOT)
    run(["git", "checkout", "-q", "main"], cwd=ROOT)
    pin_pr = gh_json(f"repos/{PLATFORM_REPO}/pulls", "--method", "POST", "-f", f"title={title}", "-f", f"head={pin_branch}", "-f", "base=main",
                     "-f", f"body=Moves corpus.lock to {tag} (data#{pr['number']}): {n} feed files that scheduled jobs wrote. It merges itself once CI has built against the new corpus.")
    print(f"merged data#{pr['number']} as {merge_sha[:12]}, tagged {tag}; pin PR {pin_pr['html_url']}")  # type: ignore[index]
    return 0 if merge_when_green(PLATFORM_REPO, pin_pr, title) else 1  # type: ignore[arg-type]


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
    live = sub.add_parser("live", help="release what scheduled jobs wrote, merge it and rewrite corpus.lock")
    live.add_argument("--execute", action="store_true", help="release (default: report)")
    live.set_defaults(func=cmd_live)
    args = parser.parse_args()
    if shutil.which("gh") is None:
        print("gh is required", file=sys.stderr)
        return 2
    os.chdir(ROOT)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
