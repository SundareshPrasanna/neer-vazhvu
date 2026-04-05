from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from statistics import mean
from typing import Any

from app.gee.client import initialize_earth_engine
from app.gee.config import (
    CHIRPS_BAND,
    CHIRPS_DAILY_DATASET,
    CHIRPS_PIXEL_SCALE_METERS,
    CHIRPS_START_DATE,
    DEFAULT_BASELINE_YEARS,
    DEFAULT_RAIN_WINDOWS,
    PHASE1_RESERVOIRS,
    RESERVOIR_CATCHMENTS_PATH,
)

_GEOMETRY_TYPES = {"Polygon", "MultiPolygon"}
_RESERVOIR_NAME_ALIASES = {
    "poondi": "poondi",
    "redhills": "redhills",
    "red hills": "redhills",
    "puzhal": "redhills",
    "chembarambakkam": "chembarambakkam",
    "cholavaram": "cholavaram",
}


@dataclass(slots=True)
class ReservoirCatchmentFeature:
    reservoir: str
    geometry: dict[str, Any]
    properties: dict[str, Any]


@dataclass(slots=True)
class ReservoirCatchmentContextRow:
    reservoir: str
    context_date: str
    window_days: int
    rain_total_mm: float
    baseline_mm: float | None
    anomaly_pct: float | None
    context_level: str
    source_dataset: str = "chirps_daily"
    geometry_version: str | None = None


def canonicalize_reservoir_name(raw_name: Any) -> str | None:
    if not isinstance(raw_name, str):
        return None

    normalized = " ".join(
        raw_name.strip().lower().replace("_", " ").replace("-", " ").split()
    )
    return _RESERVOIR_NAME_ALIASES.get(normalized)


def window_bounds(context_date: date, window_days: int) -> tuple[date, date]:
    if window_days <= 0:
        raise RuntimeError("window_days must be positive")

    start_date = context_date - timedelta(days=window_days - 1)
    end_date_exclusive = context_date + timedelta(days=1)
    return start_date, end_date_exclusive


def calculate_anomaly_pct(
    rain_total_mm: float, baseline_mm: float | None
) -> float | None:
    if baseline_mm is None or baseline_mm < 1:
        return None
    return round(((rain_total_mm - baseline_mm) / baseline_mm) * 100, 2)


def classify_rainfall_context(anomaly_pct: float | None) -> str:
    if anomaly_pct is None:
        return "near_normal"
    if anomaly_pct <= -50:
        return "well_below"
    if anomaly_pct <= -20:
        return "below"
    if anomaly_pct < 20:
        return "near_normal"
    if anomaly_pct < 50:
        return "above"
    return "well_above"


def read_catchment_payload(catchments_path: Path | None = None) -> dict[str, Any]:
    path = catchments_path or RESERVOIR_CATCHMENTS_PATH
    if not path.exists():
        raise RuntimeError(f"Missing file: {path}")

    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("type") != "FeatureCollection":
        raise RuntimeError(f"Catchment GeoJSON must be a FeatureCollection: {path}")
    return payload


def extract_geometry_version(payload: dict[str, Any]) -> str | None:
    metadata = payload.get("metadata")
    if not isinstance(metadata, dict):
        return None

    for key in ("geometry_version", "version", "source_version"):
        value = metadata.get(key)
        if value:
            return str(value)
    return None


