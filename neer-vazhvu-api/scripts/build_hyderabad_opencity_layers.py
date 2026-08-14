#!/usr/bin/env python3
"""
Ingest Hyderabad's OpenCity geo layers: nalas, waterlogging points, the
Jal Dharohar water-bodies census, tanks and canals/drains.

THE NALA ENCROACHMENT COLUMNS ARE PUBLISHED BUT EMPTY - READ THIS
-----------------------------------------------------------------
GHMC's nala (storm-water drain) layer ships with a per-nala encroachment
schema, broken out by who is doing the encroaching:

    Govt_Encr   Pvt_Encr   Rel_Encr   Total_Encr   Court_Case

That would be an exceptional accountability dataset - nala encroachment is the
accepted cause of Hyderabad's 2020 flooding. **It is not populated.** Verified
2026-07-26: all five fields hold "0" for all 96 nalas, one distinct value,
zero non-zero entries - while Length_m carries 94 distinct values and
Total_Seg 28, so the file is not broken, just blank in these columns.

**This must never be rendered as "zero encroachments".** Hyderabad created
HYDRAA in 2024 specifically to demolish encroachments and it has been
demolishing them since; a column of zeros in that city is an unpopulated
field, not a finding of compliance. Publishing it as data would be a serious
factual error.

What it IS: a named gap with a precise shape. GHMC defined the schema,
shipped it, and left it blank. That is worth stating on the flood page as an
absence - "the city publishes a field for this and does not fill it" - and it
is a concrete RTI ask, because the schema tells you exactly what to request.

The build ASSERTS this rather than trusting the docstring: any column that is
uniformly zero across every feature is reported as `_empty_columns` and
excluded from the summary, so if GHMC ever populates it the change surfaces
instead of passing silently.

Layers built
------------
  hyderabad-nalas.geojson          96 nalas, 245 km (encroachment cols stripped, empty)
  hyderabad-waterlogging.geojson   23 GHMC "major water logging places" points
  hyderabad-water-census.geojson   Jal Dharohar 2023 points (Hyderabad + Rangareddy)
  hyderabad-tanks-opencity.geojson GHMC tank/lake layer
  hyderabad-canals-drains.geojson  GHMC canals and drains

CAVEATS
-------
- These are undated GHMC/HMDA extracts republished by OpenCity. No edition or
  survey date is present in the KML, so `_vintage_unknown` is set rather than
  invented. The Jal Dharohar layer self-identifies as 2023.
- `water_body_type` in the census is a CODED value (01, 02, ...). The code
  table is in the census methodology PDF, not in the KML, so codes are carried
  through unresolved rather than guessed at. Same handling as Delhi's.
- The census `village` field for urban points holds "GHMC WARD NUMBER <n>",
  which is a usable ward key - but it refers to the OLD 150-ward GHMC, not the
  300-ward Dec-2025 delimitation. Recorded, not joined.

Run
---
    cd neer-vazhvu-api
    python3 scripts/build_hyderabad_opencity_layers.py --outdir ../public/geojson
"""

import argparse
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import date
from pathlib import Path

# The registry owns every registered source's licence string; a second copy in
# a generator is how the registry and the corpus drifted apart (PR #227).
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from registry_license import registry_license  # noqa: E402
from nvdm_write import write_artifact  # noqa: E402


KML_NS = {"k": "http://www.opengis.net/kml/2.2"}

