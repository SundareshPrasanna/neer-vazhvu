from fastapi import APIRouter, Query

from app.db import get_supabase

router = APIRouter()


@router.get("/forecast")
async def get_forecast(
    reservoir: str = Query("all", description="Reservoir name or 'all'"),
    horizon: int = Query(30, description="Forecast horizon in days", ge=1, le=90),
):
    """Return the latest reservoir storage forecasts."""
    supabase = get_supabase()

    query = (
        supabase.table("reservoir_forecast")
        .select("*")
        .order("forecast_date", desc=True)
    )

    # Get the most recent forecast_date
    latest = query.limit(1).execute()
    if not latest.data:
        return {"forecast_date": None, "reservoirs": {}}

    forecast_date = latest.data[0]["forecast_date"]

    # Fetch all predictions for that forecast_date
    query = (
        supabase.table("reservoir_forecast")
        .select("*")
        .eq("forecast_date", forecast_date)
    )

    if reservoir != "all":
        query = query.eq("reservoir", reservoir)

    result = query.order("target_date").execute()

    # Group by reservoir
    reservoirs: dict[str, list] = {}
    for row in result.data:
        name = row["reservoir"]
        if name not in reservoirs:
            reservoirs[name] = []
        reservoirs[name].append(
            {
                "target_date": row["target_date"],
                "predicted_storage_mcft": row["predicted_storage_mcft"],
                "confidence_lower_mcft": row["confidence_lower_mcft"],
                "confidence_upper_mcft": row["confidence_upper_mcft"],
            }
        )

    # Trim to requested horizon
    for name in reservoirs:
        reservoirs[name] = reservoirs[name][:horizon]

    return {"forecast_date": forecast_date, "reservoirs": reservoirs}


@router.get("/risk-scores")
async def get_risk_scores(
    date: str = Query("latest", description="Date (YYYY-MM-DD) or 'latest'"),
):
    """Return ward-level water risk scores."""
    supabase = get_supabase()

    if date == "latest":
        latest = (
            supabase.table("ward_risk_score")
            .select("computed_date")
            .order("computed_date", desc=True)
            .limit(1)
            .execute()
        )
        if not latest.data:
            return {"computed_date": None, "city_average_risk": None, "wards": []}
        date = latest.data[0]["computed_date"]

    result = (
        supabase.table("ward_risk_score")
        .select("*")
        .eq("computed_date", date)
        .order("ward_number")
        .execute()
    )

    scores = [row["risk_score"] for row in result.data if row["risk_score"] is not None]
    city_avg = round(sum(scores) / len(scores), 1) if scores else None

    return {
        "computed_date": date,
        "city_average_risk": city_avg,
        "wards": [
            {
                "ward_number": r["ward_number"],
                "risk_score": r["risk_score"],
                "risk_level": r["risk_level"],
                "factors": r["factors"],
            }
            for r in result.data
        ],
    }


@router.get("/briefing")
async def get_briefing(
    date: str = Query("latest", description="Date (YYYY-MM-DD) or 'latest'"),
):
    """Return the daily intelligence briefing."""
    supabase = get_supabase()

    if date == "latest":
        result = (
            supabase.table("daily_briefing")
            .select("*")
            .order("briefing_date", desc=True)
            .limit(1)
            .execute()
        )
    else:
        result = (
            supabase.table("daily_briefing")
            .select("*")
            .eq("briefing_date", date)
            .execute()
        )

    if not result.data:
        return {"briefing_date": None, "headline": "No briefing available"}

    row = result.data[0]
    return {
        "briefing_date": row["briefing_date"],
        "headline": row["headline"],
        "summary": row["summary"],
        "key_metrics": row["key_metrics"],
        "alerts": row["alerts"],
        "recommendations": row["recommendations"],
    }
