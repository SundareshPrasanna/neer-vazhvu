from pydantic import BaseModel


class GroundwaterRecord(BaseModel):
    """A single ward groundwater measurement."""

    ward_number: int
    ward_name: str | None = None
    zone_name: str | None = None
    year: int
    month: int
    depth_to_water_m: float | None = None
