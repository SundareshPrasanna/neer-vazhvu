from __future__ import annotations

from datetime import date
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
PUBLIC_DIR = REPO_ROOT / "public"
PUBLIC_DATA_DIR = PUBLIC_DIR / "data"
PUBLIC_GEOJSON_DIR = PUBLIC_DIR / "geojson"

PHASE1_TARGETS_PATH = PUBLIC_DATA_DIR / "gee-phase1-water-body-targets.json"
RESERVOIR_CATCHMENTS_PATH = PUBLIC_GEOJSON_DIR / "chennai-reservoir-catchments.geojson"

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
