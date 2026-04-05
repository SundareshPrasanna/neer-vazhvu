-- =============================================================
-- 001_initial_schema.sql
-- Neer Vazhvu - Chennai Water Intelligence Dashboard
-- =============================================================

-- ----- ENUM TYPES -----

CREATE TYPE reservoir_name AS ENUM (
  'poondi',
  'cholavaram',
  'redhills',
  'chembarambakkam',
  'veeranam',
  'kannankottai'
);

CREATE TYPE data_source AS ENUM (
  'kaggle',
  'cmwssb_scrape',
  'opencity_ckan',
  'nasa_power',
  'cgwb',
  'manual'
);

-- ----- RESERVOIR DAILY STORAGE -----

CREATE TABLE reservoir_daily (
  id                  BIGSERIAL PRIMARY KEY,
  reservoir           reservoir_name NOT NULL,
  date                DATE NOT NULL,
  current_level_ft    NUMERIC(8,2),
  current_storage_mcft NUMERIC(10,3),
  capacity_mcft       NUMERIC(10,3),
  storage_pct         NUMERIC(5,2),
  inflow_cusecs       NUMERIC(10,2),
  outflow_cusecs      NUMERIC(10,2),
  rainfall_mm         NUMERIC(8,2),
  source              data_source NOT NULL DEFAULT 'cmwssb_scrape',
  scraped_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reservoir, date)
);

CREATE INDEX idx_reservoir_daily_date ON reservoir_daily(date DESC);
CREATE INDEX idx_reservoir_daily_reservoir_date ON reservoir_daily(reservoir, date DESC);

-- ----- WARD-LEVEL GROUNDWATER -----

CREATE TABLE groundwater_monthly (
  id                  BIGSERIAL PRIMARY KEY,
  ward_number         INTEGER NOT NULL,
  ward_name           TEXT,
  zone_name           TEXT,
  year                INTEGER NOT NULL,
  month               INTEGER NOT NULL,
  depth_to_water_m    NUMERIC(8,2),
  source              data_source NOT NULL DEFAULT 'opencity_ckan',
  ingested_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ward_number, year, month)
);

CREATE INDEX idx_gw_ward_date ON groundwater_monthly(ward_number, year DESC, month DESC);
CREATE INDEX idx_gw_year_month ON groundwater_monthly(year DESC, month DESC);

-- ----- NASA POWER WEATHER DATA -----

CREATE TABLE weather_daily (
  id                  BIGSERIAL PRIMARY KEY,
  date                DATE NOT NULL UNIQUE,
  latitude            NUMERIC(6,4) DEFAULT 13.0827,
  longitude           NUMERIC(7,4) DEFAULT 80.2707,
  precipitation_mm    NUMERIC(8,2),
  temp_max_c          NUMERIC(5,2),
  temp_min_c          NUMERIC(5,2),
  humidity_pct        NUMERIC(5,2),
  source              data_source NOT NULL DEFAULT 'nasa_power',
  fetched_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weather_date ON weather_daily(date DESC);

-- ----- COMPUTED: DAYS OF WATER LEFT -----

CREATE TABLE water_estimate_daily (
  id                      BIGSERIAL PRIMARY KEY,
  date                    DATE NOT NULL UNIQUE,
  total_storage_mcft      NUMERIC(12,3),
  total_capacity_mcft     NUMERIC(12,3),
  storage_pct             NUMERIC(5,2),
  consumption_mld         NUMERIC(8,2),
  consumption_mcft_day    NUMERIC(8,3),
  avg_inflow_mcft_day     NUMERIC(8,3),
  avg_outflow_mcft_day    NUMERIC(8,3),
  net_depletion_mcft_day  NUMERIC(8,3),
  days_left_pessimistic   INTEGER,
  days_left_moderate      INTEGER,
  days_left_optimistic    INTEGER,
  computed_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_estimate_date ON water_estimate_daily(date DESC);

-- ----- DATA PIPELINE LOG -----

CREATE TABLE pipeline_log (
  id              BIGSERIAL PRIMARY KEY,
  run_date        DATE NOT NULL,
  step            TEXT NOT NULL,
  status          TEXT NOT NULL,
  rows_affected   INTEGER DEFAULT 0,
  error_message   TEXT,
  duration_ms     INTEGER,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_pipeline_date ON pipeline_log(run_date DESC);

-- ----- REFERENCE: RESERVOIR METADATA -----

CREATE TABLE reservoir_meta (
  reservoir           reservoir_name PRIMARY KEY,
  display_name        TEXT NOT NULL,
  full_capacity_mcft  NUMERIC(10,3) NOT NULL,
  full_tank_level_ft  NUMERIC(8,2),
  latitude            NUMERIC(8,5),
  longitude           NUMERIC(8,5),
  catchment_area_sqkm NUMERIC(8,2)
);

INSERT INTO reservoir_meta VALUES
  ('poondi',          'Poondi',              3231.0, 36.00, 13.3542, 80.0678, 2530.0),
  ('cholavaram',      'Cholavaram',           881.0, 22.00, 13.2184, 80.1499, 77.4),
  ('redhills',        'Red Hills (Puzhal)',  3300.0, 48.50, 13.1710, 80.1811, 60.3),
  ('chembarambakkam', 'Chembarambakkam',     3645.0, 24.00, 12.9517, 80.0551, 71.6),
  ('veeranam',        'Veeranam',            1465.0, NULL,  11.3500, 79.5400, NULL),
  ('kannankottai',    'Kannankottai (TK)',    1574.0, NULL,  12.8200, 79.9800, NULL);

-- ----- ROW LEVEL SECURITY -----

ALTER TABLE reservoir_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundwater_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_estimate_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read reservoir_daily"
  ON reservoir_daily FOR SELECT USING (true);
CREATE POLICY "Public read groundwater_monthly"
  ON groundwater_monthly FOR SELECT USING (true);
CREATE POLICY "Public read weather_daily"
  ON weather_daily FOR SELECT USING (true);
CREATE POLICY "Public read water_estimate_daily"
  ON water_estimate_daily FOR SELECT USING (true);

-- ----- SQL FUNCTION: Average monthly inflow -----

CREATE OR REPLACE FUNCTION avg_monthly_inflow(target_month INTEGER)
RETURNS TABLE(avg_inflow_mcft_per_day NUMERIC) AS $$
  SELECT
    AVG(daily_total_cusecs) * 0.0864 as avg_inflow_mcft_per_day
  FROM (
    SELECT date, SUM(inflow_cusecs) as daily_total_cusecs
    FROM reservoir_daily
    WHERE EXTRACT(MONTH FROM date) = target_month
      AND inflow_cusecs IS NOT NULL
      AND inflow_cusecs > 0
    GROUP BY date
  ) daily_sums;
$$ LANGUAGE SQL STABLE;
