-- =============================================================
-- 070_jaipur_water_sources.sql
-- Jaipur's two tracked dams. reservoir_daily_v2 has a foreign key on
-- (city_id, source_code): apply before the first scrape_rajasthan_wrd_dams.py
-- --supabase. source_code = waterSources[].sourceCode = DB_SOURCES in the scraper.
--   bisalpur - Banas, Tonk (NRLD-2019 RA11HH0160). 590 of 766.73 MLD
--              (PHED APR 2025-26). Shared with Ajmer, Tonk, irrigation.
--   ramgarh  - Banganga (NRLD-2019 RA11MH0016, 1901). Former city source
--              (SC 9 Nov 2017); 0.000 Mcum on every WRD date read 2023-2026.
-- is_primary TRUE for Bisalpur only; the hero is the supply overview with
-- default_consumption_mld NULL (069), so no runway from a shared dam.
-- full_capacity_mcft is DESIGNED GROSS, not live: the WRD report prints gross
-- storage and % of designed gross only, and the scraper writes that basis.
-- Bisalpur 1,095.840 Mcum (= NRLD gross); Ramgarh 75.040 Mcum (2026; 75.022
-- in 2025). FRL: Bisalpur 315.50 m; Ramgarh NULL (19.82 m is a gauge
-- reading). Coordinates: NRLD-2019, text and page image. Apply after 069.
-- =============================================================
INSERT INTO water_sources (
  city_id, source_code, display_name, source_type,
  full_capacity_mcft, full_tank_level_ft,
  latitude, longitude, catchment_area_sqkm,
  display_order, is_primary_drinking_source
) VALUES
  ('jaipur', 'bisalpur', 'Bisalpur (Banas)',        'reservoir', 38699.3, 1035.1, 25.92472, 75.45583, NULL, 1, TRUE),
  ('jaipur', 'ramgarh',  'Ramgarh (Jamwa Ramgarh)', 'reservoir',  2650.0,   NULL, 27.04556, 76.06000, NULL, 2, FALSE)
ON CONFLICT (city_id, source_code) DO NOTHING;
