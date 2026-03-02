"""
Reservoir Level Forecaster.

Uses statsforecast AutoARIMA to predict storage levels 30 days ahead
for each of Chennai's 6 reservoirs. Trains daily on all available history.
"""

from datetime import date

import numpy as np
import pandas as pd
from statsforecast import StatsForecast
from statsforecast.models import AutoARIMA, SeasonalExponentialSmoothingOptimized

from app.db import get_supabase
from app.etl.constants import RESERVOIR_CAPACITY

FORECAST_HORIZON = 30  # days ahead
CONFIDENCE_LEVEL = 80  # percent
MIN_HISTORY_DAYS = 90  # minimum data points for AutoARIMA

RESERVOIRS = [
    "poondi",
    "cholavaram",
    "redhills",
    "chembarambakkam",
    "veeranam",
    "kannankottai",
]


def _fetch_reservoir_history(reservoir: str) -> pd.DataFrame:
    """Fetch all historical storage data for a reservoir from Supabase."""
    supabase = get_supabase()

    result = (
        supabase.table("reservoir_daily")
        .select("date, current_storage_mcft")
        .eq("reservoir", reservoir)
        .not_.is_("current_storage_mcft", "null")
        .order("date")
        .execute()
    )

    if not result.data:
        return pd.DataFrame()

    df = pd.DataFrame(result.data)
    df["ds"] = pd.to_datetime(df["date"])
    df["y"] = df["current_storage_mcft"].astype(float)
    df["unique_id"] = reservoir

    # Drop duplicates (keep last per date) and sort
    df = df.drop_duplicates(subset=["ds"], keep="last").sort_values("ds").reset_index(drop=True)

    return df[["unique_id", "ds", "y"]]


def _forecast_single_reservoir(reservoir: str) -> list[dict]:
    """Generate forecast for a single reservoir."""
    today = date.today()
    df = _fetch_reservoir_history(reservoir)

    if len(df) < 30:
        # Not enough data even for basic forecasting
        return []

    capacity = RESERVOIR_CAPACITY.get(reservoir, 5000)

    # Choose model based on data availability
    if len(df) >= MIN_HISTORY_DAYS:
        models = [AutoARIMA(season_length=365)]
        model_name = "auto_arima"
    else:
        # Fallback to seasonal exponential smoothing with shorter season
        models = [SeasonalExponentialSmoothingOptimized(season_length=30)]
        model_name = "ses_optimized"

    sf = StatsForecast(models=models, freq="D", n_jobs=1)
    sf.fit(df)

    forecasts = sf.predict(h=FORECAST_HORIZON, level=[CONFIDENCE_LEVEL])
    forecasts = forecasts.reset_index()

    results = []
    for _, row in forecasts.iterrows():
        # Get the predicted value and confidence bounds
        model_col = forecasts.columns[2]  # First model column after unique_id and ds
        lo_col = [c for c in forecasts.columns if "-lo-" in c][0]
        hi_col = [c for c in forecasts.columns if "-hi-" in c][0]

        predicted = float(row[model_col])
        lower = float(row[lo_col])
        upper = float(row[hi_col])

        # Clamp predictions to valid range [0, capacity]
        predicted = max(0, min(predicted, capacity))
        lower = max(0, min(lower, capacity))
        upper = max(0, min(upper, capacity))

        results.append(
            {
                "reservoir": reservoir,
                "forecast_date": today.isoformat(),
                "target_date": row["ds"].strftime("%Y-%m-%d"),
                "predicted_storage_mcft": round(predicted, 3),
                "confidence_lower_mcft": round(lower, 3),
                "confidence_upper_mcft": round(upper, 3),
                "model_name": model_name,
            }
        )

    return results


async def forecast_reservoirs() -> list[dict]:
    """Generate 30-day forecasts for all 6 reservoirs and store in Supabase."""
    supabase = get_supabase()
    all_results: list[dict] = []

    for reservoir in RESERVOIRS:
        try:
            results = _forecast_single_reservoir(reservoir)
            all_results.extend(results)
        except Exception as e:
            # Log but don't fail the whole pipeline for one reservoir
            print(f"Forecast failed for {reservoir}: {e}")
            continue

    if all_results:
        # Batch upsert (supabase-py handles chunking)
        supabase.table("reservoir_forecast").upsert(
            all_results, on_conflict="reservoir,forecast_date,target_date"
        ).execute()

    return all_results
