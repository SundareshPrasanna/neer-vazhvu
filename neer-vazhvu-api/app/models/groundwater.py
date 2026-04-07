from datetime import date

from pydantic import BaseModel


class GroundwaterRecord(BaseModel):
    """A single ward groundwater measurement."""

    ward_number: int
    ward_name: str | None = None
    zone_name: str | None = None
    year: int
    month: int
    depth_to_water_m: float | None = None


class WrisGroundwaterRecord(BaseModel):
    """A single CGWB station groundwater reading from India WRIS."""

    station_code: str
    station_name: str
    latitude: float | None = None
    longitude: float | None = None
    reading_date: date
    depth_to_water_m: float
    acquisition_mode: str = "Manual"  # "Manual" or "Telemetric"
    agency: str = "CGWB"
    state: str = "Tamil Nadu"
    district: str = "Chennai"
