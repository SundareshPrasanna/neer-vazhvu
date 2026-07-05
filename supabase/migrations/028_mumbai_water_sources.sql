-- =============================================================
-- 028_mumbai_water_sources.sql
-- Mumbai's 7 BMC supply lakes.
--
-- Unlike Bangalore (upstream Cauvery basin storage) and Madurai (Vaigai +
-- Mullaperiyar), Mumbai is reservoir-impounded like Chennai: the 7 BMC
-- lakes ARE the city's tap. is_primary_drinking_source=TRUE for all seven.
--   - Bhatsa           ~48% of supply   Shahapur, Thane
--   - Upper Vaitarna   ~16%
--   - Middle Vaitarna  ~12%
--   - Modak Sagar      ~11%
--   - Tansa            ~10%
--   - Tulsi             ~2%             Sanjay Gandhi NP, Mumbai
--   - Vihar             ~1%             Sanjay Gandhi NP, Mumbai
--
-- The lakes sit 30-130 km outside the Mumbai bbox but are tracked because
-- they feed the supply. full_capacity_mcft is converted from BMC's
-- published live-storage figures (million litres / 28.317); M1 reconciles
-- units against the live feed. Ulhas/Barvi (Thane/Navi Mumbai) excluded.
-- =============================================================

INSERT INTO water_sources (
  city_id, source_code, display_name, source_type,
  full_capacity_mcft, full_tank_level_ft,
  latitude, longitude, catchment_area_sqkm,
  display_order, is_primary_drinking_source
) VALUES
  ('mumbai', 'bhatsa',          'Bhatsa',          'reservoir', 25321.900, NULL, 19.55000, 73.45000, NULL, 1, TRUE),
  ('mumbai', 'upper_vaitarna',  'Upper Vaitarna',  'reservoir',  8018.100, NULL, 19.95000, 73.47000, NULL, 2, TRUE),
  ('mumbai', 'middle_vaitarna', 'Middle Vaitarna', 'reservoir',  6834.400, NULL, 19.83000, 73.40000, NULL, 3, TRUE),
  ('mumbai', 'modak_sagar',     'Modak Sagar',     'reservoir',  4552.900, NULL, 19.78000, 73.18000, NULL, 4, TRUE),
  ('mumbai', 'tansa',           'Tansa',           'reservoir',  5123.500, NULL, 19.63000, 73.30000, NULL, 5, TRUE),
  ('mumbai', 'tulsi',           'Tulsi',           'reservoir',   284.100, NULL, 19.16000, 72.90000, NULL, 6, TRUE),
  ('mumbai', 'vihar',           'Vihar',           'reservoir',   978.200, NULL, 19.14000, 72.91000, NULL, 7, TRUE)
ON CONFLICT (city_id, source_code) DO NOTHING;

-- Aliases so an ingest tolerant of spelling / Devanagari variants in the
-- BMC Hydraulic Engineer feed (mirrored at numerical.co.in) maps cleanly.
INSERT INTO water_source_name_aliases (city_id, alias, source_code) VALUES
  ('mumbai', 'bhatsa',          'bhatsa'),
  ('mumbai', 'भातसा',           'bhatsa'),
  ('mumbai', 'upper vaitarna',  'upper_vaitarna'),
  ('mumbai', 'vaitarna',        'upper_vaitarna'),
  ('mumbai', 'middle vaitarna', 'middle_vaitarna'),
  ('mumbai', 'modak sagar',     'modak_sagar'),
  ('mumbai', 'modaksagar',      'modak_sagar'),
  ('mumbai', 'lower vaitarna',  'modak_sagar'),
  ('mumbai', 'मोडकसागर',        'modak_sagar'),
  ('mumbai', 'tansa',           'tansa'),
  ('mumbai', 'तानसा',           'tansa'),
  ('mumbai', 'tulsi',           'tulsi'),
  ('mumbai', 'vihar',           'vihar')
ON CONFLICT (city_id, alias) DO NOTHING;
