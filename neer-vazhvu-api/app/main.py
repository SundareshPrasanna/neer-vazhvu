from fastapi import FastAPI

from app.routers import health, pipeline, intelligence

app = FastAPI(
    title="Neer Vazhvu API",
    description="Chennai Water Intelligence Service — scrapers, ETL, forecasting, and risk scoring",
    version="0.1.0",
)

app.include_router(health.router)
app.include_router(pipeline.router, prefix="/pipeline", tags=["pipeline"])
app.include_router(intelligence.router, prefix="/intelligence", tags=["intelligence"])
