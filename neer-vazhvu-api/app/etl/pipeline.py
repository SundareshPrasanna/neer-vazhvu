"""
Daily Pipeline Orchestrator.

Replaces the 4 separate Next.js cron endpoints with a single Python orchestrator.
Steps run sequentially; each step logs to pipeline_log.
"""

import logging
import time
from collections.abc import Callable, Coroutine
from datetime import datetime, timedelta, timezone
from typing import Any

from app.db import get_supabase
from app.etl.constants import (
    CUSEC_DAY_TO_MCFT,
    DEFAULT_CONSUMPTION_MLD,
    DEFAULT_DESALINATION_MLD,
    MLD_TO_MCFT,
)
from app.etl.estimate import compute_days_left
from app.scrapers.cmwssb import scrape_cmwssb
from app.scrapers.nasa_power import fetch_nasa_power
from app.scrapers.open_meteo import fetch_open_meteo
from app.scrapers.opencity import fetch_groundwater, GROUNDWATER_RESOURCES
from app.scrapers.wris import fetch_wris_groundwater
from app.utils.timezone import ist_today

logger = logging.getLogger(__name__)


async def _run_step(
    step_name: str,
    fn: Callable[[], Coroutine[Any, Any, dict]],
    *,
    required: bool = True,
) -> dict:
    """Run a pipeline step with timing and logging."""
    supabase = get_supabase()
    today = ist_today().isoformat()
    start = time.time()

    try:
        result = await fn()
        duration_ms = int((time.time() - start) * 1000)

        supabase.table("pipeline_log").insert(
            {
                "run_date": today,
                "step": step_name,
                "status": "success",
                "rows_affected": result.get("rows_affected", 0),
                "duration_ms": duration_ms,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()

        return {
            "name": step_name,
            "status": "success",
            "duration_ms": duration_ms,
            "rows_affected": result.get("rows_affected", 0),
        }

    except Exception as e:
        duration_ms = int((time.time() - start) * 1000)
        error_msg = str(e) or repr(e)
        logger.error("Step %s failed: %s", step_name, error_msg)

        supabase.table("pipeline_log").insert(
            {
                "run_date": today,
                "step": step_name,
                "status": "error",
                "error_message": error_msg,
                "duration_ms": duration_ms,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()

        if required:
            return {
                "name": step_name,
                "status": "error",
                "duration_ms": duration_ms,
                "error": error_msg,
            }
        # Non-required steps just log and continue
        return {
            "name": step_name,
            "status": "skipped",
            "duration_ms": duration_ms,
            "error": error_msg,
        }


# --- Step implementations ---


async def _step_scrape_cmwssb() -> dict:
    """Step 1: Scrape CMWSSB for daily reservoir levels."""
    supabase = get_supabase()
    result = await scrape_cmwssb()

    rows = []
    for r in result.readings:
        rows.append(
            {
                "reservoir": r.reservoir,
                "date": r.date,
                "current_level_ft": r.current_level_ft,
                "current_storage_mcft": r.current_storage_mcft,
                "capacity_mcft": r.capacity_mcft,
                "storage_pct": r.storage_pct,
                "inflow_cusecs": r.inflow_cusecs,
                "outflow_cusecs": r.outflow_cusecs,
                "rainfall_mm": r.rainfall_mm,
                "source": "cmwssb_scrape",
            }
        )

    supabase.table("reservoir_daily").upsert(
        rows, on_conflict="reservoir,date"
    ).execute()

    return {"rows_affected": len(rows)}


async def _step_fetch_weather() -> dict:
    """Step 2: Fetch weather data (Open-Meteo primary, NASA POWER fallback).

    Open-Meteo provides same-day data with no lag and includes ET₀
    (reference evapotranspiration). NASA POWER has a 2-day lag but serves
    as a reliable fallback if Open-Meteo is unreachable.
    """
    supabase = get_supabase()
    today = ist_today()
    start_date = (today - timedelta(days=5)).isoformat()
    end_date = today.isoformat()

    source = "open_meteo"
    try:
        days = await fetch_open_meteo(start_date, end_date)
    except Exception as e:
        logger.warning("Open-Meteo failed (%s), falling back to NASA POWER", e)
        source = "nasa_power"
        # NASA POWER has a 2-day lag
        nasa_end = (today - timedelta(days=2)).isoformat()
        days = await fetch_nasa_power(start_date, nasa_end)

    rows = []
    for d in days:
        row = {
            "date": d.date,
            "precipitation_mm": d.precipitation_mm,
            "temp_max_c": d.temp_max_c,
            "temp_min_c": d.temp_min_c,
            "humidity_pct": d.humidity_pct,
            "source": source,
        }
        if d.et0_mm is not None:
            row["et0_mm"] = d.et0_mm
        if d.wind_speed_max_kmh is not None:
            row["wind_speed_max_kmh"] = d.wind_speed_max_kmh
        rows.append(row)

    if rows:
        supabase.table("weather_daily").upsert(rows, on_conflict="date").execute()

    return {"rows_affected": len(rows)}


async def _step_fetch_opencity() -> dict:
    """Step 3: Fetch OpenCity groundwater (only runs days 1-3 of month)."""
    today = ist_today()
    if today.day > 3:
        return {"rows_affected": 0}

    supabase = get_supabase()
    # Fetch the most recent year available
    latest_year = max(GROUNDWATER_RESOURCES.keys())
    records = await fetch_groundwater(latest_year)

    rows = [
        {
            "ward_number": r.ward_number,
            "ward_name": r.ward_name,
            "zone_name": r.zone_name,
            "year": r.year,
            "month": r.month,
            "depth_to_water_m": r.depth_to_water_m,
            "source": "opencity_ckan",
        }
        for r in records
    ]

    if rows:
        supabase.table("groundwater_monthly").upsert(
            rows, on_conflict="ward_number,year,month"
        ).execute()

    return {"rows_affected": len(rows)}


async def _step_fetch_wris() -> dict:
    """Fetch CGWB station-level groundwater from India WRIS API.

    Fetches both manual (seasonal) and telemetric (DWLR) readings.
    Runs weekly or on-demand. Covers the last 90 days by default to
    catch any backfilled data.
    """
    supabase = get_supabase()
    today = ist_today()
    start = today - timedelta(days=90)

    records = await fetch_wris_groundwater(start_date=start, end_date=today)

    rows = [
        {
            "station_code": r.station_code,
            "station_name": r.station_name,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "reading_date": r.reading_date.isoformat(),
            "depth_to_water_m": r.depth_to_water_m,
            "acquisition_mode": r.acquisition_mode,
            "agency": r.agency,
            "district": r.district,
            "source": "cgwb",
        }
        for r in records
    ]

    if rows:
        # Upsert in batches of 200 to avoid payload limits
        batch_size = 200
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]
            supabase.table("groundwater_wris").upsert(
                batch, on_conflict="station_code,reading_date"
            ).execute()

    return {"rows_affected": len(rows)}


async def _step_compute_estimate() -> dict:
    """Step 4: Compute daily days-left estimate."""
    supabase = get_supabase()
    today = ist_today().isoformat()

    # 1. Get latest reservoir data
    res = (
        supabase.table("reservoir_daily")
        .select("reservoir, current_storage_mcft, capacity_mcft, inflow_cusecs, date")
        .order("date", desc=True)
        .limit(12)
        .execute()
    )

    if not res.data:
        raise ValueError("No reservoir data available for estimate computation")

    most_recent_date = res.data[0]["date"]
    today_reservoirs = [r for r in res.data if r["date"] == most_recent_date]

    total_storage = sum(r["current_storage_mcft"] or 0 for r in today_reservoirs)
    total_capacity = sum(r["capacity_mcft"] or 0 for r in today_reservoirs)

    # 2. Compute 7-day rolling average inflow
    seven_days_ago = (ist_today() - timedelta(days=7)).isoformat()
    recent_res = (
        supabase.table("reservoir_daily")
        .select("date, inflow_cusecs")
        .gte("date", seven_days_ago)
        .not_.is_("inflow_cusecs", "null")
        .execute()
    )

    recent_avg_inflow_mcft_per_day = 0.0
    if recent_res.data:
        by_date: dict[str, float] = {}
        for row in recent_res.data:
            d = row["date"]
            by_date[d] = by_date.get(d, 0) + (row["inflow_cusecs"] or 0)
        daily_totals = list(by_date.values())
        avg_cusecs = sum(daily_totals) / len(daily_totals)
        recent_avg_inflow_mcft_per_day = avg_cusecs * CUSEC_DAY_TO_MCFT

    # 3. Get seasonal average inflow
    current_month = ist_today().month
    seasonal_res = supabase.rpc(
        "avg_monthly_inflow", {"target_month": current_month}
    ).execute()
    seasonal_avg = (
        seasonal_res.data[0]["avg_inflow_mcft_per_day"] if seasonal_res.data else 0
    ) or 0

    # 4. Compute
    result = compute_days_left(
        total_storage_mcft=total_storage,
        total_capacity_mcft=total_capacity,
        daily_consumption_mld=DEFAULT_CONSUMPTION_MLD,
        desalination_mld=DEFAULT_DESALINATION_MLD,
        recent_avg_inflow_mcft_per_day=recent_avg_inflow_mcft_per_day,
        seasonal_avg_inflow_mcft_per_day=seasonal_avg,
    )

    # 5. Store
    net_demand_mcft = (DEFAULT_CONSUMPTION_MLD - DEFAULT_DESALINATION_MLD) * MLD_TO_MCFT
    supabase.table("water_estimate_daily").upsert(
        {
            "date": today,
            "total_storage_mcft": total_storage,
            "total_capacity_mcft": total_capacity,
            "storage_pct": result["storage_pct"],
            "consumption_mld": DEFAULT_CONSUMPTION_MLD,
            "consumption_mcft_day": round(net_demand_mcft, 3),
            "avg_inflow_mcft_day": round(recent_avg_inflow_mcft_per_day, 3),
            "net_depletion_mcft_day": result["net_depletion_rate_mcft_per_day"],
            "days_left_pessimistic": result["pessimistic"],
            "days_left_moderate": result["moderate"],
            "days_left_optimistic": result["optimistic"],
        },
        on_conflict="date",
    ).execute()

    return {"rows_affected": 1}


async def _step_forecast() -> dict:
    """Step 5: Run reservoir forecasting."""
    from app.intelligence.forecaster import forecast_reservoirs

    results = await forecast_reservoirs()
    return {"rows_affected": len(results)}


async def _step_risk_scoring() -> dict:
    """Step 6: Compute ward risk scores."""
    from app.intelligence.risk_scorer import compute_risk_scores

    results = await compute_risk_scores()
    return {"rows_affected": len(results)}


async def _step_briefing() -> dict:
    """Step 7: Generate daily briefing."""
    from app.intelligence.briefing import generate_briefing

    await generate_briefing()
    return {"rows_affected": 1}


# --- Pipeline entry points ---


async def run_daily() -> list[dict]:
    """Run the full daily pipeline."""
    steps = []

    # Data collection
    step = await _run_step("scrape_cmwssb", _step_scrape_cmwssb)
    steps.append(step)
    if step["status"] == "error":
        return steps

    step = await _run_step("fetch_weather", _step_fetch_weather)
    steps.append(step)
    if step["status"] == "error":
        return steps

    steps.append(
        await _run_step("fetch_opencity", _step_fetch_opencity, required=False)
    )

    steps.append(
        await _run_step("fetch_wris", _step_fetch_wris, required=False)
    )

    # ETL
    step = await _run_step("compute_estimate", _step_compute_estimate)
    steps.append(step)
    if step["status"] == "error":
        return steps

    # Intelligence
    step = await _run_step("forecast", _step_forecast)
    steps.append(step)
    if step["status"] == "error":
        return steps

    step = await _run_step("briefing", _step_briefing)
    steps.append(step)

    return steps


async def run_monthly() -> list[dict]:
    """Run monthly jobs: OpenCity groundwater + risk scoring."""
    steps = []
    step = await _run_step("fetch_opencity", _step_fetch_opencity)
    steps.append(step)
    if step["status"] == "error":
        return steps

    step = await _run_step("risk_scoring", _step_risk_scoring)
    steps.append(step)
    return steps


async def run_post_scrape() -> list[dict]:
    """Run the pipeline after scraping is done externally (e.g. from GitHub Actions).

    Runs: fetch_weather → fetch_opencity → compute_estimate → forecast → briefing.
    Skips scrape_cmwssb so callers that already pushed reservoir data to the DB
    don't redundantly hit the CMWSSB website.
    """
    steps = []
    step = await _run_step("fetch_weather", _step_fetch_weather)
    steps.append(step)
    if step["status"] == "error":
        return steps

    steps.append(
        await _run_step("fetch_opencity", _step_fetch_opencity, required=False)
    )

    steps.append(
        await _run_step("fetch_wris", _step_fetch_wris, required=False)
    )

    step = await _run_step("compute_estimate", _step_compute_estimate)
    steps.append(step)
    if step["status"] == "error":
        return steps

    step = await _run_step("forecast", _step_forecast)
    steps.append(step)
    if step["status"] == "error":
        return steps

    step = await _run_step("briefing", _step_briefing)
    steps.append(step)
    return steps


async def run_wris_fetch() -> list[dict]:
    """Fetch WRIS groundwater data (on-demand or weekly)."""
    steps = []
    step = await _run_step("fetch_wris", _step_fetch_wris)
    steps.append(step)
    return steps


async def _step_fetch_census() -> dict:
    """Fetch water bodies census data from data.gov.in (one-time/periodic)."""
    from app.config import get_settings
    from app.scrapers.data_gov_in import fetch_water_bodies_census

    settings = get_settings()
    if not settings.data_gov_in_api_key:
        raise ValueError("DATA_GOV_IN_API_KEY not configured")

    supabase = get_supabase()
    records = await fetch_water_bodies_census(settings.data_gov_in_api_key)

    rows = []
    for r in records:
        orig = r.storage_capacity_original
        pres = r.storage_capacity_present
        loss_pct = None
        if orig and pres and orig > 0:
            loss_pct = round(((orig - pres) / orig) * 100, 2)
            # Clamp to NUMERIC(5,2) range: -999.99 to 999.99
            loss_pct = max(-999.99, min(999.99, loss_pct))

        rows.append(
            {
                "census_code": r.census_code,
                "name": r.name,
                "district": r.district,
                "taluk": r.taluk,
                "block": r.block,
                "village": r.village,
                "ward_name": r.ward_name,
                "water_body_type": r.water_body_type,
                "nature": r.nature,
                "ownership": r.ownership,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "storage_capacity_original": orig,
                "storage_capacity_present": pres,
                "storage_loss_pct": loss_pct,
                "max_depth_m": r.max_depth_m,
                "water_spread_area": r.water_spread_area,
                "construction_year": r.construction_year,
                "renovation_year": r.renovation_year,
                "basin": r.basin,
                "sub_basin": r.sub_basin,
                "is_in_use": r.is_in_use,
                "encroachment_status": r.encroachment_status,
                "encroachment_pct": (
                    max(-999.99, min(999.99, r.encroachment_pct))
                    if r.encroachment_pct is not None
                    else None
                ),
                "source": "data_gov_in",
            }
        )

    # Upsert in batches of 50 to isolate errors
    batch_size = 50
    total_upserted = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        try:
            supabase.table("water_bodies_census").upsert(
                batch, on_conflict="census_code"
            ).execute()
            total_upserted += len(batch)
        except Exception as batch_err:
            logger.error(
                "Census upsert batch %d–%d failed: %s",
                i,
                i + len(batch),
                batch_err,
            )
            # Try row-by-row to skip bad records
            for row in batch:
                try:
                    supabase.table("water_bodies_census").upsert(
                        [row], on_conflict="census_code"
                    ).execute()
                    total_upserted += 1
                except Exception as row_err:
                    logger.error(
                        "Census row %s failed: %s — data: %s",
                        row.get("census_code"),
                        row_err,
                        row,
                    )

    return {"rows_affected": total_upserted}


async def run_census_fetch() -> list[dict]:
    """Fetch water bodies census from data.gov.in (one-time/periodic)."""
    steps = []
    step = await _run_step("fetch_census", _step_fetch_census)
    steps.append(step)
    return steps


async def run_intelligence_only() -> list[dict]:
    """Run only intelligence steps (for backfills/manual triggers)."""
    steps = []
    step = await _run_step("forecast", _step_forecast)
    steps.append(step)
    if step["status"] == "error":
        return steps

    step = await _run_step("risk_scoring", _step_risk_scoring)
    steps.append(step)
    if step["status"] == "error":
        return steps

    step = await _run_step("briefing", _step_briefing)
    steps.append(step)
    return steps
