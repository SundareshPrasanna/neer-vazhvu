"""
WRIS surface-water (river-level) and rainfall telemetry clients.

Mirrors the groundwater client (app/scrapers/wris.py) but targets the
River Water Level and RainFall datasets on the same India WRIS API.
Both datasets share the API shape - state/district/agency filter,
hourly readings - but differ in how they aggregate to a daily value:

  river level -> daily MEAN of HHT (water-level telemetry) readings, m
  rainfall    -> daily MAX of IPC accumulator (mm). The IPC datatype
                 ("INSAT-Rain accumm") is a midnight-resetting cumulative
                 counter, so the day's MAX equals total rain that day.

Both functions accept an `agencies` list to fan out across multiple
publishers in one call (CWC, IMD, state SW GW, etc.).
"""

import logging
import math
from datetime import date, datetime

import httpx

from app.models.wris_telemetry import (
    WrisRainfallRecord,
    WrisRiverLevelRecord,
)

logger = logging.getLogger(__name__)

WRIS_RIVER_LEVEL_BASE = "https://indiawris.gov.in/Dataset/River%20Water%20Level"
WRIS_RAINFALL_BASE = "https://indiawris.gov.in/Dataset/RainFall"

PAGE_SIZE = 1000
MAX_PAGES = 50

# Datatype filters per dataset. The WRIS API returns *all* datatypes for a
# matched station, so we filter client-side.
RIVER_LEVEL_DATATYPES = {"HHT"}  # INSAT-WL Telemetry, water level
RAINFALL_ACCUMULATED_DATATYPES = {"IPC"}  # INSAT-Rain accumm (midnight-reset)


async def _fetch_pages(
    base_url: str,
    state: str,
    district: str,
    agencies: list[str],
    start_date: date,
    end_date: date,
) -> list[dict]:
    """Fan out paginated fetches across all configured agencies."""
    all_records: list[dict] = []
    async with httpx.AsyncClient(timeout=60.0) as client:
        for agency in agencies:
            agency_count = 0
            for page in range(MAX_PAGES):
                url = (
                    f"{base_url}"
                    f"?stateName={state}"
                    f"&districtName={district}"
                    f"&agencyName={agency}"
                    f"&startdate={start_date.isoformat()}"
                    f"&enddate={end_date.isoformat()}"
                    f"&download=false"
                    f"&page={page}"
                    f"&size={PAGE_SIZE}"
                )
                response = await client.post(url, headers={"Accept": "application/json"})
                response.raise_for_status()
                data = response.json()
                # Treat "no data" responses as empty for this agency rather
                # than fatal - lets us fan out across CWC + IMD + state
                # boards without per-agency special-casing during onboarding.
                msg = (data.get("message") or "").lower()
                if data.get("statusCode") != 200:
                    if "no data" in msg or "not found" in msg:
                        logger.info(
                            "WRIS %s %s: no data in window, skipping",
                            base_url.split("/")[-1],
                            agency,
                        )
                        break
                    raise ValueError(
                        f"WRIS API error ({base_url}, {agency}): "
                        f"{data.get('message')}"
                    )
                records = data.get("data", [])
                if not records:
                    break
                all_records.extend(records)
                agency_count += len(records)
                if len(records) < PAGE_SIZE:
                    break
            logger.info(
                "WRIS %s %s done: %d raw records",
                base_url.split("/")[-1],
                agency,
                agency_count,
            )
    logger.info(
        "WRIS %s total raw records across %d agencies: %d",
        base_url.split("/")[-1],
        len(agencies),
        len(all_records),
    )
    return all_records


def _meta_from_first(group: list[dict]) -> dict:
    """Pick the first reading as the metadata source for a station/date group."""
    return group[0]


