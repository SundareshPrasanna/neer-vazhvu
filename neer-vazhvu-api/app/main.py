import os

from fastapi import FastAPI

from app.routers import health, pipeline, intelligence

show_docs = os.getenv("ENVIRONMENT", "development") == "development"

app = FastAPI(
    title="Neer Vazhvu API",
    description="Chennai Water Intelligence Service — scrapers, ETL, forecasting, and risk scoring",
    version="0.1.0",
    docs_url="/docs" if show_docs else None,
    redoc_url="/redoc" if show_docs else None,
    openapi_url="/openapi.json" if show_docs else None,
)

app.include_router(health.router)
app.include_router(pipeline.router, prefix="/pipeline", tags=["pipeline"])
app.include_router(intelligence.router, prefix="/intelligence", tags=["intelligence"])
