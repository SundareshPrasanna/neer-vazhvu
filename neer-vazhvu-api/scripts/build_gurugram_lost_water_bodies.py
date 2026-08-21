#!/usr/bin/env python3
"""
Gurugram's lost water bodies, derived from GMDA's OWN cross-survey attribution.

WHY THIS IS DIFFERENT FROM EVERY OTHER CITY'S LOST-BODIES FILE. Kolkata's,
Delhi's and Bengaluru's are hand-curated from litigation records, news archives
and academic surveys - one named pond at a time, each with a story. Gurugram's
does not need that, because the publisher already did the join: GMDA maintains
an 824-body register built for the National Green Tribunal, and every row
carries a flag for whether that body appears in

    ror    the 1956 record of rights (the revenue map)
    soi    the 1976 Survey of India sheets
    wv_12  2012 WorldView satellite imagery
    drone  a drone survey
    ge     Google Earth

So "in the 1956 revenue record, absent from the 2012 satellite pass" is a query
against the authority's own attribution rather than an inference of ours. That
is a far stronger footing than any spatial join we could run.

THE THREE THINGS THIS MUST NOT CLAIM
------------------------------------
1. **It is a FLOOR, not a total.** The register is the 2012-known population. A
   pond that existed in 1956 and had already vanished by 2012 is not a row here
   at all - it would only be in the separate WB 1956 (ROR) layer. So this counts
   bodies that survived long enough to be registered and then were not seen from
   space, and undercounts the real loss.
2. **Never publish the raw vintage counts as a series.** 640 (1956) -> 519
   (1976) -> 824 (2012) RISES at the end, because three survey methods have
   three inclusion criteria and satellite picks up construction pits and
   seasonal water that a revenue clerk never listed.
3. **"Absent from the 2012 imagery" is not proof of destruction.** A seasonal
   johad photographed dry, or one under tree cover, reads the same way. Each
   entry says that plainly; `status` is "Not seen in 2012 imagery", never
   "Lost".

Run
---
    cd neer-vazhvu-api
    python3 scripts/build_gurugram_lost_water_bodies.py \
        --out ../public/data/water-bodies-lost-gurugram.json
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from registry_license import registry_license  # noqa: E402
from nvdm_write import write_artifact  # noqa: E402

SOURCE_ID = "gmda-onemap-arcgis"
REPO = Path(__file__).resolve().parents[2]
REGISTER = REPO / "public/geojson/gurugram-water-bodies-current.geojson"


def flag(props: dict, key: str) -> bool:
    """The register stores these as 0/1, sometimes as strings."""
    return str(props.get(key, "")).strip() in {"1", "1.0", "True", "true"}


def centroid(geom: dict) -> tuple[float | None, float | None]:
    xs: list[float] = []
    ys: list[float] = []

    def walk(c):
        if c and isinstance(c[0], (int, float)):
            xs.append(c[0])
            ys.append(c[1])
        else:
            for x in c or []:
                walk(x)

    walk(geom.get("coordinates"))
    if not xs:
        return None, None
    return round(sum(ys) / len(ys), 6), round(sum(xs) / len(xs), 6)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    register = json.loads(REGISTER.read_text())
    feats = register.get("features", [])
    if not feats:
        print("register is empty - harvest it first", file=sys.stderr)
        return 1

    in_ror = [f for f in feats if flag(f.get("properties", {}), "in_ror_1956")]
    gone = [f for f in in_ror if not flag(f.get("properties", {}), "in_worldview_2012")]
    # A body seen by neither the 2012 satellite pass nor Google Earth is a
    # stronger signal than one missed by a single pass.
    gone_both = [
        f for f in gone if not flag(f.get("properties", {}), "in_google_earth")
    ]

    bodies = []
    for f in sorted(gone, key=lambda x: -(x["properties"].get("area_acre") or 0)):
        p = f["properties"]
        lat, lng = centroid(f.get("geometry") or {})
        seen_ge = flag(p, "in_google_earth")
        acres = p.get("area_acre")
        bodies.append(
            {
                "name": (
                    f"{p.get('village') or 'Unnamed'} waterbody {p.get('wb_id') or ''}".strip()
                ),
                "status": "Not seen in 2012 imagery",
                "side": ", ".join(x for x in [p.get("village"), p.get("tehsil")] if x),
                "note": (
                    "In GMDA's register this body matches a 1956 revenue-record plot but was "
                    "not seen in the 2012 WorldView pass"
                    + (
                        ", though Google Earth does show it"
                        if seen_ge
                        else " and Google Earth does not show it either"
                    )
                    + f". Ownership: {p.get('ownership') or 'unrecorded'}."
                    + (
                        f" Recorded area {acres:.2f} acres."
                        if isinstance(acres, (int, float))
                        else ""
                    )
                    + (f" GMDA remark: {p['remark']}" if p.get("remark") else "")
                ),
                "lat": lat,
                "lng": lng,
                "location_basis": "Centroid of the polygon in GMDA's NGT water-body register",
                "location_confidence": "high",
                "in_mcg_limits": p.get("in_mcg") == "Present",
            }
        )

    out = {
        "place_id": "gurugram",
        "compiled_at": date.today().isoformat(),
        "summary": {
            # "fully lost" is reserved for the stronger signal: missing from
            # BOTH the satellite pass and Google Earth.
            "fully_lost_count": len(gone_both),
            "severely_reduced_count": len(gone) - len(gone_both),
        },
        "primary_source": "GMDA water-body register compiled for the National Green Tribunal",
        "primary_source_url": (
            "https://onemapdepts.gmda.gov.in/server/rest/services/"
            "Wet_Infrastructure_caching/MapServer"
        ),
        "secondary_sources": [],
        "city_wide_loss": (
            f"{len(gone)} of the {len(in_ror)} water bodies GMDA can match to a 1956 "
            f"revenue-record plot were not seen in the 2012 satellite pass. "
            f"{len(gone_both)} of those are absent from Google Earth as well. The register "
            f"holds {len(feats)} bodies in total across roughly "
            f"{sum(f['properties'].get('area_acre') or 0 for f in feats):,.0f} acres."
        ),
        "note": (
            "This is a FLOOR, not a total. GMDA's register is the 2012-known population, so a "
            "pond that existed in 1956 and had already gone by 2012 is not a row in it at all. "
            "It also is not proof of destruction: a seasonal johad photographed dry, or one under "
            "tree cover, is absent from an image for reasons that have nothing to do with being "
            "filled. Every entry says 'not seen in 2012 imagery' rather than 'lost' for that "
            "reason."
        ),
        "_location_note": (
            "Coordinates are polygon centroids from GMDA's own register, so they are as accurate "
            "as the register's geometry."
        ),
        "legal_context": (
            "The register exists because of the National Green Tribunal. Ownership is the "
            "complication it exposes: most of Gurugram's water bodies are not municipal - gram "
            "panchayats hold the largest share and a substantial number are privately held - and "
            "only 163 of the 824 sit inside the Municipal Corporation's boundary at all, against "
            "454 inside the wider GMDA area. The body most people would petition is responsible "
            "for a fifth of the register."
        ),
        "lost_bodies": bodies,
    }

    envelope = {
        "nvdm": "1.0",
        "dataset": "data-root/water-bodies-lost",
        "scope": {"kind": "city", "id": "gurugram"},
        "provenance": {
            "sources": [
                {
                    "id": SOURCE_ID,
                    "title": "GMDA NGT water-body register, with its own ROR/SoI/WorldView cross-survey flags",
                    "publisher": "Gurugram Metropolitan Development Authority (OneMap GGM)",
                    "license": registry_license(SOURCE_ID),
                    # 'input': GMDA stands behind the register and its
                    # cross-survey flags; the "not seen in 2012" SELECTION over
                    # them is ours, so this is raw material rather than a
                    # published finding we transport.
                    "role": "input",
                }
            ],
            "method": "derived",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_gurugram_lost_water_bodies.py",
            "note": (
                "Derived by querying the publisher's OWN cross-survey attribution (in the 1956 "
                "record of rights, absent from the 2012 WorldView pass) rather than by a spatial "
                "join of ours. A floor rather than a total, and a statement about imagery rather "
                "than about destruction."
            ),
        },
    }
    write_artifact(Path(args.out), {**envelope, **out})
    print(
        f"wrote {args.out}: {len(gone)} of {len(in_ror)} ROR-matched bodies unseen in 2012 "
        f"({len(gone_both)} also absent from Google Earth), out of {len(feats)} registered",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
