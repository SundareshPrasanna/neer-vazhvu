-- =============================================================
-- 061_nagpur_water_sources.sql
-- Nagpur's four tracked sources. reservoir_daily_v2 has a foreign key on
-- (city_id, source_code), so these rows must exist before the first write by
-- scrape_pravah_dams.py --city nagpur or backfill_pravah_marathi_archive.py.
-- source_code equals waterSources[].sourceCode in src/lib/cities/nagpur.ts
-- and what both scripts write.
--
--   totladoh        - the Pench hydro-electric project reservoir (NRLD-2019
--                     purpose H, p.196), shared with Madhya Pradesh. NMC's
--                     Pench I-IV treatment plants (546 of 786 MLD, NMC ESR
--                     2023-24) run on water released from it. Pravah daily.
--   navegaon_khairi - Kamthi Khairy in the bulletin, KAMTHIKHAIRY (PENCH) in
--                     NRLD-2019 (purpose I, p.172): the Pench irrigation
--                     project's dam below Totladoh, from which NMC's draw
--                     travels 48.5 km to the Mahadula pumping station.
--                     Pravah daily.
--   kanhan_intake   - run-of-river intake for the 240 MLD Kanhan plant, about
--                     14 km from the city and 300 m below the Kolar
--                     confluence (NMC ESR 2017-18 s.4.1.2). No storage and no
--                     daily feed; the point is that ESR description placed on
--                     OSM's river lines (Kolar-Kanhan confluence node
--                     1570091102), so it is approximate.
--   gorewada        - NMC's 1911 lake on the Pili (NRLD-2019 p.151, gross
--                     8.84 Mcum, effective storage not printed). Not in the
--                     daily bulletin; no feed.
--
-- is_primary_drinking_source is TRUE for the three the city draws on. The
-- flag drives the history chart's default series, the About badge and the
-- "waiting for first daily ingestion" pill; it can only feed a days-left
-- figure under heroMode 'days-left', and Nagpur uses the supply-overview
-- hero with default_consumption_mld NULL (060), the Pune pattern. Totladoh
-- and Navegaon Khairi hold whole-dam storage in which NMC has a reservation,
-- never the city's own stock. Gorewada is FALSE: its old 16 MLD plant is not
-- among the five treatment plants NMC lists for 2023-24 (ESR 2023-24).
--
-- full_capacity_mcft is DESIGNED LIVE storage from the bulletin (1 Mcum =
-- 35.3147 mcft): Totladoh 1,016.93 Mcum, Kamthi Khairy 141.98 Mcum, both equal
-- to NRLD-2019 effective storage. NULL for the intake (no storage) and for
-- Gorewada (no live figure in the register). full_tank_level_ft is Totladoh's
-- FRL 490.00 m (CWC weekly reservoir bulletin) in feet; the bulletin prints
-- no FRL and no source used here gives Kamthi Khairy's.
--
-- Coordinates: NRLD-2019 dam positions (Totladoh 21 39'32" N 79 13'55" E;
-- Kamthikhairy 21 27'42" N 79 11'27" E; Gorewada 21 11'53" N 79 2'44" E),
-- checked against MRSAC's 1:10,000 water-body polygons (2017-18): Totladoh's
-- point lies 6 m off its 75.39 km2 polygon (the dam is at its edge), the
-- other two fall inside theirs.
--
-- DRAFT. Not applied. Apply after 060, before the first scrape.
-- =============================================================

INSERT INTO water_sources (
  city_id, source_code, display_name, source_type,
  full_capacity_mcft, full_tank_level_ft,
  latitude, longitude, catchment_area_sqkm,
  display_order, is_primary_drinking_source
) VALUES
  ('nagpur', 'totladoh',        'Totladoh (Pench)',                'reservoir', 35912.6, 1607.6, 21.65889, 79.23194, NULL, 1, TRUE),
  ('nagpur', 'navegaon_khairi', 'Navegaon Khairi (Kamthi Khairy)', 'reservoir',  5014.0,   NULL, 21.46167, 79.19083, NULL, 2, TRUE),
  ('nagpur', 'kanhan_intake',   'Kanhan river intake',             'river',        NULL,   NULL, 21.24743, 79.16088, NULL, 3, TRUE),
  ('nagpur', 'gorewada',        'Gorewada lake',                   'reservoir',    NULL,   NULL, 21.19806, 79.04556, NULL, 4, FALSE)
ON CONFLICT (city_id, source_code) DO NOTHING;
