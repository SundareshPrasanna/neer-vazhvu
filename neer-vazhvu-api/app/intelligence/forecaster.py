"""
Reservoir Level Forecaster.

Uses statsforecast AutoARIMA to predict reservoir storage levels.
When sufficient inflow/outflow data is available, uses ARIMAX (ARIMA with
exogenous regressors) for more responsive predictions. Falls back to pure
ARIMA when flow data is sparse.

Automatically detects data frequency (daily vs monthly) and adjusts accordingly.
"""

from datetime import date

import numpy as np
import pandas as pd
from statsforecast import StatsForecast
from statsforecast.models import AutoARIMA

from app.db import get_supabase
from app.etl.constants import RESERVOIR_CAPACITY

CONFIDENCE_LEVEL = 80  # percent
MIN_HISTORY_POINTS = 24  # minimum data points for forecasting
MIN_EXOG_COVERAGE = 0.3  # need at least 30% non-zero inflow to use ARIMAX

RESERVOIRS = [
    "poondi",
    "cholavaram",
    "redhills",
    "chembarambakkam",
    "veeranam",
    "kannankottai",
]


def _fetch_reservoir_history(reservoir: str) -> pd.DataFrame:
    """Fetch all historical storage, inflow, and outflow data for a reservoir."""
    supabase = get_supabase()

    result = (
        supabase.table("reservoir_daily")
        .select("date, current_storage_mcft, inflow_cusecs, outflow_cusecs")
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
    df["inflow"] = pd.to_numeric(df["inflow_cusecs"], errors="coerce").fillna(0)
    df["outflow"] = pd.to_numeric(df["outflow_cusecs"], errors="coerce").fillna(0)
    df["unique_id"] = reservoir

    # Drop duplicates (keep last per date) and sort
    df = df.drop_duplicates(subset=["ds"], keep="last").sort_values("ds").reset_index(drop=True)

    return df[["unique_id", "ds", "y", "inflow", "outflow"]]


def _detect_frequency(df: pd.DataFrame) -> tuple[str, int, int]:
    """
    Detect whether the data is daily or monthly.

    Returns:
        (freq, season_length, forecast_horizon)
        - Daily: ('D', 365, 30)
        - Monthly: ('MS', 12, 6) — 6 months ahead
    """
    if len(df) < 3:
        return "MS", 12, 6

    # Check median gap between consecutive dates
    gaps = df["ds"].diff().dt.days.dropna()
    median_gap = gaps.median()

    if median_gap > 15:
        # Monthly data — resample to month start for clean frequency
        return "MS", 12, 6
    else:
        return "D", 365, 30


def _resample_to_monthly(df: pd.DataFrame) -> pd.DataFrame:
    """Resample irregular dates to clean month-start frequency."""
    df = df.copy()
    df["month_start"] = df["ds"].dt.to_period("M").dt.to_timestamp()

    # Storage: take last value per month; flow: take mean per month
    monthly = (
        df.groupby(["unique_id", "month_start"])
        .agg({"y": "last", "inflow": "mean", "outflow": "mean"})
        .reset_index()
    )
    monthly = monthly.rename(columns={"month_start": "ds"})
    return monthly[["unique_id", "ds", "y", "inflow", "outflow"]].sort_values("ds").reset_index(drop=True)


def _compute_future_exog(
    df: pd.DataFrame,
    freq: str,
    horizon: int,
    reservoir: str,
) -> pd.DataFrame:
    """Build future exogenous DataFrame using historical seasonal averages."""
    last_date = df["ds"].max()

    if freq == "D":
        # Compute mean inflow/outflow by day-of-year
        df_copy = df.copy()
        df_copy["doy"] = df_copy["ds"].dt.dayofyear
        seasonal = df_copy.groupby("doy")[["inflow", "outflow"]].mean()

        future_dates = pd.date_range(last_date + pd.Timedelta(days=1), periods=horizon, freq="D")
        future = pd.DataFrame({"ds": future_dates})
        future["doy"] = future["ds"].dt.dayofyear
        future = future.merge(seasonal, left_on="doy", right_index=True, how="left")
        # Fill any missing day-of-year with overall means
        future["inflow"] = future["inflow"].fillna(df["inflow"].mean())
        future["outflow"] = future["outflow"].fillna(df["outflow"].mean())
    else:
        # Monthly: mean by month (1-12)
        df_copy = df.copy()
        df_copy["month"] = df_copy["ds"].dt.month
        seasonal = df_copy.groupby("month")[["inflow", "outflow"]].mean()

        future_dates = pd.date_range(last_date + pd.offsets.MonthBegin(1), periods=horizon, freq="MS")
        future = pd.DataFrame({"ds": future_dates})
        future["month"] = future["ds"].dt.month
        future = future.merge(seasonal, left_on="month", right_index=True, how="left")
        future["inflow"] = future["inflow"].fillna(df["inflow"].mean())
        future["outflow"] = future["outflow"].fillna(df["outflow"].mean())

    future["unique_id"] = reservoir
    return future[["unique_id", "ds", "inflow", "outflow"]]


def _forecast_single_reservoir(reservoir: str) -> list[dict]:
    """Generate forecast for a single reservoir using ARIMAX or ARIMA fallback."""
    today = date.today()
    df = _fetch_reservoir_history(reservoir)

    if len(df) < MIN_HISTORY_POINTS:
        return []

    capacity = RESERVOIR_CAPACITY.get(reservoir, 5000)
    freq, season_length, horizon = _detect_frequency(df)

    # Resample to clean frequency if monthly
    if freq == "MS":
        df = _resample_to_monthly(df)

    # Determine if we have enough exogenous data to use ARIMAX
    # Check coverage in the last 2 years only — older data may predate inflow scraping
    two_years_ago = df["ds"].max() - pd.Timedelta(days=730)
    recent = df[df["ds"] >= two_years_ago]
    non_zero_inflow = (recent["inflow"] > 0).sum()
    use_exog = len(recent) > 0 and non_zero_inflow >= len(recent) * MIN_EXOG_COVERAGE

    # Choose model based on data points available
    if len(df) >= season_length * 2:
        models = [AutoARIMA(season_length=season_length)]
        model_name = "arimax" if use_exog else "auto_arima"
    else:
        models = [AutoARIMA()]  # non-seasonal
        model_name = "arimax_nonseasonal" if use_exog else "auto_arima_nonseasonal"

    sf = StatsForecast(models=models, freq=freq, n_jobs=1)

    if use_exog:
        future_exog = _compute_future_exog(df, freq, horizon, reservoir)
        forecasts = sf.forecast(df=df, h=horizon, X_df=future_exog, level=[CONFIDENCE_LEVEL])
    else:
        # Fallback: pure ARIMA without exogenous columns
        df_no_exog = df[["unique_id", "ds", "y"]]
        forecasts = sf.forecast(df=df_no_exog, h=horizon, level=[CONFIDENCE_LEVEL])

    forecasts = forecasts.reset_index()

    # Find column names dynamically
    model_col = [c for c in forecasts.columns if c not in ("index", "unique_id", "ds") and "-lo-" not in c and "-hi-" not in c][0]
    lo_col = [c for c in forecasts.columns if "-lo-" in c][0]
    hi_col = [c for c in forecasts.columns if "-hi-" in c][0]

    results = []
    for _, row in forecasts.iterrows():
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
                "target_date": pd.Timestamp(row["ds"]).strftime("%Y-%m-%d"),
                "predicted_storage_mcft": round(predicted, 3),
                "confidence_lower_mcft": round(lower, 3),
                "confidence_upper_mcft": round(upper, 3),
                "model_name": model_name,
            }
        )

    return results


async def forecast_reservoirs() -> list[dict]:
    """Generate forecasts for all 6 reservoirs and store in Supabase."""
    supabase = get_supabase()
    all_results: list[dict] = []

    for reservoir in RESERVOIRS:
        try:
            results = _forecast_single_reservoir(reservoir)
            all_results.extend(results)
        except Exception as e:
            print(f"Forecast failed for {reservoir}: {e}")
            continue

    if all_results:
        supabase.table("reservoir_forecast").upsert(
            all_results, on_conflict="reservoir,forecast_date,target_date"
        ).execute()

    return all_results
