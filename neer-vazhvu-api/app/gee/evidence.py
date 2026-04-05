from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
from shapely.geometry import box, mapping, shape

from app.gee.client import initialize_earth_engine
from app.gee.config import (
    CURRENT_WATER_BODIES_PATH,
    DEFAULT_SATELLITE_EVIDENCE_FRAME_COUNT,
    DEFAULT_SATELLITE_EVIDENCE_MAX_SCENE_CLOUD_PCT,
    DEFAULT_SATELLITE_EVIDENCE_MAX_SCENE_CANDIDATES,
    DEFAULT_SATELLITE_EVIDENCE_MIN_USABLE_COVERAGE_PCT,
    DEFAULT_SATELLITE_EVIDENCE_MONTHS_BACK,
    DEFAULT_SATELLITE_EVIDENCE_SEARCH_WINDOW_DAYS,
    DYNAMIC_WORLD_DATASET,
    DYNAMIC_WORLD_WATER_BAND,
    SATELLITE_EVIDENCE_BUCKET,
    SATELLITE_EVIDENCE_COHORT,
    SATELLITE_EVIDENCE_OVERLAY_FORMAT,
    SATELLITE_EVIDENCE_OVERLAY_OPACITY,
    SATELLITE_EVIDENCE_OVERLAY_PALETTE,
    SATELLITE_EVIDENCE_THUMB_DIMENSIONS,
    SATELLITE_EVIDENCE_TRUE_COLOR_FORMAT,
    SATELLITE_EVIDENCE_TRUE_COLOR_GAMMA,
    SATELLITE_EVIDENCE_TRUE_COLOR_MAX,
    SATELLITE_EVIDENCE_TRUE_COLOR_MIN,
    SENTINEL2_HARMONIZED_DATASET,
    SENTINEL2_PIXEL_SCALE_METERS,
    SENTINEL2_TRUE_COLOR_BANDS,
)
from app.gee.water_bodies import (
    Phase1WaterBodyTargetFeature,
    build_monthly_backfill_reference_dates,
    calculate_valid_pixel_pct,
    filter_targets_for_cohort,
    load_phase1_target_features,
)


_CLOUD_BIT = 1 << 10
_CIRRUS_BIT = 1 << 11
_MIN_BOUNDS_SPAN_DEGREES = 0.01
_BOUNDS_PADDING_RATIO = 0.08


@dataclass(slots=True)
class WaterBodySatelliteEvidenceRow:
    gee_target_id: str
    reference_date: str
    frame_date: str
    frame_rank: int
    osm_id: int | None = None
    census_id: int | None = None
    name: str | None = None
    target_cohort: str | None = None
    source_dataset: str = "sentinel2_harmonized"
    source_asset_id: str | None = None
    dynamic_world_asset_id: str | None = None
    image_path: str | None = None
    overlay_path: str | None = None
    usable_coverage_pct: float | None = None
    cloud_note: str | None = None
    geometry_version: str | None = None
    is_same_scene_as_overlay: bool = False
    is_reviewed: bool = False
    notes: str | None = None


@dataclass(slots=True)
class WaterBodySatelliteEvidenceSelection:
    row: WaterBodySatelliteEvidenceRow
    image_download_url: str | None = None
    overlay_download_url: str | None = None
    image_content_type: str = "image/jpeg"
    overlay_content_type: str | None = "image/png"


def sanitize_gee_target_id_for_path(gee_target_id: str) -> str:
    safe_chars: list[str] = []
    for char in gee_target_id.strip().lower():
        if char.isalnum():
            safe_chars.append(char)
        else:
            safe_chars.append("-")

    sanitized = "".join(safe_chars).strip("-")
    while "--" in sanitized:
        sanitized = sanitized.replace("--", "-")
    return sanitized or "unknown-target"


