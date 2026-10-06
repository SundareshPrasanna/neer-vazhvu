"""
NWIC National Water Data Portal (nwdp.nwic.gov.in, CKAN) groundwater levels.

The alternate for India-WRIS: the same WIMS telemetry series, no API key, and
still publishing where the WRIS endpoint stops (WRIS froze at 2026-06-04).
Rows carry a station NAME and agency but no station code, so callers join
them to known stations with station_key().
"""

import json
import logging
import re
from collections import defaultdict
from datetime import date, datetime

import httpx

from app.scrapers.well_levels import keep_mask

logger = logging.getLogger(__name__)

NWDP_API = "https://nwdp.nwic.gov.in/api/3/action/datastore_search"
PAGE_SIZE = 5000
MAX_PAGES = 200  # safety cap
# Telemetry six-hourly resources, one per agency per state. Each covers
# 2026-2030; the portal opens a new resource for the next five-year block.
CGWB_TAMIL_NADU = "3bd0c6d5-dd9b-4c07-9c60-6410c1c6bd56"
STATE_TAMIL_NADU = "6857c02f-c77e-4576-b349-3e45aacc1c21"
CGWB_KARNATAKA = "b9a76d29-078e-4551-8092-e22f0e60bb45"


def station_key(name: str, agency: str) -> tuple[str, str]:
    """Join key: WRIS 'M.Rajakkapatti' is NWDP 'M. Rajakkapatti'."""
    return re.sub(r"[^a-z0-9]", "", name.lower()), agency


def daily_means(
    rows: list[dict], start_date: date, end_date: date
) -> dict[tuple[tuple[str, str], date], float]:
    """(station_key, day) -> mean level, in the sign the portal publishes."""
    by_station: dict[tuple[str, str], list[tuple[date, float]]] = defaultdict(list)
    for r in rows:
        level_field = next((k for k in reversed(list(r)) if "Level" in k), None)
        try:
            value = float(r[level_field])
            day = datetime.strptime(r["Data Acquisition Time"], "%d-%m-%Y %H:%M").date()
        except (KeyError, TypeError, ValueError):
            continue
        if start_date <= day <= end_date:
            by_station[station_key(r["Station"], r["Agency"])].append((day, value))
    groups: dict[tuple[tuple[str, str], date], list[float]] = defaultdict(list)
    for key, readings in by_station.items():
        for (day, value), keep in zip(readings, keep_mask([v for _, v in readings])):
            if keep:
                groups[key, day].append(value)
    return {k: round(sum(v) / len(v), 3) for k, v in groups.items()}


async def fetch_nwdp_groundwater(
    start_date: date, end_date: date, district: str, resource_ids: list[str]
) -> dict[tuple[tuple[str, str], date], float]:
    """Daily mean level per station for one district across the given resources."""
    rows: list[dict] = []
    async with httpx.AsyncClient(timeout=120.0) as client:
        for resource_id in resource_ids:
            for page in range(MAX_PAGES):
                response = await client.get(
                    NWDP_API,
                    params={
                        "resource_id": resource_id,
                        "filters": json.dumps({"District": district}),
                        "limit": PAGE_SIZE,
                        "offset": page * PAGE_SIZE,
                    },
                )
                response.raise_for_status()
                records = response.json()["result"]["records"]
                rows.extend(records)
                if len(records) < PAGE_SIZE:
                    break
    logger.info("NWDP %s: %d raw records", district, len(rows))
    return daily_means(rows, start_date, end_date)


def join_to_stations(
    daily: dict, stations: list[dict], have: set[tuple[str, str]]
) -> tuple[list[dict], set[str]]:
    """Daily means as reading rows for the known stations they name.

    Returns the rows whose (station_code, reading_date) is not in `have`, and
    the station names matching no known station or more than one (left out).
    """
    by_key = defaultdict(list)
    for s in stations:
        by_key[station_key(s["station_name"], s["agency"])].append(s)
    rows, unjoined = [], set()
    for (key, day), value in daily.items():
        match = by_key.get(key, [])
        if len(match) != 1:
            unjoined.add(key[0])
        elif (match[0]["station_code"], day.isoformat()) not in have:
            rows.append(
                {
                    **match[0],
                    "reading_date": day.isoformat(),
                    "depth_to_water_m": value,
                    "acquisition_mode": "Telemetric",
                }
            )
    return rows, unjoined
