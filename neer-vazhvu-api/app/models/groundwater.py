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
    # Well metadata (from WRIS API): helps users distinguish a 6m dug well in
    # the unconfined aquifer from a 200m bore well in a confined aquifer.
    well_type: str | None = None  # e.g. "Dug Well", "Bore Well", "Piezometer"
    well_depth_m: float | None = None  # total well depth in metres
    well_aquifer_type: str | None = (
        None  # e.g. "Unconfined", "Confined", "Semi Confined"
    )
