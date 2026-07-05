#!/usr/bin/env python3
"""
Fetch BMC's official flooding-spot register from the Disaster Management
portal API and write the flood page's hotspot layer.

dm.mcgm.gov.in is an Angular SPA backed by a public JSON API; the flood-spot
register (the chronic/monitored subset of the city's pre-monsoon flooding-spot
list, each spot tied to an automatic weather station rain gauge) is:

    POST https://dmwebtwo.mcgm.gov.in/api/floodSpot/loadAll   (body: {})

Returns ~110 spots with official names, street locations, ward codes and
coordinates - which replaces our earlier hand-curated 20-spot layer (locality
centroids from press) with BMC's own register. The full pre-monsoon list
(496 spots in 2026) is NOT published with locations; this API subset is what
the city itself maps and monitors.

Categories written for the map:
  subway        - name contains "subway" (below-grade chronic spots)
  chronic_spot  - BMC type "Chronic Flooding Spot"
  flooding_spot - BMC type "Flooding Spot" (the newer/other monitored spots)

Run:  cd neer-vazhvu-api && python3 scripts/scrape_bmc_flood_spots.py
      [--json cached.json]  parse a pre-downloaded API response instead
      [--out path]          default ../public/data/mumbai-flood-hotspots.geojson
"""

import argparse
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

API_URL = "https://dmwebtwo.mcgm.gov.in/api/floodSpot/loadAll"
DEFAULT_OUT = (
    Path(__file__).resolve().parent.parent.parent
    / "public"
    / "data"
    / "mumbai-flood-hotspots.geojson"
)
# Greater Mumbai sanity bounds - drop records with junk coordinates.
BOUNDS = (18.85, 72.75, 19.35, 73.05)  # s, w, n, e


def fetch_api() -> list[dict]:
    req = urllib.request.Request(
        API_URL,
        data=b"{}",
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 neervazhvu-flood",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        payload = json.load(resp)
    if isinstance(payload, dict):
        payload = payload.get("data") or payload.get("result") or []
    if not isinstance(payload, list):
        raise RuntimeError("unexpected API payload shape")
    return payload


def categorise(name: str, bmc_type: str) -> tuple[str, str]:
    if re.search(r"\bsubway\b", name, re.I):
        return "subway", f"Flood-prone subway ({bmc_type}, BMC DM register)"
    if bmc_type == "Chronic Flooding Spot":
        return "chronic_spot", "Chronic flooding spot (BMC DM register)"
    return "flooding_spot", f"{bmc_type} (BMC DM register)"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", help="parse a pre-downloaded API response file")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    if args.json:
        with open(args.json, encoding="utf-8") as fh:
            spots = json.load(fh)
        if isinstance(spots, dict):
            spots = spots.get("data") or spots.get("result") or []
    else:
        spots = fetch_api()

    s, w, n, e = BOUNDS
    features = []
    dropped = 0
    counts: dict[str, int] = {}
    for sp in spots:
        name = (sp.get("floodingSpotName") or "").strip()
        try:
            lat = float(sp.get("lat"))
            lng = float(sp.get("longC"))
        except (TypeError, ValueError):
            dropped += 1
            continue
        if not (s <= lat <= n and w <= lng <= e) or not name:
            dropped += 1
            continue
        bmc_type = (sp.get("floodingSpotType") or "").strip()
        category, label = categorise(name, bmc_type)
        counts[category] = counts.get(category, 0) + 1
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(lng, 6), round(lat, 6)],
                },
                "properties": {
                    "name": name,
                    "category": category,
                    "category_label": label,
                    "bmc_type": bmc_type,
                    "location": (sp.get("floodingSpotLocation") or "").strip(),
                    "ward": (sp.get("wardName") or "").strip(),
                    "feature_id": sp.get("featureId") or "",
                    "aws_station_id": sp.get("floodingSpotAWSId") or "",
                },
            }
        )

    if len(features) < 50:
        print(
            f"ERROR: only {len(features)} spots parsed (dropped {dropped}) - "
            "refusing to overwrite the layer with a partial register",
            file=sys.stderr,
        )
        return 1

    out = {
        "type": "FeatureCollection",
        "name": "mumbai-flood-hotspots",
        "_provenance": (
            "BMC Disaster Management flood-spot register "
            f"(dmwebtwo.mcgm.gov.in floodSpot/loadAll, fetched {date.today().isoformat()}): "
            "the officially mapped chronic/monitored subset of the city's "
            "pre-monsoon flooding-spot list, with BMC's own names, wards and "
            "coordinates; each spot is tied to an automatic weather station. "
            "The FULL pre-monsoon list (496 spots in 2026) is not published "
            "with locations."
        ),
        "features": features,
    }
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    print(
        f"Wrote {len(features)} official spots -> {args.out} "
        f"({counts}, dropped {dropped})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
