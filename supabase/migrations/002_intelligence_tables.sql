-- =============================================================
-- 002_intelligence_tables.sql
-- Neer Vazhvu - Intelligence Layer Tables
-- =============================================================

-- ----- RESERVOIR FORECASTS -----

CREATE TABLE reservoir_forecast (
    id                     BIGSERIAL PRIMARY KEY,
    reservoir              reservoir_name NOT NULL,
    forecast_date          DATE NOT NULL,
    target_date            DATE NOT NULL,
    predicted_storage_mcft NUMERIC(10,3) NOT NULL,
    confidence_lower_mcft  NUMERIC(10,3),
    confidence_upper_mcft  NUMERIC(10,3),
    model_name             TEXT NOT NULL DEFAULT 'auto_arima',
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(reservoir, forecast_date, target_date)
);

CREATE INDEX idx_forecast_date ON reservoir_forecast(forecast_date DESC);
CREATE INDEX idx_forecast_reservoir ON reservoir_forecast(reservoir, target_date);

-- ----- WARD-LEVEL RISK SCORES -----

CREATE TABLE ward_risk_score (
    id                      BIGSERIAL PRIMARY KEY,
    ward_number             INTEGER NOT NULL,
    computed_date           DATE NOT NULL,
    risk_score              NUMERIC(5,2) NOT NULL,
    risk_level              TEXT NOT NULL,
    groundwater_component   NUMERIC(5,2),
    trend_component         NUMERIC(5,2),
    reservoir_component     NUMERIC(5,2),
    seasonal_component      NUMERIC(5,2),
    factors                 JSONB,
    UNIQUE(ward_number, computed_date)
);

CREATE INDEX idx_risk_ward ON ward_risk_score(ward_number, computed_date DESC);
CREATE INDEX idx_risk_date ON ward_risk_score(computed_date DESC);

-- ----- DAILY INTELLIGENCE BRIEFINGS -----

CREATE TABLE daily_briefing (
    id              BIGSERIAL PRIMARY KEY,
    briefing_date   DATE NOT NULL UNIQUE,
    headline        TEXT NOT NULL,
    summary         TEXT NOT NULL,
    key_metrics     JSONB NOT NULL,
    alerts          JSONB,
    recommendations JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_briefing_date ON daily_briefing(briefing_date DESC);

-- ----- ROW LEVEL SECURITY -----

ALTER TABLE reservoir_forecast ENABLE ROW LEVEL SECURITY;
ALTER TABLE ward_risk_score ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_briefing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read reservoir_forecast"
    ON reservoir_forecast FOR SELECT USING (true);
CREATE POLICY "Public read ward_risk_score"
    ON ward_risk_score FOR SELECT USING (true);
CREATE POLICY "Public read daily_briefing"
    ON daily_briefing FOR SELECT USING (true);