def load_reservoir_catchments(
    catchments_path: Path | None = None,
) -> tuple[dict[str, ReservoirCatchmentFeature], str | None]:
    payload = read_catchment_payload(catchments_path)
    features = payload.get("features", [])
    geometry_version = extract_geometry_version(payload)

    catchments: dict[str, ReservoirCatchmentFeature] = {}
    duplicates: list[str] = []
    invalid_features: list[str] = []

    for index, feature in enumerate(features):
        if not isinstance(feature, dict):
            invalid_features.append(f"feature[{index}] is not an object")
            continue

        properties = feature.get("properties")
        geometry = feature.get("geometry")
        reservoir = canonicalize_reservoir_name((properties or {}).get("reservoir"))

        if reservoir not in PHASE1_RESERVOIRS:
            invalid_features.append(
                f"feature[{index}] has unknown reservoir {(properties or {}).get('reservoir')!r}"
            )
            continue

        if (
            not isinstance(geometry, dict)
            or geometry.get("type") not in _GEOMETRY_TYPES
        ):
            invalid_features.append(
                f"feature[{index}] for {reservoir} is missing polygon geometry"
            )
            continue

        if reservoir in catchments:
            duplicates.append(reservoir)
            continue

        catchments[reservoir] = ReservoirCatchmentFeature(
            reservoir=reservoir,
            geometry=geometry,
            properties=properties or {},
        )

    missing = [name for name in PHASE1_RESERVOIRS if name not in catchments]
    if duplicates or invalid_features or missing or not catchments:
        parts: list[str] = []
        if not catchments:
            parts.append("Catchment GeoJSON has no verified features yet")
        if missing:
            parts.append(f"Missing verified catchments for: {', '.join(missing)}")
        if duplicates:
            parts.append(
                f"Duplicate reservoir features: {', '.join(sorted(set(duplicates)))}"
            )
        if invalid_features:
            parts.append("; ".join(invalid_features))
        raise RuntimeError(". ".join(parts))

    return catchments, geometry_version


def validate_reservoir_catchments(
    catchments_path: Path | None = None,
) -> dict[str, Any]:
    path = catchments_path or RESERVOIR_CATCHMENTS_PATH

    try:
        payload = read_catchment_payload(path)
    except RuntimeError as exc:
        return {
            "ok": False,
            "issue": str(exc),
            "feature_count": 0,
            "missing_reservoirs": list(PHASE1_RESERVOIRS),
            "duplicate_reservoirs": [],
            "invalid_features": [],
            "geometry_version": None,
        }

    features = payload.get("features", [])
    geometry_version = extract_geometry_version(payload)

    seen: set[str] = set()
    duplicates: list[str] = []
    invalid_features: list[str] = []

    for index, feature in enumerate(features):
        if not isinstance(feature, dict):
            invalid_features.append(f"feature[{index}] is not an object")
            continue

        properties = feature.get("properties")
        geometry = feature.get("geometry")
        reservoir = canonicalize_reservoir_name((properties or {}).get("reservoir"))

        if reservoir not in PHASE1_RESERVOIRS:
            invalid_features.append(
                f"feature[{index}] has unknown reservoir {(properties or {}).get('reservoir')!r}"
            )
            continue

        if (
            not isinstance(geometry, dict)
            or geometry.get("type") not in _GEOMETRY_TYPES
        ):
            invalid_features.append(
                f"feature[{index}] for {reservoir} is missing polygon geometry"
            )
            continue

        if reservoir in seen:
            duplicates.append(reservoir)
            continue

        seen.add(reservoir)

    missing = [name for name in PHASE1_RESERVOIRS if name not in seen]

    parts: list[str] = []
    if not features:
        parts.append("Catchment GeoJSON has no verified features yet")
    if missing:
        parts.append(f"Missing verified catchments for: {', '.join(missing)}")
    if duplicates:
        parts.append(
            f"Duplicate reservoir features: {', '.join(sorted(set(duplicates)))}"
        )
    if invalid_features:
        parts.append("; ".join(invalid_features))

    return {
        "ok": not parts,
        "issue": ". ".join(parts) if parts else None,
        "feature_count": len(features),
        "missing_reservoirs": missing,
        "duplicate_reservoirs": sorted(set(duplicates)),
        "invalid_features": invalid_features,
        "geometry_version": geometry_version,
    }


def resolve_chirps_context_date(
    chirps_collection, requested_date: date | None = None
) -> date:
    latest_millis = chirps_collection.aggregate_max("system:time_start").getInfo()
    latest_date = datetime.fromtimestamp(latest_millis / 1000, tz=UTC).date()

    if requested_date is not None and requested_date > latest_date:
        raise RuntimeError(
            f"Requested date {requested_date.isoformat()} is after latest CHIRPS data "
            f"{latest_date.isoformat()}"
        )

    return requested_date or latest_date


def shift_years(value: date, years: int) -> date:
    target_year = value.year + years
    try:
        return value.replace(year=target_year)
    except ValueError:
        return value.replace(year=target_year, month=2, day=28)