def build_satellite_evidence_reference_dates(
    *,
    reference_date: date,
    months_back: int = DEFAULT_SATELLITE_EVIDENCE_MONTHS_BACK,
    frame_count: int = DEFAULT_SATELLITE_EVIDENCE_FRAME_COUNT,
) -> list[date]:
    if frame_count <= 0:
        raise RuntimeError("frame_count must be positive")

    monthly_dates = build_monthly_backfill_reference_dates(
        reference_date=reference_date,
        months_back=months_back,
    )
    if len(monthly_dates) <= frame_count:
        return monthly_dates

    stride = max(1, len(monthly_dates) // frame_count)
    selected = monthly_dates[::stride]
    if len(selected) < frame_count and monthly_dates[-1] not in selected:
        selected.append(monthly_dates[-1])
    selected = selected[:frame_count]
    if not selected:
        return monthly_dates[:frame_count]
    return selected


def build_satellite_evidence_storage_path(
    *,
    gee_target_id: str,
    frame_date: date,
    variant: str,
    cohort: str = SATELLITE_EVIDENCE_COHORT,
) -> str:
    safe_target_id = sanitize_gee_target_id_for_path(gee_target_id)
    if variant == "true-color":
        extension = SATELLITE_EVIDENCE_TRUE_COLOR_FORMAT
    elif variant == "water-overlay":
        extension = SATELLITE_EVIDENCE_OVERLAY_FORMAT
    else:
        raise RuntimeError(f"Unsupported evidence asset variant: {variant}")
    return f"{cohort}/{safe_target_id}/{frame_date.isoformat()}/{variant}.{extension}"


def build_thumb_region_from_geometry(
    geometry: dict[str, Any],
    *,
    padding_ratio: float = _BOUNDS_PADDING_RATIO,
    min_span_degrees: float = _MIN_BOUNDS_SPAN_DEGREES,
) -> dict[str, Any]:
    polygon = shape(geometry)
    min_x, min_y, max_x, max_y = polygon.bounds
    span_x = max(max_x - min_x, min_span_degrees)
    span_y = max(max_y - min_y, min_span_degrees)
    pad_x = span_x * padding_ratio
    pad_y = span_y * padding_ratio

    padded_bounds = box(min_x - pad_x, min_y - pad_y, max_x + pad_x, max_y + pad_y)
    return mapping(padded_bounds)


def resolve_satellite_evidence_geometry_version(path: Path | None = None) -> str:
    return (path or CURRENT_WATER_BODIES_PATH).expanduser().resolve().stem


def _mask_sentinel2_clouds(ee, image):
    qa = image.select("QA60")
    clear_mask = qa.bitwiseAnd(_CLOUD_BIT).eq(0).And(qa.bitwiseAnd(_CIRRUS_BIT).eq(0))
    return image.updateMask(clear_mask)


def _build_target_geometry(ee, target: Phase1WaterBodyTargetFeature):
    return ee.Geometry(target.geometry)


def _calculate_sentinel_usable_coverage_pct(
    ee,
    *,
    image,
    target: Phase1WaterBodyTargetFeature,
) -> float | None:
    geometry = _build_target_geometry(ee, target)
    masked_band = image.select([SENTINEL2_TRUE_COLOR_BANDS[0]]).mask()
    valid_area_result = (
        masked_band.multiply(ee.Image.pixelArea())
        .divide(10000)
        .reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=geometry,
            scale=SENTINEL2_PIXEL_SCALE_METERS,
            maxPixels=1_000_000_000,
            tileScale=4,
        )
        .get(SENTINEL2_TRUE_COLOR_BANDS[0])
    )

    raw_value = valid_area_result.getInfo()
    valid_area_ha = None if raw_value is None else float(raw_value)
    return calculate_valid_pixel_pct(valid_area_ha, target.area_ha)


def _match_dynamic_world_metadata(ee, *, sentinel_index: str) -> dict[str, Any]:
    collection = ee.ImageCollection(DYNAMIC_WORLD_DATASET).filter(
        ee.Filter.eq("system:index", sentinel_index)
    )
    payload = ee.Dictionary(
        {
            "exists": collection.size().gt(0),
            "dynamic_world_asset_id": ee.Algorithms.If(
                collection.size().gt(0),
                ee.Image(collection.first()).id(),
                None,
            ),
        }
    ).getInfo()
    return {
        "exists": bool(payload.get("exists")),
        "dynamic_world_asset_id": payload.get("dynamic_world_asset_id"),
        "dynamic_world_image": ee.Image(collection.first())
        if payload.get("exists")
        else None,
    }


