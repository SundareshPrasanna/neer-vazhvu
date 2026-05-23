-- =============================================================
-- 025_bangalore_water_sources.sql
-- Bangalore's upstream Cauvery basin reservoirs.
--
-- Unlike Chennai (impounded local reservoirs) and Madurai (Vaigai +
-- Mullaperiyar dedicated supply), Bangalore's water security is set
-- ~150-200 km upstream by 4 Cauvery basin reservoirs jointly:
--   - Krishnaraja Sagar (KRS)   48.4 TMC   Mandya district
--   - Hemavathi (Gorur)         35.7 TMC   Hassan district
--   - Kabini (Beechanahalli)    19.52 TMC  Mysore district
--   - Harangi                    8.50 TMC  Kodagu district
--
-- These are NOT Bangalore's tap supply - they are the upstream basin
-- storage that determines (a) how much Cauvery water Karnataka can
-- release for Bangalore drinking + irrigation, (b) seasonal risk for
-- the BWSSB Cauvery Stages I-V pumping at T.K. Halli.
--
-- is_primary_drinking_source=FALSE for all four: they feed irrigation,
-- Mysore, Mandya, and Bangalore drinking allocation in that order.
-- The Bangalore home page hero will display them as an "upstream basin
-- storage" panel, not a days-left math.
--
-- Mirrors Madurai's Mullaperiyar pattern (Kerala-side dam, not within
-- Madurai bbox, still tracked because it feeds Madurai's supply chain).
-- =============================================================

INSERT INTO water_sources (
  city_id, source_code, display_name, source_type,
  full_capacity_mcft, full_tank_level_ft,
  latitude, longitude, catchment_area_sqkm,
  display_order, is_primary_drinking_source
) VALUES
  ('bangalore', 'krs',        'Krishnaraja Sagar (KRS)',    'reservoir', 48400.000, NULL, 12.42470, 76.57220, 10619.00, 1, FALSE),
  ('bangalore', 'hemavathi',  'Hemavathi (Gorur Dam)',      'reservoir', 35700.000, NULL, 12.56670, 76.45000,  5410.00, 2, FALSE),
  ('bangalore', 'kabini',     'Kabini (Beechanahalli)',     'reservoir', 19520.000, NULL, 11.97350, 76.35280,  2141.90, 3, FALSE),
  ('bangalore', 'harangi',    'Harangi',                    'reservoir',  8500.000, NULL, 12.49170, 75.90560,   419.58, 4, FALSE)
ON CONFLICT (city_id, source_code) DO NOTHING;

-- Aliases so a scraper or CSV ingest tolerant of spelling variants in
-- the Karnataka WRD / KWRIS public feeds.
INSERT INTO water_source_name_aliases (city_id, alias, source_code) VALUES
  ('bangalore', 'krs',                       'krs'),
  ('bangalore', 'krishna raja sagar',        'krs'),
  ('bangalore', 'krishnaraja sagar',         'krs'),
  ('bangalore', 'kannambadi',                'krs'),
  ('bangalore', 'hemavathi',                 'hemavathi'),
  ('bangalore', 'hemavati',                  'hemavathi'),
  ('bangalore', 'gorur',                     'hemavathi'),
  ('bangalore', 'gorur dam',                 'hemavathi'),
  ('bangalore', 'kabini',                    'kabini'),
  ('bangalore', 'kapila',                    'kabini'),
  ('bangalore', 'beechanahalli',             'kabini'),
  ('bangalore', 'bichanahalli',              'kabini'),
  ('bangalore', 'harangi',                   'harangi')
ON CONFLICT (city_id, alias) DO NOTHING;
