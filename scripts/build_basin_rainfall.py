#!/usr/bin/env python3
"""Per-sub-basin seasonal rainfall deviation, computed from first principles.

Why not the source portals' own numbers: KWRIS's devper failed empirical
verification (claimed -96% while Bengaluru's own Jun-Jul total ran ~-35%),
so the atlas withholds portal-derived deviation. This script computes the
deviation itself: for sample points inside each sub-basin polygon, fetch
daily precipitation from the Open-Meteo archive (ERA5-Land reanalysis -
the same provider the site's daily provisional-rainfall job already uses),
total the monsoon-to-date window (Jun 1 - cutoff), and compare with the
mean of the SAME window over 1991-2020 from the SAME source. Actual and
normal share one dataset, so the deviation is verified by construction.

Writes rainfallDeviationPct (verified: true) into each basin's
scoreboard.json. Post-ingest step: re-running ingest_basin_overview.py
wipes it - re-run this (and the other build_* post-steps) afterwards.

Usage: python3 scripts/build_basin_rainfall.py cauvery-ka cauvery-tn
"""
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Normals are cached locally (gitignored docs/research) so refresh runs only
# fetch the current season - the 30-year pull happens once per sample point.
CACHE = ROOT / "docs" / "research" / "rainfall-normals-cache.json"
NORMAL_YEARS = (1991, 2020)
SEASON_START_MD = (6, 1)  # Jun 1
ERA5_LAG_DAYS = 7  # archive completeness lag; cutoff = today - lag
API = "https://archive-api.open-meteo.com/v1/archive"


def point_in_geom(lon, lat, geom):
    def in_ring(ring):
        inside = False
        n = len(ring)
        for i in range(n):
            x1, y1 = ring[i][0], ring[i][1]
            x2, y2 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
            if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
                inside = not inside
        return inside

    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return any(in_ring(p[0]) and not any(in_ring(h) for h in p[1:]) for p in polys)


def geom_bbox(geom):
    xs, ys = [], []

    def scan(c):
        if isinstance(c[0], (int, float)):
            xs.append(c[0])
            ys.append(c[1])
        else:
            for cc in c:
                scan(cc)

    scan(geom["coordinates"])
    return min(xs), min(ys), max(xs), max(ys)


def sample_points(geom):
    """Up to 5 in-polygon sample points on a regular grid (>=1 guaranteed).
    Point budget scales with bbox area (ERA5-Land cells are ~9 km)."""
    minx, miny, maxx, maxy = geom_bbox(geom)
    approx_km2 = (maxx - minx) * (maxy - miny) * 110 * 110
    # ERA5-Land cells are ~9 km; keep the request weight low (Open-Meteo
    # rate-limits by data volume - 35-year daily pulls are heavy)
    want = 1 if approx_km2 < 1500 else 2 if approx_km2 < 6000 else 3
    pts = []
    n = 7  # grid density; filtered by PIP
    for i in range(n):
        for j in range(n):
            lon = minx + (i + 0.5) * (maxx - minx) / n
            lat = miny + (j + 0.5) * (maxy - miny) / n
            if point_in_geom(lon, lat, geom):
                pts.append((round(lon, 3), round(lat, 3)))
    if not pts:  # sliver polygons: fall back to bbox centre
        pts = [(round((minx + maxx) / 2, 3), round((miny + maxy) / 2, 3))]
    step = max(1, len(pts) // want)
    return pts[::step][:want]


def fetch_daily(lon, lat, start, end):
    q = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon,
        "start_date": start.isoformat(), "end_date": end.isoformat(),
        "daily": "precipitation_sum", "timezone": "UTC",
    })
    for attempt in range(4):
        try:
            with urllib.request.urlopen(f"{API}?{q}", timeout=120) as r:
                d = json.load(r)
            return d["daily"]["time"], d["daily"]["precipitation_sum"]
        except Exception as e:
            if attempt == 3:
                raise
            # 429s need a long cool-off (quota is hourly-windowed)
            wait = 90 * (attempt + 1) if "429" in str(e) else 8 * (attempt + 1)
            time.sleep(wait)


