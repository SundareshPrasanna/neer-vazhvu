#!/usr/bin/env python3
"""
AutoARIMA reservoir forecast for Madurai (Vaigai + Mullaperiyar +
Sothuparai). Reads daily storage history from reservoir_daily_v2 and
writes 14-day-ahead predictions with confidence bands to
reservoir_forecast_v2.

Mirrors neer-vazhvu-api/app/intelligence/forecaster.py but stripped of
Chennai-specific exogenous-variable handling - Madurai's chart needs the
basic predicted line + 80% confidence band; full ARIMAX with rainfall
exogenous can come in a follow-up once Vaigai basin rainfall is wired.

Usage:
    cd neer-vazhvu-api
    python scripts/compute_reservoir_forecast_madurai.py
    python scripts/compute_reservoir_forecast_madurai.py --horizon 30 --history-days 1825

Idempotent: forecasts upsert on (city_id, source_code, forecast_date,
target_date), so re-running on the same day overwrites.

Prereq: reservoir history backfill must be loaded first
(scripts/backfill_tn_pwd_reservoirs.py). At least ~365 days of daily
storage are needed for AutoARIMA to produce useful predictions; the
script logs and skips sources with too little data.
"""

import argparse
import asyncio
import os
import sys
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pandas as pd
from dotenv import load_dotenv

load_dotenv()

from supabase import create_client  # noqa: E402
from statsforecast import StatsForecast  # noqa: E402
from statsforecast.models import AutoARIMA  # noqa: E402

CITY_ID = "madurai"
DEFAULT_HORIZON_DAYS = 14
DEFAULT_HISTORY_DAYS = 1825  # 5 years if available
MIN_HISTORY_FOR_FIT = 180  # ~6 months minimum
SEASONAL_THRESHOLD_DAYS = 365 * 2
CONFIDENCE_LEVEL = 80


def _get_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        print(f"ERROR: {key} environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    return value


def _today_ist() -> date:
    return datetime.now(ZoneInfo("Asia/Kolkata")).date()


def _fetch_history(supabase, source_code: str, history_days: int) -> pd.DataFrame:
    cutoff = (_today_ist() - timedelta(days=history_days)).isoformat()
    rows: list[dict] = []
    PAGE_SIZE = 1000
    offset = 0
    safety = 30
    while safety > 0:
        result = (
            supabase.table("reservoir_daily_v2")
            .select("date, storage_tmc")
            .eq("city_id", CITY_ID)
            .eq("source_code", source_code)
            .gte("date", cutoff)
            .order("date", desc=False)
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        data = result.data or []
        rows.extend(data)
        if len(data) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        safety -= 1

    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df["ds"] = pd.to_datetime(df["date"])
    df["y"] = df["storage_tmc"].astype(float)
    df["unique_id"] = source_code
    return df[["unique_id", "ds", "y"]].dropna()


def _forecast_one_source(source_code: str, df: pd.DataFrame, horizon: int) -> list[dict]:
    """Fit AutoARIMA on the source's history and return forecast rows."""
    if len(df) < MIN_HISTORY_FOR_FIT:
        print(
            f"  {source_code}: skipped (only {len(df)} days, need {MIN_HISTORY_FOR_FIT})",
            file=sys.stderr,
        )
        return []

    # If we have at least 2 seasons of daily data (~2 yrs), use a 365-day
    # season; else fall back to non-seasonal AutoARIMA.
    if len(df) >= SEASONAL_THRESHOLD_DAYS:
        models = [AutoARIMA(season_length=365)]
        model_name = "auto_arima"
    else:
        models = [AutoARIMA()]
        model_name = "auto_arima_nonseasonal"

    sf = StatsForecast(models=models, freq="D", n_jobs=1)
    forecasts = sf.forecast(df=df, h=horizon, level=[CONFIDENCE_LEVEL]).reset_index()

    # Find the prediction + interval columns (AutoARIMA names them dynamically).
    pred_col = next(c for c in forecasts.columns if c not in ("unique_id", "ds", "index") and "-lo-" not in c and "-hi-" not in c)
    lo_col = next(c for c in forecasts.columns if "-lo-" in c)
    hi_col = next(c for c in forecasts.columns if "-hi-" in c)

    today = _today_ist().isoformat()
    out: list[dict] = []
    for _, row in forecasts.iterrows():
        predicted = max(0.0, float(row[pred_col]))
        lower = max(0.0, float(row[lo_col]))
        upper = max(0.0, float(row[hi_col]))
        out.append(
            {
                "city_id": CITY_ID,
                "source_code": source_code,
                "forecast_date": today,
                "target_date": pd.Timestamp(row["ds"]).strftime("%Y-%m-%d"),
                "predicted_storage_tmc": round(predicted, 3),
                "confidence_lower_tmc": round(lower, 3),
                "confidence_upper_tmc": round(upper, 3),
                "model_name": model_name,
            }
        )
    return out


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0].strip())
    parser.add_argument("--horizon", type=int, default=DEFAULT_HORIZON_DAYS)
    parser.add_argument("--history-days", type=int, default=DEFAULT_HISTORY_DAYS)
    args = parser.parse_args()

    supabase = create_client(_get_env("SUPABASE_URL"), _get_env("SUPABASE_SERVICE_KEY"))

    # Pull the configured Madurai sources from the cities table so this
    # stays in sync with the registry without hardcoding.
    src_result = (
        supabase.table("water_sources")
        .select("source_code, display_name")
        .eq("city_id", CITY_ID)
        .order("display_order", desc=False)
        .execute()
    )
    sources = src_result.data or []
    if not sources:
        print(f"ERROR: no water_sources rows for city_id={CITY_ID}", file=sys.stderr)
        return 1

    print(f"Forecasting {len(sources)} Madurai sources, horizon={args.horizon}d", flush=True)

    all_rows: list[dict] = []
    for s in sources:
        code = s["source_code"]
        print(f"  fitting {code}...", flush=True)
        df = _fetch_history(supabase, code, args.history_days)
        rows = _forecast_one_source(code, df, args.horizon)
        if rows:
            print(f"    -> {len(rows)} forecast points (model={rows[0]['model_name']})", flush=True)
            all_rows.extend(rows)

    if not all_rows:
        print("No forecasts produced (insufficient history). Run the backfill first.", flush=True)
        return 0

    supabase.table("reservoir_forecast_v2").upsert(
        all_rows, on_conflict="city_id,source_code,forecast_date,target_date"
    ).execute()
    print(f"Upserted {len(all_rows)} rows to reservoir_forecast_v2.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
