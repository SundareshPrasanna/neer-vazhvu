"""
Pydantic record types for WRIS surface-water (river-level) and rainfall
telemetry. Daily aggregated; one row per (station_code, reading_date).
"""

from datetime import date

from pydantic import BaseModel


class WrisRiverLevelRecord(BaseModel):
    """Daily-aggregated river-stage reading from a single WRIS station."""

    station_code: str
    station_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    agency: str | None = None
    state: str | None = None
    district: str | None = None
    tehsil: str | None = None
    major_basin: str | None = None
    tributary: str | None = None
    acquisition_mode: str | None = None  # "Telemetric" / "Manual"
    station_status: str | None = None
    reading_date: date
    level_m: float
    reading_count: int = 0


class WrisRainfallRecord(BaseModel):
    """Daily-aggregated rainfall reading from a single WRIS station."""

    station_code: str
    station_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    agency: str | None = None
    state: str | None = None
    district: str | None = None
    tehsil: str | None = None
    major_basin: str | None = None
    tributary: str | None = None
    acquisition_mode: str | None = None
    station_status: str | None = None
    reading_date: date
    rainfall_mm: float
    reading_count: int = 0
