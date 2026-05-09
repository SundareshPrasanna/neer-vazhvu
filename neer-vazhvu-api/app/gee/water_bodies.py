from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from app.gee.cities import CityGeeConfig, get_city_config
from app.gee.client import initialize_earth_engine
from app.gee.config import (
    DEFAULT_PERSISTENCE_MIN_AREA_HA,
    DEFAULT_PERSISTENCE_PRESENCE_FRACTION,
    DEFAULT_WATER_BODY_LOOKBACK_DAYS,
    DEFAULT_WATER_BODY_MIN_VALID_PCT,
    JRC_MONTHLY_RECURRENCE_BAND,
    JRC_MONTHLY_RECURRENCE_DATASET,
    JRC_PIXEL_SCALE_METERS,
    MAX_OBSERVATION_METADATA_IMAGE_SCANS,
    NDWI_GREEN_BAND,
    NDWI_NIR_BAND,
    NDWI_WATER_THRESHOLD,
    SENTINEL2_PIXEL_SCALE_METERS,
    SENTINEL2_SCL_MASK_VALUES,
    SENTINEL2_SR_HARMONIZED_DATASET,
)

_GEOMETRY_TYPES = {"Polygon", "MultiPolygon"}
_MONTHS = tuple(range(1, 13))


@dataclass(slots=True)
class Phase1WaterBodyTargetFeature:
    gee_target_id: str
    osm_id: int
    census_id: int | None
    name: str
    water_type: str
    area_ha: float
    priority_level: str
    priority_score: float
    centroid: list[float]
    include_reason: str
    geometry: dict[str, Any]


@dataclass(slots=True)
class WaterBodySatelliteSummaryRow:
    gee_target_id: str
    summary_date: str
    osm_id: int | None = None
    census_id: int | None = None
    name: str | None = None
    historical_persistence_pct: float | None = None
    latest_observed_area_ha: float | None = None
    seasonal_baseline_area_ha: float | None = None
    anomaly_ratio: float | None = None
    surface_water_anomaly_level: str = "near_normal"
    observation_start: str | None = None
    observation_end: str | None = None
    sensor_source: str = "sentinel2_ndwi"
    confidence_level: str = "medium"
    valid_pixel_pct: float | None = None


@dataclass(slots=True)
class WaterBodyObservationMetadata:
    latest_valid_date: str | None = None
    latest_valid_month: int | None = None


def filter_targets_for_cohort(
    targets: list[Phase1WaterBodyTargetFeature],
    *,
    cohort: str | None,
    city: CityGeeConfig | None = None,
) -> list[Phase1WaterBodyTargetFeature]:
    if cohort is None or cohort == "all":
        return targets
    if cohort != "flagship-history":
        raise RuntimeError(f"Unsupported target cohort: {cohort}")

    city_config = city or get_city_config()
    cohort_ids = set(city_config.flagship_history_cohort)
    filtered_targets = [
        target for target in targets if target.gee_target_id in cohort_ids
    ]
    if not filtered_targets:
        raise RuntimeError(
            f"No Phase 1 water-body targets found for cohort {cohort} "
            f"in city {city_config.city_id}"
        )
    return filtered_targets


def month_end_for_date(value: date) -> date:
    if value.month == 12:
        return date(value.year + 1, 1, 1) - timedelta(days=1)
    return date(value.year, value.month + 1, 1) - timedelta(days=1)


def previous_month_end(value: date) -> date:
    return date(value.year, value.month, 1) - timedelta(days=1)


def build_monthly_backfill_reference_dates(
    *,
    reference_date: date,
    months_back: int,
    include_reference_date: bool = True,
) -> list[date]:
    if months_back <= 0:
        raise RuntimeError("months_back must be positive")

    dates: list[date] = []
    if include_reference_date:
        dates.append(reference_date)
        cursor = previous_month_end(reference_date)
    else:
        cursor = month_end_for_date(reference_date)

    for _ in range(months_back):
        dates.append(cursor)
        cursor = previous_month_end(cursor)

    return dates


def read_phase1_target_payload(
    path: Path | None = None,
    *,
    city: CityGeeConfig | None = None,
) -> dict[str, Any]:
    if path is None:
        city_config = city or get_city_config()
        path = city_config.phase1_targets_path
    payload_path = path.expanduser().resolve()
    if not payload_path.exists():
        raise RuntimeError(f"Missing file: {payload_path}")

    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    if not isinstance(payload.get("targets"), list):
        raise RuntimeError(f"Invalid Phase 1 target manifest: {payload_path}")
    return payload