LAYERS = {
    "nalas": {
        "url": "https://data.opencity.in/dataset/4becf994-e7f5-4da3-b201-b56b126b57f7/resource/b3b68ed3-9443-43c4-ad93-638c8dad19b9/download/20dcf709-c38e-4ed1-a4b6-e5887769f992.kml",
        "out": "hyderabad-nalas.geojson",
        "label": "GHMC nala (storm-water drain) network",
    },
    "waterlogging": {
        "url": "https://data.opencity.in/dataset/fbc0cf2e-2c10-4d9a-8dfd-0b1c24c6f279/resource/8ab584c9-19ca-4c1b-945f-f19fe1db5de5/download/d6d078ca-7330-4efe-8a5f-0c74cb6a0a70.kml",
        "out": "hyderabad-waterlogging.geojson",
        "label": "GHMC major water-logging places",
    },
    "census_hyd": {
        "url": "https://data.opencity.in/dataset/037dc191-1419-4242-a6c1-0dcbfecae600/resource/4b7fe252-8d3c-4a1b-8f50-eccb3caf3269/download/e94a1948-f2a6-4661-9243-750e55616d3d.kml",
        "out": None,  # merged into the census layer
        "label": "Jal Dharohar 2023 water-bodies census, Hyderabad district",
    },
    "census_rr": {
        "url": "https://data.opencity.in/dataset/037dc191-1419-4242-a6c1-0dcbfecae600/resource/41640ad7-31f8-4e26-8366-bc19b0ded63e/download/5f24f421-adc5-40a9-a365-2378b8978970.kml",
        "out": None,
        "label": "Jal Dharohar 2023 water-bodies census, Rangareddy district",
    },
    "tanks": {
        "url": "https://data.opencity.in/dataset/4becf994-e7f5-4da3-b201-b56b126b57f7/resource/24d7e2e8-74bf-4ba3-bf7c-0867848f74d9/download/9e2e8554-6052-4df3-a8c0-94c993658cc5.kml",
        "out": "hyderabad-tanks-opencity.geojson",
        "label": "GHMC tanks (lakes) layer",
    },
    "canals_drains": {
        "url": "https://data.opencity.in/dataset/4becf994-e7f5-4da3-b201-b56b126b57f7/resource/652140c5-464b-46c0-ba59-dfd00d4b6b22/download/fc4643f6-25f1-47a1-b243-3e3af95b7366.kml",
        "out": "hyderabad-canals-drains.geojson",
        "label": "GHMC canals and drains",
    },
}

# Encroachment fields, in the KML's own spelling.
ENCR = ["Govt_Encr", "Pvt_Encr", "Rel_Encr", "Total_Encr", "Court_Case"]


def _get(url: str, timeout: int = 120) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "neervazhvu-hyd-opencity"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf8", "ignore")


def _coords(text: str):
    pts = []
    for tok in (text or "").split():
        parts = tok.split(",")
        if len(parts) >= 2:
            try:
                pts.append([round(float(parts[0]), 6), round(float(parts[1]), 6)])
            except ValueError:
                continue
    return pts


def parse_kml(kml: str) -> list:
    """KML -> list of GeoJSON features. Handles Point / LineString / Polygon."""
    root = ET.fromstring(kml.encode("utf8"))
    feats = []
    for pm in root.iter("{http://www.opengis.net/kml/2.2}Placemark"):
        props = {}
        for sd in pm.iter("{http://www.opengis.net/kml/2.2}SimpleData"):
            props[sd.get("name")] = (sd.text or "").strip()
        nm = pm.find("k:name", KML_NS)
        if nm is not None and (nm.text or "").strip():
            props.setdefault("name", nm.text.strip())

        geoms = []
        for ls in pm.iter("{http://www.opengis.net/kml/2.2}LineString"):
            c = ls.find("k:coordinates", KML_NS)
            pts = _coords(c.text if c is not None else "")
            if len(pts) >= 2:
                geoms.append({"type": "LineString", "coordinates": pts})
        for pt in pm.iter("{http://www.opengis.net/kml/2.2}Point"):
            c = pt.find("k:coordinates", KML_NS)
            pts = _coords(c.text if c is not None else "")
            if pts:
                geoms.append({"type": "Point", "coordinates": pts[0]})
        for pg in pm.iter("{http://www.opengis.net/kml/2.2}Polygon"):
            ob = pg.find(".//k:outerBoundaryIs//k:coordinates", KML_NS)
            pts = _coords(ob.text if ob is not None else "")
            if len(pts) >= 4:
                geoms.append({"type": "Polygon", "coordinates": [pts]})

        if not geoms:
            continue
        geom = (
            geoms[0]
            if len(geoms) == 1
            else {
                "type": "Multi" + geoms[0]["type"],
                "coordinates": [g["coordinates"] for g in geoms],
            }
        )
        feats.append({"type": "Feature", "geometry": geom, "properties": props})
    return feats


