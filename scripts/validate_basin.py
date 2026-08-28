#!/usr/bin/env python3
"""Basin Atlas contract validator (see docs/specs/basin-atlas.md sections 5-6).

Checks an ingested basin against the layer-family contract and prints a
partner-readable report: required families present, required properties
populated, geometry sanity, shedId referential integrity, and the honest
gaps (geometry-only layers, skipped sources). This is the bottleneck-removal
tool - a partner's delivery either passes, or the report says exactly what to
fix, without a developer in the loop.

Usage:
    python3 scripts/validate_basin.py docs/paani_data/ingest-manifest.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

REQUIRED_FAMILIES = {"boundary", "sub-hydrosheds", "rivers"}

# Two tiers, keyed by family root (prefixes like "admin-district" -> "admin"):
#   REQUIRED  - load-bearing for typing/scoping; a gap is an ERROR.
#   EXPECTED  - descriptive labels/details; a gap is a WARNING, never a blocker
#               (the contract allows geometry-only rendering - names enrich).
REQUIRED_PROPS = {
    "sub-hydrosheds": ["shedId", "name"],
    "rivers": ["riverId", "name"],
    "monitoring-points": ["agency", "purpose"],
    "evidence-points": ["contributor", "evidenceUrl"],
    "infrastructure": ["kind"],
    "pressures": ["kind"],
    "admin": ["level"],
    "command-areas": [],
    "flow-stations": ["stationKey", "name", "agency", "hasReadings"],
}
EXPECTED_PROPS = {
    "monitoring-points": ["name", "findings"],
    "evidence-points": ["findings"],
    "infrastructure": ["name", "status"],
    "admin": ["name"],
    "command-areas": ["name"],
    "flow-stations": ["siteType", "river"],
}

# Series kinds the station-readings panel knows how to chart (see
# docs/specs/flow-stations-contract.md). Unknown kinds render as a table,
# so they are a warning, not an error.
KNOWN_SERIES_KINDS = {
    "discharge-monthly", "discharge-daily", "climatology-monthly",
    "flow-duration", "annual-water-year", "gauge-level-monthly",
    "wq-param-series", "wq-class-series",
}


def check_readings_packs(out_dir: Path, feats: list, errors: list, warnings: list) -> None:
    """Every hasReadings station must have a parseable pack; packs must carry
    provenance and at least one series (the contract's honest-degradation rule
    is expressed as hasReadings: false, never as an empty pack)."""
    for f in feats:
        props = f["properties"]
        key = props.get("stationKey")
        if not props.get("hasReadings"):
            continue
        pf = out_dir / "readings" / f"{key}.json"
        if not pf.exists():
            errors.append(f"flow-stations: {key} has hasReadings but no readings/{key}.json")
            continue
        try:
            pack = json.loads(pf.read_text())
        except json.JSONDecodeError as e:
            errors.append(f"readings/{key}.json: not parseable ({e})")
            continue
        if pack.get("schemaVersion") != 1:
            errors.append(f"readings/{key}.json: schemaVersion must be 1")
        src = pack.get("source") or {}
        if not src.get("label") or not src.get("fetched"):
            errors.append(f"readings/{key}.json: source.label + source.fetched are mandatory (provenance rule)")
        series = pack.get("series") or []
        if not series:
            errors.append(f"readings/{key}.json: no series - use hasReadings: false instead of an empty pack")
        for s in series:
            if "verified" not in s:
                errors.append(f"readings/{key}.json: series '{s.get('kind')}' missing verified flag")
            if s.get("kind") not in KNOWN_SERIES_KINDS:
                warnings.append(f"readings/{key}.json: unknown series kind '{s.get('kind')}' (renders as a table)")


def _fam_root(fam: str) -> str:
    return fam.split("-")[0] if fam.split("-")[0] in {"waterbodies", "admin", "pressures"} else fam


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("usage: validate_basin.py <manifest.json>")
    manifest = json.loads(Path(sys.argv[1]).read_text())
    out_dir = REPO / manifest["outDir"]
    if not out_dir.exists():
        sys.exit(f"No ingested output at {out_dir} - run ingest_basin.py first.")

    inv = json.loads((out_dir / "inventory.json").read_text())
    families = inv["families"]
    errors: list[str] = []
    warnings: list[str] = []
    notes: list[str] = []

    # 1. Required families.
    for req in sorted(REQUIRED_FAMILIES):
        present = req in families or any(f.split("-")[0] == req for f in families)
        if not present:
            errors.append(f"missing required family: {req}")

    # 2. Sub-hydroshed id set, for referential integrity.
    shed_ids = set()
    shed_fp = out_dir / "sub-hydrosheds.geojson"
    if shed_fp.exists():
        for f in json.loads(shed_fp.read_text())["features"]:
            sid = f["properties"].get("shedId")
            if sid:
                shed_ids.add(sid)

    # 3. Per-family property + geometry + integrity checks.
    for fam in sorted(families):
        fp = out_dir / f"{fam}.geojson"
        if not fp.exists():
            errors.append(f"{fam}: inventory lists it but {fp.name} is missing")
            continue
        feats = json.loads(fp.read_text())["features"]
        if not feats:
            warnings.append(f"{fam}: 0 features")
            continue

        root = _fam_root(fam)
        for prop in REQUIRED_PROPS.get(root, []):
            # Required means PRESENT, not truthy: hasReadings false is a real
            # value (the contract's way of saying "no pack"), so a pending
            # station must not read as a missing property.
            missing = sum(1 for f in feats if f["properties"].get(prop) in (None, ""))
            if missing:
                errors.append(f"{fam}: {missing}/{len(feats)} features missing required '{prop}'")
        for prop in EXPECTED_PROPS.get(root, []):
            missing = sum(1 for f in feats if not f["properties"].get(prop))
            if missing:
                warnings.append(f"{fam}: {missing}/{len(feats)} features missing '{prop}' (label gap, renders without it)")

        # Geometry present?
        no_geom = sum(1 for f in feats if not f.get("geometry"))
        if no_geom:
            errors.append(f"{fam}: {no_geom} features have no geometry")

        # Station-readings packs (flow-stations contract).
        if root == "flow-stations":
            check_readings_packs(out_dir, feats, errors, warnings)

        # shedId referential integrity.
        bad = {f["properties"]["shedId"] for f in feats
               if f["properties"].get("shedId") and f["properties"]["shedId"] not in shed_ids}
        if bad:
            errors.append(f"{fam}: shedId(s) not in sub-hydrosheds: {sorted(bad)}")

        # Honest gap: geometry-only layers (no descriptive attributes at all).
        attr_keys = {k for f in feats for k in f["properties"] if k not in ("shedId", "kind", "level")}
        if not attr_keys:
            notes.append(f"{fam}: geometry-only ({len(feats)} features, no descriptive attributes)")

    # 4. Skipped sources -> honest gaps.
    for s in inv.get("skipped", []):
        notes.append(f"skipped {s['file']}: {s.get('reason','')}")

    # ── Report ──
    print(f"\nBasin '{inv['basinId']}' contract validation")
    print("=" * 52)
    print(f"families: {len(families)}   "
          f"total features: {sum(f['featureCount'] for f in families.values())}")
    if errors:
        print(f"\n  {len(errors)} ERROR(S) - must fix:")
        for e in errors:
            print(f"   x {e}")
    if warnings:
        print(f"\n  {len(warnings)} warning(s):")
        for w in warnings:
            print(f"   ! {w}")
    if notes:
        print(f"\n  {len(notes)} note(s) / known gaps:")
        for n in notes:
            print(f"   - {n}")
    print()
    if errors:
        print("RESULT: FAIL - fix the errors above and re-ingest.\n")
        sys.exit(1)
    print("RESULT: PASS - conforms to the basin layer contract.\n")


if __name__ == "__main__":
    main()
