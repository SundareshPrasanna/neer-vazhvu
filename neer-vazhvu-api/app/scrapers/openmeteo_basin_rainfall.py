"""
OpenMeteo basin-area-averaged rainfall ingestion.

Samples a regular grid of points inside a basin polygon, queries the OpenMeteo
Forecast API (recent ~92 days + 14d forecast) for each point's daily
precipitation, and averages across in-polygon points.

Why OpenMeteo over IMD for daily ingestion:
- Real-time (no 1-2 day lag like IMD gridded)
- 14-day forecast is bonus context for the June 12 question
- Free, no auth, simple HTTP+JSON
- ERA5-Land base for historical, IFS for forecast (both reputable)

IMD remains the monthly authoritative cross-check (separate script, M3.5).
"""

import asyncio
import json
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
from shapely.geometry import Point, shape

OPENMETEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPENMETEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

# Where the basin polygon lives. Public/ so the same file is also reachable from
# the Next.js client if we want to render it on a map later.
DEFAULT_BASIN_GEOJSON = (
    Path(__file__).resolve().parents[3] / "public" / "geojson" / "cauvery-basin.geojson"
)

# Grid sampling: 0.75-degree spacing inside the bbox of the basin geojson. At
# Cauvery latitudes (~11N) this is ~83km E-W and ~83km N-S, comfortable inside
# OpenMeteo's ~11km native ERA5-Land resolution.
GRID_SPACING_DEG = 0.75

USER_AGENT = "neer-vazhvu/1.0 (civic water dashboard)"


@dataclass(frozen=True)
class GridPoint:
    lat: float
    lng: float


@dataclass(frozen=True)
class BasinDailyRainfall:
    city_id: str
    basin_code: str
    date: str  # YYYY-MM-DD
    season: str  # 'sw' or 'ne'
    rainfall_mm: float | None
    cumulative_mm: float | None
    lpa_mm: float | None
    source: str


def _today_ist() -> date:
    return datetime.now(ZoneInfo("Asia/Kolkata")).date()


def _season_for(d: date) -> str | None:
    """SW monsoon = Jun-Sep; NE monsoon = Oct-Dec. Other months: None."""
    if 6 <= d.month <= 9:
        return "sw"
    if 10 <= d.month <= 12:
        return "ne"
    return None


def _season_start(d: date) -> date | None:
    """Start date of the current season. Used for cumulative calc."""
    season = _season_for(d)
    if season == "sw":
        return date(d.year, 6, 1)
    if season == "ne":
        return date(d.year, 10, 1)
    return None


def load_basin_polygon(path: Path = DEFAULT_BASIN_GEOJSON):
    """Load the basin polygon as a Shapely geometry (or MultiPolygon)."""
    with open(path) as f:
        gj = json.load(f)
    if gj.get("type") == "FeatureCollection":
        # Combine all features into one geometry
        geoms = [shape(f["geometry"]) for f in gj["features"]]
        if len(geoms) == 1:
            return geoms[0]
        from shapely.ops import unary_union

        return unary_union(geoms)
    if gj.get("type") == "Feature":
        return shape(gj["geometry"])
    return shape(gj)


def grid_points_in_basin(polygon, spacing: float = GRID_SPACING_DEG) -> list[GridPoint]:
    """Generate a regular lat/lng grid inside the polygon's bbox and filter to in-polygon points."""
    minx, miny, maxx, maxy = polygon.bounds
    points: list[GridPoint] = []
    lat = miny + spacing / 2
    while lat < maxy:
        lng = minx + spacing / 2
        while lng < maxx:
            if polygon.contains(Point(lng, lat)):
                points.append(GridPoint(lat=round(lat, 4), lng=round(lng, 4)))
            lng += spacing
        lat += spacing
    return points