def _resolve_thumb_projection(image) -> tuple[str, list[float] | None]:
    projection_info = (
        image.select([SENTINEL2_TRUE_COLOR_BANDS[0]]).projection().getInfo()
    )
    thumb_crs = str(projection_info.get("crs") or "")
    if not thumb_crs:
        raise RuntimeError("Missing Sentinel-2 thumbnail CRS")

    raw_transform = projection_info.get("transform")
    if not isinstance(raw_transform, list):
        return thumb_crs, None

    thumb_transform = [float(value) for value in raw_transform]
    return thumb_crs, thumb_transform


def _build_thumb_request(
    *,
    thumb_region: dict[str, Any],
    thumb_crs: str,
    thumb_transform: list[float] | None,
    image_format: str,
) -> dict[str, Any]:
    request: dict[str, Any] = {
        "region": thumb_region,
        "crs": thumb_crs,
        "dimensions": SATELLITE_EVIDENCE_THUMB_DIMENSIONS,
        "format": image_format,
    }
    if thumb_transform is not None:
        request["crs_transform"] = thumb_transform
    return request


def _build_true_color_download_url(
    ee,
    *,
    image,
    thumb_region: dict[str, Any],
    thumb_crs: str,
    thumb_transform: list[float] | None,
) -> str:
    visualized = image.select(list(SENTINEL2_TRUE_COLOR_BANDS)).visualize(
        min=SATELLITE_EVIDENCE_TRUE_COLOR_MIN,
        max=SATELLITE_EVIDENCE_TRUE_COLOR_MAX,
        gamma=SATELLITE_EVIDENCE_TRUE_COLOR_GAMMA,
    )
    return str(
        visualized.getThumbURL(
            _build_thumb_request(
                thumb_region=thumb_region,
                thumb_crs=thumb_crs,
                thumb_transform=thumb_transform,
                image_format=SATELLITE_EVIDENCE_TRUE_COLOR_FORMAT,
            )
        )
    )


def _build_overlay_download_url(
    ee,
    *,
    dw_image,
    target_geometry,
    thumb_region: dict[str, Any],
    thumb_crs: str,
    thumb_transform: list[float] | None,
) -> str:
    overlay = (
        dw_image.select(DYNAMIC_WORLD_WATER_BAND)
        .gt(0.5)
        .selfMask()
        .clip(target_geometry)
        .visualize(
            min=0,
            max=1,
            palette=list(SATELLITE_EVIDENCE_OVERLAY_PALETTE),
            opacity=SATELLITE_EVIDENCE_OVERLAY_OPACITY,
        )
    )
    return str(
        overlay.getThumbURL(
            _build_thumb_request(
                thumb_region=thumb_region,
                thumb_crs=thumb_crs,
                thumb_transform=thumb_transform,
                image_format=SATELLITE_EVIDENCE_OVERLAY_FORMAT,
            )
        )
    )


