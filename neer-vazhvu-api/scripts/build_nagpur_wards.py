#!/usr/bin/env python3
"""
Nagpur's 38 electoral wards (prabhags) of the 2025 ward formation.

THE FINAL NOTIFICATION IS TEXT ONLY. The Maharashtra Government Gazette of
4 Oct 2025 (No. 1600-E.D.-NMC-2025) fixes 38 wards and 151 councillors, prints
each ward's population, and describes the boundaries in words; the legal map is
"available ... for inspection in the office of the Municipal Corporation".
The only official vector is MRSAC's PM Gati Shakti layer
(Gatishakti_DMA/MapServer/2, ulb_name 'Municipal Corporation Nagpur'), so the
GEOMETRY is MRSAC's and the POPULATIONS are the gazette's.

THE MRSAC LAYER WAS CAPTURED BEFORE THE FINAL NOTIFICATION. Its population
attributes match the final gazette for only 28 of 38 wards and the August 2025
draft for 33. Wards 6, 8, 9 and 19 carry the draft figures (ward 7 the draft's
less 1,000); wards 7, 17 and 37 have typing slips (ward 17 reads 700,678); and
wards 23 and 26 differ from both the draft and the final by one block of 446
people (total, SC and ST each conserved across the pair), so MRSAC's 23/26
line is a different one, older than the draft. Between draft and final, the
lines between wards 6 and 7, 7 and 9, and 8 and 19 moved; the other 33 wards
are identical in both. So the layer's own population fields are dropped, and
wards 6, 7, 8, 9, 19, 23 and 26 carry a boundary_note: their mapped edge may
not follow the final line.

ZONES ARE NOT NESTED. NMC's 10 zones (its own GIS, NMCAdminBoundaries/2) do not
contain whole wards: 18 of the 38 have under 90% of their area in one zone
(ward 4 is split three ways, 46% in Lakadganj). NMC assigns each ward to a zone
office administratively, and no machine-readable list of that assignment has
been found. So zone_name (and zone_no) is given only where one zone holds at
least 90% of the ward (ZONE_MIN_SHARE), and is null for the other 18; zone_share
is the largest share in any one zone. zone_no is NMC's own zone number (1 to 10,
the numbering the gazette and NMC's zone locator use), not the GIS ZONEID.
MRSAC's ward layer has its own zone label (landmark); it differs from the
area-majority zone for 8 wards (MRSAC_DIFFERS, asserted), three of which (1, 8,
33) still get a zone here. The ten zone outlines are frozen as
pipeline-inputs/nagpur/nmc-zones.geojson, from which each locality gets the
zone at its own point (scripts/osm-layers/nagpur.json).

Populations are checked against the schedule's own sum, 24,47,494, and the
structure against 37 four-member wards and one three-member ward, before
anything is written.

Run:  python3 neer-vazhvu-api/scripts/build_nagpur_wards.py
"""

import sys
from datetime import date
from pathlib import Path

from shapely.geometry import shape

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_nagpur_geography import (  # noqa: E402
    NMC_GIS,
    REPO_ROOT,
    area_km2,
    arcgis_features,
    gj,
)

sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

DMA = "https://gsc.mrsac.org.in/webadpgis1/rest/services/gatishakti/Gatishakti_DMA/MapServer"
ULB = "Municipal Corporation Nagpur"
WARDS_ID = "mrsac-gatishakti-dma-wards"
ZONES_PATH = REPO_ROOT / "pipeline-inputs" / "nagpur" / "nmc-zones.geojson"
# A ward is labelled with a zone only when that zone holds this share of it.
ZONE_MIN_SHARE = 0.9
GAZETTE_ID = "sec-maharashtra-nmc-ward-formation-2025"
ZONES_ID = "nmc-gis-admin-boundaries"

GAZETTE_TOTAL = 2447494
SEATS = {w: 4 for w in range(1, 38)} | {38: 3}

# Final notification of 4 Oct 2025, English schedule: ward -> (total
# population as printed, PDF page). Read from the PDF text layer; the Marathi
# schedule (pp.1-34) prints the same figures.
POPULATION = {
    1: (69790, 35),
    2: (69465, 37),
    3: (64371, 38),
    4: (60949, 39),
    5: (68482, 40),
    6: (63959, 41),
    7: (63370, 41),
    8: (70472, 42),
    9: (60703, 43),
    10: (59260, 44),
    11: (71151, 45),
    12: (59756, 45),
    13: (62882, 46),
    14: (60771, 47),
    15: (62432, 49),
    16: (71187, 50),
    17: (70678, 51),
    18: (66652, 52),
    19: (59718, 53),
    20: (68728, 53),
    21: (63364, 54),
    22: (69001, 55),
    23: (63471, 56),
    24: (61732, 57),
    25: (66076, 58),
    26: (59642, 58),
    27: (66828, 59),
    28: (59456, 60),
    29: (62343, 60),
    30: (63564, 61),
    31: (64092, 62),
    32: (68711, 63),
    33: (67572, 64),
    34: (65506, 65),
    35: (60871, 65),
    36: (70209, 66),
    37: (63064, 67),
    38: (47216, 68),
}

