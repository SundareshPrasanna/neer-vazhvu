#!/usr/bin/env python3
"""
Build public/data/commitments-<city>.json from src/cities/<city>/commitments.json.

One builder for every city. Each city's commitments are curated content, so they
live as data in the city's folder, and this script only checks them and writes
the artifact the /<city>/commitments page reads.

    python3 neer-vazhvu-api/scripts/build_commitments.py --city nagpur
    python3 neer-vazhvu-api/scripts/build_commitments.py --all
    python3 neer-vazhvu-api/scripts/build_commitments.py --all --check   # check only, write nothing

The input file has two parts:

- `payload`: exactly what the page reads, in the order it is written: place_id,
  updated, headline, intro, status_legend, update_model, sources_note and the
  commitments rows. Edit rows here. `updated` is the date the content last
  changed; set it when you change a row.
- `build`: how to write it. `indent` and `trailingNewline` keep the file's byte
  style. `envelope` is the NVDM envelope used only when the artifact does not
  exist yet (a new city); afterwards the writer keeps the envelope already on
  disk, as every producer does. Its sources carry id, title, publisher and role;
  the licence is read from the source registry, never written here. `expect`
  pins the counts the intro states, so the prose cannot drift from the rows.

Every status rests on a dated citation. The status rule, the same for every
city: `delivered` when a dated source records completion; `on-track` only with
a dated progress figure for the work itself and the date not passed; `slipped`
when the institution's own later document moved the date and the new date has
not passed; `overdue` when the latest date given has passed with no completion
record; `stalled` when work has stopped by the record; `unverified` when the
promise can be cited but its current status cannot either way.

Hard checks fail the build. Warnings are printed and never change a status:
statuses move only against a dated citation, so a passed recheck date is a
prompt to look, not a reason to relabel.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from city_manifest import configs  # noqa: E402
from nvdm_write import merge_envelope  # noqa: E402
from registry_license import registry_license  # noqa: E402

CITIES_DIR = REPO_ROOT / "src" / "cities"
DATA_DIR = REPO_ROOT / "public" / "data"

# The statuses the commitments page knows how to sort, colour and count.
STATUSES = {"delivered", "on-track", "slipped", "overdue", "stalled", "unverified"}
# Hyderabad's file predates the shared vocabulary; its rows move to `unverified`
# in their own change, after which this allowance goes.
LEGACY_STATUSES = {"unverifiable"}
DATE = re.compile(r"^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$")
REQUIRED_TEXT = ("category", "title", "committed_by", "what")


def input_path(city: str) -> Path:
    return CITIES_DIR / city / "commitments.json"


def output_path(city: str) -> Path:
    return DATA_DIR / f"commitments-{city}.json"


def cities_with_input() -> list[str]:
    return [c for c in configs() if input_path(c).exists()]


def load(city: str) -> dict:
    return json.loads(input_path(city).read_text())


def check(city: str, spec: dict, today: str) -> tuple[list[str], list[str]]:
    """(problems, warnings) for one city's input."""
    problems: list[str] = []
    warnings: list[str] = []
    build, payload = spec.get("build", {}), spec.get("payload", {})
    rows = payload.get("commitments")
    if payload.get("place_id") != city:
        problems.append(
            f"payload.place_id is {payload.get('place_id')!r}, expected {city!r}"
        )
    if not isinstance(rows, list) or not rows:
        return problems + ["payload.commitments must be a non-empty list"], warnings
    if "license" in json.dumps(build.get("envelope", {})):
        problems.append(
            "build.envelope carries a licence; it is read from the source registry"
        )

    legend = payload.get("status_legend") or {}
    allowed = STATUSES | LEGACY_STATUSES
    ids = [r.get("id") for r in rows]
    for dup in sorted({i for i in ids if ids.count(i) > 1}):
        problems.append(f"duplicate id {dup!r}")

    for r in rows:
        rid = r.get("id") or "<no id>"
        for key in REQUIRED_TEXT:
            if not (isinstance(r.get(key), str) and r[key].strip()):
                problems.append(f"{rid}: {key} is empty")
        status = r.get("status")
        if status not in allowed:
            problems.append(
                f"{rid}: status {status!r} is not one of {sorted(STATUSES)}"
            )
        elif status not in legend:
            problems.append(f"{rid}: status {status!r} has no entry in status_legend")
        elif status in LEGACY_STATUSES:
            warnings.append(f"{rid}: status {status!r} is not one the page knows")
        history = r.get("status_history") or []
        if history and history[-1].get("status") != status:
            problems.append(
                f"{rid}: status is {status!r} but the latest history entry says {history[-1].get('status')!r}"
            )

        for key in ("due", "revised_due", "next_check"):
            value = r.get(key)
            if value is not None and not DATE.match(str(value)):
                warnings.append(
                    f"{rid}: {key} {value!r} is not a date (YYYY, YYYY-MM or YYYY-MM-DD)"
                )
        if not history:
            warnings.append(f"{rid}: no status history")
        for e in history:
            if not (
                e.get("source_label")
                and str(e.get("source_url", "")).startswith("https://")
            ):
                warnings.append(f"{rid}: history entry {e.get('date')} has no citation")
        if status == "slipped" and not r.get("revised_due"):
            warnings.append(f"{rid}: slipped with no revised_due")
        nxt = r.get("next_check")
        if isinstance(nxt, str) and DATE.match(nxt) and nxt < today:
            warnings.append(f"{rid}: next_check {nxt} has passed")
        latest = r.get("revised_due") or r.get("due")
        if (
            status in ("on-track", "slipped")
            and isinstance(latest, str)
            and DATE.match(latest)
            and latest < today[: len(latest)]
        ):
            warnings.append(f"{rid}: {status} but its date {latest} has passed")

    expect = build.get("expect") or {}
    if "total" in expect and len(rows) != expect["total"]:
        problems.append(
            f"{len(rows)} commitments; build.expect.total says {expect['total']} (update the intro too)"
        )
    for status, n in (expect.get("byStatus") or {}).items():
        got = sum(r.get("status") == status for r in rows)
        if got != n:
            problems.append(
                f"{got} {status}; build.expect.byStatus says {n} (update the intro too)"
            )
    return problems, warnings


