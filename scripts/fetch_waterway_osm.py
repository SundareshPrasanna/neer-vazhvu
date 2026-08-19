#!/usr/bin/env python3
"""Fetch a waterway's OSM inputs from Overpass (generic; --waterway <id>).

New with the Cooum (waterway 2), 19 Aug 2026: the Buckingham Canal's OSM
inputs were fetched by hand and its config carries no fetch block, so this
script refuses to run for it - refetching would move a shipped geometry
baseline. Queries live in scripts/waterways/<id>.json under fetch.queries
(filename -> Overpass QL, verbatim).

House rules encoded here:
  - the kumi mirror (overpass-api.de rate-limits burst fetches)
  - `out meta;` for the meta variant, never `out meta tags` (parse error)
  - snapshot files land in <research_dir>/data/ and are treated as a
    frozen baseline afterwards; refetch only with intent.

Usage: python3 scripts/fetch_waterway_osm.py --waterway <id> [--only FILE]
"""

import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def fetch(mirror: str, query: str) -> dict:
    body = urllib.parse.urlencode({"data": query}).encode()
    req = urllib.request.Request(
        mirror, data=body,
        headers={"User-Agent": "neer-vazhvu waterway pipeline "
                               "(contact: neervazhvu.org)"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                return json.loads(resp.read())
        except Exception as exc:  # noqa: BLE001
            if attempt == 2:
                raise
            print(f"  retry {attempt + 1} after {exc}")
            time.sleep(20 * (attempt + 1))
    raise RuntimeError("unreachable")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--waterway", required=True)
    ap.add_argument("--only", help="fetch just this output filename")
    args = ap.parse_args()
    cfg = json.loads(
        (ROOT / "scripts" / "waterways" / f"{args.waterway}.json").read_text())
    if not cfg.get("fetch"):
        raise SystemExit(
            f"{args.waterway} has no fetch block: its OSM inputs are a frozen "
            "snapshot (see fetch_note in the config).")
    data = ROOT / cfg["research_dir"] / "data"
    data.mkdir(parents=True, exist_ok=True)
    mirror = cfg["fetch"]["mirror"]
    for fname, query in cfg["fetch"]["queries"].items():
        if args.only and fname != args.only:
            continue
        print(f"fetching {fname} ...")
        d = fetch(mirror, query)
        n = len(d.get("elements", []))
        (data / fname).write_text(json.dumps(d))
        print(f"  {n} elements -> {fname}")
        time.sleep(5)
    print("done")


if __name__ == "__main__":
    main()
