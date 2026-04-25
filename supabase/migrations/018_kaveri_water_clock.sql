-- =============================================================
-- 018_kaveri_water_clock.sql
-- Kaveri Delta region scaffold + Water Clock daily-data tables.
-- Additive: extends existing schema, no destructive changes.
-- =============================================================

-- ----- 1. Place model: regions can lack ULB / wards -----

ALTER TABLE cities ALTER COLUMN ward_count DROP NOT NULL;
ALTER TABLE cities ALTER COLUMN local_gov_acronym DROP NOT NULL;
ALTER TABLE cities ALTER COLUMN local_gov_name DROP NOT NULL;

ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS place_kind TEXT NOT NULL DEFAULT 'city'
  CHECK (place_kind IN ('city', 'region'));

-- ----- 2. Extend WaterSourceType to allow flow_station (for Biligundlu) -----

ALTER TABLE water_sources DROP CONSTRAINT IF EXISTS water_sources_source_type_check;
ALTER TABLE water_sources ADD CONSTRAINT water_sources_source_type_check
  CHECK (source_type IN ('reservoir','cauvery_stage','borewell_field','river','flow_station'));

-- ----- 3. Reservoir daily v2: keyed (city_id, source_code, date) -----
-- Replaces the Chennai-specific reservoir_daily for multi-place use.
-- reservoir_daily stays as-is for existing Chennai pipeline; v2 is the new shape.