# Wards whose line moved between the draft and the final notification (the
# 6-7, 7-9 and 8-19 lines; wards 6 and 9 do not touch).
MOVED = {6: (7,), 7: (6, 9), 9: (7,), 8: (19,), 19: (8,)}
# Wards whose MRSAC figures follow a 23/26 line that is neither the draft's
# nor the final one: 446 people sit in 26 on MRSAC's figures, in 23 in both.
OTHER_LINE = {23: 26, 26: 23}

# NMC's own zone numbers, by the GIS zone NAME (its ZONEID is a record key).
ZONE_NO = {
    "Laxmi Nagar": 1,
    "Dharampeth": 2,
    "Hanuman Nagar": 3,
    "Dhantoli": 4,
    "Nehru Nagar": 5,
    "Gandhibagh": 6,
    "Satranjipura": 7,
    "Lakadganj": 8,
    "Ashi Nagar": 9,
    "Mangalwari": 10,
}
# MRSAC's landmark spellings -> NMC's zone names.
MRSAC_SPELLING = {
    "Ashinagar": "Ashi Nagar",
    "Gandhibag": "Gandhibagh",
    "Hanumannagar": "Hanuman Nagar",
    "Laxminagar": "Laxmi Nagar",
    "Neharunagar": "Nehru Nagar",
}
# Wards whose MRSAC zone label is not the NMC zone holding most of the ward
# (checked 15 Oct 2026): 1, 8 and 33 are at least 95% in one NMC zone.
MRSAC_DIFFERS = (1, 8, 17, 22, 29, 32, 33, 35)


def boundary_note(ward: int) -> str | None:
    if ward in OTHER_LINE:
        return (
            f"MRSAC's ward populations follow a different line between this ward and ward "
            f"{OTHER_LINE[ward]} than either the August 2025 draft or the final notification of "
            f"4 Oct 2025 (a block of 446 people), so this edge of the outline may not follow the "
            f"final line. The legal map is kept at the NMC office."
        )
    if ward not in MOVED:
        return None
    others = MOVED[ward]
    nbrs = (
        f"ward {others[0]}"
        if len(others) == 1
        else f"wards {others[0]} and {others[1]}"
    )
    return (
        f"The final notification of 4 Oct 2025 moved part of the line between this ward and "
        f"{nbrs}. This outline comes from MRSAC's map, whose ward populations follow the "
        f"August 2025 draft, so this edge may follow the draft line rather than the final one. "
        f"The legal map is kept at the NMC office."
    )


