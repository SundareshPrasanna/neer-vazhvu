from pydantic import BaseModel


class WaterBodyCensusRecord(BaseModel):
    """A single water body from the First Census of Water Bodies (2018-19)."""

    census_code: str | None = None
    name: str | None = None
    district: str = "CHENNAI"
    taluk: str | None = None
    block: str | None = None
    village: str | None = None
    ward_name: str | None = None
    water_body_type: str | None = None
    nature: str | None = None  # Man-made / Natural
    ownership: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    storage_capacity_original: float | None = None
    storage_capacity_present: float | None = None
    max_depth_m: float | None = None
    water_spread_area: float | None = None
    construction_year: int | None = None
    renovation_year: int | None = None
    basin: str | None = None
    sub_basin: str | None = None
    is_in_use: bool | None = None
    encroachment_status: str | None = None
    encroachment_pct: float | None = None