def _read_current_water_bodies_payload(
    path: Path | None = None,
    *,
    city: CityGeeConfig | None = None,
) -> dict[str, Any]:
    if path is None:
        city_config = city or get_city_config()
        path = city_config.current_water_bodies_path
    payload_path = path.expanduser().resolve()
    if not payload_path.exists():
        raise RuntimeError(f"Missing file: {payload_path}")

    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    if payload.get("type") != "FeatureCollection":
        raise RuntimeError(
            f"Water-body GeoJSON must be a FeatureCollection: {payload_path}"
        )
    return payload


def load_phase1_target_features(
    *,
    city_id: str | None = None,
    manifest_path: Path | None = None,
    water_bodies_path: Path | None = None,
    gee_target_id: str | None = None,
    limit: int | None = None,
) -> list[Phase1WaterBodyTargetFeature]:
    city = get_city_config(city_id)
    manifest = read_phase1_target_payload(manifest_path, city=city)
    water_bodies_payload = _read_current_water_bodies_payload(
        water_bodies_path, city=city
    )

    geometry_by_osm_id: dict[int, dict[str, Any]] = {}
    properties_by_osm_id: dict[int, dict[str, Any]] = {}
    for feature in water_bodies_payload.get("features", []):
        properties = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        osm_id = properties.get("osm_id")
        if osm_id is None:
            continue
        if geometry.get("type") not in _GEOMETRY_TYPES:
            continue
        geometry_by_osm_id[int(osm_id)] = geometry
        properties_by_osm_id[int(osm_id)] = properties

    targets: list[Phase1WaterBodyTargetFeature] = []
    missing_geometries: list[str] = []
    for row in manifest["targets"]:
        row_target_id = str(row.get("gee_target_id") or "")
        if gee_target_id and row_target_id != gee_target_id:
            continue

        osm_id = row.get("osm_id")
        if osm_id is None:
            missing_geometries.append(row_target_id)
            continue

        geometry = geometry_by_osm_id.get(int(osm_id))
        source_properties = properties_by_osm_id.get(int(osm_id), {})
        if geometry is None:
            missing_geometries.append(row_target_id)
            continue

        targets.append(
            Phase1WaterBodyTargetFeature(
                gee_target_id=row_target_id,
                osm_id=int(osm_id),
                census_id=row.get("census_id"),
                name=str(row.get("name") or source_properties.get("name") or ""),
                water_type=str(
                    row.get("water_type") or source_properties.get("water_type") or ""
                ),
                area_ha=float(
                    row.get("area_ha") or source_properties.get("area_ha") or 0.0
                ),
                priority_level=str(row.get("priority_level") or ""),
                priority_score=float(row.get("priority_score") or 0.0),
                centroid=list(row.get("centroid") or []),
                include_reason=str(row.get("include_reason") or ""),
                geometry=geometry,
            )
        )

    if missing_geometries:
        raise RuntimeError(
            "Missing current water-body polygons for Phase 1 targets: "
            + ", ".join(sorted(missing_geometries)[:10])
        )

    if limit is not None:
        if limit <= 0:
            raise RuntimeError("limit must be positive")
        targets = targets[:limit]

    if not targets:
        label = gee_target_id or "selected filters"
        raise RuntimeError(f"No Phase 1 water-body targets found for {label}")

    return targets


def classify_surface_water_anomaly(anomaly_ratio: float | None) -> str:
    if anomaly_ratio is None:
        return "near_normal"
    if anomaly_ratio < 0.60:
        return "much_lower"
    if anomaly_ratio < 0.85:
        return "lower"
    if anomaly_ratio <= 1.15:
        return "near_normal"
    if anomaly_ratio <= 1.40:
        return "higher"
    return "much_higher"


def derive_confidence_level(
    *,
    valid_pixel_pct: float | None,
    area_ha: float,
    min_valid_pct: float = DEFAULT_WATER_BODY_MIN_VALID_PCT,
) -> str:
    if valid_pixel_pct is None or valid_pixel_pct < min_valid_pct:
        return "low"
    if valid_pixel_pct >= 80 and area_ha >= 5:
        return "high"
    return "medium"


def calculate_valid_pixel_pct(
    valid_area_ha: float | None, target_area_ha: float
) -> float | None:
    if valid_area_ha is None or target_area_ha <= 0:
        return None
    return round(min((valid_area_ha / target_area_ha) * 100, 100.0), 2)


