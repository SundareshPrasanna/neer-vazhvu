"""
Reservoir Level Forecaster.

Uses statsforecast AutoARIMA to predict reservoir storage levels.
When sufficient inflow/outflow data is available, uses ARIMAX (ARIMA with
exogenous regressors) for more responsive predictions. Falls back to pure
ARIMA when flow data is sparse.

Automatically detects data frequency (daily vs monthly) and adjusts accordingly.
"""

import numpy as np
import pandas as pd
from statsforecast import StatsForecast
from statsforecast.models import AutoARIMA

from app.db import get_supabase
from app.etl.constants import RESERVOIR_CAPACITY
from app.utils.timezone import ist_today

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


def _fetch_weather_history() -> pd.DataFrame:
    """Fetch all historical weather data (precipitation, ET₀)."""
    supabase = get_supabase()
    result = (
        supabase.table("weather_daily")
        .select("date, precipitation_mm, et0_mm")
        .order("date")
        .execute()
    )
    if not result.data:
        return pd.DataFrame(columns=["ds", "precip", "et0"])

    df = pd.DataFrame(result.data)
    df["ds"] = pd.to_datetime(df["date"])
    df["precip"] = pd.to_numeric(df["precipitation_mm"], errors="coerce").fillna(0)
    df["et0"] = pd.to_numeric(df["et0_mm"], errors="coerce").fillna(0)
    return df[["ds", "precip", "et0"]]


def _fetch_reservoir_history(reservoir: str) -> pd.DataFrame:
    """Fetch all historical storage, inflow, outflow, and weather data for a reservoir."""
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
    df = (
        df.drop_duplicates(subset=["ds"], keep="last")
        .sort_values("ds")
        .reset_index(drop=True)
    )

    # Join weather data (precipitation + ET₀)
    weather = _fetch_weather_history()
    if not weather.empty:
        df = df.merge(weather, on="ds", how="left")
        df["precip"] = df["precip"].fillna(0)
        df["et0"] = df["et0"].fillna(0)
    else:
        df["precip"] = 0.0
        df["et0"] = 0.0

    return df[["unique_id", "ds", "y", "inflow", "outflow", "precip", "et0"]]


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

    # Storage: take last value per month; flow/weather: take mean per month
    agg_dict = {"y": "last", "inflow": "mean", "outflow": "mean"}
    if "precip" in df.columns:
        agg_dict["precip"] = "sum"  # total monthly precipitation
        agg_dict["et0"] = "mean"  # average daily ET₀
    monthly = (
        df.groupby(["unique_id", "month_start"])
        .agg(agg_dict)
        .reset_index()
    )
    monthly = monthly.rename(columns={"month_start": "ds"})
    cols = ["unique_id", "ds", "y", "inflow", "outflow"]
    if "precip" in monthly.columns:
        cols.extend(["precip", "et0"])
    return (
        monthly[cols]
        .sort_values("ds")
        .reset_index(drop=True)
    )


