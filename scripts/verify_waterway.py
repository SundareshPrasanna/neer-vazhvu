#!/usr/bin/env python3
"""Publication gate for public/data/waterways/<id>/.

Usage: python3 scripts/verify_waterway.py --waterway <id>

Fails (exit 1) if:
  - any fact/claim lacks a non-empty source, date, or valid flag
  - any banned claim appears in emitted text: the rules are the gate section of
    scripts/waterways/<id>.json, one per real error found in circulation
    (literal strings, regexes, and per-claim all/none patterns)
  - reach km ranges do not tile 0..gate.tiling_end_km contiguously
  - a referenced chip (or photo, when gate.photos) is missing
  - the data directory exceeds 8 MB

verify_waterway_buckingham.py and verify_waterway_cooum.py are the entry points
the served artifacts name.
"""

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLAGS = {"verified", "inferred", "asserted"}


def banned(gate: dict, all_text: str, claims: list) -> list[str]:
    errors = []
    for rule in gate["banned_text"]:
        if "literal" in rule:
            errors += [
                rule["message"].format(s=s) for s in rule["literal"] if s in all_text
            ]
        elif (
            "unless_near" in rule
        ):  # allowed only with its attribution within 200 characters
            for m in re.finditer(rule["pattern"], all_text):
                if (
                    rule["unless_near"]
                    not in all_text[max(0, m.start() - 200) : m.end() + 200]
                ):
                    errors.append(rule["message"])
        elif re.search(rule["pattern"], all_text):
            errors.append(rule["message"])
    for c in claims:
        for rule in gate["banned_claims"]:
            s = c["text"] if rule["in"] == "text" else c["text"] + " " + c["source"]
            if all(re.search(p, s) for p in rule["all"]) and not any(
                re.search(p, s) for p in rule.get("none", [])
            ):
                errors.append(f"{c['id']}: {rule['message']}")
    return errors


def main(waterway: str) -> None:
    gate = json.loads(
        (ROOT / "scripts" / "waterways" / f"{waterway}.json").read_text()
    )["gate"]
    out = ROOT / "public" / "data" / "waterways" / waterway
    img = ROOT / "public" / "images" / "waterways" / waterway
    errors = []

    docs = {n: json.loads((out / f"{n}.json").read_text()) for n in gate["scanned"]}
    reaches, claims = docs["reaches"], docs["claims"]["claims"]

    for c in claims:
        if not c.get("source") or not str(c.get("source")).strip():
            errors.append(f"{c['id']}: empty source")
        if not c.get("date") or not str(c.get("date")).strip():
            errors.append(f"{c['id']}: empty date")
        if c.get("flag") not in FLAGS:
            errors.append(f"{c['id']}: bad flag {c.get('flag')!r}")

    all_text = json.dumps(
        [claims if n == "claims" else d for n, d in docs.items()], ensure_ascii=False
    )
    errors += banned(gate, all_text, claims)

    end = gate["tiling_end_km"]
    rs = sorted(reaches["reaches"], key=lambda r: r["km"][0])
    if abs(rs[0]["km"][0] - 0.0) > 0.01:
        errors.append("reach tiling does not start at km 0")
    for a, b in zip(rs, rs[1:]):
        if abs(a["km"][1] - b["km"][0]) > 0.01:
            errors.append(f"reach gap/overlap at km {a['km'][1]} -> {b['km'][0]}")
    if abs(rs[-1]["km"][1] - end) > 0.11:
        errors.append(f"reach tiling ends at {rs[-1]['km'][1]}, expected {end}")

    for r in rs:
        for chip in r["chips"]:
            if not (img / "chips" / chip).exists():
                errors.append(f"reach {r['id']}: missing chip {chip}")
        for ph in r["photos"] if gate["photos"] else []:
            if not (img / "photos" / ph["file"]).exists():
                errors.append(f"reach {r['id']}: missing photo {ph['file']}")
        for f in r["facts"]:
            if not f.get("claim_id"):
                errors.append(f"reach {r['id']}: fact without claim_id")

    size_mb = (
        sum(f.stat().st_size for d in (out, img) for f in d.rglob("*") if f.is_file())
        / 1e6
    )
    if size_mb > 8.0:
        errors.append(f"data dir {size_mb:.1f} MB exceeds 8 MB budget")

    if errors:
        print(f"FAIL ({len(errors)}):")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print(
        f"OK: {len(claims)} claims sourced+dated+flagged, "
        f"{len(rs)} reaches tiled 0-{end} km, {'chips and photos' if gate['photos'] else 'chips'} present, "
        f"{size_mb:.1f} MB <= 8 MB"
    )


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--waterway", required=True)
    main(ap.parse_args().waterway)
