-- WRIS surface-water and rainfall telemetry tables.
--
-- India WRIS exposes hourly river-stage and rainfall readings from
-- CWC and state agencies through the same API base we already use for
-- groundwater. We store one row per (station_code, reading_date) -
-- daily aggregated like the groundwater_wris pattern. Sub-daily
-- granularity is dropped to keep storage manageable; if a use case
-- ever needs hourly, we can add a sibling _hourly table.
--
-- Aggregation per dataset:
--   river level  -> daily mean of HHT readings (m)
--   rainfall     -> daily MAX of IPC accumulator (mm). Accumulators
--                   reset at midnight, so max-per-day equals daily
--                   total rainfall.

CREATE TABLE IF NOT EXISTS wris_river_level (
  station_code      text        NOT NULL,
  station_name      text,
  latitude          double precision,
  longitude         double precision,
  agency            text,
  state             text,
  district          text,
  tehsil            text,
  major_basin       text,
  tributary         text,
  acquisition_mode  text,
  station_status    text,
  reading_date      date        NOT NULL,
  level_m           double precision,
  reading_count     integer     NOT NULL DEFAULT 0,
  source            text        NOT NULL DEFAULT 'wris',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (station_code, reading_date)
);

CREATE INDEX IF NOT EXISTS wris_river_level_district_date_idx
  ON wris_river_level (district, reading_date DESC);

CREATE INDEX IF NOT EXISTS wris_river_level_basin_idx
  ON wris_river_level (major_basin, tributary);

CREATE TABLE IF NOT EXISTS wris_rainfall (
  station_code      text        NOT NULL,
  station_name      text,
  latitude          double precision,
  longitude         double precision,
  agency            text,
  state             text,
  district          text,
  tehsil            text,
  major_basin       text,
  tributary         text,
  acquisition_mode  text,
  station_status    text,
  reading_date      date        NOT NULL,
  rainfall_mm       double precision,
  reading_count     integer     NOT NULL DEFAULT 0,
  source            text        NOT NULL DEFAULT 'wris',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (station_code, reading_date)
);

CREATE INDEX IF NOT EXISTS wris_rainfall_district_date_idx
  ON wris_rainfall (district, reading_date DESC);

CREATE INDEX IF NOT EXISTS wris_rainfall_basin_idx
  ON wris_rainfall (major_basin, tributary);

-- Public read RLS, mirroring our convention for the groundwater_wris table.
ALTER TABLE wris_river_level ENABLE ROW LEVEL SECURITY;
ALTER TABLE wris_rainfall    ENABLE ROW LEVEL SECURITY;

CREATE POLICY wris_river_level_public_read ON wris_river_level
  FOR SELECT USING (true);

CREATE POLICY wris_rainfall_public_read ON wris_rainfall
  FOR SELECT USING (true);