CREATE TABLE IF NOT EXISTS reservoir_daily_v2 (
  city_id          TEXT NOT NULL REFERENCES cities(city_id) ON DELETE CASCADE,
  source_code      TEXT NOT NULL,
  date             DATE NOT NULL,
  storage_tmc      NUMERIC(8,3),
  storage_pct_frl  NUMERIC(5,2),
  level_ft         NUMERIC(8,2),
  inflow_cusecs    INTEGER,
  outflow_cusecs   INTEGER,
  source           TEXT NOT NULL,
  scraped_from     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (city_id, source_code, date),
  FOREIGN KEY (city_id, source_code)
    REFERENCES water_sources(city_id, source_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reservoir_daily_v2_city_date
  ON reservoir_daily_v2(city_id, date DESC);

-- ----- 4. Flow station daily (Biligundlu CWMA realisation) -----
-- source_method = 'manual_admin' wins on conflict via priority column.

CREATE TABLE IF NOT EXISTS flow_station_daily (
  city_id                   TEXT NOT NULL REFERENCES cities(city_id) ON DELETE CASCADE,
  source_code               TEXT NOT NULL,
  date                      DATE NOT NULL,
  cumulative_tmc_ytd        NUMERIC(8,3),
  cumulative_normal_tmc_ytd NUMERIC(8,3),
  source_method             TEXT NOT NULL CHECK (source_method IN ('auto_scrape','manual_admin')),
  priority                  INTEGER NOT NULL DEFAULT 0,
  source_url                TEXT,
  note                      TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (city_id, source_code, date)
);

CREATE INDEX IF NOT EXISTS idx_flow_station_daily_city_date
  ON flow_station_daily(city_id, date DESC);

-- ----- 5. Basin rainfall daily (Cauvery basin SW + NE cumulative) -----
-- Not a water_sources row: a measurement area, not a source.

CREATE TABLE IF NOT EXISTS basin_rainfall_daily (
  city_id        TEXT NOT NULL REFERENCES cities(city_id) ON DELETE CASCADE,
  basin_code     TEXT NOT NULL,
  date           DATE NOT NULL,
  season         TEXT NOT NULL CHECK (season IN ('sw','ne')),
  rainfall_mm    NUMERIC(8,2),
  cumulative_mm  NUMERIC(10,2),
  lpa_mm         NUMERIC(10,2),
  source         TEXT NOT NULL CHECK (source IN ('imd','chirps','gee')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (city_id, basin_code, date, season)
);

CREATE INDEX IF NOT EXISTS idx_basin_rainfall_city_basin_date
  ON basin_rainfall_daily(city_id, basin_code, date DESC);

-- ----- 6. Mettur release signal (daily computed) -----

CREATE TABLE IF NOT EXISTS mettur_release_signal (
  date           DATE PRIMARY KEY,
  signal         TEXT NOT NULL CHECK (signal IN ('likely','uncertain','unlikely')),
  model_version  TEXT NOT NULL,
  inputs         JSONB NOT NULL,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----- 7. Delta infrastructure assets (V1 timeline visual seed) -----

CREATE TABLE IF NOT EXISTS delta_infrastructure_assets (
  asset_id                 TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  asset_type               TEXT NOT NULL CHECK (asset_type IN ('dam','anicut','barrage','canal_main','regulator')),
  built_year               INTEGER NOT NULL,
  builder                  TEXT,
  last_restored_year       INTEGER,
  current_status           TEXT CHECK (current_status IN ('operational','collapsed','rebuilding','decommissioned')),
  design_discharge_cusecs  INTEGER,
  current_efficiency_pct   NUMERIC(5,2),
  latitude                 NUMERIC(8,5),
  longitude                NUMERIC(8,5),
  citation_url             TEXT
);

-- ----- 8. Delta capex projects (V1 timeline visual seed) -----

CREATE TABLE IF NOT EXISTS delta_capex_projects (
  project_id            TEXT PRIMARY KEY,
  scheme_name           TEXT NOT NULL,
  sanctioned_year       INTEGER,
  sanctioned_amount_cr  NUMERIC(10,2),
  financier             TEXT,
  status                TEXT CHECK (status IN ('completed','in_progress','stalled')),
  scope_km              NUMERIC(10,2),
  completed_year        INTEGER,
  citation_url          TEXT
);

-- =============================================================
-- Seed data
-- =============================================================

-- ----- Seed: Kaveri Delta region -----

INSERT INTO cities (
  city_id, display_name, state_code, timezone,
  center_lat, center_lng, bbox_south, bbox_north, bbox_west, bbox_east,
  primary_authority_acronym, primary_authority_name,
  local_gov_acronym, local_gov_name, ward_count,
  default_consumption_mld, default_desalination_mld, enabled, place_kind
) VALUES (
  'kaveri', 'Kaveri Delta', 'TN', 'Asia/Kolkata',
  10.78000, 79.13000, 10.00000, 13.00000, 77.00000, 80.00000,
  'TN WRD', 'Tamil Nadu Water Resources Department',
  NULL, NULL, NULL,
  NULL, NULL, TRUE, 'region'
) ON CONFLICT (city_id) DO NOTHING;

-- ----- Seed: Kaveri water sources (Mettur + Karnataka 4-dam + Biligundlu) -----

INSERT INTO water_sources (
  city_id, source_code, display_name, source_type,
  full_capacity_mcft, full_tank_level_ft, latitude, longitude,
  catchment_area_sqkm, display_order, is_primary_drinking_source
) VALUES
  ('kaveri','mettur',     'Mettur',                    'reservoir',    93400.000, 120.00, 11.78880, 77.79170, 42200.00, 1, FALSE),
  ('kaveri','krs',        'Krishna Raja Sagara (KRS)', 'reservoir',    49450.000, NULL,   12.42420, 76.57170, 10619.00, 2, FALSE),
  ('kaveri','kabini',     'Kabini',                    'reservoir',    19520.000, NULL,   11.97060, 76.35000,  2141.00, 3, FALSE),
  ('kaveri','hemavathy',  'Hemavathy',                 'reservoir',    37100.000, NULL,   12.81670, 76.05000,  2810.00, 4, FALSE),
  ('kaveri','harangi',    'Harangi',                   'reservoir',     8500.000, NULL,   12.49720, 75.90690,   419.00, 5, FALSE),
  ('kaveri','biligundlu', 'Biligundlu (CWMA control)', 'flow_station', NULL,      NULL,   12.05000, 77.60000,   NULL,   6, FALSE)
ON CONFLICT (city_id, source_code) DO NOTHING;

-- ----- Seed: Kaveri water source name aliases -----

INSERT INTO water_source_name_aliases (city_id, alias, source_code) VALUES
  ('kaveri','mettur','mettur'),
  ('kaveri','mettur dam','mettur'),
  ('kaveri','krs','krs'),
  ('kaveri','krishna raja sagara','krs'),
  ('kaveri','krishnarajasagara','krs'),
  ('kaveri','kabini','kabini'),
  ('kaveri','hemavathy','hemavathy'),
  ('kaveri','hemavathi','hemavathy'),
  ('kaveri','harangi','harangi'),
  ('kaveri','biligundlu','biligundlu')
ON CONFLICT (city_id, alias) DO NOTHING;

-- ----- Seed: delta infrastructure assets (V1 timeline) -----
-- Lat/lon sourced from OSM where available. citation_url points to the most
-- authoritative single source per asset; deeper provenance lives in
-- docs/kaveri-water-clock-plan.md and the kaveri_delta_infrastructure_research
-- memory.

INSERT INTO delta_infrastructure_assets (
  asset_id, name, asset_type, built_year, builder, last_restored_year,
  current_status, design_discharge_cusecs, current_efficiency_pct,
  latitude, longitude, citation_url
) VALUES
  ('kallanai',                'Kallanai (Grand Anicut)',     'anicut',     150,  'Karikala Chola',          NULL, 'operational', NULL, NULL,
   10.82600, 78.81800, 'https://en.wikipedia.org/wiki/Kallanai_Dam'),
  ('upper_anicut',            'Upper Anicut (Mukkombu)',     'anicut',     1838, 'Sir Arthur Cotton',       2024, 'operational', NULL, NULL,
   10.86310, 78.64470, 'https://en.wikipedia.org/wiki/Upper_Anaicut'),
  ('lower_anicut',            'Lower Anicut (Anaikarai)',    'anicut',     1836, 'Sir Arthur Cotton',       NULL, 'operational', NULL, NULL,
   10.99200, 79.40800, 'https://www.icid.org/pd3_pap_Rajagopal.pdf'),
  ('mettur_dam',              'Mettur Dam',                  'dam',        1934, 'Madras Presidency PWD',   NULL, 'operational', NULL, NULL,
   11.78880, 77.79170, 'https://en.wikipedia.org/wiki/Mettur_Dam'),
  ('grand_anicut_canal_main', 'Grand Anicut Canal (main)',   'canal_main', 1934, 'Madras Presidency PWD',   2021, 'operational', NULL, 45.00,
   10.82600, 78.81800, 'https://www.dtnext.in/news/tamilnadu/water-resource-dept-takes-up-projects-worth-over-rs-5k-crore-to-modernise-irrigation-infra-of-cauvery-sub-basin-791622')
ON CONFLICT (asset_id) DO NOTHING;

-- ----- Seed: delta capex projects (V1 timeline) -----
-- Amounts approximate; verify before launch. World Bank and ADB amounts
-- converted to crore at contemporaneous USD/INR rates.

INSERT INTO delta_capex_projects (
  project_id, scheme_name, sanctioned_year, sanctioned_amount_cr, financier,
  status, scope_km, completed_year, citation_url
) VALUES
  ('iamwarm',          'TN-IAMWARM',                                2007, 3550.00, 'World Bank',                 'completed',   NULL,   2015,
   'https://en.wikipedia.org/wiki/TN-IAMWARM'),
  ('adb_vennar',       'ADB Vennar Subbasin Climate Adaptation',    2014,  725.00, 'Asian Development Bank',     'in_progress',  235.0, NULL,
   'https://www.adb.org/projects/44429-013/main'),
  ('grand_anicut_erm', 'Grand Anicut Canal ERM',                    2021, 2639.00, 'NABARD-NIDA-AIIB',           'in_progress', 1232.0, NULL,
   'https://www.aiib.org/en/projects/details/2021/proposed/India-Extension-Renovation-and-Modernization-of-Grand-Anicut-Canal-System.html'),
  ('cauvery_subbasin', 'Cauvery sub-basin renovation',              2022, 3607.00, 'TN State + NABARD',          'in_progress', 2000.0, NULL,
   'https://www.dtnext.in/news/tamilnadu/water-resource-dept-takes-up-projects-worth-over-rs-5k-crore-to-modernise-irrigation-infra-of-cauvery-sub-basin-791622'),
  ('mukkombu_rebuild', 'Mukkombu (Upper Anicut) reconstruction',    2019,  410.00, 'TN State',                   'completed',   NULL,   2024,
   'https://www.deccanchronicle.com/nation/current-affairs/250818/only-age-not-sand-mining-caused-mukkombu-damage-tn-cm.html')
ON CONFLICT (project_id) DO NOTHING;
