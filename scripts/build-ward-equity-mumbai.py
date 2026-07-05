#!/usr/bin/env python3
"""
Build public/data/ward-equity-mumbai.json - the UI-facing feed for the
ward-equity panel on /mumbai/my-ward.

Joins the Praja RTI ward tables (public/data/mumbai-ward-water-praja.json:
per-ward supply hours, zone duration buckets, metered/unmetered connections,
%-unfit samples 2020-24) with ward labels from the ward geometry
(public/geojson/mumbai-wards-2023.geojson), and carries the city aggregates
+ provenance through. Re-run whenever either input changes (Praja publishes
annually; the 2026 edition lands ~late July).

Run:  python3 scripts/build-ward-equity-mumbai.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

praja = json.loads((ROOT / "public/data/mumbai-ward-water-praja.json").read_text())
wards_geo = json.loads((ROOT / "public/geojson/mumbai-wards-2023.geojson").read_text())

labels = {
    f["properties"]["ward_code"]: {
        "label": f["properties"]["ward_label"],
        "name": f["properties"]["ward_name"],
    }
    for f in wards_geo["features"]
}

rows = []
for w in praja["wards"]:
    code = w["ward_code"]
    lab = labels.get(code, {"label": code, "name": ""})
    metered = w.get("connections_metered_2025_03") or 0
    nonmetered = w.get("connections_nonmetered_2025_03") or 0
    total_conn = metered + nonmetered
    zones = w.get("zones_by_duration") or {}
    zones_total = sum(v for k, v in zones.items() if k != "na")
    zones_le4 = zones.get("<=2h", 0) + zones.get(">2-4h", 0)
    rows.append(
        {
            "ward_code": code,
            "label": lab["label"],
            "name": lab["name"],
            "avg_supply_hours": w.get("avg_supply_hours_2024"),
            "zones": w.get("supply_zones"),
            "zones_4h_or_less_pct": round(zones_le4 / zones_total * 100) if zones_total else None,
            "zones_24h": zones.get("24h", 0),
            "unfit_pct_2024": (w.get("pct_unfit_samples") or {}).get("2024"),
            "unfit_series": w.get("pct_unfit_samples"),
            "connections": total_conn,
            "unmetered_pct": round(nonmetered / total_conn * 100, 1) if total_conn else None,
        }
    )

city = praja["city"]
out = {
    "place_id": "mumbai",
    "updated": "2026-07-05",
    "source": {
        "label": (praja.get("source") or {}).get("title")
        or "Praja Foundation, Status of Civic Issues in Mumbai (May 2025)",
        "url": (praja.get("source") or {}).get("url") or "https://www.praja.org/",
    },
    "_note": (
        "Derived from Praja Foundation's RTI ward tables (Status of Civic Issues in "
        "Mumbai, May 2025; data year 2024, connections as on March 2025) joined with "
        "the BMC administrative-ward labels. Connections are building-level, not "
        "households. Supply hours are per-ward averages across water-supply zones - "
        "pressure and reliability vary within a ward."
    ),
    "city": {
        "avg_supply_hours": city.get("avg_supply_hours_2024"),
        "zones_total": city.get("supply_zones"),
        "zones_4h_or_less_pct": city.get("zones_4h_or_less_pct"),
        "zones_24h": city.get("zones_24h"),
        "connections_total": city.get("connections_total_2025_03"),
        "connections_unmetered": city.get("connections_nonmetered"),
    },
    "wards": sorted(rows, key=lambda r: (r["avg_supply_hours"] is None, r["avg_supply_hours"])),
}

path = ROOT / "public/data/ward-equity-mumbai.json"
path.write_text(json.dumps(out, ensure_ascii=False, indent=2))
print(f"wrote {path.name}: {len(rows)} wards")