def _int(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--outdir", default="../public/geojson")
    args = ap.parse_args()
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    summary = {}
    census_feats = []

    for key, spec in LAYERS.items():
        try:
            kml = _get(spec["url"])
            feats = parse_kml(kml)
        except Exception as exc:  # noqa: BLE001
            print(f"  !! {key}: {str(exc)[:90]}", file=sys.stderr)
            summary[key] = {"error": str(exc)[:120]}
            continue

        if key.startswith("census_"):
            district = "Hyderabad" if key.endswith("hyd") else "Rangareddy"
            for f in feats:
                f["properties"]["_source_district"] = district
            census_feats.extend(feats)
            summary[key] = {"features": len(feats)}
            print(f"  {key}: {len(feats)} features", file=sys.stderr)
            continue

        meta = {
            "_source": spec["label"],
            "_source_url": spec["url"],
            "_licence": registry_license("opencity-ghmc-drainage-layers"),
            "_fetched": date.today().isoformat(),
            "_vintage_unknown": (
                "The KML carries no edition or survey date. Treat as an undated GHMC "
                "extract; do not present it as current-year."
            ),
        }

        if key == "nalas":
            tot = Counter()
            named = 0
            for f in feats:
                p = f["properties"]
                if p.get("Nala_Name"):
                    named += 1
                for fld in ENCR:
                    v = _int(p.get(fld))
                    if v:
                        tot[fld] += v
                p["length_m"] = _int(p.get("Length_m"))
            total_len = sum(f["properties"].get("length_m") or 0 for f in feats)

            # Detect columns GHMC ships but leaves blank. A field that is
            # uniformly zero across every nala is UNPOPULATED, not a measurement
            # of zero - see the docstring. Asserted here so that if GHMC ever
            # fills it in, the change surfaces instead of passing silently.
            empty_cols = []
            for fld in ENCR:
                vals = {(f["properties"].get(fld) or "").strip() for f in feats}
                if vals <= {"0", "", "0.0"}:
                    empty_cols.append(fld)
                    for f in feats:
                        f["properties"].pop(fld, None)

            meta["_note"] = (
                "GHMC nala (storm-water drain) network with per-nala length and segment "
                "count. The layer also DEFINES an encroachment schema (Govt_Encr / "
                "Pvt_Encr / Rel_Encr / Total_Encr / Court_Case) which GHMC ships EMPTY - "
                "see _empty_columns. Those fields are stripped rather than published, "
                "because rendering them would read as 'zero encroachments' in the city "
                "that created HYDRAA to demolish them."
            )
            if empty_cols:
                meta["_empty_columns"] = {
                    "fields": empty_cols,
                    "meaning": (
                        "Published by GHMC but uniformly zero across all "
                        f"{len(feats)} nalas - unpopulated, NOT a measurement of zero. "
                        "Do not render as data. Surface as a named gap, and as an RTI "
                        "ask whose exact shape GHMC has already specified."
                    ),
                }
            meta["summary"] = {
                "nalas": len(feats),
                "named": named,
                "total_length_m": total_len,
                "encroachment_data_published": not empty_cols,
            }
            print(
                f"  nalas: {len(feats)} nalas ({named} named), {total_len:,} m"
                + (
                    f"; ENCROACHMENT COLUMNS EMPTY and stripped: {', '.join(empty_cols)}"
                    if empty_cols
                    else f"; encroachment totals {dict(tot)}"
                ),
                file=sys.stderr,
            )
        else:
            meta["summary"] = {"features": len(feats)}
            print(f"  {key}: {len(feats)} features", file=sys.stderr)

        fc = {"type": "FeatureCollection", **meta, "features": feats}
        write_artifact(outdir / spec["out"], fc, compact=True)
        summary[key] = meta.get("summary")

    if census_feats:
        types = Counter(
            f["properties"].get("water_body_type", "") for f in census_feats
        )
        wards = sum(
            1
            for f in census_feats
            if re.search(r"WARD NUMBER", f["properties"].get("village", ""), re.I)
        )
        fc = {
            "type": "FeatureCollection",
            "_source": "1st Census of Water Bodies / Jal Dharohar 2023, Telangana",
            "_source_url": "https://data.opencity.in/dataset/hyderabad-and-telangana-water-bodies-census-data",
            "_licence": registry_license("opencity-jal-dharohar-hyderabad"),
            "_fetched": date.today().isoformat(),
            "_note": (
                "Point layer joining onto the OSM polygon base. water_body_type is a CODED "
                "value (01, 02, ...) and the code table lives in the census methodology PDF, "
                "not in the KML - codes are carried through UNRESOLVED rather than guessed. "
                "Urban points put 'GHMC WARD NUMBER <n>' in the village field, which refers "
                "to the OLD 150-ward GHMC, not the 300-ward Dec-2025 delimitation."
            ),
            "summary": {
                "features": len(census_feats),
                "with_ward_number": wards,
                "water_body_type_codes": dict(types.most_common()),
            },
            "features": census_feats,
        }
        write_artifact(outdir / "hyderabad-water-census.geojson", fc, compact=True)
        print(
            f"  census: {len(census_feats)} points ({wards} with a ward number), "
            f"type codes {dict(types.most_common())}",
            file=sys.stderr,
        )

    print(json.dumps(summary, indent=1)[:400], file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
