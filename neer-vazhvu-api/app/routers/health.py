from fastapi import APIRouter

from app.config import get_settings
from app.db import get_supabase
from app.utils.timezone import ist_today

router = APIRouter()


@router.get("/health")
async def health_check():
    """Service health check with last pipeline run status."""
    settings = get_settings()
    try:
        supabase = get_supabase()
        response = {
            "status": "ok",
            "service": "neer-vazhvu-api",
            "date": ist_today().isoformat(),
        }

        if settings.environment == "development":
            result = (
                supabase.table("pipeline_log")
                .select("run_date, step, status, duration_ms")
                .order("started_at", desc=True)
                .limit(5)
                .execute()
            )
            response["recent_pipeline_runs"] = result.data
        else:
            supabase.table("pipeline_log").select("id").limit(1).execute()

        return response
    except Exception:
        return {
            "status": "degraded",
            "service": "neer-vazhvu-api",
            "date": ist_today().isoformat(),
        }
