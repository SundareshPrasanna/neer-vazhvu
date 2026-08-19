#!/usr/bin/env python3
"""Waterway geometry baseline: chained OSM centerline + transect widths.

Generalized 19 Aug 2026 from the Buckingham Canal pilot when the Cooum
became waterway 2; per-waterway parameters live in
scripts/waterways/<id>.json (geometry section). Pure python, no geo deps.
For buckingham-canal this reproduces the pilot's outputs byte-for-byte.

Usage: python3 scripts/build_waterway_geometry.py --waterway <id>

Inputs (fetched from Overpass, ODbL, snapshot in the research data dir):
  <research_dir>/data/<inputs[].file>

Outputs (<research_dir>/data/):
  centerline.geojson   - the clipped, chained centerline with chainage
  widths.csv           - water-surface width every transect_every_m of
                         chainage, measured as the OSM water-polygon
                         interval containing the centerline on a
                         perpendicular transect (even-odd rule)
  widths-summary.csv   - per-km stats (n, median, min, max, coverage)

Width semantics: WATER SURFACE width as mapped in OSM, not the revenue
(poramboke) width of the channel land. Transects that rail past the
half_transect_m cap read OPEN_WATER; transects with no OSM water polygon
yield null (NO_POLYGON) - to be filled from Sentinel-2 NDWI in the
satellite pass.

Chaining: ways are joined end-to-end starting from the endpoint farthest
from the chainage-zero end along the configured axis; gaps up to gap_m
are jumped when the far end of the candidate way progresses toward
chainage zero (river crossings, locks, unmapped junctions).
"""

import argparse
import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

R = 6371000.0


def local_xy(lat0):
    kx = math.radians(1) * R * math.cos(math.radians(lat0))
    ky = math.radians(1) * R
    return kx, ky


def dist_m(a, b):
    kx, ky = local_xy((a[1] + b[1]) / 2)
    return math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * ky)


# ---------------- centerline chaining ----------------
def chain_centerline(cfg, data):
    """Chain the configured OSM ways; jump gaps up to gap_m where the
    candidate way's far end progresses toward the chainage-zero end."""
    geo = cfg["geometry"]
    ch = geo["chain"]
    ax = 1 if ch["axis"] == "lat" else 0
    # zsign orients the axis so that "toward chainage zero" is "increasing":
    # zero at the max end (canal: Ennore, north) keeps the raw axis; zero at
    # the min end (a river chained from its mouth back to its head) flips it.
    zsign = 1.0 if ch["chainage_zero_at"] == "max" else -1.0
    gap_m = ch["gap_m"]
    tol = ch["progress_tol_deg"]

    segs = {}
    for inp in geo["inputs"]:
        d = json.loads((data / inp["file"]).read_text())
        keep_tags = inp["keep_tags"]
        for e in d["elements"]:
            if e["type"] != "way" or "geometry" not in e:
                continue
            tags = e.get("tags") or {}
            if keep_tags and any(tags.get(k) != v for k, v in keep_tags.items()):
                continue
            segs[e["id"]] = [(p["lon"], p["lat"]) for p in e["geometry"]]

    def key(pt):
        return (round(pt[0], 6), round(pt[1], 6))

    # start: the endpoint farthest from chainage zero along the axis
    all_ends = [(sid, endi, segs[sid][endi]) for sid in segs
                for endi in (0, -1)]
    start = min(all_ends, key=lambda t: zsign * t[2][ax])
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
            # gap-jump: nearest unused endpoint within gap_m whose far
            # end continues toward chainage zero
            best = None
            for cid in segs:
                if cid in used:
                    continue
                for ei in (0, -1):
                    d = dist_m(cur, segs[cid][ei])
                    far = segs[cid][-1 if ei == 0 else 0]
                    if d <= gap_m and zsign * far[ax] > zsign * cur[ax] - tol:
                        if best is None or d < best[2]:
                            best = (cid, ei, d)
            nxt = best
        if nxt is None:
            break
        sid, endi = nxt[0], nxt[1]
    return chain


