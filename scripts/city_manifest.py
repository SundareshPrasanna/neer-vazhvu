"""Per-city settings for Python scripts and GitHub workflows.

Everything about a city lives in its folder, src/cities/<id>/. Python reads two
files from there:

- src/cities/generated/cities.json - every config.ts as plain JSON, written by
  `npm run cities:gen` (centre, bbox, routes, placeKind, waterSources...).
- src/cities/<id>/pipeline.json - settings only the data pipeline reads (the
  IMD rainfall grid point, the IN-GRES assessment units, elevation bands...).
  The app never imports it. Optional; a city without one has no sections.

In a script (scripts under neer-vazhvu-api/ already put scripts/ on sys.path):

    from city_manifest import configs, section
    for city, imd in section("rainfall.imdGrid").items(): ...

From a shell or workflow:

    python3 scripts/city_manifest.py --ids                        # every city, launch order
    python3 scripts/city_manifest.py --ids --has rainfall.imdGrid # cities with that section
    python3 scripts/city_manifest.py --get kolkata center         # one value, as JSON

Keys `_note` and `_notes` hold the reasoning behind a value (what a code comment
held before the value moved here). section() drops them, so scripts see only data.
"""

from __future__ import annotations

import argparse
import json
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CITIES_DIR = ROOT / "src" / "cities"
NOTE_KEYS = ("_note", "_notes")


@lru_cache(maxsize=1)
def configs() -> dict[str, dict]:
    """Every city config (config.ts as JSON), in launch order."""
    return json.loads((CITIES_DIR / "generated" / "cities.json").read_text())


@lru_cache(maxsize=None)
def pipeline(city: str) -> dict:
    """The city's pipeline.json, or {} if it has none."""
    path = CITIES_DIR / city / "pipeline.json"
    return json.loads(path.read_text()) if path.exists() else {}


def _dig(obj: Any, dotted: str) -> Any:
    for part in dotted.split("."):
        if not isinstance(obj, dict) or part not in obj:
            return None
        obj = obj[part]
    return obj


def section(dotted: str) -> dict[str, Any]:
    """{city: value} for every city whose pipeline.json has `dotted`, in launch
    order, with top-level `_note`/`_notes` removed from dict values."""
    out: dict[str, Any] = {}
    for city in configs():
        value = _dig(pipeline(city), dotted)
        if value is None:
            continue
        if isinstance(value, dict):
            value = {k: v for k, v in value.items() if k not in NOTE_KEYS}
        out[city] = value
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--ids", action="store_true", help="print city ids, one line, space-separated")
    ap.add_argument("--has", help="with --ids: only cities whose pipeline.json has this dotted key")
    ap.add_argument("--get", nargs=2, metavar=("CITY", "KEY"), help="print one config value as JSON")
    args = ap.parse_args()
    if args.ids:
        ids = list(section(args.has)) if args.has else list(configs())
        print(" ".join(ids))
        return 0
    if args.get:
        city, key = args.get
        print(json.dumps(_dig(configs().get(city, {}), key)))
        return 0
    ap.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