def calculate_historical_persistence_pct(
    monthly_baseline_areas_ha: list[float],
    *,
    target_area_ha: float,
    presence_fraction: float = DEFAULT_PERSISTENCE_PRESENCE_FRACTION,
    min_presence_area_ha: float = DEFAULT_PERSISTENCE_MIN_AREA_HA,
) -> float | None:
    if not monthly_baseline_areas_ha or target_area_ha <= 0:
        return None

    threshold_area_ha = max(target_area_ha * presence_fraction, min_presence_area_ha)
    months_present = sum(
        1 for area_ha in monthly_baseline_areas_ha if area_ha >= threshold_area_ha
    )
    return round((months_present / len(monthly_baseline_areas_ha)) * 100, 2)


def _build_target_feature_collection(ee, targets: list[Phase1WaterBodyTargetFeature]):
    features = []
    for target in targets:
        geometry = ee.Geometry(target.geometry)
        features.append(
            ee.Feature(
                geometry,
                {
                    "gee_target_id": target.gee_target_id,
                    "osm_id": target.osm_id,
                    "census_id": target.census_id,
                    "name": target.name,
                    "water_type": target.water_type,
                    "area_ha": target.area_ha,
                    "priority_level": target.priority_level,
                    "priority_score": target.priority_score,
                    "include_reason": target.include_reason,
                },
            )
        )
    return ee.FeatureCollection(features)


def _reduce_sum_by_target(
    ee, image, *, targets_fc, scale_meters: int
) -> dict[str, float | None]:
    reduced = image.reduceRegions(
        collection=targets_fc,
        reducer=ee.Reducer.sum(),
        scale=scale_meters,
        tileScale=4,
    ).getInfo()

    values: dict[str, float | None] = {}
    for feature in reduced.get("features", []):
        properties = feature.get("properties") or {}
        target_id = str(properties.get("gee_target_id") or "")
        raw_value = properties.get("sum")
        values[target_id] = None if raw_value is None else float(raw_value)
    return values


def _mask_sentinel2_clouds(ee, image):
    """Mask cloud shadows, medium/high cloud probability, thin cirrus, and saturated pixels."""
    scl = image.select("SCL")
    clear_mask = ee.Image.constant(1)
    for scl_value in SENTINEL2_SCL_MASK_VALUES:
        clear_mask = clear_mask.And(scl.neq(scl_value))
    return image.updateMask(clear_mask)


def _get_sentinel2_ndwi_observation_window(
    ee,
    *,
    region_geometry,
    reference_date: date,
    lookback_days: int,
) -> tuple[Any, str]:
    """Build a collection of binary NDWI water masks from Sentinel-2 SR.

    Each image in the returned collection has a single ``water`` band
    (1 = water, 0 = not water) with cloudy pixels masked via SCL.
    """
    if lookback_days <= 0:
        raise RuntimeError("lookback_days must be positive")

    observation_end_exclusive = reference_date + timedelta(days=1)
    observation_start = reference_date - timedelta(days=lookback_days - 1)

    s2_collection = (
        ee.ImageCollection(SENTINEL2_SR_HARMONIZED_DATASET)
        .filterBounds(region_geometry)
        .filterDate(
            observation_start.isoformat(), observation_end_exclusive.isoformat()
        )
    )

    def _to_ndwi_water_mask(image):
        masked = _mask_sentinel2_clouds(ee, image)
        green = masked.select(NDWI_GREEN_BAND).toFloat()
        nir = masked.select(NDWI_NIR_BAND).toFloat()
        ndwi = green.subtract(nir).divide(green.add(nir))
        return (
            ndwi.gt(NDWI_WATER_THRESHOLD)
            .rename("water")
            .copyProperties(image, ["system:time_start"])
        )

    collection = s2_collection.map(_to_ndwi_water_mask)

    image_count = int(collection.size().getInfo())
    if image_count <= 0:
        raise RuntimeError(
            "No Sentinel-2 observations found for the requested window "
            f"{observation_start.isoformat()} to {reference_date.isoformat()}"
        )

    return collection, observation_start.isoformat()


