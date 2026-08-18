#!/usr/bin/env python3
"""Buckingham Canal (Ennore -> Mahabalipuram) geometry baseline.

Inputs (fetched from Overpass, ODbL, snapshot in data/):
  docs/research/buckingham-canal/data/osm-canal-centerline.json
  docs/research/buckingham-canal/data/osm-water-polygons.json

Outputs (docs/research/buckingham-canal/data/):
  centerline.geojson   - the clipped, chained centerline with chainage
  widths.csv           - water-surface width every 200 m of chainage,
                         measured as the OSM water-polygon interval
                         containing the centerline on a perpendicular
                         transect (even-odd rule, pure python)
  widths-summary.csv   - per-km stats (n, median, min, max, coverage)

Width semantics: WATER SURFACE width as mapped in OSM, not the revenue
(poramboke) width of the canal land. Reaches where the canal opens into
a backwater (Muttukadu) rail past the 500 m transect cap and are
flagged OPEN_WATER. Reaches with no OSM water polygon yield null
(NO_POLYGON) - to be filled from Sentinel-2 NDWI in the satellite pass.

Clip window: lat 12.615 (Mahabalipuram) .. 13.245 (Ennore creek
junction). Chainage 0 at the Ennore end, increasing south.
"""

import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "research" / "buckingham-canal" / "data"
LAT_N, LAT_S = 13.245, 12.615
SAMPLE_M = 100.0        # centerline resample step
TRANSECT_EVERY_M = 200.0
HALF_TRANSECT_M = 500.0  # per side; > this reads as open water
OPEN_WATER_M = 400.0

R = 6371000.0


def local_xy(lat0):
    kx = math.radians(1) * R * math.cos(math.radians(lat0))
    ky = math.radians(1) * R
    return kx, ky


def dist_m(a, b):
    kx, ky = local_xy((a[1] + b[1]) / 2)
    return math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * ky)


def load(path):
    return json.loads((DATA / path).read_text())


# ---------------- centerline chaining ----------------
def chain_centerline():
    """Chain named Buckingham ways plus unnamed canal connectors from the
    north-Chennai fetch; jump gaps up to GAP_M (river crossings, locks)."""
    GAP_M = 1600.0  # bridges the Basin Bridge / Cooum junction (~1.4 km),
    # where the canal historically exchanges with the river and OSM has
    # no continuous canal way; chainage through the jump is approximate.
    segs = {}
    for fname, keep in [
        ("osm-canal-centerline.json",
         lambda t: True),  # all named Buckingham ways
        ("osm-north-waterways.json",
         lambda t: t.get("waterway") == "canal"),  # connectors + lock
    ]:
        d = load(fname)
        for e in d["elements"]:
            if e["type"] != "way" or "geometry" not in e:
                continue
            if not keep(e.get("tags") or {}):
                continue
            segs[e["id"]] = [(p["lon"], p["lat"]) for p in e["geometry"]]

    def key(pt):
        return (round(pt[0], 6), round(pt[1], 6))

    # start: southernmost endpoint among named ways
    all_ends = [(sid, endi, segs[sid][endi]) for sid in segs
                for endi in (0, -1)]
    start = min(all_ends, key=lambda t: t[2][1])
    chain = []
    used = set()
    sid, endi = start[0], start[1]
    while True:
        used.add(sid)
        pts = segs[sid]
        if endi == -1:
            pts = pts[::-1]
        if chain and key(pts[0]) == key(chain[-1]):
            pts = pts[1:]
        chain.extend(pts)
        cur = chain[-1]
        # exact continuation first
        nxt = None
        for cid in segs:
            if cid in used:
                continue
            for ei in (0, -1):
                if key(segs[cid][ei]) == key(cur):
                    nxt = (cid, ei, 0.0)
                    break
            if nxt:
                break
        if nxt is None:
            # gap-jump: nearest unused endpoint within GAP_M whose far
            # end continues north
            best = None
            for cid in segs:
                if cid in used:
                    continue
                for ei in (0, -1):
                    d = dist_m(cur, segs[cid][ei])
                    far = segs[cid][-1 if ei == 0 else 0]
                    if d <= GAP_M and far[1] > cur[1] - 0.001:
                        if best is None or d < best[2]:
                            best = (cid, ei, d)
            nxt = best
        if nxt is None:
            break
        sid, endi = nxt[0], nxt[1]
    return chain