def baseline_offsets(
    context_date: date, window_days: int, baseline_years: int = DEFAULT_BASELINE_YEARS
) -> list[int]:
    start_date, _ = window_bounds(context_date, window_days)
    offsets: list[int] = []

    for offset in range(1, baseline_years + 1):
        shifted_start = shift_years(start_date, -offset)
        if shifted_start >= CHIRPS_START_DATE:
            offsets.append(offset)

    return offsets


def _window_mean_precip_mm_ee(
    ee, chirps_collection, geometry, start_date, end_date_exclusive
):
    image = chirps_collection.filterDate(start_date, end_date_exclusive).sum()
    stats = image.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=geometry,
        scale=CHIRPS_PIXEL_SCALE_METERS,
        bestEffort=True,
        maxPixels=1_000_000_000,
    )
    return ee.Number(ee.Dictionary(stats).get(CHIRPS_BAND, 0))


def compute_reservoir_context_rows(
    *,
    reference_date: date | None = None,
    baseline_years: int = DEFAULT_BASELINE_YEARS,
    window_days: tuple[int, ...] = DEFAULT_RAIN_WINDOWS,
    catchments_path: Path | None = None,
) -> dict[str, Any]:
    if baseline_years <= 0:
        raise RuntimeError("baseline_years must be positive")

    validation = validate_reservoir_catchments(catchments_path)
    if not validation["ok"]:
        raise RuntimeError(validation["issue"] or "Catchment validation failed")

    catchments, geometry_version = load_reservoir_catchments(catchments_path)
    ee = initialize_earth_engine()
    chirps_collection = ee.ImageCollection(CHIRPS_DAILY_DATASET).select(CHIRPS_BAND)
    context_date = resolve_chirps_context_date(chirps_collection, reference_date)

    rows: list[ReservoirCatchmentContextRow] = []

    for reservoir in PHASE1_RESERVOIRS:
        feature = catchments[reservoir]
        geometry = ee.Geometry(feature.geometry)

        for window in window_days:
            start_date, end_date_exclusive = window_bounds(context_date, window)
            rain_total_mm = float(
                _window_mean_precip_mm_ee(
                    ee,
                    chirps_collection,
                    geometry,
                    start_date.isoformat(),
                    end_date_exclusive.isoformat(),
                ).getInfo()
            )

            offsets = baseline_offsets(context_date, window, baseline_years)
            baseline_values: list[float] = []
            if offsets:
                start_ee = ee.Date(start_date.isoformat())
                end_ee = ee.Date(end_date_exclusive.isoformat())
                offset_list = ee.List(offsets)

                def per_offset(offset):
                    offset = ee.Number(offset)
                    historical_start = start_ee.advance(offset.multiply(-1), "year")
                    historical_end = end_ee.advance(offset.multiply(-1), "year")
                    return _window_mean_precip_mm_ee(
                        ee,
                        chirps_collection,
                        geometry,
                        historical_start,
                        historical_end,
                    )

                values = offset_list.map(per_offset).getInfo()
                baseline_values = [
                    float(value) for value in values if value is not None
                ]

            baseline_mm = round(mean(baseline_values), 2) if baseline_values else None
            rain_total_mm = round(rain_total_mm, 2)
            anomaly_pct = calculate_anomaly_pct(rain_total_mm, baseline_mm)

            rows.append(
                ReservoirCatchmentContextRow(
                    reservoir=reservoir,
                    context_date=context_date.isoformat(),
                    window_days=window,
                    rain_total_mm=rain_total_mm,
                    baseline_mm=baseline_mm,
                    anomaly_pct=anomaly_pct,
                    context_level=classify_rainfall_context(anomaly_pct),
                    geometry_version=geometry_version,
                )
            )

    return {
        "context_date": context_date.isoformat(),
        "geometry_version": geometry_version,
        "row_count": len(rows),
        "rows": rows,
    }


def upsert_reservoir_context(rows: list[ReservoirCatchmentContextRow]) -> int:
    if not rows:
        return 0

    from app.db import get_supabase

    payload = [asdict(row) for row in rows]
    get_supabase().table("reservoir_catchment_context").upsert(
        payload, on_conflict="reservoir,context_date,window_days"
    ).execute()
    return len(payload)