def _get_latest_valid_observation_metadata_by_target(
    ee,
    *,
    targets: list[Phase1WaterBodyTargetFeature],
    water_collection,
) -> dict[str, WaterBodyObservationMetadata]:
    metadata_by_target: dict[str, WaterBodyObservationMetadata] = {
        target.gee_target_id: WaterBodyObservationMetadata() for target in targets
    }
    unresolved_target_ids = {target.gee_target_id for target in targets}
    if not unresolved_target_ids:
        return metadata_by_target

    targets_fc = _build_target_feature_collection(ee, targets)
    ordered_collection = water_collection.sort("system:time_start", False)
    image_count = int(ordered_collection.size().getInfo())
    if image_count <= 0:
        return metadata_by_target

    scan_limit = min(image_count, MAX_OBSERVATION_METADATA_IMAGE_SCANS)
    image_list = ordered_collection.toList(scan_limit)
    for index in range(scan_limit):
        if not unresolved_target_ids:
            break

        image = ee.Image(image_list.get(index))
        valid_area_by_target = _reduce_sum_by_target(
            ee,
            image.mask()
            .multiply(ee.Image.pixelArea())
            .divide(10000)
            .rename("valid_area_ha"),
            targets_fc=targets_fc,
            scale_meters=SENTINEL2_PIXEL_SCALE_METERS,
        )
        resolved_target_ids = [
            target_id
            for target_id in unresolved_target_ids
            if (valid_area_by_target.get(target_id) or 0) > 0
        ]
        if not resolved_target_ids:
            continue

        latest_valid_date = str(
            ee.Date(image.get("system:time_start")).format("YYYY-MM-dd").getInfo()
        )
        latest_valid_month = date.fromisoformat(latest_valid_date).month
        for target_id in resolved_target_ids:
            metadata_by_target[target_id] = WaterBodyObservationMetadata(
                latest_valid_date=latest_valid_date,
                latest_valid_month=latest_valid_month,
            )
            unresolved_target_ids.remove(target_id)

    return metadata_by_target


def compute_jrc_monthly_baselines(
    ee,
    *,
    targets_fc,
) -> dict[str, list[float]]:
    """Compute 12-month JRC recurrence baselines for all targets.

    Returns a dict mapping gee_target_id to a list of 12 floats
    (one baseline area_ha per calendar month, index 0 = January).

    This result is static and can be reused across snapshot dates.
    """
    monthly_baseline_areas_by_target: dict[str, list[float]] = {}
    monthly_recurrence_collection = ee.ImageCollection(JRC_MONTHLY_RECURRENCE_DATASET)
    for month in _MONTHS:
        monthly_image = (
            monthly_recurrence_collection.filter(ee.Filter.eq("month", month))
            .first()
            .select([JRC_MONTHLY_RECURRENCE_BAND])
            .divide(100)
            .multiply(ee.Image.pixelArea())
            .divide(10000)
            .rename("seasonal_baseline_area_ha")
        )
        baseline_by_target = _reduce_sum_by_target(
            ee,
            monthly_image,
            targets_fc=targets_fc,
            scale_meters=JRC_PIXEL_SCALE_METERS,
        )
        for target_id, area_ha in baseline_by_target.items():
            monthly_baseline_areas_by_target.setdefault(target_id, []).append(
                area_ha or 0.0
            )
    return monthly_baseline_areas_by_target