def main() -> int:
    assert sum(t for t, _ in POPULATION.values()) == GAZETTE_TOTAL, (
        "gazette transcription no longer sums"
    )
    assert sorted(POPULATION) == list(range(1, 39))

    raw = arcgis_features(
        f"{DMA}/2",
        f"ulb_name='{ULB}'",
        fields="OBJECTID,ward_no,tot_member,ulb_name,landmark",
    )
    assert len(raw) == 38, f"expected 38 prabhags, MRSAC returned {len(raw)}"
    members = {
        int(f["properties"]["ward_no"]): int(f["properties"]["tot_member"]) for f in raw
    }
    assert members == SEATS, f"members per ward differ from 37 x 4 + 1 x 3: {members}"
    city = arcgis_features(
        f"{DMA}/1", f"ulb_name='{ULB}'", fields="OBJECTID,tot_wards,tot_member,tot_pop"
    )
    c = city[0]["properties"]
    assert (c["tot_wards"], c["tot_member"], c["tot_pop"]) == (
        38,
        151,
        GAZETTE_TOTAL,
    ), c

    zones = [
        (
            z["properties"]["ZONEID"],
            z["properties"]["NAME"].strip(),
            shape(z["geometry"]).buffer(0),
        )
        for z in arcgis_features(f"{NMC_GIS}/2", "1=1", fields="OBJECTID,ZONEID,NAME")
    ]
    assert len(zones) == 10, f"expected NMC's 10 zones, got {len(zones)}"
    assert {zn for _, zn, _ in zones} == set(ZONE_NO), sorted(zn for _, zn, _ in zones)
    mrsac_zone = {
        int(f["properties"]["ward_no"]): MRSAC_SPELLING.get(
            f["properties"]["landmark"].strip(), f["properties"]["landmark"].strip()
        )
        for f in raw
    }
    assert set(mrsac_zone.values()) <= set(ZONE_NO), sorted(set(mrsac_zone.values()))
    # A pipeline input carries no envelope; write_artifact writes it as given.
    write_artifact(
        ZONES_PATH,
        {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"zone_name": zn, "zone_no": str(ZONE_NO[zn])},
                    "geometry": gj(zg),
                }
                for _, zn, zg in sorted(zones, key=lambda z: ZONE_NO[z[1]])
            ],
        },
        compact=True,
    )

    feats = []
    majority: dict[int, str] = {}
    for f in raw:
        no = int(f["properties"]["ward_no"])
        g = shape(f["geometry"])
        g = g if g.is_valid else g.buffer(0)
        shares = sorted(
            ((area_km2(g.intersection(zg)), zid, zn) for zid, zn, zg in zones),
            reverse=True,
        )
        a = area_km2(g)
        top_km2, _, zname = shares[0]
        majority[no] = zname
        share = round(top_km2 / a, 2)
        named = share >= ZONE_MIN_SHARE
        props = {
            "ward_number": no,
            "ward_name": f"Prabhag {no}",
            "zone_name": zname if named else None,
            "zone_no": ZONE_NO[zname] if named else None,
            "zone_share": share,
            "councillors": SEATS[no],
            "population": POPULATION[no][0],
            "area_sq_km": round(a, 3),
        }
        note = boundary_note(no)
        if note:
            props["boundary_note"] = note
        feats.append({"type": "Feature", "properties": props, "geometry": gj(g)})
    feats.sort(key=lambda x: x["properties"]["ward_number"])
    differs = tuple(sorted(n for n in majority if majority[n] != mrsac_zone[n]))
    assert differs == MRSAC_DIFFERS, f"MRSAC zone labels now differ for {differs}"
    zoned = sum(1 for x in feats if x["properties"]["zone_name"] is not None)
    assert zoned == 20, f"{zoned} wards now have a zone; update the envelope note"

    out = {
        "nvdm": "1.0",
        "dataset": "geojson-layers/wards-2025",
        "scope": {"kind": "city", "id": "nagpur"},
        "provenance": {
            "sources": [
                {
                    "id": WARDS_ID,
                    "title": "MRSAC PM Gati Shakti 'Prabhag Ward Boundary' (Gatishakti_DMA/MapServer/2), Municipal Corporation Nagpur, 38 polygons",
                    "publisher": "Maharashtra Remote Sensing Applications Centre (MRSAC)",
                    "license": registry_license(WARDS_ID),
                    "url": f"{DMA}/2",
                },
                {
                    "id": GAZETTE_ID,
                    "title": "Final ward formation, Nagpur Municipal Corporation, notification No. 1600-E.D.-NMC-2025, Maharashtra Government Gazette Extraordinary Part 1-A, Nagpur Divisional Supplement, 4 Oct 2025, English schedule pp.35-68 (ward populations)",
                    "publisher": "Nagpur Municipal Corporation, with the approval of the State Election Commission, Maharashtra",
                    "license": registry_license(GAZETTE_ID),
                    "as_of": "2025-10-04",
                },
                {
                    "id": ZONES_ID,
                    "title": "NMC GIS zone boundaries (NMCAdminBoundaries/MapServer/2), 10 zones, for zone_name",
                    "publisher": "Nagpur Municipal Corporation",
                    "license": registry_license(ZONES_ID),
                    "role": "input",
                },
            ],
            "method": "mixed",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_nagpur_wards.py",
            "internal_inputs": [],
            "note": (
                "Outlines from MRSAC's layer; its own population fields are not used because they were "
                "captured before the final notification. population is the total printed for each ward in the final "
                "notification (sum 2,447,494; the schedule does not name its census year). Wards cross "
                "the lines of NMC's GIS zones, and NMC assigns wards to zone offices administratively, so "
                "zone_name and zone_no (NMC's own zone number, 1 to 10) are given only where one zone "
                "holds at least 90% of the ward (20 of 38 wards) and are null elsewhere; zone_share is "
                "the largest share in any one zone. MRSAC's ward layer labels each ward with a zone too, "
                "and for 8 wards (1, 8, 17, 22, 29, 32, 33 and 35) its label is not the NMC zone holding "
                "most of the ward; wards 1, 8 and 33 lie at least 95% in one NMC zone and keep that zone "
                "here, so the two publishers differ on them. MRSAC's ward populations follow the August "
                "2025 draft, with some typing slips and a different 23/26 split: wards 6, 7, 8, 9 and 19 "
                "carry a boundary_note because their line moved after the draft, and wards 23 and 26 "
                "because MRSAC's line between them is neither the draft's nor the final one. "
                "area_sq_km is measured on the outline."
            ),
        },
        "type": "FeatureCollection",
        "features": feats,
    }
    path = REPO_ROOT / "public" / "geojson" / "nagpur-wards-2025.geojson"
    write_artifact(path, out, compact=True)
    total = sum(x["properties"]["area_sq_km"] for x in feats)
    split = sum(1 for x in feats if x["properties"]["zone_name"] is None)
    print(
        f"38 wards, {total:.2f} km2, {split} with no zone (under 90% in one) -> {path.name}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