def season_totals(times, vals, cutoff_md):
    """Per-year total for Jun 1 .. (cutoff month, day)."""
    out = {}
    for t, v in zip(times, vals):
        if v is None:
            continue
        y, m, dd = int(t[:4]), int(t[5:7]), int(t[8:10])
        if (m, dd) >= SEASON_START_MD and (m, dd) <= cutoff_md:
            out[y] = out.get(y, 0.0) + v
    return out


def main(basin_ids):
    today = date.today()
    cutoff = today - timedelta(days=ERA5_LAG_DAYS)
    cutoff_md = (cutoff.month, cutoff.day)
    if cutoff_md < SEASON_START_MD:
        sys.exit(f"cutoff {cutoff} precedes Jun 1 - season has not started; refusing to write")
    start = date(NORMAL_YEARS[0], 6, 1)

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
                print(f"  WARN {basin_id}: no scoreboard entry for {key}, skipped")
                continue
            # resume support: a crash mid-basin keeps what was written
            existing = entry["metrics"].get("rainfallDeviationPct")
            if existing and existing.get("asOf") == today.isoformat():
                print(f"  {basin_id}/{key}: already computed today, skipped")
                continue
            pts = sample_points(feat["geometry"])
            actuals, normals = [], []
            cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
            for lon, lat in pts:
                ck = f"{lon},{lat}"
                if ck not in cache:
                    # one-time 30-year pull, Jun-Aug only (weight ~4x lighter
                    # than a full-year pull); cached for every later run
                    ntimes, nvals = fetch_daily(lon, lat, start, date(NORMAL_YEARS[1], 8, 31))
                    cache[ck] = [[t, v] for t, v in zip(ntimes, nvals)
                                 if v is not None and 6 <= int(t[5:7]) <= 8]
                    CACHE.parent.mkdir(parents=True, exist_ok=True)
                    CACHE.write_text(json.dumps(cache))
                    time.sleep(3)
                ntotals = season_totals([t for t, _ in cache[ck]], [v for _, v in cache[ck]], cutoff_md)
                normal_vals = [ntotals[y] for y in range(NORMAL_YEARS[0], NORMAL_YEARS[1] + 1) if y in ntotals]
                times, vals = fetch_daily(lon, lat, date(today.year, 6, 1), cutoff)
                totals = season_totals(times, vals, cutoff_md)
                if today.year in totals and len(normal_vals) >= 25:
                    actuals.append(totals[today.year])
                    normals.append(sum(normal_vals) / len(normal_vals))
                time.sleep(3)
            if not actuals:
                print(f"  WARN {basin_id}/{key}: no usable samples, metric withheld")
                continue
            actual = sum(actuals) / len(actuals)
            normal = sum(normals) / len(normals)
            dev = round((actual - normal) / normal * 100) if normal > 0 else None
            if dev is None:
                continue
            entry["metrics"]["rainfallDeviationPct"] = {
                "value": dev,
                "unit": f"% vs 1991-2020 mean, Jun 1 - {cutoff.isoformat()}",
                "asOf": today.isoformat(),
                "source": (
                    f"Computed from Open-Meteo archive (ERA5-Land reanalysis): season total "
                    f"{round(actual)} mm vs {round(normal)} mm normal for the same window, "
                    f"mean of {len(actuals)} sample point(s) in the sub-basin"
                ),
                "verified": True,
            }
            print(f"  {basin_id}/{key} {entry.get('name','')}: {round(actual)} vs {round(normal)} mm -> {dev:+d}% ({len(pts)} pts)", flush=True)
            # incremental write: rate-limit crashes must not lose progress
            sb["asOf"] = today.isoformat()
            sb_path.write_text(json.dumps(sb, ensure_ascii=False, indent=1))

        sb["asOf"] = today.isoformat()
        sb_path.write_text(json.dumps(sb, ensure_ascii=False, indent=1))
        print(f"updated {sb_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1:] or ["cauvery-ka", "cauvery-tn"])
