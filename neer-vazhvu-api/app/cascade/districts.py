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

    # Optional manual override for the methodology section's "spotlight
    # tank" example. If set, the about-page narrative uses this tank as
    # the convergence-example anchor instead of the auto-computed top
    # degree_in. Useful when the topologically highest-convergence node
    # is unnamed or less narratively meaningful than a known anchor
    # (e.g. Madurai prefers Vandiyur for the HC PIL story even though
    # an unnamed reservoir has higher degree_in).
    narrative_anchor_osm_id: int | None = None

    # OSM IDs of nodes that should be treated as terminal sinks - water
    # comes in but never flows out through the natural-cascade graph.
    # These are large engineered reservoirs / dams whose outflow is via
    # spillway or canal to a river, not via gravity to a downstream tank.
    #
    # Auto-classification by OSM's water_type=reservoir tag is not safe
    # in this region: in Madurai ~87% of cascade nodes carry that tag
    # because OSM contributors apply it to traditional kanmoi tanks as
    # well as engineered dams. Curated per district as we validate
    # against TN PWD / CMWSSB / DHAN inventories. Empty by default; the
    # graph behaves identically to V1 until populated.
    terminal_sink_osm_ids: tuple[int, ...] = ()

    # When True, an upstream tank can emit multiple outflows: the
    # steepest candidate plus any whose score_m_per_km is within
    # multi_outflow_score_tolerance of the best. Reflects the
    # historical reality that many traditional tanks had a feeder
    # channel AND a separate surplus channel. Default False preserves
    # the V1 single-outflow rule; turn on per-district once validation
    # shows the topography benefits from it (Bangalore's plateau
    # geometry is the expected first beneficiary).
    allow_multi_outflow: bool = False
    # When allow_multi_outflow is True, a candidate survives if its
    # score is at least (1 - tolerance) * best_score. Default 0.30
    # keeps "near-tied" candidates and rejects clearly inferior ones.
    multi_outflow_score_tolerance: float = 0.30

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

    def cascade_stats_json_path(self) -> Path:
        return CASCADE_OUTPUT_DIR / f"{self.district_id}-cascade-stats.json"

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
    # Vandiyur Lake. Topologically Madurai's highest-convergence node is
    # an unnamed reservoir near Kadachanenthal (degree_in=10), but the
    # public narrative anchor is Vandiyur (HC PIL R. Manibharathi v UoI).
    narrative_anchor_osm_id=1073092381,
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


_BANGALORE = DistrictCascadeConfig(
    district_id="bangalore",
    label="Bengaluru",
    state="karnataka",
    tank_polygons_path=PUBLIC_GEOJSON_DIR / "bangalore-water-bodies-current.geojson",
    rivers_path=PUBLIC_GEOJSON_DIR / "bangalore-rivers.geojson",
    # Bengaluru sits on a ridge that splits into three valleys
    # (Vrishabhavathi west, Koramangala-Challaghatta south, Hebbal
    # north). Traditional kere chains historically branched into a
    # feeder + a surplus channel - single-outflow scoring loses that.
    allow_multi_outflow=True,
    historical_eras=(
        HistoricalEra(
            era="Kempegowda",
            period_start=1537,
            period_end=1638,
            notes=(
                "Kempegowda I founded Bengaluru in 1537 and laid down the "
                "interconnected kere system on the ridge city, with each "
                "tank's surplus feeding the next. Dharmambudhi (now Majestic "
                "bus stand) and Sampangi (now Kanteerava stadium) are the "
                "canonical Kempegowda-era kere."
            ),
        ),
        HistoricalEra(
            era="Wodeyar / Hyder-Tipu",
            period_start=1638,
            period_end=1799,
            notes=(
                "Tank-building continued under the Mysore Wodeyars, Hyder "
                "Ali, and Tipu Sultan. Lalbagh tank and Ulsoor's expansion "
                "trace to this era."
            ),
        ),
        HistoricalEra(
            era="British Cantonment",
            period_start=1809,
            period_end=1947,
            notes=(
                "The Cantonment era added Sankey Tank (1882, M.C. Sankey) "
                "and Hebbal-Nagavara chain works; many older tanks were "
                "drained for parade grounds and civil station expansion."
            ),
        ),
    ),
    court_references=(
        CourtCase(
            case_id="forward-foundation-ngt-2012",
            court="National Green Tribunal (Principal Bench)",
            year=2012,
            citation_url="https://greentribunal.gov.in/",
            narrative=(
                "Forward Foundation & Praja v State of Karnataka & Ors "
                "(NGT OA 222/2014 et al.). Landmark order requiring 75 m "
                "buffer around lakes, 50 m around rajakaluves (storm "
                "drains), 30 m around secondary drains; halted Mantri "
                "and Coremind constructions on Bellandur catchment."
            ),
        ),
        CourtCase(
            case_id="karnataka-lokayukta-patil-2011",
            court="Karnataka Lokayukta (Justice N. Padmaraj Patil report)",
            year=2011,
            citation_url="https://www.lokayukta.kar.nic.in/",
            narrative=(
                "Lokayukta report on Bengaluru lake encroachments "
                "documented systemic loss of kere to civic and private "
                "construction; cited in subsequent HC and NGT proceedings."
            ),
        ),
    ),
    # Layer B expansion (named cascades + atlas refs + NGO partners) is
    # queued for a follow-up PR once the WELL Labs Bengaluru Urban Water
    # Balance dataset and the IISc kere chain inventories are joined.
)


_REGISTRY: dict[str, DistrictCascadeConfig] = {
    _MADURAI.district_id: _MADURAI,
    _CHENNAI.district_id: _CHENNAI,
    _BANGALORE.district_id: _BANGALORE,
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
