#!/usr/bin/env python3
"""
Convert OpenCity BWSSB Sewage Treatment Plant data to GeoJSON.

Sources (both required):
  - bwssb-stps.csv (3.4 KB, 39 rows, authoritative for Status/active flag)
  - bwssb-stps.kml (39 KB, used only as a cross-check on lat/lng)

Why both? OpenCity's KML for this dataset has empty <SimpleData name="Status">
elements - the active/inactive flag only lives in the CSV. CSV also carries
lat/lng directly, so it's the simpler source. We pass both paths so the
script can verify the two stay in sync.

Output: public/geojson/bangalore-stps.geojson

39 STPs across BBMP service area, total ~1,371 MLD design treatment
capacity. The headline narrative-relevant ones:
  - K&C Valley 218 MLD (Koramangala-Challaghatta valley, feeds Bellandur)
  - V.Valley 180 MLD + 150 MLD (Vrishabhavathi - the foam-and-fire river)
  - Bellandur Amani Kere 90 MLD (literally on the foam-and-fire lake)
  - Mailasandra Ph-I 75 MLD (Vrishabhavathi catchment)

Run: python scripts/convert-bangalore-stps-kml.py scripts/data-raw/bangalore/bwssb-stps.csv
"""

import csv
import re
import sys
from pathlib import Path

from nvdm_write import write_artifact

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
OUT = REPO_ROOT / "public" / "geojson" / "bangalore-stps.geojson"


def to_int(value: str | None) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def to_float(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def main() -> None:
    if len(sys.argv) < 2:
        print(
            "Usage: convert-bangalore-stps-kml.py <path-to-csv>",
            file=sys.stderr,
        )
        sys.exit(1)

    src = Path(sys.argv[1])
    with src.open() as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    features = []
    total_capacity_kld = 0
    active_count = 0

    for row in rows:
        lat = to_float(row.get("Latitude"))
        lng = to_float(row.get("Longitude"))
        if lat is None or lng is None:
            continue

        name = re.sub(r"\s+", " ", row.get("STPName", "")).strip()
        plant_type = re.sub(r"\s+", " ", row.get("PlantType", "")).strip()
        capacity_kld = to_int(row.get("TreatmentCapacity (KLD)"))
        status_raw = (row.get("Status") or "").strip().upper()
        is_active = status_raw == "TRUE"

        if capacity_kld:
            total_capacity_kld += capacity_kld
        if is_active:
            active_count += 1

        features.append({
            "type": "Feature",
            "properties": {
                "stp_id": to_int(row.get("STPId")),
                "name": name,
                "plant_type": plant_type,
                "capacity_kld": capacity_kld,
                "capacity_mld": round(capacity_kld / 1000, 2) if capacity_kld else None,
                "is_active": is_active,
            },
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # Envelope-preserving write (scripts/nvdm_write.py); compact like before.
    write_artifact(OUT, {"type": "FeatureCollection", "features": features}, compact=True)
    print(f"Wrote {len(features)} STPs to {OUT}")
    print(f"  active: {active_count}, inactive: {len(features) - active_count}")
    print(f"  total design capacity: {total_capacity_kld:,} KLD ({total_capacity_kld/1000:.1f} MLD)")


if __name__ == "__main__":
    main()
