#!/usr/bin/env python3
"""
Build each city's curated artifacts from the input files in its folder.

A curated artifact is written research: rows, citations and wording a person
compiled, rather than numbers a script fetched. It lives as data in the city's
folder and this script checks it and writes the file the page reads:

    src/cities/<city>/<family>.json  ->  public/data/<family>-<city>.json

    family                  page
    commitments             /<city>/commitments
    restoration-projects    /<city>/lake-restoration (projects, court orders)
    water-bodies-flagship   /<city>/lake-restoration (the flagship lakes)
    allocations             /<city>/allocations

    python3 neer-vazhvu-api/scripts/build_curated.py commitments --city nagpur
    python3 neer-vazhvu-api/scripts/build_curated.py all --all
    python3 neer-vazhvu-api/scripts/build_curated.py all --all --check   # check only, write nothing

An input file has two parts:

- `payload`: exactly what the page reads, in the order it is written. Edit
  rows here, and set the date field (`updated`, `compiled_at`) when you do.
- `build`: how to write it. `indent` and `trailingNewline` keep the file's byte
  style. `envelope` is the NVDM envelope used only when the artifact does not
  exist yet (a new city); afterwards the writer keeps the envelope on disk, as
  every producer does. A source with a registry `id` gets its licence from the
  source registry, never from this file; a source with no id (a one-off
  citation) keeps the licence written on it. `expect` pins counts that prose
  states (commitments only).

When a city's numbers are transcribed from a document's table, and the table's
printed totals can be checked, keep a builder that checks them instead (see
`scripted` in FAMILIES). Everything else is an input file.

Commitments follow one status rule in every city: `delivered` when a dated
source records completion; `on-track` only with a dated progress figure for the
work itself and the date not passed; `slipped` when the institution's own later
document moved the date and the new date has not passed; `overdue` when the
latest date given has passed with no completion record; `stalled` when work has
stopped by the record; `unverified` when the promise can be cited but its
current status cannot either way.

Hard checks fail the build. Warnings are printed and never change a value:
statuses move only against a dated citation, so a passed recheck date is a
prompt to look, not a reason to relabel.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from city_manifest import configs  # noqa: E402
from nvdm_write import merge_envelope  # noqa: E402
from registry_license import registry_license  # noqa: E402

CITIES_DIR = REPO_ROOT / "src" / "cities"
DATA_DIR = REPO_ROOT / "public" / "data"

Report = tuple[list[str], list[str]]  # (problems, warnings)

# ── commitments ────────────────────────────────────────────────────────────

# The statuses the commitments page knows how to sort, colour and count.
STATUSES = {"delivered", "on-track", "slipped", "overdue", "stalled", "unverified"}
DATE = re.compile(r"^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$")
REQUIRED_TEXT = ("category", "title", "committed_by", "what")
# "Rs 1,926.99 crore (Centre 1,115.22, State 507.36, NMC 304.41)" or
# "Rs 237.20 crore (167.44 + 69.76)": the parts must add up to the total.
CRORE_SPLIT = re.compile(r"Rs ([\d,]+(?:\.\d+)?) crore \(([^)]*)\)")
LABELLED = re.compile(r"^[A-Za-z][\w .'-]* [\d,]+(?:\.\d+)?$")
AMOUNT = re.compile(r"[\d,]+(?:\.\d+)?")


def split_sums(text: str) -> list[str]:
    """Each 'Rs T crore (parts)' whose parts are amounts and do not add up to T."""
    bad = []
    for m in CRORE_SPLIT.finditer(text):
        inner = m.group(2).split(", our sum")[0]
        if "%" in inner:
            continue
        if " + " in inner:
            parts = [p.strip() for p in inner.split(" + ")]
            if not all(AMOUNT.fullmatch(p) for p in parts):
                continue
        else:
            parts = [p.strip() for p in inner.split(",")]
            if len(parts) < 2 or not all(LABELLED.match(p) for p in parts):
                continue
        values = [float(AMOUNT.findall(p)[-1].replace(",", "")) for p in parts]
        total = float(m.group(1).replace(",", ""))
        # Each printed part is rounded, so allow a paisa of rounding per part.
        if abs(sum(values) - total) > 0.011 * len(values):
            bad.append(
                f"Rs {m.group(1)} crore ({m.group(2)}) sums to {round(sum(values), 2)}"
            )
    return bad


def ledger_ids(city: str) -> set[str] | None:
    """The anchors a commitment's ledger_id can link to on /<city>/allocations."""
    path = DATA_DIR / f"allocations-{city}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    return {e["id"] for key in ("arrangements", "futures") for e in data.get(key, [])}