def resample(chain):
    # walk north->south: chain starts at the southernmost end, so flip
    if chain[0][1] < chain[-1][1]:
        chain = chain[::-1]
    # clip by latitude window, keep the contiguous run
    run = [p for p in chain if LAT_S <= p[1] <= LAT_N]
    out = [run[0]]
    acc = 0.0
    for a, b in zip(run, run[1:]):
        d = dist_m(a, b)
        while acc + d >= SAMPLE_M:
            t = (SAMPLE_M - acc) / d
            a = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
            d = dist_m(a, b)
            acc = 0.0
            out.append(a)
        acc += d
    return out


# ---------------- water polygons ----------------
def load_polygons():
    d = load("osm-water-polygons.json")
    polys = []  # each: list of rings; ring = [(x,y)...]
    for e in d["elements"]:
        tags = e.get("tags") or {}
        if e["type"] == "way" and "geometry" in e:
            ring = [(p["lon"], p["lat"]) for p in e["geometry"]]
            if len(ring) >= 4 and ring[0] == ring[-1]:
                polys.append({"id": f"way/{e['id']}",
                              "water": tags.get("water", ""),
                              "rings": [ring]})
        elif e["type"] == "relation":
            rings = []
            for m in e.get("members", []):
                if m.get("type") == "way" and "geometry" in m:
                    rings.append([(p["lon"], p["lat"]) for p in m["geometry"]])
            if rings:
                polys.append({"id": f"relation/{e['id']}",
                              "water": tags.get("water", ""),
                              "rings": rings})
    return polys


def transect_width(pt, direction, polys):
    """Width of the union-of-polygons interval containing t=0 along the
    perpendicular transect at pt. Returns (width_m, flag, srcs)."""
    lon0, lat0 = pt
    kx, ky = local_xy(lat0)
    dx, dy = direction  # unit vector in metres space along centerline
    # perpendicular unit vector
    px, py = -dy, dx

    def to_m(p):
        return ((p[0] - lon0) * kx, (p[1] - lat0) * ky)

    intervals = []
    for poly in polys:
        ts = []
        for ring in poly["rings"]:
            mpts = [to_m(p) for p in ring]
            for a, b in zip(mpts, mpts[1:]):
                # solve a + s*(b-a) = t*(px,py), s in [0,1]
                ax, ay = a
                bx, by = b
                exx, exy = bx - ax, by - ay
                denom = exx * py - exy * px
                if abs(denom) < 1e-12:
                    continue
                s = (ax * py - ay * px) / -denom if False else None
                # standard 2x2 solve: t*p - s*e = a  =>
                # [px -exx][t]   [ax]
                # [py -exy][s] = [ay]
                det = px * (-exy) - py * (-exx)
                if abs(det) < 1e-12:
                    continue
                t = (ax * (-exy) - ay * (-exx)) / det
                s = (px * ay - py * ax) / det
                if 0.0 <= s < 1.0 and abs(t) <= HALF_TRANSECT_M:
                    ts.append(t)
        ts.sort()
        # even-odd: consecutive pairs are inside intervals
        for i in range(0, len(ts) - 1, 2):
            intervals.append((ts[i], ts[i + 1], poly))

    if not intervals:
        return None, "NO_POLYGON", []
    # union of intervals, find the one containing 0
    intervals.sort()
    merged = []
    for lo, hi, poly in intervals:
        if merged and lo <= merged[-1][1] + 0.5:
            merged[-1][1] = max(merged[-1][1], hi)
            merged[-1][2].add(poly["id"])
        else:
            merged.append([lo, hi, {poly["id"]}])
    for lo, hi, ids in merged:
        if lo <= 0.0 <= hi:
            w = hi - lo
            flag = "OK"
            if w >= OPEN_WATER_M or hi >= HALF_TRANSECT_M - 1 or \
               lo <= -(HALF_TRANSECT_M - 1):
                flag = "OPEN_WATER"
            return w, flag, sorted(ids)
    return None, "CENTER_DRY", []


