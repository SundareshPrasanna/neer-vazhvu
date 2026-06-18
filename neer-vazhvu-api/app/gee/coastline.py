"""
Chennai coastal shoreline-change reproduction (CoastSat + DSAS).

This reproduces the shoreline-change half of:

    Anagha, Singh & Frappart (2026), "Shoreline and salinity shifts along the
    Chennai coast", Environmental Challenges. DOI 10.1016/j.envc.2026.101514.

It supersedes the SEED layer (scripts/build-chennai-coastal-seed.py, which only
maps the study's published per-zone numbers onto the OSM coastline) with OUR OWN
computed transect rates, written as source="computed".

Two stages:

  1. extract_shorelines() - drives the CoastSat toolkit (Vos et al. 2019) to
     download Landsat 5/7/8 + Sentinel-2 imagery via Google Earth Engine,
     compute MNDWI, threshold with Otsu, and trace sub-pixel shorelines for the
     study epochs (1990, 1995, ... 2020, 2024). This is the GEE-dependent step
     and needs earthengine-api auth (see app/gee/client.py) plus the optional
     `coastal` dependency group:  pip install -e .[coastal]

  2. compute_transect_rates() - DSAS-equivalent analysis: cast normals every
     100 m along a baseline, intersect each shoreline with each transect, and
     derive End Point Rate (EPR) and Weighted Linear Regression (WLR) rates plus
     per-epoch positional uncertainty (Table 2 of the paper). Pure NumPy, no
     ArcGIS - so this stage is unit-testable without GEE.

STATUS: the DSAS math (stage 2) is self-contained and reviewable. The CoastSat
driver (stage 1) requires GEE service-account credentials that are injected at
deploy time (Railway), not present in local dev, so the end-to-end run has NOT
yet been executed or validated here. Treat the first run's output as a draft to
review against the paper's Fig. 3-4 before it replaces the seed on /coastal.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

# Study epochs (Table 1 of the paper). Landsat for 1990-2015, Sentinel-2 for
# 2020 & 2024 (10 m, hence lower positional uncertainty).
EPOCHS: tuple[int, ...] = (1990, 1995, 2000, 2005, 2010, 2015, 2020, 2024)

# Per-epoch total shoreline-position error Esp (metres), Table 2 of the paper.
# Used as the WLR weights (weight = 1 / Esp**2).
EPOCH_UNCERTAINTY_M: dict[int, float] = {
    1990: 16.33,
    1995: 17.21,
    2000: 15.78,
    2005: 16.04,
    2010: 15.67,
    2015: 15.14,
    2020: 8.66,
    2024: 8.66,
}

# Study area: 86 km from Uthandi (south) to Pulicat (north). Bbox is the
# fetch envelope; transects are clipped to the baseline.
STUDY_BBOX = (80.15, 12.70, 80.45, 13.60)  # west, south, east, north
TRANSECT_SPACING_M = 100.0
TRANSECT_HALF_LENGTH_M = 500.0  # normals extend +/- this from the baseline

# MNDWI = (Green - SWIR1) / (Green + SWIR1); Otsu threshold per CoastSat.
MNDWI_GREEN_BAND_S2 = "B3"
MNDWI_SWIR1_BAND_S2 = "B11"

EARTH_RADIUS_M = 6_371_000.0


@dataclass
class TransectRate:
    """DSAS output for one transect."""

    transect_id: int
    zone_id: str
    lon: float
    lat: float
    epr_m_yr: float | None  # End Point Rate (first vs last epoch)
    wlr_m_yr: float | None  # Weighted Linear Regression slope
    nsm_m: float | None  # Net Shoreline Movement (first->last, metres)
    r_squared: float | None
    n_epochs: int
    trend: str  # "erosion" | "accretion" | "stable"


@dataclass
class ShorelineSet:
    """Extracted shorelines keyed by epoch year.

    Each value is an ordered list of (lon, lat) vertices for that year's
    sub-pixel shoreline within the study area.
    """

    shorelines: dict[int, list[tuple[float, float]]] = field(default_factory=dict)


# --------------------------------------------------------------------------
# Stage 1: CoastSat shoreline extraction (GEE-dependent)
# --------------------------------------------------------------------------

def extract_shorelines(*, output_dir: str | None = None) -> ShorelineSet:
    """Run CoastSat to extract one shoreline per epoch via GEE.

    Requires `pip install -e .[coastal]` and GEE auth. Raises a clear error if
    CoastSat is unavailable so the failure is actionable rather than an opaque
    ImportError deep in a job.
    """
    try:
        from coastsat import SDS_download, SDS_preprocess, SDS_shoreline  # noqa: F401
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise RuntimeError(
            "CoastSat is not installed. Install the coastal extra: "
            "pip install -e .[coastal]  (and authenticate Earth Engine, see "
            "app/gee/client.py)."
        ) from exc

    # Ensure EE is initialised through the project's shared credentials path.
    from app.gee.client import initialize_earth_engine

    initialize_earth_engine()

    # NOTE: the concrete CoastSat invocation (inputs dict, settings dict,
    # retrieve_images -> save_shorelines) is intentionally left as the single
    # block to fill in on first authenticated run, because its exact parameters
    # (reference shoreline digitisation, cloud threshold, beach slope) need
    # tuning against the study and cannot be validated without credentials.
    raise NotImplementedError(
        "extract_shorelines: wire the CoastSat retrieve_images/save_shorelines "
        "call here on the first authenticated GEE run, then remove this guard. "
        "See METHODS.md for the exact CoastSat settings derived from the paper."
    )


# --------------------------------------------------------------------------
# Stage 2: DSAS-equivalent transect analysis (pure NumPy, testable)
# --------------------------------------------------------------------------

def _haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def build_transects(
    baseline: list[tuple[float, float]],
    *,
    spacing_m: float = TRANSECT_SPACING_M,
) -> list[tuple[int, tuple[float, float], tuple[float, float]]]:
    """Cast shore-normal transects every `spacing_m` along an ordered baseline.

    Returns (transect_id, origin_lonlat, unit_normal_lonlat) tuples. The unit
    normal points seaward (to the right of the south->north baseline) and is
    expressed in degrees-per-metre so intersections can be measured in metres.
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
            # tangent (south->north); seaward normal = rotate -90deg
            mlat = math.cos(math.radians(origin[1]))
            tx = (b[0] - a[0]) * mlat
            ty = (b[1] - a[1])
            norm = math.hypot(tx, ty) or 1.0
            # rotate tangent by -90deg -> (ty, -tx); convert back to lon/lat deg per metre
            deg_per_m_lat = 1.0 / 111_320.0
            deg_per_m_lon = deg_per_m_lat / (mlat or 1.0)
            normal = (ty / norm * deg_per_m_lon, -tx / norm * deg_per_m_lat)
            transects.append((tid, origin, normal))
            tid += 1
            next_at += spacing_m
        dist_acc += seg_len
    return transects