def compute_water_body_summary_rows(
    *,
    city_id: str | None = None,
    reference_date: date | None = None,
    lookback_days: int = DEFAULT_WATER_BODY_LOOKBACK_DAYS,
    gee_target_id: str | None = None,
    limit: int | None = None,
    target_cohort: str | None = None,
    precomputed_targets: list[Phase1WaterBodyTargetFeature] | None = None,
    precomputed_ee: Any | None = None,
    precomputed_targets_fc: Any | None = None,
    precomputed_region_geometry: Any | None = None,
    precomputed_jrc_baselines: dict[str, list[float]] | None = None,
) -> dict[str, Any]:
    city = get_city_config(city_id)
    if precomputed_targets is not None:
        targets = precomputed_targets
    else:
        targets = load_phase1_target_features(
            city_id=city.city_id, gee_target_id=gee_target_id, limit=limit
        )
        targets = filter_targets_for_cohort(targets, cohort=target_cohort, city=city)

    ee = precomputed_ee if precomputed_ee is not None else initialize_earth_engine()

    if precomputed_targets_fc is not None:
        targets_fc = precomputed_targets_fc
        region_geometry = precomputed_region_geometry
    else:
        targets_fc = _build_target_feature_collection(ee, targets)
        region_geometry = targets_fc.geometry().bounds()

    summary_reference_date = reference_date or datetime.now(UTC).date()
    water_collection, observation_start = _get_sentinel2_ndwi_observation_window(
        ee,
        region_geometry=region_geometry,
        reference_date=summary_reference_date,
        lookback_days=lookback_days,
    )

    water_area_image = (
        water_collection.mean()
        .multiply(ee.Image.pixelArea())
        .divide(10000)
        .rename("latest_observed_area_ha")
    )
    valid_area_image = (
        water_collection.mean()
        .mask()
        .multiply(ee.Image.pixelArea())
        .divide(10000)
        .rename("valid_area_ha")
    )
    latest_area_by_target = _reduce_sum_by_target(
        ee,
        water_area_image,
        targets_fc=targets_fc,
        scale_meters=SENTINEL2_PIXEL_SCALE_METERS,
    )
    valid_area_by_target = _reduce_sum_by_target(
        ee,
        valid_area_image,
        targets_fc=targets_fc,
        scale_meters=SENTINEL2_PIXEL_SCALE_METERS,
    )
    observation_metadata_by_target = _get_latest_valid_observation_metadata_by_target(
        ee,
        targets=targets,
        water_collection=water_collection,
    )

    if precomputed_jrc_baselines is not None:
        monthly_baseline_areas_by_target = precomputed_jrc_baselines
    else:
        monthly_baseline_areas_by_target = compute_jrc_monthly_baselines(
            ee, targets_fc=targets_fc
        )

    rows: list[WaterBodySatelliteSummaryRow] = []
    for target in targets:
        observation_metadata = observation_metadata_by_target.get(target.gee_target_id)
        observation_end = (
            observation_metadata.latest_valid_date if observation_metadata else None
        )
        summary_date = summary_reference_date.isoformat()
        summary_month = (
            observation_metadata.latest_valid_month
            if observation_metadata and observation_metadata.latest_valid_month
            else summary_reference_date.month
        )
        latest_observed_area_ha = latest_area_by_target.get(target.gee_target_id)
        monthly_baseline_areas_ha = monthly_baseline_areas_by_target[
            target.gee_target_id
        ]
        seasonal_baseline_area_ha = monthly_baseline_areas_ha[summary_month - 1]
        valid_area_ha = valid_area_by_target.get(target.gee_target_id)

        latest_observed_area_ha = (
            None
            if latest_observed_area_ha is None
            else round(latest_observed_area_ha, 2)
        )
        seasonal_baseline_area_ha = (
            None
            if seasonal_baseline_area_ha is None
            else round(seasonal_baseline_area_ha, 2)
        )

        valid_pixel_pct = calculate_valid_pixel_pct(valid_area_ha, target.area_ha)

        historical_persistence_pct = calculate_historical_persistence_pct(
            monthly_baseline_areas_ha,
            target_area_ha=target.area_ha,
        )

        anomaly_ratio = None
        if (
            latest_observed_area_ha is not None
            and seasonal_baseline_area_ha is not None
            and seasonal_baseline_area_ha >= 1
        ):
            anomaly_ratio = round(
                latest_observed_area_ha / seasonal_baseline_area_ha, 3
            )

        rows.append(
            WaterBodySatelliteSummaryRow(
                gee_target_id=target.gee_target_id,
                summary_date=summary_date,
                osm_id=target.osm_id,
                census_id=target.census_id,
                name=target.name or None,
                historical_persistence_pct=historical_persistence_pct,
                latest_observed_area_ha=latest_observed_area_ha,
                seasonal_baseline_area_ha=seasonal_baseline_area_ha,
                anomaly_ratio=anomaly_ratio,
                surface_water_anomaly_level=classify_surface_water_anomaly(
                    anomaly_ratio
                ),
                observation_start=observation_start,
                observation_end=observation_end,
                sensor_source="sentinel2_ndwi",
                confidence_level=derive_confidence_level(
                    valid_pixel_pct=valid_pixel_pct,
                    area_ha=target.area_ha,
                ),
                valid_pixel_pct=valid_pixel_pct,
            )
        )

    latest_summary_date = max(
        (row.summary_date for row in rows), default=summary_reference_date.isoformat()
    )
    latest_observation_end = max(
        (row.observation_end for row in rows if row.observation_end),
        default=None,
    )

    return {
        "summary_date": latest_summary_date,
        "observation_start": observation_start,
        "observation_end": latest_observation_end,
        "target_count": len(rows),
        "rows": rows,
    }


