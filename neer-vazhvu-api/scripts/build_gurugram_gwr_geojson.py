#!/usr/bin/env python3
"""
Give Gurugram's groundwater choropleth something to paint.

THE BUG THIS FIXES. The groundwater page was turned on with the IN-GRES
assessment in hand and rendered a map with ZERO features - 203 characters of
text over an empty basemap - because the choropleth reads
`<cityId>-gwr-blocks.geojson` for its polygons and that file 404'd. The
assessment VALUES existed; nothing carried the SHAPES. The page returned 200
and said the right words, which is why three earlier verification passes
called it working. Only counting rendered map features caught it.

THE JOIN. GMDA OneMap publishes all 22 Haryana district boundaries
(onemap/Boundary_GMDA, layer 20 "District Boundary"), and it spells them the
way IN-GRES does - GURGAON, MEWAT - so the join is direct on the name IN-GRES
already gives us. No fuzzy matching, no hand-maintained alias table.

Output shape matches Delhi's and Bengaluru's gwr-blocks layers:
`block`, `class`, `sgw_dev_pe` (stage of extraction %), so the shared
choropleth renders it without a city branch.

Run
---
    cd neer-vazhvu-api
    python3 scripts/build_gurugram_gwr_geojson.py \
        --out ../public/geojson/gurugram-gwr-blocks.geojson
"""

from __future__ import annotations

import argparse
import json
import ssl
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from registry_license import registry_license  # noqa: E402
from nvdm_write import write_artifact  # noqa: E402

SOURCE_ID = "gmda-onemap-arcgis"
INGRES_ID = "ingres-groundwater-haryana"
BOUNDARY = (
    "https://onemapdepts.gmda.gov.in/server/rest/services/"
    "onemap/Boundary_GMDA/MapServer/20"
)
REPO = Path(__file__).resolve().parents[2]
ASSESSMENT = REPO / "public/data/gwr-blocks-gurugram.json"

# IN-GRES category -> the class label the shared choropleth colours on.
CLASS_LABEL = {
    "safe": "Safe",
    "semi_critical": "Semi Critical",
    "critical": "Critical",
    "over_exploited": "Over Exploited",
    "salinity": "Saline (not assessed on extraction)",
}

_CTX = ssl.create_default_context()
_CTX.options |= getattr(ssl, "OP_LEGACY_SERVER_CONNECT", 0x4)
assert _CTX.verify_mode == ssl.CERT_REQUIRED
assert _CTX.check_hostname


def fetch_districts() -> dict[str, dict]:
    q = urllib.parse.urlencode(
        {
            "where": "1=1",
            "outFields": "name",
            "returnGeometry": "true",
            "outSR": "4326",
            "f": "geojson",
        }
    )
    req = urllib.request.Request(
        f"{BOUNDARY}/query?{q}", headers={"User-Agent": "neervazhvu-ggm-gwr"}
    )
    with urllib.request.urlopen(req, timeout=180, context=_CTX) as r:
        doc = json.loads(r.read())
    if doc.get("error"):
        raise RuntimeError(doc["error"].get("message"))
    out = {}
    for f in doc.get("features", []):
        nm = (f.get("properties") or {}).get("name")
        if nm:
            out[nm.strip().upper()] = f
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    assessment = json.loads(ASSESSMENT.read_text())
    polys = fetch_districts()

    features, missing = [], []
    for d in assessment["districts"]:
        key = (d.get("ingres_name") or d["district"]).strip().upper()
        poly = polys.get(key)
        if not poly:
            missing.append(d["district"])
            continue
        latest = d.get("latest") or {}
        stage = latest.get("stage_of_extraction_pct")
        features.append(
            {
                "type": "Feature",
                "geometry": poly["geometry"],
                "properties": {
                    # `block` is the shared layer's label field. These are
                    # DISTRICTS: Haryana's IN-GRES assessment publishes at district
                    # level, and the page copy says district so the label is not
                    # claiming a finer unit than exists.
                    "block": d["district"],
                    "class": CLASS_LABEL.get(latest.get("category"), "Unassessed"),
                    "sgw_dev_pe": round(stage, 2)
                    if isinstance(stage, (int, float))
                    else None,
                    "assessment_year": latest.get("year"),
                    "assessed_on_extraction": latest.get("assessed_on_extraction"),
                },
            }
        )

    if missing:
        # Refuse rather than ship a choropleth with holes in it: a district
        # silently absent reads as "no data here" on the map.
        print(f"no boundary matched for: {missing}", file=sys.stderr)
        return 1
    if not features:
        print("no features built", file=sys.stderr)
        return 1

    payload = {
        "type": "FeatureCollection",
        "_source": "GMDA OneMap district boundaries, joined to the IN-GRES assessment",
        "_note": (
            "Haryana's IN-GRES assessment is published at DISTRICT level, so these polygons are "
            "districts rather than blocks despite the file name, which follows the platform's "
            "existing gwr-blocks convention. Block-level figures exist for Gurugram district "
            "(GURGAON_URBAN 326.26%) but GMDA's block-boundary layer covers only four blocks, so "
            "no complete block choropleth can be drawn yet."
        ),
        "_fetched": date.today().isoformat(),
        "features": features,
    }
    envelope = {
        "nvdm": "1.0",
        "dataset": "geojson-layers/gwr-blocks",
        "scope": {"kind": "city", "id": "gurugram"},
        "provenance": {
            "sources": [
                {
                    "id": SOURCE_ID,
                    "title": "GMDA OneMap Boundary_GMDA district boundaries",
                    "publisher": "Gurugram Metropolitan Development Authority (OneMap GGM)",
                    "license": registry_license(SOURCE_ID),
                    # 'input': the geometry is raw material for a layer WE
                    # derive by joining it to a separate assessment. Neither
                    # publisher stands behind the joined product.
                    "role": "input",
                },
                {
                    "id": INGRES_ID,
                    "title": "IN-GRES dynamic ground water resource assessment, Haryana",
                    "publisher": "IN-GRES (CGWB + Haryana), IIT Hyderabad",
                    "license": registry_license(INGRES_ID),
                    "role": "input",
                },
            ],
            "method": "derived",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_gurugram_gwr_geojson.py",
            "note": (
                "District polygons from the municipal authority joined to the central "
                "assessment on the district name both portals share. Refuses to write if any "
                "assessed district lacks a boundary, so the choropleth cannot ship with holes."
            ),
        },
    }
    write_artifact(Path(args.out), {**envelope, **payload}, compact=True)
    print(
        f"wrote {args.out}: {len(features)} districts with geometry and stage %",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
