"""
Ward-Level Water Risk Scorer.

Computes a composite risk score (0–100) for each of Chennai's 200 wards.
Components: groundwater depth (40%), trend (30%), reservoir stress (20%), seasonal (10%).
"""

import json

from app.db import get_supabase
from app.utils.timezone import ist_today

# --- Component weights ---
W_GROUNDWATER = 0.40
W_TREND = 0.30
W_RESERVOIR = 0.20
W_SEASONAL = 0.10


def _groundwater_score(depth_m: float | None) -> tuple[float, str]:
    """Score groundwater depth. Lower depth = lower risk."""
    if depth_m is None:
        return 50.0, "No data available — assumed moderate risk"

    if depth_m <= 3:
        score = 0.0
        desc = f"Depth at {depth_m:.1f}m (Healthy)"
    elif depth_m <= 6:
        score = 25.0
        desc = f"Depth at {depth_m:.1f}m (Moderate)"
    elif depth_m <= 10:
        score = 50.0
        desc = f"Depth at {depth_m:.1f}m (Declining)"
    elif depth_m <= 15:
        score = 70.0
        desc = f"Depth at {depth_m:.1f}m (Stressed)"
    elif depth_m <= 25:
        score = 85.0
        desc = f"Depth at {depth_m:.1f}m (Critical)"
    else:
        score = 100.0
        desc = f"Depth at {depth_m:.1f}m (Crisis)"

    return score, f"{desc} — {score:.0f}/100"


def _trend_score(
    current_depth: float | None, prev_year_depth: float | None
) -> tuple[float, str]:
    """Score year-over-year trend. Declining water table = higher risk."""
    if current_depth is None or prev_year_depth is None:
        return 50.0, "Trend unknown (insufficient data) — 50/100"

    change = current_depth - prev_year_depth  # positive = table fell (worse)

    if change < -0.5:
        score = 0.0
        label = "Improving"
        detail = f"rose {abs(change):.1f}m from last year"
    elif change <= 0.5:
        score = 40.0
        label = "Stable"
        detail = f"changed {change:+.1f}m from last year"
    else:
        score = 80.0
        label = "Declining"
        detail = f"fell {change:.1f}m from last year"

    return score, f"{label} ({detail}) — {score:.0f}/100"


def _reservoir_score(storage_pct: float) -> tuple[float, str]:
    """Score city-wide reservoir stress."""
    if storage_pct > 75:
        score = 0.0
    elif storage_pct > 50:
        score = 25.0
    elif storage_pct > 25:
        score = 60.0
    else:
        score = 90.0

    return score, f"City reservoirs at {storage_pct:.0f}% capacity — {score:.0f}/100"


def _seasonal_score(month: int) -> tuple[float, str]:
    """Score seasonal vulnerability."""
    # Pre-monsoon (hottest, driest): Apr-Jun
    # Southwest monsoon: Jul-Sep
    # Northeast monsoon (Chennai's main): Oct-Dec
    # Post-monsoon: Jan-Mar
    seasonal_map = {
        1: (30, "Post-monsoon (January)"),
        2: (30, "Post-monsoon (February)"),
        3: (40, "Late post-monsoon (March)"),
        4: (80, "Pre-monsoon (April)"),
        5: (80, "Pre-monsoon (May)"),
        6: (80, "Pre-monsoon (June)"),
        7: (40, "Southwest monsoon (July)"),
        8: (40, "Southwest monsoon (August)"),
        9: (40, "Southwest monsoon (September)"),
        10: (10, "Northeast monsoon (October)"),
        11: (10, "Northeast monsoon (November)"),
        12: (10, "Northeast monsoon (December)"),
    }
    score, label = seasonal_map.get(month, (50, "Unknown"))
    return float(score), f"{label} — {score}/100"


def _risk_level(score: float) -> str:
    """Classify risk score into a level."""
    if score <= 25:
        return "low"
    elif score <= 50:
        return "moderate"
    elif score <= 75:
        return "high"
    else:
        return "critical"


async def compute_risk_scores() -> list[dict]:
    """Compute risk scores for all 200 wards and store in Supabase."""
    supabase = get_supabase()
    today = ist_today()
    current_month = today.month

    # 1. Get latest groundwater data
    gw_result = (
        supabase.table("groundwater_monthly")
        .select("ward_number, depth_to_water_m, year, month")
        .order("year", desc=True)
        .order("month", desc=True)
        .execute()
    )

    # Build lookup: ward_number -> (latest_depth, latest_year, latest_month)
    latest_depth: dict[int, float | None] = {}
    latest_period: dict[int, tuple[int, int]] = {}  # ward -> (year, month)
    for row in gw_result.data:
        wn = row["ward_number"]
        if wn not in latest_depth:
            latest_depth[wn] = row["depth_to_water_m"]
            latest_period[wn] = (row["year"], row["month"])

    # Build lookup for previous year same month
    prev_year_depth: dict[int, float | None] = {}
    for row in gw_result.data:
        wn = row["ward_number"]
        if wn in latest_period:
            ly, lm = latest_period[wn]
            if row["year"] == ly - 1 and row["month"] == lm:
                if wn not in prev_year_depth:
                    prev_year_depth[wn] = row["depth_to_water_m"]

    # 2. Get latest city-wide storage percentage
    est_result = (
        supabase.table("water_estimate_daily")
        .select("storage_pct")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    city_storage_pct = est_result.data[0]["storage_pct"] if est_result.data else 50.0

    # 3. Compute risk for each ward (1-200)
    all_wards = set(latest_depth.keys()) | set(range(1, 201))
    results: list[dict] = []

    for ward_num in sorted(all_wards):
        if ward_num < 1 or ward_num > 200:
            continue

        depth = latest_depth.get(ward_num)
        prev_depth = prev_year_depth.get(ward_num)

        gw_score, gw_desc = _groundwater_score(depth)
        tr_score, tr_desc = _trend_score(depth, prev_depth)
        res_score, res_desc = _reservoir_score(city_storage_pct)
        sea_score, sea_desc = _seasonal_score(current_month)

        composite = (
            gw_score * W_GROUNDWATER
            + tr_score * W_TREND
            + res_score * W_RESERVOIR
            + sea_score * W_SEASONAL
        )
        composite = round(composite, 2)
        level = _risk_level(composite)

        factors = {
            "groundwater": gw_desc,
            "trend": tr_desc,
            "reservoir": res_desc,
            "seasonal": sea_desc,
            "overall": f"{level.title()} risk — composite score {composite:.0f}",
        }

        results.append(
            {
                "ward_number": ward_num,
                "computed_date": today.isoformat(),
                "risk_score": composite,
                "risk_level": level,
                "groundwater_component": gw_score,
                "trend_component": tr_score,
                "reservoir_component": res_score,
                "seasonal_component": sea_score,
                "factors": json.dumps(factors),
            }
        )

    # 4. Upsert to Supabase
    if results:
        supabase.table("ward_risk_score").upsert(
            results, on_conflict="ward_number,computed_date"
        ).execute()

    return results