def seed_envelope(city: str, envelope: dict) -> dict:
    """The envelope for a first write, with licences from the registry."""
    if not envelope:
        return {}
    env = json.loads(json.dumps(envelope))
    prov = env.setdefault("provenance", {})
    prov["sources"] = [
        {
            **{k: s[k] for k in s if k != "role"},
            "license": registry_license(s["id"]),
            **({"role": s["role"]} if "role" in s else {}),
        }
        for s in prov.get("sources", [])
    ]
    prov["produced_at"] = date.today().isoformat()
    return {"nvdm": "1.0", **env}


def render(city: str, spec: dict, path: Path | None = None) -> str:
    """The artifact's text: the envelope on disk (or the seed), then the payload."""
    build = spec.get("build", {})
    path = path or output_path(city)
    out = merge_envelope(
        path, {**seed_envelope(city, build.get("envelope", {})), **spec["payload"]}
    )
    text = json.dumps(out, ensure_ascii=False, indent=build.get("indent", 2))
    return text + ("\n" if build.get("trailingNewline") else "")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="Build commitments-<city>.json from each city folder."
    )
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--city")
    group.add_argument("--all", action="store_true")
    ap.add_argument(
        "--check", action="store_true", help="run the checks only; write nothing"
    )
    args = ap.parse_args(argv)

    cities = cities_with_input() if args.all else [args.city]
    today = date.today().isoformat()
    failed = False
    for city in cities:
        if not input_path(city).exists():
            print(
                f"{city}: no {input_path(city).relative_to(REPO_ROOT)}", file=sys.stderr
            )
            failed = True
            continue
        spec = load(city)
        problems, warnings = check(city, spec, today)
        for w in warnings:
            print(f"  warning  {city}: {w}")
        if problems:
            failed = True
            for p in problems:
                print(f"  ERROR    {city}: {p}", file=sys.stderr)
            continue
        rows = len(spec["payload"]["commitments"])
        if args.check:
            print(f"{city}: {rows} commitments OK ({len(warnings)} warnings)")
            continue
        output_path(city).write_text(render(city, spec))
        print(
            f"{city}: wrote {output_path(city).relative_to(REPO_ROOT)} ({rows} commitments, {len(warnings)} warnings)"
        )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