def _build_candidate_sentinel_collection(
    ee,
    *,
    target: Phase1WaterBodyTargetFeature,
    target_geometry,
    reference_date: date,
    search_window_days: int,
    max_scene_cloud_pct: float,
):
    window_start = reference_date - timedelta(days=search_window_days - 1)
    window_end_exclusive = reference_date + timedelta(days=1)
    base_collection = (
        ee.ImageCollection(SENTINEL2_HARMONIZED_DATASET)
        .filterBounds(target_geometry)
        .filterDate(window_start.isoformat(), window_end_exclusive.isoformat())
    )

    filtered_collection = base_collection.filter(
        ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", max_scene_cloud_pct)
    )
    counts = ee.Dictionary(
        {
            "base_count": base_collection.size(),
            "filtered_count": filtered_collection.size(),
        }
    ).getInfo()
    filtered_count = int(counts.get("filtered_count") or 0)
    base_count = int(counts.get("base_count") or 0)
    if filtered_count <= 0 and base_count <= 0:
        return None

    collection = filtered_collection if filtered_count > 0 else base_collection
    collection = collection.sort("system:time_start", False).limit(
        DEFAULT_SATELLITE_EVIDENCE_MAX_SCENE_CANDIDATES
    )

    area_ha = max(target.area_ha, 0.01)
    reference_date_str = reference_date.isoformat()

    def annotate_candidate(image):
        masked_image = _mask_sentinel2_clouds(ee, image)
        valid_area_raw = (
            masked_image.select([SENTINEL2_TRUE_COLOR_BANDS[0]])
            .mask()
            .multiply(ee.Image.pixelArea())
            .divide(10000)
            .reduceRegion(
                reducer=ee.Reducer.sum(),
                geometry=target_geometry,
                scale=SENTINEL2_PIXEL_SCALE_METERS,
                maxPixels=1_000_000_000,
                tileScale=4,
            )
            .get(SENTINEL2_TRUE_COLOR_BANDS[0])
        )
        valid_area_ha = ee.Number(ee.Algorithms.If(valid_area_raw, valid_area_raw, 0))
        usable_coverage_pct = valid_area_ha.divide(area_ha).multiply(100).min(100)
        date_distance_days = ee.Number(
            ee.Date(reference_date_str).difference(
                ee.Date(image.get("system:time_start")), "day"
            )
        ).abs()
        cloud_pct = ee.Number(
            ee.Algorithms.If(
                image.get("CLOUDY_PIXEL_PERCENTAGE"),
                image.get("CLOUDY_PIXEL_PERCENTAGE"),
                100,
            )
        )
        ranking_score = (
            usable_coverage_pct.multiply(1000)
            .subtract(date_distance_days.multiply(10))
            .subtract(cloud_pct)
        )
        return image.set(
            {
                "usable_coverage_pct": usable_coverage_pct,
                "date_distance_days": date_distance_days,
                "scene_cloud_pct": cloud_pct,
                "ranking_score": ranking_score,
            }
        )

    return ee.ImageCollection(collection.map(annotate_candidate))


def _select_best_scene_for_reference_date(
    ee,
    *,
    target: Phase1WaterBodyTargetFeature,
    reference_date: date,
    search_window_days: int,
    min_usable_coverage_pct: float,
    max_scene_cloud_pct: float,
    include_download_urls: bool,
) -> WaterBodySatelliteEvidenceSelection | None:
    target_geometry = _build_target_geometry(ee, target)
    candidate_collection = _build_candidate_sentinel_collection(
        ee,
        target=target,
        target_geometry=target_geometry,
        reference_date=reference_date,
        search_window_days=search_window_days,
        max_scene_cloud_pct=max_scene_cloud_pct,
    )
    if candidate_collection is None:
        return None

    ranked_collection = candidate_collection.filter(
        ee.Filter.gte("usable_coverage_pct", min_usable_coverage_pct)
    ).sort("ranking_score", False)
    if int(ranked_collection.size().getInfo()) <= 0:
        return None

    best_image = ee.Image(ranked_collection.first())
    best_info = ee.Dictionary(
        {
            "frame_date": ee.Date(best_image.get("system:time_start")).format(
                "YYYY-MM-dd"
            ),
            "scene_cloud_pct": best_image.get("scene_cloud_pct"),
            "usable_coverage_pct": best_image.get("usable_coverage_pct"),
            "source_asset_id": best_image.id(),
            "source_asset_index": best_image.get("system:index"),
        }
    ).getInfo()

    frame_date = date.fromisoformat(str(best_info["frame_date"]))
    usable_coverage_pct = round(float(best_info["usable_coverage_pct"]), 2)
    source_asset_index = str(best_info["source_asset_index"])
    source_asset_id = str(best_info["source_asset_id"])
    scene_cloud_pct = float(best_info["scene_cloud_pct"])

    thumb_region = build_thumb_region_from_geometry(target.geometry)
    dynamic_world_match = _match_dynamic_world_metadata(
        ee, sentinel_index=source_asset_index
    )
    dynamic_world_asset_id = dynamic_world_match.get("dynamic_world_asset_id")
    dw_image = dynamic_world_match.get("dynamic_world_image")

    image_download_url = None
    overlay_download_url = None
    if include_download_urls:
        masked_best_image = _mask_sentinel2_clouds(ee, best_image)
        thumb_crs, thumb_transform = _resolve_thumb_projection(masked_best_image)
        image_download_url = _build_true_color_download_url(
            ee,
            image=masked_best_image,
            thumb_region=thumb_region,
            thumb_crs=thumb_crs,
            thumb_transform=thumb_transform,
        )
        if dw_image is not None:
            overlay_download_url = _build_overlay_download_url(
                ee,
                dw_image=dw_image,
                target_geometry=target_geometry,
                thumb_region=thumb_region,
                thumb_crs=thumb_crs,
                thumb_transform=thumb_transform,
            )

    row = WaterBodySatelliteEvidenceRow(
        gee_target_id=target.gee_target_id,
        reference_date=reference_date.isoformat(),
        frame_date=frame_date.isoformat(),
        frame_rank=0,
        osm_id=target.osm_id,
        census_id=target.census_id,
        name=target.name,
        target_cohort=SATELLITE_EVIDENCE_COHORT,
        source_dataset="sentinel2_harmonized",
        source_asset_id=source_asset_id,
        dynamic_world_asset_id=dynamic_world_asset_id,
        image_path=build_satellite_evidence_storage_path(
            gee_target_id=target.gee_target_id,
            frame_date=frame_date,
            variant="true-color",
        ),
        overlay_path=(
            build_satellite_evidence_storage_path(
                gee_target_id=target.gee_target_id,
                frame_date=frame_date,
                variant="water-overlay",
            )
            if dynamic_world_asset_id
            else None
        ),
        usable_coverage_pct=usable_coverage_pct,
        cloud_note=f"tile_cloud_pct={scene_cloud_pct:.1f}",
        geometry_version=resolve_satellite_evidence_geometry_version(),
        is_same_scene_as_overlay=bool(dynamic_world_asset_id),
        is_reviewed=False,
        notes=None,
    )
    return WaterBodySatelliteEvidenceSelection(
        row=row,
        image_download_url=image_download_url,
        overlay_download_url=overlay_download_url,
    )


