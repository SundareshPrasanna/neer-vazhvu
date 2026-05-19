from dataclasses import dataclass
from typing import Literal

WaterSourceType = Literal[
    "reservoir",
    "borewell_field",
    "river",
    "flow_station",
]


@dataclass(frozen=True)
class Coordinates:
    lat: float
    lng: float


@dataclass(frozen=True)
class GeoBounds:
    south: float
    north: float
    west: float
    east: float


@dataclass(frozen=True)
class Authority:
    code: str
    name: str
    acronym: str


@dataclass(frozen=True)
class LocalGovernment:
    code: str
    name: str
    acronym: str
    ward_count: int


@dataclass(frozen=True)
class WaterSourceConfig:
    source_code: str
    display_name: str
    source_type: WaterSourceType
    full_capacity_mcft: float | None
    full_tank_level_ft: float | None
    latitude: float
    longitude: float
    catchment_area_sqkm: float | None
    display_order: int
    is_primary_drinking_source: bool


@dataclass(frozen=True)
class CityConfig:
    city_id: str
    display_name: str
    state_code: str
    timezone: str
    center: Coordinates
    bbox: GeoBounds
    primary_authority: Authority
    local_government: LocalGovernment
    default_consumption_mld: float | None
    default_desalination_mld: float | None
    water_sources: tuple[WaterSourceConfig, ...]
    source_name_aliases: dict[str, str]


PlaceConfig = CityConfig
