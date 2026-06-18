"""
Chennai coastal shoreline-change reproduction (MNDWI on Landsat/Sentinel-2 via GEE).

Independent corroboration of the shoreline-change half of:

    Anagha, Singh & Frappart (2026), "Shoreline and salinity shifts along the
    Chennai coast", Environmental Challenges. DOI 10.1016/j.envc.2026.101514.

The study used CoastSat (sub-pixel) + ArcGIS DSAS. We reproduce the measurement
with a transparent, dependency-light pipeline: a per-epoch MNDWI water index from
Google Earth Engine composites, sampled along shore-normal transects, with a
DSAS-equivalent Weighted Linear Regression over the eight study epochs.

Validated run (2026-06): the spatial pattern and signs match the paper - Zone V
(Ennore-Kattupalli) most volatile (transect minima ~-19 m/yr vs the paper's
-21.3 down-drift; port-adjacent maxima ~+21 m/yr), Zones II-III accretion-
dominant (~+7 m/yr vs the paper's +7.78), Zone I the stable turtle sector. The
absolute zone means run lower than the paper because we use a fixed MNDWI=0
threshold with no tidal correction at 20 m sampling, and the paper's per-zone
figure is the mean of eroding transects only, not the net mean. Treat the output
as independent corroboration, not a replica.

Output: public/geojson/chennai-coastal-transects.geojson (source="computed").

Stages:
  1. sample_transect_offsets() - GEE-dependent. Needs earthengine-api auth
     (app/gee/client.py); no extra pip deps beyond the core install.
  2. compute_rates() / transects_to_geojson() - pure NumPy/Python, unit-testable.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
ZONES_GEOJSON = REPO_ROOT / "public" / "geojson" / "chennai-coastal-zones.geojson"
TRANSECTS_GEOJSON = REPO_ROOT / "public" / "geojson" / "chennai-coastal-transects.geojson"

# Study epochs (Table 1 of the paper). Landsat for 1990-2015, Sentinel-2 for
# 2020 & 2024.
EPOCHS: tuple[int, ...] = (1990, 1995, 2000, 2005, 2010, 2015, 2020, 2024)

# Per-epoch total shoreline-position error Esp (m), Table 2 of the paper, used
# as the WLR weights (weight = 1 / Esp**2).
EPOCH_UNCERTAINTY_M: dict[int, float] = {
    1990: 16.33, 1995: 17.21, 2000: 15.78, 2005: 16.04,
    2010: 15.67, 2015: 15.14, 2020: 8.66, 2024: 8.66,
}

# Sensor / band / window per epoch. Reflectance = DN * scale + offset; MNDWI is
# scale-sensitive (the +offset doesn't cancel in the ratio), so it is applied.
# A dry-season Dec-May window + median composite suppresses cloud and tide noise.
EPOCH_CONFIG: tuple[dict, ...] = (
    {"year": 1990, "coll": "LANDSAT/LT05/C02/T1_L2", "d0": "1989-12-01", "d1": "1990-05-31", "green": "SR_B2", "swir1": "SR_B5", "scale": 2.75e-5, "offset": -0.2, "kind": "ls"},
    {"year": 1995, "coll": "LANDSAT/LT05/C02/T1_L2", "d0": "1994-12-01", "d1": "1995-05-31", "green": "SR_B2", "swir1": "SR_B5", "scale": 2.75e-5, "offset": -0.2, "kind": "ls"},
    {"year": 2000, "coll": "LANDSAT/LE07/C02/T1_L2", "d0": "1999-12-01", "d1": "2000-05-31", "green": "SR_B2", "swir1": "SR_B5", "scale": 2.75e-5, "offset": -0.2, "kind": "ls"},
    {"year": 2005, "coll": "LANDSAT/LE07/C02/T1_L2", "d0": "2004-12-01", "d1": "2005-05-31", "green": "SR_B2", "swir1": "SR_B5", "scale": 2.75e-5, "offset": -0.2, "kind": "ls"},
    {"year": 2010, "coll": "LANDSAT/LE07/C02/T1_L2", "d0": "2009-12-01", "d1": "2010-05-31", "green": "SR_B2", "swir1": "SR_B5", "scale": 2.75e-5, "offset": -0.2, "kind": "ls"},
    # Landsat 8 for 2015 (no SLC-off gaps); the paper used Landsat 7.
    {"year": 2015, "coll": "LANDSAT/LC08/C02/T1_L2", "d0": "2014-12-01", "d1": "2015-05-31", "green": "SR_B3", "swir1": "SR_B6", "scale": 2.75e-5, "offset": -0.2, "kind": "ls"},
    {"year": 2020, "coll": "COPERNICUS/S2_SR_HARMONIZED", "d0": "2019-12-01", "d1": "2020-05-31", "green": "B3", "swir1": "B11", "scale": 1e-4, "offset": 0.0, "kind": "s2"},
    {"year": 2024, "coll": "COPERNICUS/S2_SR_HARMONIZED", "d0": "2023-12-01", "d1": "2024-05-31", "green": "B3", "swir1": "B11", "scale": 1e-4, "offset": 0.0, "kind": "s2"},
)

TRANSECT_SPACING_M = 100.0
# Sample the water index along each transect normal, landward to seaward (m).
SAMPLE_S_VALUES: tuple[int, ...] = tuple(range(-260, 401, 20))
WATER_THRESHOLD = 0.0  # MNDWI > 0 => water
EARTH_RADIUS_M = 6_371_000.0
ZONE_IDS = ("I", "II", "III", "IV", "V", "VI")
ZONE_LENGTHS_KM = (14.0, 10.3, 9.4, 12.2, 24.6, 15.6)  # study along-shore lengths


@dataclass
class TransectRate:
    transect_id: int
    zone_id: str
    lon: float
    lat: float
    epr_m_yr: float | None
    wlr_m_yr: float | None
    r_squared: float | None
    n_epochs: int
    trend: str


# --------------------------------------------------------------------------
# Geometry helpers (pure)
# --------------------------------------------------------------------------

def _haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def baseline_from_zones(path: Path = ZONES_GEOJSON) -> list[tuple[float, float]]:
    """Concatenate the six seed zone segments (south->north) into one baseline."""
    fc = json.loads(path.read_text(encoding="utf-8"))
    order = {z: i for i, z in enumerate(ZONE_IDS)}
    feats = sorted(fc["features"], key=lambda f: order[f["properties"]["zone_id"]])
    baseline: list[tuple[float, float]] = []
    for f in feats:
        for lon, lat in f["geometry"]["coordinates"]:
            pt = (lon, lat)
            if not baseline or baseline[-1] != pt:
                baseline.append(pt)
    return baseline


def build_transects(
    baseline: list[tuple[float, float]],
    *,
    spacing_m: float = TRANSECT_SPACING_M,
) -> list[tuple[int, tuple[float, float], tuple[float, float]]]:
    """Cast shore-normal transects every `spacing_m` along the baseline.

    Returns (transect_id, origin_lonlat, seaward_normal) where the normal is in
    degrees-per-metre so offsets along it come out in metres.
    """
    transects: list[tuple[int, tuple[float, float], tuple[float, float]]] = []
    dist_acc = 0.0
    next_at = 0.0
    tid = 0
    for i in range(len(baseline) - 1):
        a, b = baseline[i], baseline[i + 1]
        seg_len = _haversine_m(a, b)
        if seg_len == 0:
            continue
        while next_at <= dist_acc + seg_len:
            t = (next_at - dist_acc) / seg_len
            origin = (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
            mlat = math.cos(math.radians(origin[1])) or 1.0
            tx = (b[0] - a[0]) * mlat
            ty = (b[1] - a[1])
            norm = math.hypot(tx, ty) or 1.0
            deg_per_m_lat = 1.0 / 111_320.0
            deg_per_m_lon = deg_per_m_lat / mlat
            # seaward normal = tangent rotated -90deg -> (ty, -tx)
            normal = (ty / norm * deg_per_m_lon, -tx / norm * deg_per_m_lat)
            transects.append((tid, origin, normal))
            tid += 1
            next_at += spacing_m
        dist_acc += seg_len
    return transects


def zones_by_position(n: int) -> list[str]:
    """Assign each transect a zone by along-shore position, using the study's
    published per-zone lengths (the same split the seed uses)."""
    total = sum(ZONE_LENGTHS_KM)
    bounds, acc = [], 0.0
    for length in ZONE_LENGTHS_KM:
        acc += length / total * n
        bounds.append(acc)
    out, zi = [], 0
    for k in range(n):
        while zi < len(ZONE_IDS) - 1 and k > bounds[zi]:
            zi += 1
        out.append(ZONE_IDS[zi])
    return out


# --------------------------------------------------------------------------
# Stage 1: per-epoch MNDWI waterline offsets (GEE-dependent)
# --------------------------------------------------------------------------

def sample_transect_offsets(
    transects: list[tuple[int, tuple[float, float], tuple[float, float]]],
    *,
    batch_size: int = 4000,
    log=print,
) -> dict[int, dict[int, float]]:
    """For each transect, the seaward waterline offset (m) per epoch.

    Builds an 8-band MNDWI image (one band per epoch) and samples it along the
    transect normals via GEE, then finds the land->water crossing per transect.
    Requires Earth Engine auth (no extra pip deps).
    """
    import ee

    from app.gee.client import initialize_earth_engine

    initialize_earth_engine()

    features = []
    for tid, origin, normal in transects:
        for s in SAMPLE_S_VALUES:
            pt = ee.Geometry.Point([origin[0] + normal[0] * s, origin[1] + normal[1] * s])
            features.append(ee.Feature(pt, {"tid": tid, "s": s}))
    fc = ee.FeatureCollection(features)
    geom = fc.geometry()

    def ls_mask(img):
        qa = img.select("QA_PIXEL")
        keep = (
            qa.bitwiseAnd(1 << 1).eq(0)
            .And(qa.bitwiseAnd(1 << 2).eq(0))
            .And(qa.bitwiseAnd(1 << 3).eq(0))
            .And(qa.bitwiseAnd(1 << 4).eq(0))
        )
        return img.updateMask(keep)

    def s2_mask(img):
        scl = img.select("SCL")
        keep = ee.Image(1)
        for v in (1, 3, 8, 9, 10):
            keep = keep.And(scl.neq(v))
        return img.updateMask(keep)

    def mndwi(img, cfg):
        g = img.select(cfg["green"]).multiply(cfg["scale"]).add(cfg["offset"])
        s = img.select(cfg["swir1"]).multiply(cfg["scale"]).add(cfg["offset"])
        return g.subtract(s).divide(g.add(s))

    bands = []
    for cfg in EPOCH_CONFIG:
        col = ee.ImageCollection(cfg["coll"]).filterBounds(geom).filterDate(cfg["d0"], cfg["d1"])
        if cfg["kind"] == "ls":
            col = col.map(ls_mask)
        else:
            col = col.filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 40)).map(s2_mask)
        bands.append(mndwi(col.median(), cfg).rename(f"m{cfg['year']}"))
    multi = ee.Image.cat(bands)

    raw: dict[tuple[int, int], dict[int, float]] = {}
    n = len(features)
    plist = fc.toList(n)
    for i in range(0, n, batch_size):
        sub = ee.FeatureCollection(plist.slice(i, min(i + batch_size, n)))
        sampled = multi.sampleRegions(collection=sub, scale=20, geometries=False).getInfo()
        for f in sampled["features"]:
            p = f["properties"]
            raw[(p["tid"], p["s"])] = {cfg["year"]: p.get(f"m{cfg['year']}") for cfg in EPOCH_CONFIG}
        log(f"  sampled {min(i + batch_size, n)}/{n}")

    offsets: dict[int, dict[int, float]] = {}
    for tid, _origin, _normal in transects:
        per_year: dict[int, float] = {}
        for year in EPOCHS:
            seq = [(s, raw.get((tid, s), {}).get(year)) for s in SAMPLE_S_VALUES]
            crossing = _land_to_water_crossing(seq)
            if crossing is not None:
                per_year[year] = crossing
        offsets[tid] = per_year
    return offsets


def _land_to_water_crossing(seq: list[tuple[int, float | None]]) -> float | None:
    pts = [(s, v) for s, v in seq if v is not None]
    for j in range(1, len(pts)):
        s0, v0 = pts[j - 1]
        s1, v1 = pts[j]
        if v0 < WATER_THRESHOLD <= v1:
            return s0 + (WATER_THRESHOLD - v0) / (v1 - v0) * (s1 - s0)
    return None


# --------------------------------------------------------------------------
# Stage 2: DSAS-equivalent rates (pure)
# --------------------------------------------------------------------------

def _wlr(years: list[int], offsets: list[float], weights: list[float]) -> tuple[float, float]:
    sw = sum(weights)
    mx = sum(w * x for w, x in zip(weights, years)) / sw
    my = sum(w * y for w, y in zip(weights, offsets)) / sw
    sxx = sum(w * (x - mx) ** 2 for w, x in zip(weights, years))
    sxy = sum(w * (x - mx) * (y - my) for w, x, y in zip(weights, years, offsets))
    if sxx == 0:
        return 0.0, 0.0
    slope = sxy / sxx
    syy = sum(w * (y - my) ** 2 for w, y in zip(weights, offsets))
    r2 = (sxy ** 2 / (sxx * syy)) if syy > 0 else 0.0
    return slope, r2


def _classify(rate: float | None) -> str:
    if rate is None:
        return "stable"
    if rate <= -0.5:
        return "erosion"
    if rate >= 0.5:
        return "accretion"
    return "stable"


def compute_rates(
    transects: list[tuple[int, tuple[float, float], tuple[float, float]]],
    offsets: dict[int, dict[int, float]],
    zones: list[str],
    *,
    min_epochs: int = 3,
) -> list[TransectRate]:
    """DSAS End Point Rate + Weighted Linear Regression per transect."""
    results: list[TransectRate] = []
    for idx, (tid, origin, _normal) in enumerate(transects):
        per = offsets.get(tid, {})
        years = sorted(per)
        if len(years) < min_epochs:
            results.append(TransectRate(tid, zones[idx], origin[0], origin[1],
                                        None, None, None, len(years), "stable"))
            continue
        offs = [per[y] for y in years]
        weights = [1.0 / (EPOCH_UNCERTAINTY_M.get(y, 15.0) ** 2) for y in years]
        nsm = offs[-1] - offs[0]
        span = years[-1] - years[0]
        epr = nsm / span if span else None
        wlr, r2 = _wlr(years, offs, weights)
        results.append(TransectRate(
            transect_id=tid, zone_id=zones[idx], lon=origin[0], lat=origin[1],
            epr_m_yr=epr, wlr_m_yr=wlr, r_squared=r2, n_epochs=len(years),
            trend=_classify(wlr),
        ))
    return results


def transects_to_geojson(rates: list[TransectRate]) -> dict:
    features = []
    for r in rates:
        if r.wlr_m_yr is None:
            continue
        features.append({
            "type": "Feature",
            "properties": {
                "transect_id": r.transect_id,
                "zone_id": r.zone_id,
                "rate_m_yr": round(r.wlr_m_yr, 2),
                "epr_m_yr": round(r.epr_m_yr, 2) if r.epr_m_yr is not None else None,
                "r_squared": round(r.r_squared, 3) if r.r_squared is not None else None,
                "n_epochs": r.n_epochs,
                "trend": r.trend,
                "source": "computed",
                "period": "1990-2024",
            },
            "geometry": {"type": "Point", "coordinates": [round(r.lon, 6), round(r.lat, 6)]},
        })
    return {
        "type": "FeatureCollection",
        "_note": "COMPUTED transect shoreline-change rates (neervazhvu): MNDWI on "
                 "Landsat 5/7/8 + Sentinel-2 via GEE, 100 m transects, WLR over 8 "
                 "epochs (1990-2024). Independent of the study's CoastSat+DSAS.",
        "_source": "neervazhvu (MNDWI/GEE) corroborating Anagha, Singh & Frappart 2026",
        "features": features,
    }


def run(*, write: bool = True, log=print) -> dict:
    """End-to-end: baseline -> transects -> GEE offsets -> rates -> GeoJSON."""
    baseline = baseline_from_zones()
    transects = build_transects(baseline)
    zones = zones_by_position(len(transects))
    log(f"transects: {len(transects)}")
    offsets = sample_transect_offsets(transects, log=log)
    rates = compute_rates(transects, offsets, zones)
    fc = transects_to_geojson(rates)
    if write:
        TRANSECTS_GEOJSON.write_text(json.dumps(fc, separators=(",", ":")), encoding="utf-8")
        log(f"wrote {TRANSECTS_GEOJSON} ({len(fc['features'])} transects)")
    return fc
