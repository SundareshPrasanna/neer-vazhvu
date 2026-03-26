"""
Open-Meteo Weather Data Client.

Free, no-auth weather API providing:
- Hourly/daily weather for Chennai (precipitation, temperature, humidity, wind)
- Reference evapotranspiration (ET₀) — critical for reservoir evaporation modeling
- No rate-limiting concerns for our daily pipeline use case

Replaces NASA POWER as primary weather source (zero lag vs NASA's 2-day lag).
NASA POWER is kept as a fallback.
"""

import httpx

from app.etl.constants import CHENNAI_LAT, CHENNAI_LNG
from app.models.weather import WeatherDay

OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_HISTORICAL = "https://archive-api.open-meteo.com/v1/archive"


async def fetch_open_meteo(
    start_date: str,
    end_date: str,
    *,
    historical: bool = False,
) -> list[WeatherDay]:
    """
    Fetch daily weather data from Open-Meteo.

    Uses the forecast API for recent/current data and the archive API
    for historical data (> 7 days ago).

    Args:
        start_date: YYYY-MM-DD format
        end_date: YYYY-MM-DD format
        historical: If True, use the archive API for older data.

    Returns:
        List of daily weather records including ET₀.
    """
    base_url = OPEN_METEO_HISTORICAL if historical else OPEN_METEO_BASE

    params = {
        "latitude": str(CHENNAI_LAT),
        "longitude": str(CHENNAI_LNG),
        "start_date": start_date,
        "end_date": end_date,
        "daily": ",".join([
            "precipitation_sum",
            "temperature_2m_max",
            "temperature_2m_min",
            "relative_humidity_2m_mean",
            "et0_fao_evapotranspiration",
            "wind_speed_10m_max",
        ]),
        "timezone": "Asia/Kolkata",
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(base_url, params=params, timeout=30.0)
        response.raise_for_status()

    data = response.json()
    daily = data["daily"]

    results: list[WeatherDay] = []
    for i, date in enumerate(daily["time"]):
        precip = daily["precipitation_sum"][i]
        if precip is None:
            continue

        results.append(
            WeatherDay(
                date=date,
                precipitation_mm=precip,
                temp_max_c=daily["temperature_2m_max"][i] or 0,
                temp_min_c=daily["temperature_2m_min"][i] or 0,
                humidity_pct=daily["relative_humidity_2m_mean"][i] or 0,
                et0_mm=daily["et0_fao_evapotranspiration"][i],
                wind_speed_max_kmh=daily["wind_speed_10m_max"][i],
            )
        )

    return results
