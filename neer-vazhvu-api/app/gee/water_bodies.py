from __future__ import annotations

from dataclasses import asdict, dataclass


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
    sensor_source: str = "dynamic_world"
    confidence_level: str = "medium"
    valid_pixel_pct: float | None = None


def upsert_water_body_summaries(rows: list[WaterBodySatelliteSummaryRow]) -> int:
    if not rows:
        return 0

    from app.db import get_supabase

    payload = [asdict(row) for row in rows]
    get_supabase().table("water_body_satellite_summary").upsert(
        payload, on_conflict="gee_target_id,summary_date"
    ).execute()
    return len(payload)