def serialize_satellite_evidence_selection(
    selection: WaterBodySatelliteEvidenceSelection,
) -> dict[str, Any]:
    payload = asdict(selection.row)
    payload.update(
        {
            "image_download_url_present": bool(selection.image_download_url),
            "overlay_download_url_present": bool(selection.overlay_download_url),
        }
    )
    return payload


def build_satellite_evidence_selections(
    *,
    reference_date: date | None = None,
    months_back: int = DEFAULT_SATELLITE_EVIDENCE_MONTHS_BACK,
    frame_count: int = DEFAULT_SATELLITE_EVIDENCE_FRAME_COUNT,
    search_window_days: int = DEFAULT_SATELLITE_EVIDENCE_SEARCH_WINDOW_DAYS,
    min_usable_coverage_pct: float = DEFAULT_SATELLITE_EVIDENCE_MIN_USABLE_COVERAGE_PCT,
    max_scene_cloud_pct: float = DEFAULT_SATELLITE_EVIDENCE_MAX_SCENE_CLOUD_PCT,
    gee_target_id: str | None = None,
    limit: int | None = None,
    target_cohort: str | None = SATELLITE_EVIDENCE_COHORT,
    include_download_urls: bool = False,
) -> dict[str, Any]:
    build_reference_date = reference_date or datetime.now(UTC).date()
    targets = load_phase1_target_features(gee_target_id=gee_target_id, limit=limit)
    targets = filter_targets_for_cohort(targets, cohort=target_cohort)
    ee = initialize_earth_engine()

    reference_dates = build_satellite_evidence_reference_dates(
        reference_date=build_reference_date,
        months_back=months_back,
        frame_count=frame_count,
    )

    selections: list[WaterBodySatelliteEvidenceSelection] = []
    skipped: list[dict[str, Any]] = []
    for target in targets:
        target_selections: list[WaterBodySatelliteEvidenceSelection] = []
        for ref_date in reference_dates:
            selection = _select_best_scene_for_reference_date(
                ee,
                target=target,
                reference_date=ref_date,
                search_window_days=search_window_days,
                min_usable_coverage_pct=min_usable_coverage_pct,
                max_scene_cloud_pct=max_scene_cloud_pct,
                include_download_urls=include_download_urls,
            )
            if selection is None:
                skipped.append(
                    {
                        "gee_target_id": target.gee_target_id,
                        "name": target.name,
                        "reference_date": ref_date.isoformat(),
                        "reason": "no_usable_sentinel_scene",
                    }
                )
                continue
            target_selections.append(selection)

        target_selections.sort(key=lambda item: item.row.frame_date)
        for rank, selection in enumerate(target_selections, start=1):
            selection.row.frame_rank = rank
        selections.extend(target_selections)

    return {
        "build_date": build_reference_date.isoformat(),
        "target_count": len(targets),
        "reference_dates": [ref_date.isoformat() for ref_date in reference_dates],
        "selection_count": len(selections),
        "selected_rows": [
            serialize_satellite_evidence_selection(selection)
            for selection in selections
        ],
        "skipped": skipped,
        "selections": selections,
    }


