from .bangalore import BANGALORE
from .chennai import CHENNAI
from .madurai import MADURAI
from .mumbai import MUMBAI
from .types import PlaceConfig

# Registry contains every known city, enabled or not. Disabled cities are
# usable internally (data scaffolding, scrapers in progress, migrations)
# but filtered out of list_enabled_places() and out of any user-facing
# surface that calls it. Switch a city on by setting `enabled=True` on
# its CityConfig AND flipping `enabled` to TRUE in the `cities` table.
_REGISTRY: dict[str, PlaceConfig] = {
    CHENNAI.city_id: CHENNAI,
    MADURAI.city_id: MADURAI,
    BANGALORE.city_id: BANGALORE,
    MUMBAI.city_id: MUMBAI,
}

DEFAULT_CITY_ID = CHENNAI.city_id


def get_place_config(place_id: str = DEFAULT_CITY_ID) -> PlaceConfig:
    config = _REGISTRY.get(place_id)
    if config is None:
        raise ValueError(f"Unknown place: {place_id}")
    return config


def try_get_place_config(place_id: str) -> PlaceConfig | None:
    """Lookup any registered place by id, including disabled ones. Callers
    rendering user-facing surfaces must additionally check `config.enabled`
    or use list_enabled_places()."""
    return _REGISTRY.get(place_id)


def list_enabled_places() -> list[PlaceConfig]:
    """Cities visible to end users. Disabled cities are excluded."""
    return [config for config in _REGISTRY.values() if config.enabled]