def check_commitments(city: str, spec: dict, today: str) -> Report:
    problems: list[str] = []
    warnings: list[str] = []
    payload, build = spec["payload"], spec.get("build", {})
    rows = payload.get("commitments")
    if not isinstance(rows, list) or not rows:
        return ["payload.commitments must be a non-empty list"], []
    legend = payload.get("status_legend") or {}
    ledger = ledger_ids(city)
    unique(rows, "id", problems)

    for r in rows:
        rid = r.get("id") or "<no id>"
        for key in REQUIRED_TEXT:
            if not (isinstance(r.get(key), str) and r[key].strip()):
                problems.append(f"{rid}: {key} is empty")
        status = r.get("status")
        if status not in STATUSES:
            problems.append(
                f"{rid}: status {status!r} is not one of {sorted(STATUSES)}"
            )
        elif status not in legend:
            problems.append(f"{rid}: status {status!r} has no entry in status_legend")
        history = r.get("status_history") or []
        if history and history[-1].get("status") != status:
            problems.append(
                f"{rid}: status is {status!r} but the latest history entry says {history[-1].get('status')!r}"
            )
        if r.get("ledger_id") and ledger is not None and r["ledger_id"] not in ledger:
            problems.append(
                f"{rid}: ledger_id {r['ledger_id']!r} is not an id in allocations-{city}.json"
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
        for s in split_sums(json.dumps(r, ensure_ascii=False)):
            warnings.append(f"{rid}: {s}")

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


# ── restoration projects, flagship lakes, allocations ──────────────────────


def unique(rows: list, key: str, problems: list[str], what: str = "") -> None:
    """The page keys its lists on these fields, so each must be present and unique."""
    values = [r.get(key) for r in rows]
    if any(not v for v in values):
        problems.append(f"{what}a row has no {key}")
    for dup in sorted({v for v in values if v and values.count(v) > 1}):
        problems.append(f"{what}duplicate {key} {dup!r}")


def check_list(
    key: str, name: str, extra: Callable[[dict, list[str]], None] | None = None
):
    def check_family(city: str, spec: dict, today: str) -> Report:
        problems: list[str] = []
        rows = spec["payload"].get(key)
        if not isinstance(rows, list) or not rows:
            return [f"payload.{key} must be a non-empty list"], []
        unique(rows, name, problems)
        if extra:
            extra(spec["payload"], problems)
        return problems, []

    return check_family


def court_orders(payload: dict, problems: list[str]) -> None:
    unique(
        payload.get("court_orders") or [], "writ_petition", problems, "court_orders: "
    )


# ── families ───────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Family:
    # public/data/<output>, with {city} for the city id.
    output: str
    check: Callable[[str, dict, str], Report]
    # Cities whose artifact a builder writes instead, and why. A new city uses
    # an input file; a builder belongs only where it checks a transcription
    # against printed totals, or reads another artifact.
    scripted: dict[str, str]


LAKES_SCRIPTED = {
    "kolkata": "build_kolkata_restoration.py reads each lake's latest sample from river-quality-kolkata.json",
    "nagpur": "build_nagpur_lakes.py checks its transcription against the documents' printed totals",
    "visakhapatnam": "build_visakhapatnam_restoration.py checks the AMRUT rows against their printed totals",
}

FAMILIES: dict[str, Family] = {
    "commitments": Family("commitments-{city}.json", check_commitments, {}),
    "restoration-projects": Family(
        "restoration-projects-{city}.json",
        check_list("projects", "scheme_name", court_orders),
        LAKES_SCRIPTED,
    ),
    "water-bodies-flagship": Family(
        "water-bodies-flagship-{city}.json",
        check_list("bodies", "name"),
        LAKES_SCRIPTED,
    ),
    "allocations": Family(
        "allocations-{city}.json",
        check_list("arrangements", "id"),
        {
            "nagpur": "build_nagpur_allocations.py checks the GR and ESR tables against their printed totals"
        },
    ),
}


def input_path(family: str, city: str) -> Path:
    return CITIES_DIR / city / f"{family}.json"


def output_path(family: str, city: str) -> Path:
    return DATA_DIR / FAMILIES[family].output.format(city=city)


def cities_with_input(family: str) -> list[str]:
    return [c for c in configs() if input_path(family, c).exists()]


def load(family: str, city: str) -> dict:
    return json.loads(input_path(family, city).read_text())


def check(family: str, city: str, spec: dict, today: str) -> Report:
    payload = spec.get("payload")
    if not isinstance(payload, dict):
        return ["no payload"], []
    problems: list[str] = []
    if payload.get("place_id") != city:
        problems.append(
            f"payload.place_id is {payload.get('place_id')!r}, expected {city!r}"
        )
    for src in (
        spec.get("build", {})
        .get("envelope", {})
        .get("provenance", {})
        .get("sources", [])
    ):
        if src.get("id") and "license" in src:
            problems.append(
                f"source {src['id']!r} carries a licence; it is read from the source registry"
            )
    p, w = FAMILIES[family].check(city, spec, today)
    return problems + p, w


def seed_envelope(envelope: dict) -> dict:
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
        if s.get("id")
        else s
        for s in prov.get("sources", [])
    ]
    prov["produced_at"] = date.today().isoformat()
    return {"nvdm": "1.0", **env}


