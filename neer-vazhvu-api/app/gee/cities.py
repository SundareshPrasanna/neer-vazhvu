from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from types import MappingProxyType
from typing import Mapping

from app.gee.config import PUBLIC_DATA_DIR, PUBLIC_GEOJSON_DIR


DEFAULT_CITY_ID = "chennai"


@dataclass(frozen=True, slots=True)
class CityGeeConfig:
    """Per-city inputs and selection rules for the GEE pipeline.

    Each city points at its own restoration-priority JSON, current
    water-bodies GeoJSON, and a target manifest output path. The
    selection rules (name patterns, flagship cohort) are city-scoped
    because reservoir naming, cultural anchors, and shortlist of
    history-cohort polygons differ across cities.
    """

    city_id: str
    label: str
    restoration_priority_path: Path
    current_water_bodies_path: Path
    phase1_targets_path: Path
    flagship_history_cohort: tuple[str, ...]
    # Reservoir catchments / rainfall-context are Phase-1 Chennai-only
    # for now; cities without verified catchments leave this None and
    # skip the reservoir_context pipeline.
    reservoir_catchments_path: Path | None = None
    phase1_reservoirs: tuple[str, ...] = ()
    reservoir_name_aliases: Mapping[str, str] = field(
        default_factory=lambda: MappingProxyType({})
    )
    reservoir_name_patterns: tuple[str, ...] = ()
    wetland_name_patterns: tuple[str, ...] = (
        "marsh",
        "wetland",
        "backwater",
        "creek",
    )


_CHENNAI = CityGeeConfig(
    city_id="chennai",
    label="Chennai",
    restoration_priority_path=PUBLIC_DATA_DIR / "restoration-priority.json",
    current_water_bodies_path=PUBLIC_GEOJSON_DIR / "chennai-water-bodies-current.geojson",
    phase1_targets_path=PUBLIC_DATA_DIR / "gee-phase1-water-body-targets.json",
    reservoir_catchments_path=PUBLIC_GEOJSON_DIR / "chennai-reservoir-catchments.geojson",
    phase1_reservoirs=("poondi", "redhills", "chembarambakkam", "cholavaram"),
    reservoir_name_aliases=MappingProxyType(
        {
            "poondi": "poondi",
            "redhills": "redhills",
            "red hills": "redhills",
            "puzhal": "redhills",
            "chembarambakkam": "chembarambakkam",
            "cholavaram": "cholavaram",
        }
    ),
    reservoir_name_patterns=(
        "poondi",
        "red hills",
        "puzhal",
        "chembarambakkam",
        "cholavaram",
        "veeranam",
        "kannankottai",
        "thervoy",
    ),
    flagship_history_cohort=(
        "osm:25453624",  # Chembarambakkam Lake
        "osm:25394157",  # Red Hills Reservoir
        "osm:25394523",  # Sholavaram Lake
        "osm:24161888",  # Kolavai Lake
        "osm:25391800",  # Ambattur Lake
        "osm:25474612",  # Korattur Lake
        "osm:25474749",  # Retteri Lake
        "osm:1237456198",  # Ayanambakkam Tank
        "osm:30424450",  # Perumbakkam Lake
        "osm:23648233",  # Tiruneermalai Eri
        "osm:1236160012",  # Poonamallee Lake
        "osm:23633592",  # Porur Lake
    ),
)


_MADURAI = CityGeeConfig(
    city_id="madurai",
    label="Madurai",
    restoration_priority_path=PUBLIC_DATA_DIR / "restoration-priority-madurai.json",
    current_water_bodies_path=PUBLIC_GEOJSON_DIR / "madurai-water-bodies-current.geojson",
    phase1_targets_path=PUBLIC_DATA_DIR / "gee-phase1-water-body-targets-madurai.json",
    reservoir_catchments_path=None,
    phase1_reservoirs=(),
    reservoir_name_aliases=MappingProxyType({}),
    reservoir_name_patterns=(
        "vaigai",
        "manjalar",
        "sothuparai",
        "mullaperiyar",
    ),
    flagship_history_cohort=(
        "osm:13724237",  # Vaigai Dam reservoir
        "osm:51815981",  # Manjalar dam
        "osm:755424587",  # Thenkal Kanmoi
        "osm:1073092381",  # Vandiyur tank (HC PIL anchor)
        "osm:18641173",  # Madakulam tank
        "osm:870776568",  # Avaniyapuram tank (medium confidence, pending verification)
        "osm:921413067",  # Anaikondan tank (Arittapatti BHS)
        "osm:136448547",  # Sellur tank
        "osm:339279340",  # Sothuparai Dam reservoir
    ),
)


_REGISTRY: dict[str, CityGeeConfig] = {
    _CHENNAI.city_id: _CHENNAI,
    _MADURAI.city_id: _MADURAI,
}


def get_city_config(city_id: str | None = None) -> CityGeeConfig:
    resolved = (city_id or DEFAULT_CITY_ID).strip().lower()
    config = _REGISTRY.get(resolved)
    if config is None:
        supported = ", ".join(sorted(_REGISTRY))
        raise RuntimeError(
            f"Unknown city_id {city_id!r}. Supported: {supported}"
        )
    return config


def supported_city_ids() -> tuple[str, ...]:
    return tuple(sorted(_REGISTRY))
