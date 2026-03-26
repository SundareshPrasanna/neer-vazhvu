from pydantic import BaseModel


class WeatherDay(BaseModel):
    """A single day of weather data (Open-Meteo or NASA POWER)."""

    date: str  # YYYY-MM-DD
    precipitation_mm: float
    temp_max_c: float
    temp_min_c: float
    humidity_pct: float
    et0_mm: float | None = None  # Reference evapotranspiration (FAO Penman-Monteith)
    wind_speed_max_kmh: float | None = None
