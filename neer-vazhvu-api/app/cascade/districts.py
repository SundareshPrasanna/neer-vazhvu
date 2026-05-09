"""District registry for cascade reconstruction.

Mirrors the shape of `app.gee.cities` so the cascade pipeline can scale
across districts and cities the same way the GEE pipeline does.

Two-layer separation:

- Layer A (universal, data-driven): topology from DEM, channel evidence
  from OSM + Sentinel, encroachment from Dynamic World. The pipeline runs
  these stages identically for every district.

- Layer B (curated, additive, optional): named cascades, court cases,
  atlas references, NGO partnerships, historical engineering era. Each
  district plugs in its own curation. The pipeline runs without it; the
  outputs are richer with it.

Adding a new district is exactly: drop a `DistrictCascadeConfig` entry
into `_REGISTRY`. No code changes anywhere else.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.gee.config import PUBLIC_DATA_DIR, PUBLIC_DIR, PUBLIC_GEOJSON_DIR


# All cascade outputs are precomputed and committed; no runtime DB reads.
CASCADE_OUTPUT_DIR = PUBLIC_DATA_DIR / "cascade"
CASCADE_TILE_DIR = PUBLIC_DIR / "tiles" / "cascade"


@dataclass(frozen=True, slots=True)
class NamedCascade:
    """A historically named cascade system, manually curated."""

    cascade_id: str
    name: str
    name_ta: str = ""
    narrative: str = ""
    member_tank_osm_ids: tuple[int, ...] = ()


@dataclass(frozen=True, slots=True)
class CourtCase:
    """A court case referencing one or more tanks in this district."""

    case_id: str
    court: str
    year: int
    citation_url: str
    related_tank_osm_ids: tuple[int, ...] = ()
    narrative: str = ""


@dataclass(frozen=True, slots=True)
class AtlasRef:
    """A documentary reference to a historical water-resource atlas."""

    source: str
    url: str
    page: str = ""
    related_tank_osm_ids: tuple[int, ...] = ()


@dataclass(frozen=True, slots=True)
class NGOPartner:
    """A working partnership with an NGO active in this district."""

    name: str
    role: str
    url: str = ""


@dataclass(frozen=True, slots=True)
class HistoricalEra:
    """Historical engineering era during which cascades were built."""

    era: str
    period_start: int
    period_end: int
    notes: str = ""


@dataclass(frozen=True, slots=True)
class DistrictCascadeConfig:
    """Per-district inputs and curation for the cascade pipeline.

    Layer A fields (paths, tuning) are required. Layer B fields
    (named_cascades, court_references, etc.) are optional and additive.
    """

    district_id: str
    label: str
    state: str
    tank_polygons_path: Path

    # Topology tuning (rarely overridden)
    dem_source: str = "merit_hydro"
    max_downstream_distance_km: float = 3.0
    min_tank_area_ha: float = 1.0
    # Tanks with no tank-to-tank downstream within
    # max_downstream_distance_km whose flow direction points to a river
    # within this distance are marked as draining INTO the river. Models
    # rivers as terminal sinks (water doesn't only stop at rivers, it
    # falls into them).
    max_river_outlet_distance_km: float = 2.0

    # Optional admin boundary; if absent the topology stage falls back to
    # the bounding box of tank polygons.
    admin_boundary_path: Path | None = None

    # Optional rivers GeoJSON. If present, the topology stage rejects
    # candidate cascade edges whose straight-line path crosses a river
    # LineString - water doesn't flow across rivers, it falls into them.
    rivers_path: Path | None = None

    # Layer B - curation (all optional, additive)
    named_cascades: tuple[NamedCascade, ...] = ()
    court_references: tuple[CourtCase, ...] = ()
    atlas_references: tuple[AtlasRef, ...] = ()
    ngo_partners: tuple[NGOPartner, ...] = ()
    historical_eras: tuple[HistoricalEra, ...] = ()

    def cascade_nodes_geojson_path(self) -> Path:
        return CASCADE_OUTPUT_DIR / f"{self.district_id}-cascade-nodes.geojson"

    def cascade_edges_geojson_path(self) -> Path:
        return CASCADE_OUTPUT_DIR / f"{self.district_id}-cascade-edges.geojson"

    def cascade_systems_json_path(self) -> Path:
        return CASCADE_OUTPUT_DIR / f"{self.district_id}-cascade-systems.json"

    def cascade_river_outlets_geojson_path(self) -> Path:
        return CASCADE_OUTPUT_DIR / f"{self.district_id}-cascade-river-outlets.geojson"

    def cascade_nodes_pmtiles_path(self) -> Path:
        return CASCADE_TILE_DIR / f"{self.district_id}-cascade-nodes.pmtiles"

    def cascade_edges_pmtiles_path(self) -> Path:
        return CASCADE_TILE_DIR / f"{self.district_id}-cascade-edges.pmtiles"

    def cascade_river_outlets_pmtiles_path(self) -> Path:
        return CASCADE_TILE_DIR / f"{self.district_id}-cascade-river-outlets.pmtiles"


_MADURAI = DistrictCascadeConfig(
    district_id="madurai",
    label="Madurai",
    state="tamil_nadu",
    tank_polygons_path=PUBLIC_GEOJSON_DIR / "madurai-water-bodies-current.geojson",
    rivers_path=PUBLIC_GEOJSON_DIR / "madurai-rivers.geojson",
    historical_eras=(
        HistoricalEra(
            era="Pandya",
            period_start=300,
            period_end=1300,
            notes=(
                "Most named tanks in Madurai trace to Pandya-era tank-building. "
                "Anaikondan tank (Arittapatti BHS) is canonically Pandyan."
            ),
        ),
        HistoricalEra(
            era="Nayak",
            period_start=1529,
            period_end=1736,
            notes=(
                "Vandiyur Mariamman Teppakulam was built in 1645 AD by "
                "Thirumalai Nayak; soil dug for the tank built the Mahal."
            ),
        ),
    ),
    # Layer B curation expands in P3 (named cascades, court refs, atlas refs).
)


_CHENNAI = DistrictCascadeConfig(
    district_id="chennai",
    label="Chennai",
    state="tamil_nadu",
    tank_polygons_path=PUBLIC_GEOJSON_DIR / "chennai-water-bodies-current.geojson",
    rivers_path=PUBLIC_GEOJSON_DIR / "chennai-rivers.geojson",
    # Layer B curation deferred until after Madurai validates the pipeline.
)


_REGISTRY: dict[str, DistrictCascadeConfig] = {
    _MADURAI.district_id: _MADURAI,
    _CHENNAI.district_id: _CHENNAI,
}


def get_district_cascade_config(district_id: str) -> DistrictCascadeConfig:
    resolved = (district_id or "").strip().lower()
    config = _REGISTRY.get(resolved)
    if config is None:
        supported = ", ".join(sorted(_REGISTRY))
        raise RuntimeError(
            f"Unknown district_id {district_id!r}. Supported: {supported}"
        )
    return config


def supported_district_ids() -> tuple[str, ...]:
    return tuple(sorted(_REGISTRY))
