#!/usr/bin/env python3
"""
Emit public/data/mumbai-ward-profiles.json - administrative-only ward
profiles for Mumbai's 24 BMC wards, in the same list schema as
bangalore-ward-profiles.json's admin-only variant.

Deliberately WITHOUT the analytical sections (water_bodies, flood,
drainage, sewerage, industrial): the my-ward page branches on
`profile.water_bodies == null` and renders its honest "ward-level
analytical layers are not yet compiled" message with links to the
city-level views. This makes the ward selector, ward header and report
card work (fed by /api/wards) while the full per-ward analytical join
remains a follow-up.

Derived from ward-risk-mumbai.json (risk_v2_mum output: names, codes,
zones, areas, centroids - note its centroid_latlng is [lat, lng]; the
profiles schema wants [lng, lat]).

Run:  python3 scripts/compute-mumbai-ward-profiles.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

risk = json.loads((ROOT / "public/data/ward-risk-mumbai.json").read_text())

profiles = []
for w in risk["wards"]:
    lat, lng = w["centroid_latlng"]
    profiles.append(
        {
            "ward_number": w["ward_number"],
            "ward_name": w["ward_name"],
            "ward_code": w["ward_code"],
            "corporation": "Greater Mumbai (BMC)",
            "zone": w.get("zone"),
            "zone_name": f"Ward {w['ward_code']} - {w['ward_name']}",
            "centroid": [lng, lat],
            "area_sq_km": w.get("area_sq_km"),
        }
    )

profiles.sort(key=lambda p: p["ward_number"])
path = ROOT / "public/data/mumbai-ward-profiles.json"
path.write_text(json.dumps(profiles, ensure_ascii=False, indent=1))
print(f"wrote {path.name}: {len(profiles)} admin-only ward profiles")
