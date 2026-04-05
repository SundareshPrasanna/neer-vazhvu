from __future__ import annotations

from datetime import date
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
PUBLIC_DIR = REPO_ROOT / "public"
PUBLIC_DATA_DIR = PUBLIC_DIR / "data"
PUBLIC_GEOJSON_DIR = PUBLIC_DIR / "geojson"

PHASE1_TARGETS_PATH = PUBLIC_DATA_DIR / "gee-phase1-water-body-targets.json"
RESERVOIR_CATCHMENTS_PATH = PUBLIC_GEOJSON_DIR / "chennai-reservoir-catchments.geojson"
CURRENT_WATER_BODIES_PATH = PUBLIC_GEOJSON_DIR / "chennai-water-bodies-current.geojson"

PHASE1_RESERVOIRS = (
    "poondi",
    "redhills",
    "chembarambakkam",
    "cholavaram",
)

CHIRPS_DAILY_DATASET = "UCSB-CHG/CHIRPS/DAILY"
CHIRPS_BAND = "precipitation"
CHIRPS_PIXEL_SCALE_METERS = 5566
CHIRPS_START_DATE = date(1981, 1, 1)

DEFAULT_RAIN_WINDOWS = (7, 30, 90)
DEFAULT_BASELINE_YEARS = 20

JRC_MONTHLY_RECURRENCE_DATASET = "JRC/GSW1_4/MonthlyRecurrence"
JRC_MONTHLY_RECURRENCE_BAND = "monthly_recurrence"
JRC_PIXEL_SCALE_METERS = 30

DYNAMIC_WORLD_DATASET = "GOOGLE/DYNAMICWORLD/V1"
DYNAMIC_WORLD_WATER_BAND = "water"
DYNAMIC_WORLD_PIXEL_SCALE_METERS = 10
DEFAULT_WATER_BODY_LOOKBACK_DAYS = 45
DEFAULT_WATER_BODY_MIN_VALID_PCT = 40.0
DEFAULT_PERSISTENCE_PRESENCE_FRACTION = 0.15
DEFAULT_PERSISTENCE_MIN_AREA_HA = 1.0

FLAGSHIP_HISTORY_COHORT = (
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
)
