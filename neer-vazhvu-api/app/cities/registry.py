from .chennai import CHENNAI
from .kaveri import KAVERI
from .madurai import MADURAI
from .types import PlaceConfig

_REGISTRY: dict[str, PlaceConfig] = {
    CHENNAI.city_id: CHENNAI,
    KAVERI.city_id: KAVERI,
    MADURAI.city_id: MADURAI,
}

DEFAULT_CITY_ID = CHENNAI.city_id


def get_place_config(place_id: str = DEFAULT_CITY_ID) -> PlaceConfig:
    config = _REGISTRY.get(place_id)
    if config is None:
        raise ValueError(f"Unknown place: {place_id}")
    return config


def try_get_place_config(place_id: str) -> PlaceConfig | None:
    return _REGISTRY.get(place_id)


def list_enabled_places() -> list[PlaceConfig]:
    return list(_REGISTRY.values())
