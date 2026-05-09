from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from datetime import date
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))


def cmd_check_auth() -> int:
    from app.gee.client import check_auth

    result = check_auth()
    print(json.dumps(result, indent=2))
    return 0


def cmd_build_targets(write: bool, city_id: str) -> int:
    from app.gee.targets import build_phase1_targets, write_phase1_target_manifest

    if write:
        payload = write_phase1_target_manifest(city_id=city_id)
        targets = payload["targets"]
        payload = {
            "city_id": city_id,
            "target_count": payload["target_count"],
            "unnamed_target_count": sum(1 for target in targets if not target["name"]),
            "sample_targets": [target["gee_target_id"] for target in targets[:10]],
        }
    else:
        targets = build_phase1_targets(city_id=city_id)
        payload = {
            "city_id": city_id,
            "target_count": len(targets),
            "sample_targets": [target.gee_target_id for target in targets[:10]],
        }
    print(json.dumps(payload, indent=2))
    return 0


def cmd_validate_catchments(city_id: str) -> int:
    from app.gee.cities import get_city_config
    from app.gee.reservoir_context import validate_reservoir_catchments

    result = validate_reservoir_catchments(city=get_city_config(city_id))
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


def cmd_derive_catchment_candidate(
    *,
    reservoir: str,
    method: str,
    hydrobasins_level: int,
    simplify_meters: int,
    include_upstream: bool,
    point_lng: float | None,
    point_lat: float | None,
    write: bool,
    catchments_path_arg: str | None,
) -> int:
    from app.gee.catchment_derivation import (
        derive_hydrobasins_catchment_feature,
        derive_merit_local_catchment_feature,
        upsert_catchment_candidate,
    )

    catchments_path = (
        Path(catchments_path_arg).expanduser().resolve()
        if catchments_path_arg
        else None
    )

    if method == "hydrobasins":
        if (point_lng is None) != (point_lat is None):
            raise RuntimeError("Provide both --point-lng and --point-lat together.")
        reference_point = (
            (point_lng, point_lat)
            if point_lng is not None and point_lat is not None
            else None
        )
        feature = derive_hydrobasins_catchment_feature(
            reservoir=reservoir,
            hydrobasins_level=hydrobasins_level,
            simplify_meters=simplify_meters,
            reference_point=reference_point,
            include_upstream=include_upstream,
        )
    elif method == "merit-local":
        if point_lng is not None or point_lat is not None:
            raise RuntimeError(
                "--point-lng/--point-lat are only supported with --method hydrobasins."
            )
        if include_upstream:
            raise RuntimeError(
                "--include-upstream is only supported with --method hydrobasins."
            )
        feature = derive_merit_local_catchment_feature(reservoir=reservoir)
    else:
        raise RuntimeError(f"Unsupported derivation method: {method}")

    if write:
        result = upsert_catchment_candidate(feature, path=catchments_path)
        payload = {
            "reservoir": feature["properties"]["reservoir"],
            "source_dataset": feature["properties"]["source_dataset"],
            "derivation_method": feature["properties"]["derivation_method"],
            "source_hybas_id": feature["properties"].get("source_hybas_id"),
            "sub_area_sqkm": feature["properties"].get("sub_area_sqkm"),
            "up_area_sqkm": feature["properties"].get("up_area_sqkm"),
            "visited_cell_count": feature["properties"].get("visited_cell_count"),
            **result,
        }
    else:
        payload = feature

    print(json.dumps(payload, indent=2))
    return 0


