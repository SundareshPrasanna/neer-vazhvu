from .chennai import CHENNAI
from .types import CityConfig

_REGISTRY: dict[str, CityConfig] = {
    CHENNAI.city_id: CHENNAI,
}

DEFAULT_CITY_ID = CHENNAI.city_id


def get_city_config(city_id: str = DEFAULT_CITY_ID) -> CityConfig:
    config = _REGISTRY.get(city_id)
    if config is None:
        raise ValueError(f"Unknown city: {city_id}")
    return config


def try_get_city_config(city_id: str) -> CityConfig | None:
    return _REGISTRY.get(city_id)


def list_enabled_cities() -> list[CityConfig]:
    return list(_REGISTRY.values())