def _download_bytes(url: str) -> bytes:
    response = httpx.get(url, timeout=120.0, follow_redirects=True)
    response.raise_for_status()
    return response.content


def upload_satellite_evidence_assets(
    selections: list[WaterBodySatelliteEvidenceSelection],
    *,
    bucket_name: str = SATELLITE_EVIDENCE_BUCKET,
) -> int:
    if not selections:
        return 0

    from app.db import get_supabase

    bucket = get_supabase().storage.from_(bucket_name)
    uploaded_count = 0
    for selection in selections:
        row = selection.row
        if row.image_path and selection.image_download_url:
            bucket.upload(
                row.image_path,
                _download_bytes(selection.image_download_url),
                {"content-type": selection.image_content_type, "upsert": "true"},
            )
            uploaded_count += 1
        if (
            row.overlay_path
            and selection.overlay_download_url
            and selection.overlay_content_type
        ):
            bucket.upload(
                row.overlay_path,
                _download_bytes(selection.overlay_download_url),
                {"content-type": selection.overlay_content_type, "upsert": "true"},
            )
            uploaded_count += 1
    return uploaded_count


def upsert_water_body_satellite_evidence(
    rows: list[WaterBodySatelliteEvidenceRow],
) -> int:
    if not rows:
        return 0

    from app.db import get_supabase

    payload = [asdict(row) for row in rows]
    get_supabase().table("water_body_satellite_evidence").upsert(
        payload, on_conflict="gee_target_id,reference_date"
    ).execute()
    return len(rows)


def build_satellite_evidence(
    *,
    write: bool,
    reference_date: date | None = None,
    months_back: int = DEFAULT_SATELLITE_EVIDENCE_MONTHS_BACK,
    frame_count: int = DEFAULT_SATELLITE_EVIDENCE_FRAME_COUNT,
    search_window_days: int = DEFAULT_SATELLITE_EVIDENCE_SEARCH_WINDOW_DAYS,
    min_usable_coverage_pct: float = DEFAULT_SATELLITE_EVIDENCE_MIN_USABLE_COVERAGE_PCT,
    max_scene_cloud_pct: float = DEFAULT_SATELLITE_EVIDENCE_MAX_SCENE_CLOUD_PCT,
    gee_target_id: str | None = None,
    limit: int | None = None,
    target_cohort: str | None = SATELLITE_EVIDENCE_COHORT,
) -> dict[str, Any]:
    result = build_satellite_evidence_selections(
        reference_date=reference_date,
        months_back=months_back,
        frame_count=frame_count,
        search_window_days=search_window_days,
        min_usable_coverage_pct=min_usable_coverage_pct,
        max_scene_cloud_pct=max_scene_cloud_pct,
        gee_target_id=gee_target_id,
        limit=limit,
        target_cohort=target_cohort,
        include_download_urls=write,
    )
    selections = result.pop("selections")

    if not write:
        return result

    uploaded = upload_satellite_evidence_assets(selections)
    written = upsert_water_body_satellite_evidence(
        [selection.row for selection in selections]
    )

    return {
        "build_date": result["build_date"],
        "target_count": result["target_count"],
        "reference_dates": result["reference_dates"],
        "selection_count": result["selection_count"],
        "uploaded": uploaded,
        "written": written,
        "skipped": result["skipped"],
    }