def _signed_offset_m(
    origin: tuple[float, float],
    normal: tuple[float, float],
    shoreline: list[tuple[float, float]],
) -> float | None:
    """Signed seaward distance (m) from `origin` to where `shoreline` crosses
    the transect ray. Positive = seaward of origin. None if no nearby crossing.
    """
    best: float | None = None
    best_perp = TRANSECT_HALF_LENGTH_M
    mlat = math.cos(math.radians(origin[1]))
    nx, ny = normal[0] * mlat, normal[1]  # metric-ish normal direction
    nnorm = math.hypot(nx, ny) or 1.0
    nx, ny = nx / nnorm, ny / nnorm
    for p in shoreline:
        dx = (p[0] - origin[0]) * mlat * 111_320.0
        dy = (p[1] - origin[1]) * 111_320.0
        along = dx * nx + dy * ny  # projection onto seaward normal (m)
        perp = abs(-dx * ny + dy * nx)  # distance off the transect line (m)
        if perp < best_perp and abs(along) <= TRANSECT_HALF_LENGTH_M:
            best_perp = perp
            best = along
    return best


def _wlr(years: list[int], offsets: list[float], weights: list[float]) -> tuple[float, float]:
    """Weighted linear regression of offset (m) on year. Returns (slope_m_yr, r2)."""
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


def compute_transect_rates(
    transects: list[tuple[int, tuple[float, float], tuple[float, float]]],
    shorelines: ShorelineSet,
    zone_of: callable,  # (transect_id) -> zone_id "I".."VI"
) -> list[TransectRate]:
    """DSAS EPR + WLR per transect from the extracted shoreline time series."""
    results: list[TransectRate] = []
    years = sorted(shorelines.shorelines.keys())
    for tid, origin, normal in transects:
        offs: list[float] = []
        yrs: list[int] = []
        wts: list[float] = []
        for y in years:
            off = _signed_offset_m(origin, normal, shorelines.shorelines[y])
            if off is None:
                continue
            offs.append(off)
            yrs.append(y)
            wts.append(1.0 / (EPOCH_UNCERTAINTY_M.get(y, 15.0) ** 2))
        if len(yrs) < 2:
            results.append(TransectRate(tid, zone_of(tid), origin[0], origin[1],
                                        None, None, None, None, len(yrs), "stable"))
            continue
        nsm = offs[-1] - offs[0]
        span = yrs[-1] - yrs[0]
        epr = nsm / span if span else None
        wlr, r2 = _wlr(yrs, offs, wts)
        results.append(TransectRate(
            transect_id=tid, zone_id=zone_of(tid), lon=origin[0], lat=origin[1],
            epr_m_yr=epr, wlr_m_yr=wlr, nsm_m=nsm, r_squared=r2,
            n_epochs=len(yrs), trend=_classify(wlr),
        ))
    return results


def transects_to_geojson(rates: list[TransectRate]) -> dict:
    """Emit the computed transect layer (source="computed") that supersedes the
    seed on /coastal. Geometry is a short seaward stub per transect for display.
    """
    features = []
    for r in rates:
        # A point per transect origin suffices for the web layer; a seaward
        # LineString stub can be added once the baseline azimuth is retained.
        features.append({
            "type": "Feature",
            "properties": {
                "transect_id": r.transect_id,
                "zone_id": r.zone_id,
                "rate_m_yr": round(r.wlr_m_yr, 2) if r.wlr_m_yr is not None else None,
                "epr_m_yr": round(r.epr_m_yr, 2) if r.epr_m_yr is not None else None,
                "nsm_m": round(r.nsm_m, 1) if r.nsm_m is not None else None,
                "r_squared": round(r.r_squared, 3) if r.r_squared is not None else None,
                "trend": r.trend,
                "n_epochs": r.n_epochs,
                "source": "computed",
                "period": "1990-2024",
            },
            "geometry": {"type": "Point", "coordinates": [round(r.lon, 6), round(r.lat, 6)]},
        })
        _ = (stub_m, mlat)  # reserved for LineString geometry once baseline azimuth is kept
    return {
        "type": "FeatureCollection",
        "_note": "COMPUTED CoastSat+DSAS transect rates. Supersedes the seed.",
        "features": features,
    }