def main():
    chain = chain_centerline()
    pts = resample(chain)
    polys = load_polygons()
    print(f"centerline samples: {len(pts)} "
          f"({(len(pts) - 1) * SAMPLE_M / 1000:.1f} km), "
          f"polygons: {len(polys)}")

    # centerline geojson
    gj = {"type": "FeatureCollection", "features": [{
        "type": "Feature",
        "properties": {
            "name": "Buckingham Canal (Ennore - Mahabalipuram)",
            "source": "OpenStreetMap via Overpass, ODbL, snapshot 2026-08",
            "chainage_zero": "Ennore creek junction end (lat 13.245)",
            "length_km": round((len(pts) - 1) * SAMPLE_M / 1000, 1),
        },
        "geometry": {"type": "LineString",
                     "coordinates": [[round(x, 6), round(y, 6)]
                                     for x, y in pts]},
    }]}
    (DATA / "centerline.geojson").write_text(json.dumps(gj))

    rows = []
    step = int(TRANSECT_EVERY_M // SAMPLE_M)
    for i in range(0, len(pts), step):
        pt = pts[i]
        j0, j1 = max(0, i - 1), min(len(pts) - 1, i + 1)
        kx, ky = local_xy(pt[1])
        dx = (pts[j1][0] - pts[j0][0]) * kx
        dy = (pts[j1][1] - pts[j0][1]) * ky
        n = math.hypot(dx, dy) or 1.0
        w, flag, srcs = transect_width(pt, (dx / n, dy / n), polys)
        rows.append({
            "chainage_km": round(i * SAMPLE_M / 1000, 2),
            "lat": round(pt[1], 6), "lon": round(pt[0], 6),
            "width_m": round(w, 1) if w is not None else "",
            "flag": flag, "osm_water_ids": ";".join(srcs),
        })

    with open(DATA / "widths.csv", "w", newline="") as f:
        wtr = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        wtr.writeheader()
        wtr.writerows(rows)

    # per-km summary
    byk = {}
    for r in rows:
        byk.setdefault(int(r["chainage_km"]), []).append(r)
    with open(DATA / "widths-summary.csv", "w", newline="") as f:
        wtr = csv.writer(f)
        wtr.writerow(["km", "n_transects", "n_measured", "median_m",
                      "min_m", "max_m", "flags"])
        for k in sorted(byk):
            rs = byk[k]
            ws = sorted(float(r["width_m"]) for r in rs if r["width_m"] != "")
            med = ws[len(ws) // 2] if ws else ""
            flags = ",".join(sorted({r["flag"] for r in rs}))
            wtr.writerow([k, len(rs), len(ws), med,
                          ws[0] if ws else "", ws[-1] if ws else "", flags])

    ok = sum(1 for r in rows if r["flag"] == "OK")
    nop = sum(1 for r in rows if r["flag"] == "NO_POLYGON")
    opn = sum(1 for r in rows if r["flag"] == "OPEN_WATER")
    print(f"transects: {len(rows)}  OK: {ok}  OPEN_WATER: {opn}  "
          f"NO_POLYGON: {nop}")
    okw = sorted(float(r['width_m']) for r in rows if r['flag'] == 'OK')
    if okw:
        print(f"canal-water widths (OK only): median "
              f"{okw[len(okw)//2]:.0f} m, p10 {okw[len(okw)//10]:.0f} m, "
              f"p90 {okw[9*len(okw)//10]:.0f} m")


if __name__ == "__main__":
    main()
