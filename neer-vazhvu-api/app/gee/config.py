from __future__ import annotations

from datetime import date
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
PUBLIC_DIR = REPO_ROOT / "public"
PUBLIC_DATA_DIR = PUBLIC_DIR / "data"
PUBLIC_GEOJSON_DIR = PUBLIC_DIR / "geojson"
# Committed pipeline inputs that are deliberately NOT shipped as public
# static assets (see pipeline-inputs/README.md).
PIPELINE_INPUTS_DIR = REPO_ROOT / "pipeline-inputs"

CHIRPS_DAILY_DATASET = "UCSB-CHG/CHIRPS/DAILY"
CHIRPS_BAND = "precipitation"
CHIRPS_PIXEL_SCALE_METERS = 5566
CHIRPS_START_DATE = date(1981, 1, 1)

DEFAULT_RAIN_WINDOWS = (7, 30, 90)
DEFAULT_BASELINE_YEARS = 20

JRC_MONTHLY_RECURRENCE_DATASET = "JRC/GSW1_4/MonthlyRecurrence"
JRC_MONTHLY_RECURRENCE_BAND = "monthly_recurrence"
JRC_PIXEL_SCALE_METERS = 30

DEFAULT_WATER_BODY_LOOKBACK_DAYS = 45
DEFAULT_WATER_BODY_MIN_VALID_PCT = 40.0
DEFAULT_PERSISTENCE_PRESENCE_FRACTION = 0.15
DEFAULT_PERSISTENCE_MIN_AREA_HA = 1.0
DEFAULT_BACKFILL_MONTHS_BACK = 24
MAX_OBSERVATION_METADATA_IMAGE_SCANS = 15

SENTINEL2_HARMONIZED_DATASET = "COPERNICUS/S2_HARMONIZED"
SENTINEL2_SR_HARMONIZED_DATASET = "COPERNICUS/S2_SR_HARMONIZED"
SENTINEL2_TRUE_COLOR_BANDS = ("B4", "B3", "B2")
SENTINEL2_PIXEL_SCALE_METERS = 10
# SCL classes to mask: saturated, cloud shadows, cloud medium/high prob, thin cirrus
SENTINEL2_SCL_MASK_VALUES = (1, 3, 8, 9, 10)

# NDWI water detection - used by water_bodies.py summary pipeline (area chart).
# (Evidence pipeline removed - it's replaced by the rich-body deep-zoom panel.)
NDWI_GREEN_BAND = "B3"
NDWI_NIR_BAND = "B8"
NDWI_WATER_THRESHOLD = 0.0
