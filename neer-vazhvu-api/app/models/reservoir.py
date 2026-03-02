from pydantic import BaseModel


class ScrapedReservoir(BaseModel):
    """A single reservoir reading scraped from CMWSSB."""

    reservoir: str
    date: str  # YYYY-MM-DD
    current_level_ft: float | None = None
    current_storage_mcft: float = 0
    capacity_mcft: float = 0
    storage_pct: float = 0
    inflow_cusecs: float = 0
    outflow_cusecs: float = 0
    rainfall_mm: float = 0


class ScrapeResult(BaseModel):
    """Result of scraping the CMWSSB lake level page."""

    date: str
    readings: list[ScrapedReservoir]


class NASAPowerDay(BaseModel):
    """A single day of weather data from NASA POWER."""

    date: str  # YYYY-MM-DD
    precipitation_mm: float
    temp_max_c: float
    temp_min_c: float
    humidity_pct: float
