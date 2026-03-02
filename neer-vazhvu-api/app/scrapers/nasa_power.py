"""
NASA POWER Weather Data Client.

Ported from src/lib/api-clients/nasa-power.ts.
Fetches daily precipitation, temperature, and humidity for Chennai.
No auth required.
"""

import httpx

from app.etl.constants import CHENNAI_LAT, CHENNAI_LNG
from app.models.reservoir import NASAPowerDay

NASA_POWER_BASE = "https://power.larc.nasa.gov/api/temporal/daily/point"


def _iso_to_nasa(iso_date: str) -> str:
    """Convert YYYY-MM-DD to YYYYMMDD."""
    return iso_date.replace("-", "")


def _nasa_to_iso(nasa_date: str) -> str:
    """Convert YYYYMMDD to YYYY-MM-DD."""
    return f"{nasa_date[:4]}-{nasa_date[4:6]}-{nasa_date[6:8]}"


async def fetch_nasa_power(start_date: str, end_date: str) -> list[NASAPowerDay]:
    """
    Fetch daily weather data from NASA POWER API.

    Args:
        start_date: YYYY-MM-DD format
        end_date: YYYY-MM-DD format

    Returns:
        List of daily weather records.
    """
    params = {
        "parameters": "PRECTOTCORR,T2M_MAX,T2M_MIN,RH2M",
        "community": "AG",
        "longitude": str(CHENNAI_LNG),
        "latitude": str(CHENNAI_LAT),
        "start": _iso_to_nasa(start_date),
        "end": _iso_to_nasa(end_date),
        "format": "JSON",
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(NASA_POWER_BASE, params=params, timeout=60.0)
        response.raise_for_status()

    data = response.json()
    properties = data["properties"]["parameter"]

    dates = list(properties["PRECTOTCORR"].keys())

    results: list[NASAPowerDay] = []
    for d in dates:
        # -999 = missing data in NASA POWER
        if properties["PRECTOTCORR"][d] == -999:
            continue
        results.append(
            NASAPowerDay(
                date=_nasa_to_iso(d),
                precipitation_mm=properties["PRECTOTCORR"][d],
                temp_max_c=properties["T2M_MAX"][d],
                temp_min_c=properties["T2M_MIN"][d],
                humidity_pct=properties["RH2M"][d],
            )
        )

    return results