def cmd_run_reservoir_context(
    *,
    write: bool,
    city_id: str,
    date_arg: str | None,
    baseline_years: int,
    catchments_path_arg: str | None,
) -> int:
    from app.gee.reservoir_context import (
        compute_reservoir_context_rows,
        upsert_reservoir_context,
    )

    if date_arg:
        try:
            reference_date = date.fromisoformat(date_arg)
        except ValueError as exc:
            raise RuntimeError(
                f"Invalid --date value: {date_arg}. Use YYYY-MM-DD."
            ) from exc
    else:
        reference_date = None
    catchments_path = (
        Path(catchments_path_arg).expanduser().resolve()
        if catchments_path_arg
        else None
    )

    result = compute_reservoir_context_rows(
        city_id=city_id,
        reference_date=reference_date,
        baseline_years=baseline_years,
        catchments_path=catchments_path,
    )
    rows = result["rows"]

    if write:
        written = upsert_reservoir_context(rows)
        payload = {
            "context_date": result["context_date"],
            "geometry_version": result["geometry_version"],
            "row_count": result["row_count"],
            "written": written,
        }
    else:
        payload = {
            "context_date": result["context_date"],
            "geometry_version": result["geometry_version"],
            "row_count": result["row_count"],
            "rows": [asdict(row) for row in rows],
        }

    print(json.dumps(payload, indent=2))
    return 0


def cmd_run_water_body_summaries(
    *,
    write: bool,
    city_id: str,
    date_arg: str | None,
    lookback_days: int,
    gee_target_id: str | None,
    limit: int | None,
    target_cohort: str | None,
) -> int:
    from app.gee.water_bodies import (
        compute_water_body_summary_rows,
        upsert_water_body_summaries,
    )

    if date_arg:
        try:
            reference_date = date.fromisoformat(date_arg)
        except ValueError as exc:
            raise RuntimeError(
                f"Invalid --date value: {date_arg}. Use YYYY-MM-DD."
            ) from exc
    else:
        reference_date = None

    result = compute_water_body_summary_rows(
        city_id=city_id,
        reference_date=reference_date,
        lookback_days=lookback_days,
        gee_target_id=gee_target_id,
        limit=limit,
        target_cohort=target_cohort,
    )
    rows = result["rows"]

    if write:
        written = upsert_water_body_summaries(rows)
        payload = {
            "city_id": city_id,
            "summary_date": result["summary_date"],
            "observation_start": result["observation_start"],
            "observation_end": result["observation_end"],
            "target_count": result["target_count"],
            "written": written,
        }
    else:
        payload = {
            "city_id": city_id,
            "summary_date": result["summary_date"],
            "observation_start": result["observation_start"],
            "observation_end": result["observation_end"],
            "target_count": result["target_count"],
            "rows": [asdict(row) for row in rows],
        }

    print(json.dumps(payload, indent=2))
    return 0


def cmd_backfill_water_body_summaries(
    *,
    write: bool,
    city_id: str,
    date_arg: str | None,
    months_back: int,
    lookback_days: int,
    gee_target_id: str | None,
    limit: int | None,
    target_cohort: str | None,
) -> int:
    from app.gee.water_bodies import backfill_water_body_summaries

    if date_arg:
        try:
            reference_date = date.fromisoformat(date_arg)
        except ValueError as exc:
            raise RuntimeError(
                f"Invalid --date value: {date_arg}. Use YYYY-MM-DD."
            ) from exc
    else:
        reference_date = None

    result = backfill_water_body_summaries(
        city_id=city_id,
        reference_date=reference_date,
        months_back=months_back,
        lookback_days=lookback_days,
        gee_target_id=gee_target_id,
        limit=limit,
        target_cohort=target_cohort,
        write=write,
    )
    print(json.dumps(result, indent=2))
    return 0


