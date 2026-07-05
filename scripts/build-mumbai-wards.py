#!/usr/bin/env python3
"""
Build public/geojson/mumbai-wards-2023.geojson from the DataMeet source.

Mumbai has 24 BMC ADMINISTRATIVE wards, lettered A..T (with N/S/E/W and
C splits), NOT the 227 electoral wards (which exist only as SEC PDFs with
no open geometry). DataMeet's Municipal_Spatial_Data/Mumbai/BMC_Wards.geojson
carries the 24 admin-ward polygons with bare {gid, name} properties, where
`name` is the ward letter code (e.g. "H/W").

We normalise those into the property schema the frontend ward components
expect (ward_no, ward_name, with ward_code + ward_label extras) and attach
each ward's well-known primary locality so the map/tooltip reads as a
Mumbaikar would name the ward, not "Ward 17".

Source (ODbL): https://github.com/datameet/Municipal_Spatial_Data (Mumbai/)
Run:  python scripts/build-mumbai-wards.py
"""

import json
import sys
import urllib.request

SRC_URL = (
    "https://raw.githubusercontent.com/datameet/Municipal_Spatial_Data/"
    "master/Mumbai/BMC_Wards.geojson"
)
OUT_PATH = "public/geojson/mumbai-wards-2023.geojson"

# BMC admin ward letter -> representative primary locality. Full coverage of
# all 24 codes (A..T with splits). The locality is the name residents use;
# secondary localities are omitted for a concise label.
WARD_LOCALITY: dict[str, str] = {
    "A": "Colaba / Fort",
    "B": "Sandhurst Road",
    "C": "Marine Lines",
    "D": "Malabar Hill",
    "E": "Byculla",
    "F/S": "Parel",
    "F/N": "Matunga / Sion",
    "G/S": "Worli",
    "G/N": "Dadar / Mahim",
    "H/E": "Bandra East / Khar East",
    "H/W": "Bandra West",
    "K/E": "Andheri East",
    "K/W": "Andheri West",
    "L": "Kurla",
    "M/E": "Govandi / Mankhurd",
    "M/W": "Chembur",
    "N": "Ghatkopar",
    "P/S": "Goregaon",
    "P/N": "Malad",
    "R/S": "Kandivali",
    "R/C": "Borivali",
    "R/N": "Dahisar",
    "S": "Bhandup / Powai",
    "T": "Mulund",
}


def main() -> int:
    print(f"Fetching {SRC_URL} …", flush=True)
    req = urllib.request.Request(SRC_URL, headers={"User-Agent": "neervazhvu-build"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        src = json.load(resp)

    feats = src.get("features", [])
    if len(feats) != 24:
        print(
            f"WARN: expected 24 admin wards, got {len(feats)}", file=sys.stderr, flush=True
        )

    missing = []
    out_feats = []
    for f in feats:
        props = f.get("properties", {})
        code = str(props.get("name", "")).strip()
        gid = props.get("gid")
        locality = WARD_LOCALITY.get(code)
        if locality is None:
            missing.append(code)
            locality = code
        out_feats.append(
            {
                "type": "Feature",
                "geometry": f.get("geometry"),
                "properties": {
                    "ward_no": gid,
                    "ward_code": code,
                    "ward_name": locality,
                    "ward_label": f"{code} - {locality}",
                },
            }
        )

    if missing:
        print(
            f"WARN: no locality mapping for ward codes: {missing}",
            file=sys.stderr,
            flush=True,
        )

    out = {
        "type": "FeatureCollection",
        "name": "mumbai-wards",
        "_provenance": "DataMeet Municipal_Spatial_Data/Mumbai (ODbL); "
        "24 BMC administrative wards.",
        "features": sorted(out_feats, key=lambda x: x["properties"]["ward_no"] or 0),
    }
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False)
    print(f"Wrote {len(out_feats)} wards -> {OUT_PATH}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
