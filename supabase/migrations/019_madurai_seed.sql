-- =============================================================
-- 019_madurai_seed.sql
-- Madurai city seed: cities row + water_sources rows + aliases.
-- Reuses multi-place schema from 017 (cities, water_sources) and 018
-- (place_kind, reservoir_daily_v2, basin_rainfall_daily). No new tables.
-- =============================================================

-- ----- Seed: Madurai city -----
-- Center: Meenakshi Temple area. Bbox: MMC 100-ward envelope.
-- Default consumption 135 MLD: CMA Madurai Master Plan vol II baseline supply
-- (city demand ~270 MLD, supply ~135 MLD - we model the supply side).
-- Desalination: not applicable for Madurai (no coastal access).

INSERT INTO cities (
  city_id, display_name, state_code, timezone,
  center_lat, center_lng, bbox_south, bbox_north, bbox_west, bbox_east,
  primary_authority_acronym, primary_authority_name,
  local_gov_acronym, local_gov_name, ward_count,
  default_consumption_mld, default_desalination_mld, enabled, place_kind
) VALUES (
  'madurai', 'Madurai', 'TN', 'Asia/Kolkata',
  9.92520, 78.11980, 9.85000, 10.00000, 78.05000, 78.20000,
  'MMC', 'Madurai Municipal Corporation',
  'MMC', 'Madurai Municipal Corporation', 100,
  135, NULL, TRUE, 'city'
) ON CONFLICT (city_id) DO NOTHING;

-- ----- Seed: Madurai water sources -----
-- Vaigai: primary city source, on TN Agri ARS portal (same scraper as Mettur).
--   Capacity 6,837 Mcft as listed on tnagriculture.in (~193 MCM).
--   Different secondary sources cite 174 MCM (live storage); we use TN Agri's
--   figure since our scraper validates against that page.
-- Mullaperiyar: Kerala-controlled, TN-operated (1886 lease). Dual-sourced -
--   TN Agri publishes under "Periyar"; Kerala SDMA publishes under
--   "Mullaperiyar" with a different storage cap (Kerala caps at 142 ft per SC
--   2014 ruling; TN-side records use 152 ft historical FRL).
-- Sothuparai: small Vaigai-tributary dam on Varaha river, Periyakulam taluk.
--   NOT on TN Agri portal (PWD WRD daily memo only) - scraper gap, seeded
--   for completeness.
-- Manjalar / Marudhanadi / Sathaiyar are smaller Vaigai-system reservoirs;
--   deferred to a later commit pending verified coordinates.

INSERT INTO water_sources (
  city_id, source_code, display_name, source_type,
  full_capacity_mcft, full_tank_level_ft, latitude, longitude,
  catchment_area_sqkm, display_order, is_primary_drinking_source
) VALUES
  ('madurai','vaigai',       'Vaigai Dam',                     'reservoir',  6837.000,  71.00,  10.05330, 77.58970,  2253.00, 1, TRUE),
  ('madurai','mullaperiyar', 'Mullaperiyar (Periyar) Dam',     'reservoir', 15660.000, 152.00,   9.53940, 77.14220,   624.00, 2, TRUE),
  ('madurai','sothuparai',   'Sothuparai Dam',                 'reservoir',  1272.000,  NULL,   10.07000, 77.45000,    NULL,  3, FALSE)
ON CONFLICT (city_id, source_code) DO NOTHING;

-- ----- Seed: Madurai water source name aliases -----
-- Aliases mediate between scraper-source naming and our canonical source_code.
-- 'periyar' alias resolves the TN Agri portal's listing to mullaperiyar.
-- Tamil-script aliases support future Tamil-language UI / Tamil press scraping.

INSERT INTO water_source_name_aliases (city_id, alias, source_code) VALUES
  ('madurai','vaigai','vaigai'),
  ('madurai','vaigai dam','vaigai'),
  ('madurai','வைகை','vaigai'),
  ('madurai','mullaperiyar','mullaperiyar'),
  ('madurai','mullai periyar','mullaperiyar'),
  ('madurai','periyar','mullaperiyar'),
  ('madurai','periyar dam','mullaperiyar'),
  ('madurai','மூலைப்பெரியார்','mullaperiyar'),
  ('madurai','sothuparai','sothuparai'),
  ('madurai','sothuparai dam','sothuparai'),
  ('madurai','சோத்துப்பாறை','sothuparai')
ON CONFLICT (city_id, alias) DO NOTHING;
