"""Publish already-generated rich-body chips and tints, and repair manifests.

The imagery ingest uploads as it goes, but an upload that fails leaves the
chip on local disk with `public_url: null` in the manifest, and the whole
run has to be repeated to get it published. That happened wholesale when
the `satellite-evidence` bucket was deleted: every chip generated during
the outage exists at its `local_path` and none of them has a URL.

This uploads whatever is already on disk for a body and rewrites its
manifest URLs, so a bucket outage costs an upload pass rather than a
fresh GEE run.

Usage:
  python scripts/backfill_rich_body_chip_uploads.py --body-id powai
  python scripts/backfill_rich_body_chip_uploads.py --all
  python scripts/backfill_rich_body_chip_uploads.py --all --dry-run
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "neer-vazhvu-api" / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parent))

from _rich_body_upload import upload_supabase, SATELLITE_EVIDENCE_BUCKET  # noqa: E402

MANIFEST_DIR = ROOT / "public/data/rich-bodies"


def manifest_path(body_id: str) -> Path:
    return MANIFEST_DIR / f"{body_id}-imagery-manifest.json"


def all_body_ids() -> list[str]:
    return sorted(
        p.name[: -len("-imagery-manifest.json")]
        for p in MANIFEST_DIR.glob("*-imagery-manifest.json")
    )


def publish(entry: dict, kind: str, dry_run: bool) -> str | None:
    """Upload one asset if its bytes are on disk and it has no URL yet."""
    if entry.get("public_url") or entry.get("url"):
        return None
    local = entry.get("local_path")
    remote = entry.get("remote_path")
    if not local or not remote:
        return f"{kind}: no local_path/remote_path recorded"
    local_file = Path(local)
    if not local_file.exists():
        return f"{kind}: {local} missing on disk - needs a fresh ingest run"
    if dry_run:
        entry["_would_upload"] = remote
        return None
    content_type = "image/png" if local_file.suffix == ".png" else "image/jpeg"
    entry["public_url"] = upload_supabase(remote, local_file.read_bytes(), content_type)
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--body-id")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not args.body_id and not args.all:
        ap.error("pass --body-id <slug> or --all")

    bodies = all_body_ids() if args.all else [args.body_id]
    total_up = total_skip = 0

    for body_id in bodies:
        path = manifest_path(body_id)
        if not path.exists():
            print(f"{body_id}: no manifest, skipped")
            continue
        manifest = json.loads(path.read_text())
        problems: list[str] = []
        before = sum(1 for c in manifest.get("chips", []) if c.get("public_url") or c.get("url"))

        for chip in manifest.get("chips", []):
            if not chip.get("available"):
                continue
            p = publish(chip, f"chip {chip.get('year')}", args.dry_run)
            if p:
                problems.append(p)
        for name, tint in (manifest.get("tints") or {}).items():
            p = publish(tint, f"tint {name}", args.dry_run)
            if p:
                problems.append(p)

        # Count what actually got a URL. In dry-run nothing is written, so
        # counting `public_url` again would report 0 every time and make a
        # dry run look like "nothing to do" on a body with no URLs at all.
        if args.dry_run:
            uploaded = sum(1 for c in manifest.get("chips", []) if c.pop("_would_upload", None))
            uploaded += sum(
                1 for t in (manifest.get("tints") or {}).values() if t.pop("_would_upload", None)
            )
        else:
            after = sum(
                1 for c in manifest.get("chips", []) if c.get("public_url") or c.get("url")
            )
            uploaded = after - before
        total_up += uploaded
        total_skip += len(problems)

        if not args.dry_run and uploaded:
            manifest["storage_bucket"] = SATELLITE_EVIDENCE_BUCKET
            path.write_text(json.dumps(manifest, indent=2) + "\n")

        verb = "would upload" if args.dry_run else "uploaded"
        print(f"{body_id}: {verb} {uploaded} chips, {len(problems)} unavailable")
        for p in problems[:3]:
            print(f"    {p}")
        if len(problems) > 3:
            print(f"    ... and {len(problems) - 3} more")

    print(f"\n{total_up} assets published, {total_skip} still need a fresh ingest run")
    return 0


if __name__ == "__main__":
    sys.exit(main())
