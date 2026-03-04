"""
Daily Intelligence Briefing Generator.

Template-based (no LLM required). Pulls data from multiple tables
and applies rule-based logic to produce a structured briefing.
"""

from datetime import date, timedelta

from app.db import get_supabase


def _build_headline(
    storage_pct: float,
    change_7d: float,
    days_left_moderate: int,
) -> str:
    """Generate the briefing headline based on current conditions."""
    if storage_pct < 15:
        return (
            f"Critical: reservoir levels at {storage_pct:.0f}% — "
            f"approaching Day Zero thresholds"
        )

    if storage_pct < 30:
        return (
            f"Water stress alert — only {days_left_moderate} days remaining "
            f"at current consumption"
        )

    if change_7d < -5:
        return (
            f"Rapid drawdown — storage dropped {abs(change_7d):.1f}% this week "
            f"to {storage_pct:.0f}%"
        )

    if change_7d > 2:
        return (
            f"Reservoirs recovering — {storage_pct:.0f}% full, "
            f"up {change_7d:.1f}% this week"
        )

    if abs(change_7d) <= 2:
        return (
            f"Storage steady at {storage_pct:.0f}% — "
            f"{days_left_moderate} days of water at current usage"
        )

    if change_7d < 0:
        return (
            f"Gradual drawdown — storage at {storage_pct:.0f}%, "
            f"down {abs(change_7d):.1f}% this week"
        )

    return f"Reservoir storage at {storage_pct:.0f}%"


def _build_summary(
    storage_pct: float,
    change_7d: float,
    days_left: dict,
    inflow_mcft_day: float,
) -> str:
    """Generate the briefing summary paragraph."""
    parts = []

    parts.append(
        f"Chennai's combined reservoir storage stands at {storage_pct:.1f}% of capacity"
    )

    if abs(change_7d) > 0.5:
        direction = "up" if change_7d > 0 else "down"
        parts.append(f"{direction} {abs(change_7d):.1f}% from a week ago")

    parts.append(
        f"At current consumption rates, the moderate scenario estimates "
        f"{days_left['moderate']} days of water remaining"
    )

    if inflow_mcft_day > 0:
        parts.append(f"Average daily inflow is {inflow_mcft_day:.1f} mcft/day")

    return ". ".join(parts) + "."


def _build_alerts(
    storage_pct: float,
    change_7d: float,
    days_left: dict,
    high_risk_wards: int,
    inflow_change_pct: float | None,
) -> list[dict]:
    """Generate alerts based on threshold conditions."""
    alerts = []

    if storage_pct < 30:
        alerts.append(
            {
                "level": "critical",
                "message": (
                    f"Combined reservoir storage is at {storage_pct:.0f}%, "
                    f"well below the 30% comfort threshold."
                ),
            }
        )

    if change_7d < -5:
        alerts.append(
            {
                "level": "warning",
                "message": (
                    f"Storage declined {abs(change_7d):.1f}% in the past 7 days — "
                    f"above the normal depletion rate."
                ),
            }
        )

    if days_left.get("pessimistic", 999) < 60:
        alerts.append(
            {
                "level": "warning",
                "message": (
                    f"In a no-rain scenario, water supply could be stressed "
                    f"within {days_left['pessimistic']} days."
                ),
            }
        )

    if high_risk_wards >= 30:
        alerts.append(
            {
                "level": "info",
                "message": (
                    f"{high_risk_wards} wards currently rated high or critical risk "
                    f"for groundwater stress."
                ),
            }
        )

    if inflow_change_pct is not None and inflow_change_pct < -50:
        alerts.append(
            {
                "level": "warning",
                "message": (
                    f"Reservoir inflow dropped {abs(inflow_change_pct):.0f}% "
                    f"compared to last week."
                ),
            }
        )

    return alerts


