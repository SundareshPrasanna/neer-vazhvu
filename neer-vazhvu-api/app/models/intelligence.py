from pydantic import BaseModel


class ForecastPoint(BaseModel):
    """A single forecast data point."""

    target_date: str
    predicted_storage_mcft: float
    confidence_lower_mcft: float | None = None
    confidence_upper_mcft: float | None = None


class ReservoirForecast(BaseModel):
    """Forecast for a single reservoir."""

    reservoir: str
    forecast_date: str
    model_name: str
    predictions: list[ForecastPoint]


class WardRiskScore(BaseModel):
    """Risk score for a single ward."""

    ward_number: int
    computed_date: str
    risk_score: float
    risk_level: str  # low, moderate, high, critical
    groundwater_component: float
    trend_component: float
    reservoir_component: float
    seasonal_component: float
    factors: dict


class DailyBriefing(BaseModel):
    """Daily intelligence briefing."""

    briefing_date: str
    headline: str
    summary: str
    key_metrics: dict
    alerts: list[dict] | None = None
    recommendations: list[str] | None = None


class DaysLeftOutput(BaseModel):
    """Output of the days-left calculation."""

    pessimistic: int
    moderate: int
    optimistic: int
    storage_pct: float
    net_depletion_rate_mcft_per_day: float
    last_updated: str
