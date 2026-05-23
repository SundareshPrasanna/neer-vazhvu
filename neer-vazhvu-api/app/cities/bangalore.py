from .types import (
    Authority,
    CityConfig,
    Coordinates,
    GeoBounds,
    LocalGovernment,
    WaterSourceConfig,
)

# Bangalore is registered but DISABLED until M1 data ingestion + M2 UI land.
# - `enabled=False` keeps the city out of list_enabled_places(), the URL
#   parser's knownCityIds set, the city switcher, and the [cityId] route
#   guard. The frontend layout 404s any non-enabled city.
# - Ward count is the post-15-May-2025 GBA delimitation (369 wards across
#   5 City Corporations, notified 19 Nov 2025).
#
# water_sources are the 4 upstream Cauvery basin reservoirs (KRS,
# Hemavathi, Kabini, Harangi). These are NOT Bangalore's tap supply -
# they are the upstream basin storage that determines how much Cauvery
# water Karnataka can release for BWSSB's pumping operation at T.K.
# Halli. Mirrors Madurai's Mullaperiyar pattern (Kerala-side dam
# tracked because it feeds Madurai's supply). is_primary_drinking_source
# is False on all four because they feed irrigation, Mysore, Mandya,
# and Bangalore drinking in that order. The Bangalore home page hero
# will surface these as an upstream-basin-storage panel rather than
# Chennai-style days-left math.
BANGALORE = CityConfig(
    city_id="bangalore",
    display_name="Bengaluru",
    state_code="KA",
    timezone="Asia/Kolkata",
    center=Coordinates(lat=12.9716, lng=77.5946),
    bbox=GeoBounds(south=12.83, north=13.18, west=77.40, east=77.78),
    primary_authority=Authority(
        code="bwssb",
        name="Bangalore Water Supply and Sewerage Board",
        acronym="BWSSB",
    ),
    local_government=LocalGovernment(
        code="gba",
        name="Greater Bengaluru Authority",
        acronym="GBA",
        ward_count=369,
    ),
    default_consumption_mld=1450.0,
    default_desalination_mld=None,
    water_sources=(
        WaterSourceConfig(
            source_code="krs",
            display_name="Krishnaraja Sagar (KRS)",
            source_type="reservoir",
            full_capacity_mcft=48400.0,
            full_tank_level_ft=None,
            latitude=12.4247,
            longitude=76.5722,
            catchment_area_sqkm=10619.0,
            display_order=1,
            is_primary_drinking_source=False,
        ),
        WaterSourceConfig(
            source_code="hemavathi",
            display_name="Hemavathi (Gorur Dam)",
            source_type="reservoir",
            full_capacity_mcft=35700.0,
            full_tank_level_ft=None,
            latitude=12.5667,
            longitude=76.4500,
            catchment_area_sqkm=5410.0,
            display_order=2,
            is_primary_drinking_source=False,
        ),
        WaterSourceConfig(
            source_code="kabini",
            display_name="Kabini (Beechanahalli)",
            source_type="reservoir",
            full_capacity_mcft=19520.0,
            full_tank_level_ft=None,
            latitude=11.9735,
            longitude=76.3528,
            catchment_area_sqkm=2141.90,
            display_order=3,
            is_primary_drinking_source=False,
        ),
        WaterSourceConfig(
            source_code="harangi",
            display_name="Harangi",
            source_type="reservoir",
            full_capacity_mcft=8500.0,
            full_tank_level_ft=None,
            latitude=12.4917,
            longitude=75.9056,
            catchment_area_sqkm=419.58,
            display_order=4,
            is_primary_drinking_source=False,
        ),
    ),
    source_name_aliases={
        "krs": "krs",
        "krishna raja sagar": "krs",
        "krishnaraja sagar": "krs",
        "kannambadi": "krs",
        "hemavathi": "hemavathi",
        "hemavati": "hemavathi",
        "gorur": "hemavathi",
        "gorur dam": "hemavathi",
        "kabini": "kabini",
        "kapila": "kabini",
        "beechanahalli": "kabini",
        "bichanahalli": "kabini",
        "harangi": "harangi",
    },
    enabled=False,
)
