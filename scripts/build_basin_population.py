#!/usr/bin/env python3
"""Per-sub-basin population from WorldPop's zonal-statistics API.

Dataset: wpgppop (WorldPop global 100 m population count), year 2020 - the
latest the stats service offers; asOf is stated as 2020 in the metric.
The API accepts single Polygons only, so MultiPolygon sub-basins are
submitted part-by-part and summed (parts with a bbox smaller than ~1 sq km
are skipped; the omission is far below rounding error).

Post-ingest step (like the other build_* scripts): re-running the basin
ingest wipes scoreboard metrics - re-run this afterwards.

Usage: python3 scripts/build_basin_population.py cauvery-ka cauvery-tn
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "https://api.worldpop.org/v1/services/stats"
TASKS = "https://api.worldpop.org/v1/tasks/"


def bbox_km2(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return (max(xs) - min(xs)) * (max(ys) - min(ys)) * 110 * 110


def pop_for_polygon(coords):
    gj = json.dumps({"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": coords}}]})
    data = urllib.parse.urlencode({"dataset": "wpgppop", "year": "2020",
                                   "geojson": gj, "runasync": "false"}).encode()
    for attempt in range(4):
        try:
            req = urllib.request.Request(API, data=data)
            with urllib.request.urlopen(req, timeout=300) as r:
                d = json.load(r)
            tid = d["taskid"]
            for _ in range(30):
                with urllib.request.urlopen(TASKS + tid, timeout=60) as r:
                    res = json.load(r)
                if res.get("status") == "finished":
                    if res.get("error"):
                        raise RuntimeError(res.get("error_message"))
                    return float(res["data"]["total_population"])
                time.sleep(2)
            raise TimeoutError("task never finished")
        except Exception:
            if attempt == 3:
                raise
            time.sleep(10 * (attempt + 1))


def main(basin_ids):
    for basin_id in basin_ids:
        basin_dir = ROOT / "public" / "data" / "basins" / basin_id
        sub_basins = json.loads((basin_dir / "sub-basins.geojson").read_text())
        sb_path = basin_dir / "scoreboard.json"
        sb = json.loads(sb_path.read_text())

        for feat in sub_basins["features"]:
            props = feat["properties"]
            key = str(props.get("scoreboardKey") or props.get("code"))
            entry = sb["subBasins"].get(key)
            if entry is None:
                continue
            g = feat["geometry"]
            parts = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
            total = 0.0
            used = 0
            for part in parts:
                if bbox_km2(part[0]) < 1:
                    continue
                total += pop_for_polygon(part)
                used += 1
                time.sleep(1)
            if used == 0:
                continue
            entry["metrics"]["populationTotal"] = {
                "value": int(round(total, -3)),
                "unit": "people",
                "asOf": "2020",
                "source": "WorldPop global 100 m population (wpgppop 2020), zonal total via the WorldPop stats API over the sub-basin polygon",
                "verified": True,
            }
            print(f"  {basin_id}/{key} {entry.get('name','')}: {int(total):,} ({used} part(s))")

        sb["asOf"] = date.today().isoformat()
        sb_path.write_text(json.dumps(sb, ensure_ascii=False, indent=1))
        print(f"updated {sb_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1:] or ["cauvery-ka", "cauvery-tn"])