def _build_recommendations(
    storage_pct: float,
    days_left: dict,
    high_risk_wards: int,
) -> list[str]:
    """Generate actionable recommendations."""
    recs = []

    if storage_pct < 30:
        recs.append(
            "Consider reducing non-essential water usage. "
            "Reservoir levels are approaching stress thresholds."
        )

    if days_left.get("pessimistic", 999) < 90:
        recs.append(
            "Monitor inflow trends closely. If the monsoon is delayed, "
            "rationing measures may be necessary."
        )

    if high_risk_wards >= 50:
        recs.append(
            f"{high_risk_wards} wards show high groundwater stress. "
            "Targeted borwell monitoring and tanker water allocation recommended."
        )

    if storage_pct > 80:
        recs.append(
            "Storage levels are healthy. Good time to focus on "
            "rainwater harvesting infrastructure maintenance."
        )

    if not recs:
        recs.append("No immediate action required. Continue regular monitoring.")

    return recs


async def generate_briefing() -> dict:
    """Generate today's intelligence briefing and store in Supabase."""
    supabase = get_supabase()
    today = date.today()
    week_ago = today - timedelta(days=7)

    # 1. Get latest estimate
    est_result = (
        supabase.table("water_estimate_daily")
        .select("*")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )

    if not est_result.data:
        # No data available — generate a placeholder briefing
        briefing = {
            "briefing_date": today.isoformat(),
            "headline": "No data available — waiting for pipeline to populate",
            "summary": "The daily data pipeline has not yet produced estimates.",
            "key_metrics": {},
            "alerts": [],
            "recommendations": ["Run the daily pipeline to generate data."],
        }
        supabase.table("daily_briefing").upsert(
            briefing, on_conflict="briefing_date"
        ).execute()
        return briefing

    current = est_result.data[0]
    storage_pct = float(current.get("storage_pct", 0))
    inflow_mcft_day = float(current.get("avg_inflow_mcft_day", 0) or 0)

    days_left = {
        "pessimistic": current.get("days_left_pessimistic", 999),
        "moderate": current.get("days_left_moderate", 999),
        "optimistic": current.get("days_left_optimistic", 999),
    }

    # 2. Get previous week's estimate for comparison
    prev_result = (
        supabase.table("water_estimate_daily")
        .select("storage_pct, avg_inflow_mcft_day")
        .lte("date", week_ago.isoformat())
        .order("date", desc=True)
        .limit(1)
        .execute()
    )

    prev_storage_pct = (
        float(prev_result.data[0]["storage_pct"]) if prev_result.data else storage_pct
    )
    change_7d = storage_pct - prev_storage_pct

    prev_inflow = (
        float(prev_result.data[0].get("avg_inflow_mcft_day", 0) or 0)
        if prev_result.data
        else None
    )
    inflow_change_pct = None
    if prev_inflow is not None and prev_inflow > 0:
        inflow_change_pct = ((inflow_mcft_day - prev_inflow) / prev_inflow) * 100

    # 3. Get risk score summary
    risk_result = (
        supabase.table("ward_risk_score")
        .select("risk_level")
        .order("computed_date", desc=True)
        .limit(200)
        .execute()
    )

    high_risk_wards = sum(
        1 for r in risk_result.data if r["risk_level"] in ("high", "critical")
    )

    # 4. Build briefing
    headline = _build_headline(storage_pct, change_7d, days_left["moderate"])
    summary = _build_summary(storage_pct, change_7d, days_left, inflow_mcft_day)
    alerts = _build_alerts(
        storage_pct, change_7d, days_left, high_risk_wards, inflow_change_pct
    )
    recommendations = _build_recommendations(storage_pct, days_left, high_risk_wards)

    key_metrics = {
        "storage_pct": round(storage_pct, 1),
        "storage_change_7d": round(change_7d, 1),
        "days_left_pessimistic": days_left["pessimistic"],
        "days_left_moderate": days_left["moderate"],
        "days_left_optimistic": days_left["optimistic"],
        "avg_inflow_mcft_day": round(inflow_mcft_day, 1),
        "wards_at_high_risk": high_risk_wards,
    }

    briefing = {
        "briefing_date": today.isoformat(),
        "headline": headline,
        "summary": summary,
        "key_metrics": key_metrics,
        "alerts": alerts,
        "recommendations": recommendations,
    }

    supabase.table("daily_briefing").upsert(
        briefing, on_conflict="briefing_date"
    ).execute()

    return briefing
