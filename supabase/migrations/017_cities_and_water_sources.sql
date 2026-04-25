-- =============================================================
-- 017_cities_and_water_sources.sql
-- Phase 0 multi-city foundation.
-- Additive: no existing tables are altered.
-- Follow-up migrations will add city_id to existing tables.
-- =============================================================

CREATE TABLE IF NOT EXISTS cities (
  city_id                    TEXT PRIMARY KEY,
  display_name               TEXT NOT NULL,
  state_code                 TEXT NOT NULL,
  timezone                   TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  center_lat                 NUMERIC(8,5) NOT NULL,
  center_lng                 NUMERIC(8,5) NOT NULL,
  bbox_south                 NUMERIC(8,5) NOT NULL,
  bbox_north                 NUMERIC(8,5) NOT NULL,
  bbox_west                  NUMERIC(8,5) NOT NULL,
  bbox_east                  NUMERIC(8,5) NOT NULL,
  primary_authority_acronym  TEXT NOT NULL,
  primary_authority_name     TEXT NOT NULL,
  local_gov_acronym          TEXT NOT NULL,
  local_gov_name             TEXT NOT NULL,
  ward_count                 INTEGER NOT NULL,
  default_consumption_mld    NUMERIC(8,2),
  default_desalination_mld   NUMERIC(8,2),
  enabled                    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS water_sources (
  city_id                     TEXT NOT NULL REFERENCES cities(city_id) ON DELETE CASCADE,
  source_code                 TEXT NOT NULL,
  display_name                TEXT NOT NULL,
  source_type                 TEXT NOT NULL CHECK (source_type IN ('reservoir','cauvery_stage','borewell_field','river')),
  full_capacity_mcft          NUMERIC(10,3),
  full_tank_level_ft          NUMERIC(8,2),
  latitude                    NUMERIC(8,5) NOT NULL,
  longitude                   NUMERIC(8,5) NOT NULL,
  catchment_area_sqkm         NUMERIC(10,2),
  display_order               INTEGER NOT NULL,
  is_primary_drinking_source  BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (city_id, source_code)
);

CREATE INDEX IF NOT EXISTS idx_water_sources_city ON water_sources(city_id, display_order);

CREATE TABLE IF NOT EXISTS water_source_name_aliases (
  city_id       TEXT NOT NULL,
  alias         TEXT NOT NULL,
  source_code   TEXT NOT NULL,
  PRIMARY KEY (city_id, alias),
  FOREIGN KEY (city_id, source_code) REFERENCES water_sources(city_id, source_code) ON DELETE CASCADE
);

-- ----- Seed: Chennai -----

INSERT INTO cities (
  city_id, display_name, state_code, timezone,
  center_lat, center_lng, bbox_south, bbox_north, bbox_west, bbox_east,
  primary_authority_acronym, primary_authority_name,
  local_gov_acronym, local_gov_name, ward_count,
  default_consumption_mld, default_desalination_mld, enabled
) VALUES (
  'chennai', 'Chennai', 'TN', 'Asia/Kolkata',
  13.0827, 80.2707, 12.70, 13.40, 79.90, 80.40,
  'CMWSSB', 'Chennai Metropolitan Water Supply and Sewerage Board',
  'GCC', 'Greater Chennai Corporation', 200,
  830, 190, TRUE
) ON CONFLICT (city_id) DO NOTHING;

INSERT INTO water_sources (
  city_id, source_code, display_name, source_type,
  full_capacity_mcft, full_tank_level_ft, latitude, longitude,
  catchment_area_sqkm, display_order, is_primary_drinking_source
) VALUES
  ('chennai','chembarambakkam','Chembarambakkam','reservoir',3645.0,24.0,12.9517,80.0551,71.6,1,TRUE),
  ('chennai','redhills','Red Hills (Puzhal)','reservoir',3300.0,48.5,13.1710,80.1811,60.3,2,TRUE),
  ('chennai','poondi','Poondi','reservoir',3231.0,36.0,13.3542,80.0678,2530.0,3,TRUE),
  ('chennai','veeranam','Veeranam','reservoir',1465.0,NULL,11.3500,79.5400,NULL,4,FALSE),
  ('chennai','kannankottai','Kannankottai (TK)','reservoir',500.0,NULL,12.8200,79.9800,NULL,5,FALSE),
  ('chennai','cholavaram','Cholavaram','reservoir',1081.0,22.0,13.2184,80.1499,77.4,6,TRUE)
ON CONFLICT (city_id, source_code) DO NOTHING;

INSERT INTO water_source_name_aliases (city_id, alias, source_code) VALUES
  ('chennai','poondi','poondi'),
  ('chennai','cholavaram','cholavaram'),
  ('chennai','puzhal','redhills'),
  ('chennai','red hills','redhills'),
  ('chennai','chembarambakkam','chembarambakkam'),
  ('chennai','veeranam','veeranam'),
  ('chennai','kannankottai','kannankottai'),
  ('chennai','thervoy kandigai','kannankottai')
ON CONFLICT (city_id, alias) DO NOTHING;
