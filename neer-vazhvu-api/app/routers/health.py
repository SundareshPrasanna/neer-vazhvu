from fastapi import APIRouter

from app.db import get_supabase
from app.utils.timezone import ist_today

router = APIRouter()


@router.get("/health")
async def health_check():
    """Service health check with last pipeline run status."""
    try:
        supabase = get_supabase()
        result = (
            supabase.table("pipeline_log")
            .select("run_date, step, status, duration_ms")
            .order("started_at", desc=True)
            .limit(5)
            .execute()
        )
        return {
            "status": "ok",
            "service": "neer-vazhvu-api",
            "date": ist_today().isoformat(),
            "recent_pipeline_runs": result.data,
        }
    except Exception as e:
        return {
            "status": "degraded",
            "service": "neer-vazhvu-api",
            "error": str(e),
        }
