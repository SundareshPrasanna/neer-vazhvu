-- =============================================================
-- 055_ahmedabad_water_sources.sql
-- The three dams whose daily storage the Gujarat water department publishes
-- and scrape_gujarat_wrd_dams.py ingests into reservoir_daily_v2 (which has a
-- foreign key on (city_id, source_code), so these rows must exist first).
--
-- None is the city's own storage, so none is a primary drinking source:
--   sardar_sarovar - 84% of AMC's supply comes down its canal (Budget
--                    2026-27), but it is a four-state project and the
--                    city's share is not published.
--   kadana         - feeds Raska through the Wanakbori weir and the Shedhi
--                    branch canal; an irrigation dam.
--   dharoi         - the Sabarmati's own dam; not a current AMC source
--                    (releases to the city stopped in 1999).
-- full_capacity_mcft is DESIGNED LIVE storage from the department's report
-- (1 MCM = 35.3147 mcft); full_tank_level_ft is FRL in feet.
-- =============================================================

INSERT INTO water_sources (
  city_id, source_code, display_name, source_type,
  full_capacity_mcft, full_tank_level_ft,
  latitude, longitude, catchment_area_sqkm,
  display_order, is_primary_drinking_source
) VALUES
  ('ahmedabad', 'sardar_sarovar', 'Sardar Sarovar (Narmada)', 'reservoir', 203412.7, 455.0, 21.83100, 73.75020, NULL, 1, FALSE),
  ('ahmedabad', 'kadana',         'Kadana (Mahi)',            'reservoir',  42084.6, 419.0, 23.30530, 73.82480, NULL, 2, FALSE),
  ('ahmedabad', 'dharoi',         'Dharoi (Sabarmati)',       'reservoir',  26331.8, 622.0, 24.00440, 72.85390, NULL, 3, FALSE)
ON CONFLICT (city_id, source_code) DO NOTHING;
