-- =============================================================
-- 053_groundwater_dwlr_daily.sql
-- Ward water-level loggers, one row per logger per day, first from
-- CMWSSB's 200 ward loggers (neer-vazhvu-api/scripts/scrape_cmwssb_dwlr.py).
--
-- Unknowns stay null. status:
--   measured      depth is the mean of the day's readings that passed QC
--   stuck         under 10 cm of movement across 60 days; value kept,
--                 left out of statistics
--   not_measured  the day's readings all failed QC; depth null
--   dry           water below the bottom of the well; depth null and
--                 well_depth_m kept as the lower bound
-- A day with no reading gets no row.
--
-- RLS on with no public policy: the portal states no open licence, so the
-- table stays service-role only until a published surface reads it.
-- =============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS groundwater_dwlr_daily (
  city_id       TEXT NOT NULL REFERENCES cities(city_id) ON DELETE CASCADE,
  station_id    TEXT NOT NULL,
  station_name  TEXT,
  ward          INTEGER,
  zone          INTEGER,
  reading_date  DATE NOT NULL,
  depth_m_bgl   NUMERIC(8,3),
  well_depth_m  NUMERIC(8,3),
  readings      SMALLINT NOT NULL DEFAULT 0,
  dropped       SMALLINT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL
                CHECK (status IN ('measured', 'stuck', 'not_measured', 'dry')),
  raw_ref       TEXT,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (city_id, station_id, reading_date),
  CHECK ((status IN ('not_measured', 'dry')) = (depth_m_bgl IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_groundwater_dwlr_daily_recent
  ON groundwater_dwlr_daily (city_id, reading_date DESC);

ALTER TABLE groundwater_dwlr_daily ENABLE ROW LEVEL SECURITY;

COMMIT;