def _compute_future_exog(
    df: pd.DataFrame,
    freq: str,
    horizon: int,
    reservoir: str,
) -> pd.DataFrame:
    """Build future exogenous DataFrame blending recent conditions with seasonal averages.

    Near-term projections are anchored to recent actual conditions (last 14 days
    for daily, last 3 months for monthly). Further-out projections gradually
    transition toward historical seasonal averages. This prevents the model from
    predicting recoveries during droughts (when recent inflow is near zero but
    historical seasonal averages include monsoon months).
    """
    last_date = df["ds"].max()

    exog_cols = ["inflow", "outflow"]
    # Only add weather regressors if they have meaningful variance
    # (e.g. during dry spells, precip is all zeros → rank deficient)
    has_weather = "precip" in df.columns
    if has_weather:
        precip_std = df["precip"].std()
        et0_std = df["et0"].std()
        if precip_std > 0.1:
            exog_cols.append("precip")
        if et0_std > 0.1:
            exog_cols.append("et0")

    if freq == "D":
        # Recent conditions (last 14 days)
        recent_window = min(14, len(df))
        recent = df.tail(recent_window)
        recent_vals = {col: recent[col].mean() for col in exog_cols}

        # Historical seasonal averages by day-of-year
        df_copy = df.copy()
        df_copy["doy"] = df_copy["ds"].dt.dayofyear
        seasonal = df_copy.groupby("doy")[exog_cols].mean()

        future_dates = pd.date_range(
            last_date + pd.Timedelta(days=1), periods=horizon, freq="D"
        )
        future = pd.DataFrame({"ds": future_dates})
        future["doy"] = future["ds"].dt.dayofyear
        future = future.merge(seasonal, left_on="doy", right_index=True, how="left")
        for col in exog_cols:
            future[col] = future[col].fillna(df[col].mean())

        # Blend: recent → seasonal over the forecast horizon
        blend = np.linspace(0, 1, horizon)
        for col in exog_cols:
            future[col] = (1 - blend) * recent_vals[col] + blend * future[col]
    else:
        # Recent conditions (last 3 months)
        recent_window = min(3, len(df))
        recent = df.tail(recent_window)
        recent_vals = {col: recent[col].mean() for col in exog_cols}

        # Historical seasonal averages by month (1-12)
        df_copy = df.copy()
        df_copy["month"] = df_copy["ds"].dt.month
        seasonal = df_copy.groupby("month")[exog_cols].mean()

        future_dates = pd.date_range(
            last_date + pd.offsets.MonthBegin(1), periods=horizon, freq="MS"
        )
        future = pd.DataFrame({"ds": future_dates})
        future["month"] = future["ds"].dt.month
        future = future.merge(seasonal, left_on="month", right_index=True, how="left")
        for col in exog_cols:
            future[col] = future[col].fillna(df[col].mean())

        # Blend: recent → seasonal over the forecast horizon
        blend = np.linspace(0, 1, horizon)
        for col in exog_cols:
            future[col] = (1 - blend) * recent_vals[col] + blend * future[col]

    future["unique_id"] = reservoir
    return future[["unique_id", "ds"] + exog_cols]


def _forecast_single_reservoir(reservoir: str) -> list[dict]:
    """Generate forecast for a single reservoir using ARIMAX or ARIMA fallback."""
    today = ist_today()
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

    # Crisis detection: when storage is critically low, the seasonal ARIMA
    # component would predict recovery based on historical seasonal patterns
    # (e.g. "April is normally 2000 mcft"). During a drought this is misleading.
    # Drop the seasonal component so the model extrapolates current trajectory.
    latest_storage = float(df["y"].iloc[-1])
    in_crisis = latest_storage < capacity * 0.15

    # Choose model based on data availability and crisis state
    if in_crisis:
        # Non-seasonal: prevents false seasonal recovery predictions
        models = [AutoARIMA()]
        model_name = "arimax_crisis" if use_exog else "auto_arima_crisis"
    elif len(df) >= season_length * 2:
        models = [AutoARIMA(season_length=season_length)]
        model_name = "arimax" if use_exog else "auto_arima"
    else:
        models = [AutoARIMA()]  # non-seasonal
        model_name = "arimax_nonseasonal" if use_exog else "auto_arima_nonseasonal"

    sf = StatsForecast(models=models, freq=freq, n_jobs=1)

    if use_exog:
        future_exog = _compute_future_exog(df, freq, horizon, reservoir)
        # Only pass columns that exist in both df and future_exog
        exog_cols = [c for c in future_exog.columns if c not in ("unique_id", "ds")]
        df_for_fit = df[["unique_id", "ds", "y"] + exog_cols]
        forecasts = sf.forecast(
            df=df_for_fit, h=horizon, X_df=future_exog, level=[CONFIDENCE_LEVEL]
        )
    else:
        # Fallback: pure ARIMA without exogenous columns
        df_no_exog = df[["unique_id", "ds", "y"]]
        forecasts = sf.forecast(df=df_no_exog, h=horizon, level=[CONFIDENCE_LEVEL])

    forecasts = forecasts.reset_index()

    # Find column names dynamically
    model_col = [
        c
        for c in forecasts.columns
        if c not in ("index", "unique_id", "ds") and "-lo-" not in c and "-hi-" not in c
    ][0]
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
    failures: list[str] = []

    for reservoir in RESERVOIRS:
        try:
            results = _forecast_single_reservoir(reservoir)
            all_results.extend(results)
        except Exception as e:
            failures.append(f"{reservoir}: {e}")

    if failures:
        raise RuntimeError(
            "Forecast failed for one or more reservoirs: " + "; ".join(failures)
        )

    if all_results:
        supabase.table("reservoir_forecast").upsert(
            all_results, on_conflict="reservoir,forecast_date,target_date"
        ).execute()

    return all_results