async def _fetch_openmeteo_forecast(
    points: list[GridPoint], past_days: int = 92, forecast_days: int = 14
) -> list[dict]:
    """Fetch daily precipitation_sum for each point. Returns one dict per point."""
    if not points:
        return []
    params = {
        "latitude": ",".join(f"{p.lat}" for p in points),
        "longitude": ",".join(f"{p.lng}" for p in points),
        "daily": "precipitation_sum",
        "timezone": "Asia/Kolkata",
        "past_days": str(past_days),
        "forecast_days": str(forecast_days),
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(
            OPENMETEO_FORECAST_URL,
            params=params,
            headers={"User-Agent": USER_AGENT},
        )
        response.raise_for_status()

    payload = response.json()
    # Multi-location returns a list; single-location returns a dict. Normalise.
    if isinstance(payload, dict):
        return [payload]
    return payload


def _basin_average(per_point_responses: list[dict]) -> dict[str, float]:
    """
    Average daily precipitation across all grid points.

    Returns: { 'YYYY-MM-DD': basin_avg_mm }
    """
    by_date: dict[str, list[float]] = {}
    for resp in per_point_responses:
        daily = resp.get("daily") or {}
        times = daily.get("time") or []
        precs = daily.get("precipitation_sum") or []
        for t, p in zip(times, precs):
            if p is None:
                continue
            by_date.setdefault(t, []).append(float(p))

    return {
        d: round(sum(vals) / len(vals), 2) for d, vals in by_date.items() if vals
    }


def _load_lpa_lookup(lpa_path: Path) -> dict[str, dict[str, float]] | None:
    """LPA file maps season -> day-of-season-index -> mm.

    Format: { 'sw': { '0': 0.0, '1': 4.2, ... }, 'ne': { ... } }
    Day-of-season index is days since season start (0 = Jun 1 for SW, 0 = Oct 1 for NE).

    Returns None if the file doesn't exist - caller falls back to null lpa_mm.
    """
    if not lpa_path.exists():
        return None
    with open(lpa_path) as f:
        return json.load(f)


def _lpa_for(d: date, lpa: dict[str, dict[str, float]] | None) -> float | None:
    if lpa is None:
        return None
    season = _season_for(d)
    if season is None:
        return None
    start = _season_start(d)
    assert start is not None
    day_idx = (d - start).days
    return lpa.get(season, {}).get(str(day_idx))


async def compute_basin_rainfall(
    city_id: str = "kaveri",
    basin_code: str = "cauvery_basin",
    basin_geojson_path: Path = DEFAULT_BASIN_GEOJSON,
    lpa_path: Path | None = None,
) -> list[BasinDailyRainfall]:
    """
    Compute daily basin rainfall for the past ~92 days plus 14 forecast days.

    Returns rows ready to upsert into basin_rainfall_daily.
    """
    polygon = load_basin_polygon(basin_geojson_path)
    points = grid_points_in_basin(polygon)
    if not points:
        raise ValueError(
            f"No grid points fell inside basin polygon {basin_geojson_path.name} "
            f"(spacing={GRID_SPACING_DEG} deg). Check the polygon."
        )

    responses = await _fetch_openmeteo_forecast(points)
    daily_avg = _basin_average(responses)

    lpa_lookup = _load_lpa_lookup(lpa_path) if lpa_path else None

    today = _today_ist()
    rows: list[BasinDailyRainfall] = []
    cumulative_by_season: dict[str, float] = {"sw": 0.0, "ne": 0.0}

    for date_str in sorted(daily_avg.keys()):
        d = date.fromisoformat(date_str)
        season = _season_for(d)
        if season is None:
            continue
        # Reset the cumulative when we cross a season boundary.
        start = _season_start(d)
        if start is not None and d == start:
            cumulative_by_season[season] = 0.0
        rainfall_mm = daily_avg[date_str]
        # Don't accumulate beyond today (forecast days inflate the cumulative).
        if d <= today:
            cumulative_by_season[season] += rainfall_mm
        rows.append(
            BasinDailyRainfall(
                city_id=city_id,
                basin_code=basin_code,
                date=date_str,
                season=season,
                rainfall_mm=rainfall_mm,
                cumulative_mm=round(cumulative_by_season[season], 2)
                if d <= today
                else None,
                lpa_mm=_lpa_for(d, lpa_lookup),
                source="openmeteo",
            )
        )
    return rows


async def fetch_archive_for_lpa(
    points: list[GridPoint],
    start_year: int = 1991,
    end_year: int = 2020,
) -> dict[str, dict[int, float]]:
    """
    Fetch daily precipitation from OpenMeteo Historical Archive for many years.

    Used by the one-time LPA backfill script (see scripts/backfill_cauvery_basin_lpa.py).

    Returns: { season: { day_of_season_idx: mean_cumulative_mm } }
    """
    # Cap the date range to avoid hammering the API. Multi-location archive is
    # supported but query returns a lot of data; we batch by 3 years per call.
    by_season_doy: dict[str, dict[int, list[float]]] = {"sw": {}, "ne": {}}

    async with httpx.AsyncClient(timeout=120.0) as client:
        for year in range(start_year, end_year + 1):
            params = {
                "latitude": ",".join(f"{p.lat}" for p in points),
                "longitude": ",".join(f"{p.lng}" for p in points),
                "daily": "precipitation_sum",
                "timezone": "Asia/Kolkata",
                "start_date": f"{year}-01-01",
                "end_date": f"{year}-12-31",
            }
            payload = None
            for attempt in range(1, 5):
                response = await client.get(
                    OPENMETEO_ARCHIVE_URL,
                    params=params,
                    headers={"User-Agent": USER_AGENT},
                )
                if response.status_code == 429:
                    backoff = min(60, 5 * (2 ** (attempt - 1)))
                    print(
                        f"  [{year}] 429 rate-limited, sleeping {backoff}s before retry {attempt}",
                        flush=True,
                    )
                    await asyncio.sleep(backoff)
                    continue
                response.raise_for_status()
                payload = response.json()
                break
            if payload is None:
                print(f"  [{year}] gave up after retries; skipping year", flush=True)
                continue
            if isinstance(payload, dict):
                payload = [payload]
            daily_avg = _basin_average(payload)
            cumulative = {"sw": 0.0, "ne": 0.0}
            for date_str in sorted(daily_avg.keys()):
                d = date.fromisoformat(date_str)
                season = _season_for(d)
                if season is None:
                    continue
                start = _season_start(d)
                assert start is not None
                day_idx = (d - start).days
                cumulative[season] += daily_avg[date_str]
                by_season_doy[season].setdefault(day_idx, []).append(
                    cumulative[season]
                )
            print(f"  [{year}] ok ({len(daily_avg)} days)", flush=True)
            await asyncio.sleep(2.0)  # gentle on the API

    # Average across years per day-of-season
    return {
        season: {doy: round(sum(vals) / len(vals), 2) for doy, vals in doys.items()}
        for season, doys in by_season_doy.items()
    }


# Helper for callers that want a synchronous view
def days_until(d: date, target: date) -> int:
    return (target - d).days
