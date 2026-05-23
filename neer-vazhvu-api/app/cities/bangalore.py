from .types import (
    Authority,
    CityConfig,
    Coordinates,
    GeoBounds,
    LocalGovernment,
)

# Bangalore is registered but DISABLED until M1 data ingestion + M2 UI land.
# - `enabled=False` keeps the city out of list_enabled_places(), the URL
#   parser's knownCityIds set, the city switcher, and the [cityId] route
#   guard. The frontend layout 404s any non-enabled city.
# - water_sources is intentionally empty: Bangalore's supply is pumped
#   from the Cauvery 95+ km away (BWSSB Stages I-V) plus local
#   groundwater. There are no Chennai-style local reservoirs that ARE
#   the urban tap supply. The eventual hero will lead with Cauvery
#   pumping reliability, tanker dependence, and groundwater stress -
#   not a days-left math. Adding empty water_sources here would imply
#   a Chennai-shaped supply model that doesn't apply.
# - Ward count is the post-15-May-2025 GBA delimitation (369 wards
#   across 5 City Corporations, notified 19 Nov 2025).
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
    water_sources=(),
    source_name_aliases={},
    enabled=False,
)
