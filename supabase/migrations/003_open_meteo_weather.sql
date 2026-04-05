-- Add Open-Meteo weather fields and update source enum
-- ET₀ (reference evapotranspiration) is critical for reservoir evaporation modeling
-- Wind speed supports more accurate evaporation estimates

-- Add 'open_meteo' to the data_source enum
ALTER TYPE data_source ADD VALUE IF NOT EXISTS 'open_meteo';

-- Add new columns to weather_daily
ALTER TABLE weather_daily
  ADD COLUMN IF NOT EXISTS et0_mm NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS wind_speed_max_kmh NUMERIC(6,2);

COMMENT ON COLUMN weather_daily.et0_mm IS 'FAO Penman-Monteith reference evapotranspiration (mm/day)';
COMMENT ON COLUMN weather_daily.wind_speed_max_kmh IS 'Maximum wind speed at 10m height (km/h)';