def render(family: str, city: str, spec: dict, path: Path | None = None) -> str:
    """The artifact's text: the envelope on disk (or the seed), then the payload."""
    build = spec.get("build", {})
    path = path or output_path(family, city)
    out = merge_envelope(
        path, {**seed_envelope(build.get("envelope", {})), **spec["payload"]}
    )
    text = json.dumps(out, ensure_ascii=False, indent=build.get("indent", 2))
    return text + ("\n" if build.get("trailingNewline") else "")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="Build curated artifacts from each city folder."
    )
    ap.add_argument("families", nargs="+", choices=[*FAMILIES, "all"])
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--city")
    group.add_argument("--all", action="store_true")
    ap.add_argument(
        "--check", action="store_true", help="run the checks only; write nothing"
    )
    args = ap.parse_args(argv)

    families = list(FAMILIES) if "all" in args.families else args.families
    if "all" in args.families and args.city:
        # One city: build the families it has an input for.
        families = [f for f in families if input_path(f, args.city).exists()]
    today = date.today().isoformat()
    failed = False
    for family in families:
        cities = cities_with_input(family) if args.all else [args.city]
        for city in cities:
            label = f"{family}-{city}"
            if not input_path(family, city).exists():
                print(
                    f"{label}: no {input_path(family, city).relative_to(REPO_ROOT)}",
                    file=sys.stderr,
                )
                failed = True
                continue
            spec = load(family, city)
            problems, warnings = check(family, city, spec, today)
            for w in warnings:
                print(f"  warning  {label}: {w}")
            if problems:
                failed = True
                for p in problems:
                    print(f"  ERROR    {label}: {p}", file=sys.stderr)
                continue
            if args.check:
                print(f"{label}: OK ({len(warnings)} warnings)")
                continue
            output_path(family, city).write_text(render(family, city, spec))
            print(
                f"{label}: wrote {output_path(family, city).relative_to(REPO_ROOT)} ({len(warnings)} warnings)"
            )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
