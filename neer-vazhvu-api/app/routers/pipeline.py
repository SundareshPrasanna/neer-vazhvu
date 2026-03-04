from fastapi import APIRouter, Header, HTTPException

from app.config import get_settings

router = APIRouter()


def verify_cron_auth(authorization: str = Header(...)):
    """Verify the cron secret matches."""
    expected = f"Bearer {get_settings().cron_secret}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Invalid cron secret")


@router.post("/run-daily")
async def run_daily_pipeline(authorization: str = Header(...)):
    """Run the full daily pipeline: scrape → ETL → intelligence."""
    verify_cron_auth(authorization)

    from app.etl.pipeline import run_daily

    results = await run_daily()
    return {"success": True, "steps": results}


@router.post("/run-monthly")
async def run_monthly_pipeline(authorization: str = Header(...)):
    """Run monthly jobs: OpenCity groundwater fetch + risk scoring."""
    verify_cron_auth(authorization)

    from app.etl.pipeline import run_monthly

    results = await run_monthly()
    return {"success": True, "steps": results}


@router.post("/run-post-scrape")
async def run_post_scrape_pipeline(authorization: str = Header(...)):
    """Run all pipeline steps except scrape_cmwssb.

    Call this after pushing reservoir data to the DB externally (e.g. from a
    GitHub Actions job that scrapes CMWSSB from a non-blocked IP).
    Steps: fetch_nasa → fetch_opencity → compute_estimate → forecast → briefing.
    """
    verify_cron_auth(authorization)

    from app.etl.pipeline import run_post_scrape

    results = await run_post_scrape()
    return {"success": True, "steps": results}


@router.post("/run-intelligence")
async def run_intelligence(authorization: str = Header(...)):
    """Run only intelligence steps (forecast + risk + briefing). Useful for backfills."""
    verify_cron_auth(authorization)

    from app.etl.pipeline import run_intelligence_only

    results = await run_intelligence_only()
    return {"success": True, "steps": results}