def _aggregate(
    raw: list[dict],
    datatype_filter: set[str],
    aggregator: str,  # "mean" | "max"
) -> list[tuple[str, date, float, int, dict]]:
    """
    Group raw hourly records by (station_code, date) and aggregate.

    Returns a list of (station_code, reading_date, aggregated_value,
    reading_count, meta_dict) tuples. Caller turns these into typed
    records.

    Filters out: invalid dates, non-numeric values, datatypes outside
    the configured filter set, and obvious sensor errors (|value|>500
    metres or mm).
    """
    from collections import defaultdict

    groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in raw:
        datatype = r.get("datatypeCode", "")
        if datatype not in datatype_filter:
            continue
        station_code = r.get("stationCode", "")
        data_time = r.get("dataTime", "")
        raw_value = r.get("dataValue")
        if not station_code or not data_time or raw_value is None:
            continue
        # WRIS sometimes returns numeric values as strings, including
        # the string "NaN" or actual NaN floats - both are unsendable
        # to Postgres via JSON. Coerce and drop anything we cannot
        # parse or that is not a finite float.
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            continue
        if not math.isfinite(value):
            continue
        r["dataValue"] = value  # normalise so downstream aggregation gets floats
        if abs(value) > 500:
            continue
        date_str = data_time[:10]  # YYYY-MM-DD
        groups[(station_code, date_str)].append(r)

    out: list[tuple[str, date, float, int, dict]] = []
    for (station_code, date_str), group in groups.items():
        values = [g["dataValue"] for g in group if isinstance(g.get("dataValue"), (int, float))]
        if not values:
            continue
        try:
            reading_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            continue
        if aggregator == "mean":
            agg = sum(values) / len(values)
        elif aggregator == "max":
            agg = max(values)
        else:
            raise ValueError(f"Unknown aggregator: {aggregator}")
        out.append((station_code, reading_date, agg, len(values), _meta_from_first(group)))
    return out


def _common_fields(meta: dict) -> dict:
    """Pull the non-value identifying fields shared between both record types."""
    return {
        "station_name": meta.get("stationName"),
        "latitude": meta.get("latitude"),
        "longitude": meta.get("longitude"),
        "agency": meta.get("agencyName"),
        "state": meta.get("state"),
        "district": meta.get("district"),
        "tehsil": meta.get("tehsil"),
        "major_basin": meta.get("majorBasin"),
        "tributary": meta.get("tributary"),
        "acquisition_mode": meta.get("dataAcquisitionMode"),
        "station_status": meta.get("stationStatus"),
    }


async def fetch_wris_river_level(
    start_date: date,
    end_date: date,
    state: str = "Tamil Nadu",
    district: str = "Madurai",
    agencies: list[str] | None = None,
) -> list[WrisRiverLevelRecord]:
    """
    Fetch daily-mean river water-level telemetry for a district from WRIS.

    Filters to HHT datatype (INSAT-WL Telemetry). Returns one record
    per (station_code, reading_date), with `level_m` as the daily mean
    of the hourly readings.
    """
    agencies = agencies or ["CWC"]
    raw = await _fetch_pages(
        WRIS_RIVER_LEVEL_BASE, state, district, agencies, start_date, end_date
    )
    aggregated = _aggregate(raw, RIVER_LEVEL_DATATYPES, "mean")
    return [
        WrisRiverLevelRecord(
            station_code=station_code,
            reading_date=reading_date,
            level_m=value,
            reading_count=count,
            **_common_fields(meta),
        )
        for station_code, reading_date, value, count, meta in aggregated
    ]


async def fetch_wris_rainfall(
    start_date: date,
    end_date: date,
    state: str = "Tamil Nadu",
    district: str = "Madurai",
    agencies: list[str] | None = None,
) -> list[WrisRainfallRecord]:
    """
    Fetch daily-total rainfall telemetry for a district from WRIS.

    Filters to IPC datatype (INSAT-Rain accumm, a midnight-resetting
    cumulative counter). Returns one record per (station_code,
    reading_date), with `rainfall_mm` as the day's MAX accumulator
    value - which equals the total rain that day, given the midnight
    reset.
    """
    agencies = agencies or ["CWC"]
    raw = await _fetch_pages(
        WRIS_RAINFALL_BASE, state, district, agencies, start_date, end_date
    )
    aggregated = _aggregate(raw, RAINFALL_ACCUMULATED_DATATYPES, "max")
    return [
        WrisRainfallRecord(
            station_code=station_code,
            reading_date=reading_date,
            rainfall_mm=value,
            reading_count=count,
            **_common_fields(meta),
        )
        for station_code, reading_date, value, count, meta in aggregated
    ]