def resample(cfg, chain):
    geo = cfg["geometry"]
    ch = geo["chain"]
    clip = geo["clip"]
    ax = 1 if ch["axis"] == "lat" else 0
    zsign = 1.0 if ch["chainage_zero_at"] == "max" else -1.0
    cax = 1 if clip["axis"] == "lat" else 0
    sample_m = geo["sample_m"]
    # walk from chainage zero outward: the chain starts at the far end, flip
    if zsign * chain[0][ax] < zsign * chain[-1][ax]:
        chain = chain[::-1]
    # clip by the axis window, keep the contiguous run
    run = [p for p in chain if clip["min"] <= p[cax] <= clip["max"]]
    out = [run[0]]
    acc = 0.0
    for a, b in zip(run, run[1:]):
        d = dist_m(a, b)
        while acc + d >= sample_m:
            t = (sample_m - acc) / d
            a = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
            d = dist_m(a, b)
            acc = 0.0
            out.append(a)
        acc += d
    return out


# ---------------- water polygons ----------------
def load_polygons(data):
    d = json.loads((data / "osm-water-polygons.json").read_text())
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


def transect_width(pt, direction, polys, half_transect_m, open_water_m):
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
                ax_, ay = a
                bx, by = b
                exx, exy = bx - ax_, by - ay
                denom = exx * py - exy * px
                if abs(denom) < 1e-12:
                    continue
                # standard 2x2 solve: t*p - s*e = a  =>
                # [px -exx][t]   [ax]
                # [py -exy][s] = [ay]
                det = px * (-exy) - py * (-exx)
                if abs(det) < 1e-12:
                    continue
                t = (ax_ * (-exy) - ay * (-exx)) / det
                s = (px * ay - py * ax_) / det
                if 0.0 <= s < 1.0 and abs(t) <= half_transect_m:
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
            if w >= open_water_m or hi >= half_transect_m - 1 or \
               lo <= -(half_transect_m - 1):
                flag = "OPEN_WATER"
            return w, flag, sorted(ids)
    return None, "CENTER_DRY", []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--waterway", required=True)
    args = ap.parse_args()
    cfg = json.loads(
        (ROOT / "scripts" / "waterways" / f"{args.waterway}.json").read_text())
    geo = cfg["geometry"]
    data = ROOT / cfg["research_dir"] / "data"
    sample_m = geo["sample_m"]
    transect_every_m = geo["transect_every_m"]
    half_transect_m = geo["half_transect_m"]
    open_water_m = geo["open_water_m"]

    chain = chain_centerline(cfg, data)
    pts = resample(cfg, chain)
    polys = load_polygons(data)
    print(f"centerline samples: {len(pts)} "
          f"({(len(pts) - 1) * sample_m / 1000:.1f} km), "
          f"polygons: {len(polys)}")

    # centerline geojson
    gj = {"type": "FeatureCollection", "features": [{
        "type": "Feature",
        "properties": {
            "name": geo["feature"]["name"],
            "source": geo["feature"]["source"],
            "chainage_zero": geo["feature"]["chainage_zero"],
            "length_km": round((len(pts) - 1) * sample_m / 1000, 1),
        },
        "geometry": {"type": "LineString",
                     "coordinates": [[round(x, 6), round(y, 6)]
                                     for x, y in pts]},
    }]}
    (data / "centerline.geojson").write_text(json.dumps(gj))

    rows = []
    step = int(transect_every_m // sample_m)
    for i in range(0, len(pts), step):
        pt = pts[i]
        j0, j1 = max(0, i - 1), min(len(pts) - 1, i + 1)
        kx, ky = local_xy(pt[1])
        dx = (pts[j1][0] - pts[j0][0]) * kx
        dy = (pts[j1][1] - pts[j0][1]) * ky
        n = math.hypot(dx, dy) or 1.0
        w, flag, srcs = transect_width(pt, (dx / n, dy / n), polys,
                                       half_transect_m, open_water_m)
        rows.append({
            "chainage_km": round(i * sample_m / 1000, 2),
            "lat": round(pt[1], 6), "lon": round(pt[0], 6),
            "width_m": round(w, 1) if w is not None else "",
            "flag": flag, "osm_water_ids": ";".join(srcs),
        })

    with open(data / "widths.csv", "w", newline="") as f:
        wtr = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        wtr.writeheader()
        wtr.writerows(rows)

    # per-km summary
    byk = {}
    for r in rows:
        byk.setdefault(int(r["chainage_km"]), []).append(r)
    with open(data / "widths-summary.csv", "w", newline="") as f:
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
        print(f"channel-water widths (OK only): median "
              f"{okw[len(okw)//2]:.0f} m, p10 {okw[len(okw)//10]:.0f} m, "
              f"p90 {okw[9*len(okw)//10]:.0f} m")


if __name__ == "__main__":
    main()
