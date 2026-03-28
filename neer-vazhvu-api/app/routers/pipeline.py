import hmac

from fastapi import APIRouter, Header, HTTPException

from app.config import get_settings

router = APIRouter()


def verify_cron_auth(authorization: str | None = Header(default=None)):
    """Verify the cron secret matches."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization")

    expected = f"Bearer {get_settings().cron_secret}"
    if not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Invalid cron secret")


@router.post("/run-daily")
async def run_daily_pipeline(authorization: str | None = Header(default=None)):
    """Run the full daily pipeline: scrape → ETL → intelligence."""
    verify_cron_auth(authorization)

    from app.etl.pipeline import run_daily

    results = await run_daily()
    return {"success": True, "steps": results}


@router.post("/run-monthly")
async def run_monthly_pipeline(authorization: str | None = Header(default=None)):
    """Run monthly jobs: OpenCity groundwater fetch + risk scoring."""
    verify_cron_auth(authorization)

    from app.etl.pipeline import run_monthly

    results = await run_monthly()
    return {"success": True, "steps": results}


@router.post("/run-post-scrape")
async def run_post_scrape_pipeline(authorization: str | None = Header(default=None)):
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
async def run_intelligence(authorization: str | None = Header(default=None)):
    """Run only intelligence steps (forecast + risk + briefing). Useful for backfills."""
    verify_cron_auth(authorization)

    from app.etl.pipeline import run_intelligence_only

    results = await run_intelligence_only()
    return {"success": True, "steps": results}


@router.post("/run-census-fetch")
async def run_census_fetch(authorization: str | None = Header(default=None)):
    """One-time/periodic fetch of water bodies census from data.gov.in.

    Requires DATA_GOV_IN_API_KEY to be configured.
    """
    verify_cron_auth(authorization)

    from app.etl.pipeline import run_census_fetch

    results = await run_census_fetch()
    return {"success": True, "steps": results}
