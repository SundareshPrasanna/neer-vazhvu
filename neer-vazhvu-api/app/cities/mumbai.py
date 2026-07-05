from .types import (
    Authority,
    CityConfig,
    Coordinates,
    GeoBounds,
    LocalGovernment,
    WaterSourceConfig,
)

# Mumbai is registered but DISABLED until M1 data ingestion + M2 UI land.
# - `enabled=False` keeps the city out of list_enabled_places(), the URL
#   parser's knownCityIds set, the city switcher, and the [cityId] route
#   guard. The frontend layout 404s any non-enabled city.
# - Ward count is the 24 BMC administrative wards (A..T). The 227 electoral
#   wards exist only as SEC PDFs (no GeoJSON, no per-ward data) and are a gap.
#
# SUPPLY MODEL - Mumbai is reservoir-impounded like Chennai (the 7 BMC lakes
# ARE the tap), so the home hero is days-left math, not Bangalore-style
# upstream-basin storage. is_primary_drinking_source=True for all 7 because
# every lake's storage is Mumbai drinking water. The lakes sit 30-130 km
# outside the city bbox (Bhatsa in Shahapur, Thane) but are tracked because
# they feed Mumbai's supply. Ulhas/Barvi serve Thane/Navi Mumbai and are
# deliberately excluded. full_capacity_mcft is converted from BMC's published
# live-storage figures (million litres / 28.317); M1 reconciles units against
# the live feed (Maharashtra WRD Pravah bulletin; BMC's own portal page is a
# feed since the official SAP portal page is a non-scrapable iView).
MUMBAI = CityConfig(
    city_id="mumbai",
    display_name="Mumbai",
    state_code="MH",
    timezone="Asia/Kolkata",
    center=Coordinates(lat=19.076, lng=72.8777),
    bbox=GeoBounds(south=18.89, north=19.28, west=72.77, east=73.0),
    primary_authority=Authority(
        code="bmc-he",
        name="BMC Hydraulic Engineer Department",
        acronym="BMC",
    ),
    local_government=LocalGovernment(
        code="bmc",
        name="Brihanmumbai Municipal Corporation",
        acronym="BMC",
        ward_count=24,
    ),
    # ~3,850 MLD drawn from the lakes against a ~4,200 MLD stated need; the
    # days-left runway uses the actual draw to match BMC's published figure.
    default_consumption_mld=3850.0,
    default_desalination_mld=None,
    water_sources=(
        WaterSourceConfig(
            source_code="bhatsa",
            display_name="Bhatsa",
            source_type="reservoir",
            full_capacity_mcft=25321.9,
            full_tank_level_ft=None,
            latitude=19.55,
            longitude=73.45,
            catchment_area_sqkm=None,
            display_order=1,
            is_primary_drinking_source=True,
        ),
        WaterSourceConfig(
            source_code="upper_vaitarna",
            display_name="Upper Vaitarna",
            source_type="reservoir",
            full_capacity_mcft=8018.1,
            full_tank_level_ft=None,
            latitude=19.95,
            longitude=73.47,
            catchment_area_sqkm=None,
            display_order=2,
            is_primary_drinking_source=True,
        ),
        WaterSourceConfig(
            source_code="middle_vaitarna",
            display_name="Middle Vaitarna",
            source_type="reservoir",
            full_capacity_mcft=6834.4,
            full_tank_level_ft=None,
            latitude=19.83,
            longitude=73.4,
            catchment_area_sqkm=None,
            display_order=3,
            is_primary_drinking_source=True,
        ),
        WaterSourceConfig(
            source_code="modak_sagar",
            display_name="Modak Sagar",
            source_type="reservoir",
            full_capacity_mcft=4552.9,
            full_tank_level_ft=None,
            latitude=19.78,
            longitude=73.18,
            catchment_area_sqkm=None,
            display_order=4,
            is_primary_drinking_source=True,
        ),
        WaterSourceConfig(
            source_code="tansa",
            display_name="Tansa",
            source_type="reservoir",
            full_capacity_mcft=5123.5,
            full_tank_level_ft=None,
            latitude=19.63,
            longitude=73.3,
            catchment_area_sqkm=None,
            display_order=5,
            is_primary_drinking_source=True,
        ),
        WaterSourceConfig(
            source_code="tulsi",
            display_name="Tulsi",
            source_type="reservoir",
            full_capacity_mcft=284.1,
            full_tank_level_ft=None,
            latitude=19.16,
            longitude=72.9,
            catchment_area_sqkm=None,
            display_order=6,
            is_primary_drinking_source=True,
        ),
        WaterSourceConfig(
            source_code="vihar",
            display_name="Vihar",
            source_type="reservoir",
            full_capacity_mcft=978.2,
            full_tank_level_ft=None,
            latitude=19.14,
            longitude=72.91,
            catchment_area_sqkm=None,
            display_order=7,
            is_primary_drinking_source=True,
        ),
    ),
    source_name_aliases={
        "bhatsa": "bhatsa",
        "भातसा": "bhatsa",
        "upper vaitarna": "upper_vaitarna",
        "middle vaitarna": "middle_vaitarna",
        "vaitarna": "upper_vaitarna",
        "modak sagar": "modak_sagar",
        "modaksagar": "modak_sagar",
        "lower vaitarna": "modak_sagar",
        "मोडकसागर": "modak_sagar",
        "tansa": "tansa",
        "तानसा": "tansa",
        "tulsi": "tulsi",
        "vihar": "vihar",
    },
    enabled=False,
)