def upsert_water_body_summaries(rows: list[WaterBodySatelliteSummaryRow]) -> int:
    if not rows:
        return 0

    from app.db import get_supabase

    payload = [asdict(row) for row in rows]
    get_supabase().table("water_body_satellite_summary").upsert(
        payload, on_conflict="gee_target_id,summary_date"
    ).execute()
    return len(payload)


def backfill_water_body_summaries(
    *,
    city_id: str | None = None,
    reference_date: date | None = None,
    months_back: int,
    lookback_days: int = DEFAULT_WATER_BODY_LOOKBACK_DAYS,
    gee_target_id: str | None = None,
    limit: int | None = None,
    target_cohort: str | None = None,
    write: bool = False,
) -> dict[str, Any]:
    import sys
    import time

    city = get_city_config(city_id)
    history_reference_date = reference_date or datetime.now(UTC).date()
    snapshot_dates = build_monthly_backfill_reference_dates(
        reference_date=history_reference_date,
        months_back=months_back,
        include_reference_date=True,
    )

    backfill_start = time.monotonic()

    targets = load_phase1_target_features(
        city_id=city.city_id, gee_target_id=gee_target_id, limit=limit
    )
    targets = filter_targets_for_cohort(targets, cohort=target_cohort, city=city)
    ee = initialize_earth_engine()
    targets_fc = _build_target_feature_collection(ee, targets)
    region_geometry = targets_fc.geometry().bounds()

    print(
        f"[backfill] {len(targets)} targets, computing JRC baselines...",
        file=sys.stderr,
    )
    jrc_baselines = compute_jrc_monthly_baselines(ee, targets_fc=targets_fc)
    jrc_elapsed = time.monotonic() - backfill_start
    print(
        f"[backfill] JRC baselines ready ({jrc_elapsed:.1f}s), "
        f"processing {len(snapshot_dates)} snapshots...",
        file=sys.stderr,
    )

    snapshots: list[dict[str, Any]] = []
    total_rows = 0
    total_written = 0

    skipped = 0
    for idx, snapshot_date in enumerate(snapshot_dates, 1):
        snapshot_start = time.monotonic()
        try:
            result = compute_water_body_summary_rows(
                reference_date=snapshot_date,
                lookback_days=lookback_days,
                precomputed_targets=targets,
                precomputed_ee=ee,
                precomputed_targets_fc=targets_fc,
                precomputed_region_geometry=region_geometry,
                precomputed_jrc_baselines=jrc_baselines,
            )
        except RuntimeError as exc:
            cumulative_elapsed = time.monotonic() - backfill_start
            print(
                f"[backfill] {idx}/{len(snapshot_dates)} "
                f"{snapshot_date.isoformat()} - SKIPPED: {exc} "
                f"(total {cumulative_elapsed:.1f}s)",
                file=sys.stderr,
            )
            skipped += 1
            continue

        rows = result["rows"]
        written = upsert_water_body_summaries(rows) if write else 0
        total_rows += len(rows)
        total_written += written

        snapshot_elapsed = time.monotonic() - snapshot_start
        cumulative_elapsed = time.monotonic() - backfill_start
        print(
            f"[backfill] {idx}/{len(snapshot_dates)} "
            f"{snapshot_date.isoformat()} - "
            f"{len(rows)} rows "
            f"({snapshot_elapsed:.1f}s, total {cumulative_elapsed:.1f}s)",
            file=sys.stderr,
        )

        snapshots.append(
            {
                "summary_date": result["summary_date"],
                "observation_start": result["observation_start"],
                "observation_end": result["observation_end"],
                "target_count": result["target_count"],
                "written": written if write else None,
            }
        )

    total_elapsed = time.monotonic() - backfill_start
    skip_msg = f", {skipped} skipped" if skipped else ""
    print(
        f"[backfill] Done: {total_rows} rows, "
        f"{len(snapshots)} snapshots{skip_msg} in {total_elapsed:.1f}s",
        file=sys.stderr,
    )

    payload: dict[str, Any] = {
        "city_id": city.city_id,
        "reference_date": history_reference_date.isoformat(),
        "months_back": months_back,
        "snapshot_count": len(snapshots),
        "snapshot_dates": [snapshot.isoformat() for snapshot in snapshot_dates],
        "target_filter": gee_target_id,
        "target_cohort": target_cohort,
        "total_rows": total_rows,
        "elapsed_seconds": round(total_elapsed, 1),
        "snapshots": snapshots,
    }
    if write:
        payload["written"] = total_written

    return payload