def cmd_build_satellite_evidence(
    *,
    write: bool,
    city_id: str,
    date_arg: str | None,
    months_back: int,
    frame_count: int,
    search_window_days: int,
    min_usable_coverage_pct: float,
    max_scene_cloud_pct: float,
    gee_target_id: str | None,
    limit: int | None,
    target_cohort: str | None,
) -> int:
    from app.gee.evidence import build_satellite_evidence

    if date_arg:
        try:
            reference_date = date.fromisoformat(date_arg)
        except ValueError as exc:
            raise RuntimeError(
                f"Invalid --date value: {date_arg}. Use YYYY-MM-DD."
            ) from exc
    else:
        reference_date = None

    result = build_satellite_evidence(
        write=write,
        city_id=city_id,
        reference_date=reference_date,
        months_back=months_back,
        frame_count=frame_count,
        search_window_days=search_window_days,
        min_usable_coverage_pct=min_usable_coverage_pct,
        max_scene_cloud_pct=max_scene_cloud_pct,
        gee_target_id=gee_target_id,
        limit=limit,
        target_cohort=target_cohort,
    )
    print(json.dumps(result, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    from app.gee.cities import DEFAULT_CITY_ID, supported_city_ids
    from app.gee.config import (
        DEFAULT_BACKFILL_MONTHS_BACK,
        DEFAULT_BASELINE_YEARS,
        DEFAULT_SATELLITE_EVIDENCE_FRAME_COUNT,
        DEFAULT_SATELLITE_EVIDENCE_MAX_SCENE_CLOUD_PCT,
        DEFAULT_SATELLITE_EVIDENCE_MIN_USABLE_COVERAGE_PCT,
        DEFAULT_SATELLITE_EVIDENCE_MONTHS_BACK,
        DEFAULT_SATELLITE_EVIDENCE_SEARCH_WINDOW_DAYS,
        DEFAULT_WATER_BODY_LOOKBACK_DAYS,
    )

    parser = argparse.ArgumentParser(description="Neer Vazhvu GEE Phase 1 helper")
    parser.add_argument(
        "--city",
        choices=list(supported_city_ids()),
        default=DEFAULT_CITY_ID,
        help=f"City scope for the pipeline. Default: {DEFAULT_CITY_ID}",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser(
        "check-auth", help="Verify Earth Engine auth and project setup"
    )

    build_targets = subparsers.add_parser(
        "build-targets", help="Preview or write the Phase 1 water-body target manifest"
    )
    build_targets.add_argument(
        "--write",
        action="store_true",
        help="Write the manifest to public/data/gee-phase1-water-body-targets.json",
    )

    subparsers.add_parser(
        "validate-catchments",
        help="Check whether verified reservoir catchment polygons are present",
    )

    derive_catchment_candidate = subparsers.add_parser(
        "derive-catchment-candidate",
        help="Derive a HydroBASINS catchment candidate for a Phase 1 reservoir",
    )
    derive_catchment_candidate.add_argument(
        "--reservoir",
        required=True,
        help="Reservoir name, for example redhills or chembarambakkam.",
    )
    derive_catchment_candidate.add_argument(
        "--method",
        choices=["hydrobasins", "merit-local"],
        default="hydrobasins",
        help="Derivation method to use. Default: hydrobasins",
    )
    derive_catchment_candidate.add_argument(
        "--hydrobasins-level",
        type=int,
        default=12,
        help="HydroBASINS level to query. Default: 12",
    )
    derive_catchment_candidate.add_argument(
        "--simplify-meters",
        type=int,
        default=250,
        help="Simplification tolerance for the derived polygon. Default: 250",
    )
    derive_catchment_candidate.add_argument(
        "--include-upstream",
        action="store_true",
        help="Union upstream HydroBASINS features that drain to the selected basin.",
    )
    derive_catchment_candidate.add_argument(
        "--point-lng",
        type=float,
        help="Optional longitude override for the reference point.",
    )
    derive_catchment_candidate.add_argument(
        "--point-lat",
        type=float,
        help="Optional latitude override for the reference point.",
    )
    derive_catchment_candidate.add_argument(
        "--catchments-path",
        dest="catchments_path_arg",
        help="Optional override path for the reservoir catchment GeoJSON.",
    )
    derive_catchment_candidate.add_argument(
        "--write",
        action="store_true",
        help="Write or replace the candidate feature in the catchments GeoJSON.",
    )

    run_reservoir_context = subparsers.add_parser(
        "run-reservoir-context",
        help="Compute Phase 1 reservoir rainfall context from CHIRPS catchments",
    )
    run_reservoir_context.add_argument(
        "--date",
        dest="date_arg",
        help="Context date in YYYY-MM-DD format. Defaults to latest CHIRPS date.",
    )
    run_reservoir_context.add_argument(
        "--baseline-years",
        type=int,
        default=DEFAULT_BASELINE_YEARS,
        help=(
            "Number of prior years to use for rainfall climatology. "
            f"Default: {DEFAULT_BASELINE_YEARS}"
        ),
    )
    run_reservoir_context.add_argument(
        "--catchments-path",
        dest="catchments_path_arg",
        help="Optional override path for the reservoir catchment GeoJSON.",
    )
    run_reservoir_context.add_argument(
        "--write",
        action="store_true",
        help="Upsert rows into Supabase instead of printing the dry-run payload.",
    )

    run_water_body_summaries = subparsers.add_parser(
        "run-water-body-summaries",
        help="Compute Phase 1 water-body satellite summaries",
    )
    run_water_body_summaries.add_argument(
        "--date",
        dest="date_arg",
        help="Reference date in YYYY-MM-DD format. Defaults to today in UTC.",
    )
    run_water_body_summaries.add_argument(
        "--lookback-days",
        type=int,
        default=DEFAULT_WATER_BODY_LOOKBACK_DAYS,
        help=f"Sentinel-2 NDWI lookback window in days. Default: {DEFAULT_WATER_BODY_LOOKBACK_DAYS}",
    )
    run_water_body_summaries.add_argument(
        "--gee-target-id",
        help="Optional single target id filter, for example osm:25394523.",
    )
    run_water_body_summaries.add_argument(
        "--limit",
        type=int,
        help="Optional target limit for QA dry-runs.",
    )
    run_water_body_summaries.add_argument(
        "--target-cohort",
        choices=["flagship-history", "all"],
        help="Optional named target cohort filter.",
    )
    run_water_body_summaries.add_argument(
        "--write",
        action="store_true",
        help="Upsert rows into Supabase instead of printing the dry-run payload.",
    )

    backfill_water_body_summaries = subparsers.add_parser(
        "backfill-water-body-summaries",
        help="Backfill monthly historical Phase 1 water-body satellite summaries",
    )
    backfill_water_body_summaries.add_argument(
        "--date",
        dest="date_arg",
        help="Reference date in YYYY-MM-DD format. Defaults to today in UTC.",
    )
    backfill_water_body_summaries.add_argument(
        "--months-back",
        type=int,
        default=DEFAULT_BACKFILL_MONTHS_BACK,
        help=f"Number of prior monthly snapshots to backfill. Default: {DEFAULT_BACKFILL_MONTHS_BACK}",
    )
    backfill_water_body_summaries.add_argument(
        "--lookback-days",
        type=int,
        default=DEFAULT_WATER_BODY_LOOKBACK_DAYS,
        help=f"Sentinel-2 NDWI lookback window in days. Default: {DEFAULT_WATER_BODY_LOOKBACK_DAYS}",
    )
    backfill_water_body_summaries.add_argument(
        "--gee-target-id",
        help="Optional single target id filter, for example osm:25394523.",
    )
    backfill_water_body_summaries.add_argument(
        "--limit",
        type=int,
        help="Optional target limit for QA dry-runs.",
    )
    backfill_water_body_summaries.add_argument(
        "--target-cohort",
        choices=["flagship-history", "all"],
        help="Optional named target cohort filter.",
    )
    backfill_water_body_summaries.add_argument(
        "--write",
        action="store_true",
        help="Upsert rows into Supabase instead of printing the dry-run payload.",
    )

    build_satellite_evidence = subparsers.add_parser(
        "build-satellite-evidence",
        help="Build curated Sentinel-2 evidence frames for flagship water bodies",
    )
    build_satellite_evidence.add_argument(
        "--date",
        dest="date_arg",
        help="Reference date in YYYY-MM-DD format. Defaults to today in UTC.",
    )
    build_satellite_evidence.add_argument(
        "--months-back",
        type=int,
        default=DEFAULT_SATELLITE_EVIDENCE_MONTHS_BACK,
        help=f"Months of history to sample for evidence selection. Default: {DEFAULT_SATELLITE_EVIDENCE_MONTHS_BACK}",
    )
    build_satellite_evidence.add_argument(
        "--frame-count",
        type=int,
        default=DEFAULT_SATELLITE_EVIDENCE_FRAME_COUNT,
        help=f"Maximum reviewed frames to select per target. Default: {DEFAULT_SATELLITE_EVIDENCE_FRAME_COUNT}",
    )
    build_satellite_evidence.add_argument(
        "--search-window-days",
        type=int,
        default=DEFAULT_SATELLITE_EVIDENCE_SEARCH_WINDOW_DAYS,
        help=(
            "How far back from each reference month to search for a usable Sentinel-2 scene. "
            f"Default: {DEFAULT_SATELLITE_EVIDENCE_SEARCH_WINDOW_DAYS}"
        ),
    )
    build_satellite_evidence.add_argument(
        "--min-usable-coverage-pct",
        type=float,
        default=DEFAULT_SATELLITE_EVIDENCE_MIN_USABLE_COVERAGE_PCT,
        help=(
            "Minimum cloud-masked usable coverage needed to keep a frame. "
            f"Default: {DEFAULT_SATELLITE_EVIDENCE_MIN_USABLE_COVERAGE_PCT}"
        ),
    )
    build_satellite_evidence.add_argument(
        "--max-scene-cloud-pct",
        type=float,
        default=DEFAULT_SATELLITE_EVIDENCE_MAX_SCENE_CLOUD_PCT,
        help=(
            "Preferred maximum Sentinel-2 scene cloud percentage before falling back to any scene. "
            f"Default: {DEFAULT_SATELLITE_EVIDENCE_MAX_SCENE_CLOUD_PCT}"
        ),
    )
    build_satellite_evidence.add_argument(
        "--gee-target-id",
        help="Optional single target id filter, for example osm:25453624.",
    )
    build_satellite_evidence.add_argument(
        "--limit",
        type=int,
        help="Optional target limit for QA dry-runs.",
    )
    build_satellite_evidence.add_argument(
        "--target-cohort",
        choices=["flagship-history", "all"],
        default="flagship-history",
        help="Named target cohort to build evidence for. Default: flagship-history",
    )
    build_satellite_evidence.add_argument(
        "--write",
        action="store_true",
        help="Upload assets and upsert metadata instead of printing the dry-run payload.",
    )

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        if args.command == "check-auth":
            return cmd_check_auth()
        if args.command == "build-targets":
            return cmd_build_targets(write=args.write, city_id=args.city)
        if args.command == "validate-catchments":
            return cmd_validate_catchments(city_id=args.city)
        if args.command == "derive-catchment-candidate":
            return cmd_derive_catchment_candidate(
                reservoir=args.reservoir,
                method=args.method,
                hydrobasins_level=args.hydrobasins_level,
                simplify_meters=args.simplify_meters,
                include_upstream=args.include_upstream,
                point_lng=args.point_lng,
                point_lat=args.point_lat,
                write=args.write,
                catchments_path_arg=args.catchments_path_arg,
            )
        if args.command == "run-reservoir-context":
            return cmd_run_reservoir_context(
                write=args.write,
                city_id=args.city,
                date_arg=args.date_arg,
                baseline_years=args.baseline_years,
                catchments_path_arg=args.catchments_path_arg,
            )
        if args.command == "run-water-body-summaries":
            return cmd_run_water_body_summaries(
                write=args.write,
                city_id=args.city,
                date_arg=args.date_arg,
                lookback_days=args.lookback_days,
                gee_target_id=args.gee_target_id,
                limit=args.limit,
                target_cohort=args.target_cohort,
            )
        if args.command == "backfill-water-body-summaries":
            return cmd_backfill_water_body_summaries(
                write=args.write,
                city_id=args.city,
                date_arg=args.date_arg,
                months_back=args.months_back,
                lookback_days=args.lookback_days,
                gee_target_id=args.gee_target_id,
                limit=args.limit,
                target_cohort=args.target_cohort,
            )
        if args.command == "build-satellite-evidence":
            return cmd_build_satellite_evidence(
                write=args.write,
                city_id=args.city,
                date_arg=args.date_arg,
                months_back=args.months_back,
                frame_count=args.frame_count,
                search_window_days=args.search_window_days,
                min_usable_coverage_pct=args.min_usable_coverage_pct,
                max_scene_cloud_pct=args.max_scene_cloud_pct,
                gee_target_id=args.gee_target_id,
                limit=args.limit,
                target_cohort=args.target_cohort,
            )
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    parser.error(f"Unknown command: {args.command}")
    return 2


if __name__ == "__main__":
    sys.exit(main())
