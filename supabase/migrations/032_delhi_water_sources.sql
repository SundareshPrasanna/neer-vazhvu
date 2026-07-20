-- =============================================================
-- 032_delhi_water_sources.sql
-- Delhi's six instrument-governed supply arms.
--
-- Delhi is PUMPED-FROM-FAR like Bangalore, not reservoir-impounded: the
-- city owns no storage, and ~90% of raw water arrives via inter-state
-- instruments (1994 Yamuna MoU + BBMB/THDC allocations), ~10% own
-- groundwater. 9 DJB WTPs produce ~960 MGD against ~1,400 MGD demand.
--   - Yamuna at Wazirabad     -> Wazirabad + Chandrawal WTPs
--   - Munak Canal (CLC)       ~70% of raw water; Haiderpur/Nangloi/
--                             Bawana/Dwarka/Okhla WTPs
--   - Upper Ganga Canal       Bhagirathi + Sonia Vihar WTPs (~254 MGD)
--   - Bhakra (BBMB share)     ~240 km; share fixed in BBMB TC minutes
--   - Tehri (Delhi share)     300 cusecs / 162 MGD (THDC)
--   - DJB tube-wells/Ranney   ~10%; no public census (CAG-flagged gap)
--
-- full_capacity_mcft is NULL throughout: Delhi's SHARE of Bhakra/Tehri is
-- not a published capacity (per-season in TC/UYRB minutes), and canals /
-- river arms / borewell fields have no capacity semantics. Whole-dam
-- storage percentages (BBMB daily, CWC weekly / WRIS) can still render as
-- source cards - the Bangalore upstream-dam pattern.
-- is_primary_drinking_source=TRUE for the three arms that are the daily
-- raw-water tap (Yamuna/Munak/UGC); Bhakra + Tehri are allocation-backed
-- contributors; groundwater is supplementary.
-- =============================================================

INSERT INTO water_sources (
  city_id, source_code, display_name, source_type,
  full_capacity_mcft, full_tank_level_ft,
  latitude, longitude, catchment_area_sqkm,
  display_order, is_primary_drinking_source
) VALUES
  ('delhi', 'yamuna_wazirabad',  'Yamuna at Wazirabad',           'river',         NULL, NULL, 28.71000, 77.23000, NULL, 1, TRUE),
  ('delhi', 'munak_canal',       'Munak Canal (CLC)',             'flow_station',  NULL, NULL, 29.05000, 76.98000, NULL, 2, TRUE),
  ('delhi', 'upper_ganga_canal', 'Upper Ganga Canal',             'flow_station',  NULL, NULL, 28.78000, 77.50000, NULL, 3, TRUE),
  ('delhi', 'bhakra',            'Bhakra (BBMB share)',           'reservoir',     NULL, NULL, 31.41000, 76.43000, NULL, 4, FALSE),
  ('delhi', 'tehri',             'Tehri (Delhi share)',           'reservoir',     NULL, NULL, 30.38000, 78.48000, NULL, 5, FALSE),
  ('delhi', 'djb_groundwater',   'DJB tube-wells & Ranney wells', 'borewell_field', NULL, NULL, 28.61000, 77.21000, NULL, 6, FALSE)
ON CONFLICT (city_id, source_code) DO NOTHING;

-- Aliases tolerant of the spellings that appear in DJB press notes, BBMB
-- bulletins and news coverage (the Munak news-NER pipeline maps through
-- these), including Devanagari variants.
INSERT INTO water_source_name_aliases (city_id, alias, source_code) VALUES
  ('delhi', 'yamuna',                'yamuna_wazirabad'),
  ('delhi', 'wazirabad',             'yamuna_wazirabad'),
  ('delhi', 'munak canal',           'munak_canal'),
  ('delhi', 'munak',                 'munak_canal'),
  ('delhi', 'clc',                   'munak_canal'),
  ('delhi', 'carrier lined channel', 'munak_canal'),
  ('delhi', 'upper ganga canal',     'upper_ganga_canal'),
  ('delhi', 'ugc',                   'upper_ganga_canal'),
  ('delhi', 'muradnagar',            'upper_ganga_canal'),
  ('delhi', 'bhakra',                'bhakra'),
  ('delhi', 'gobind sagar',          'bhakra'),
  ('delhi', 'भाखड़ा',                 'bhakra'),
  ('delhi', 'tehri',                 'tehri'),
  ('delhi', 'टिहरी',                 'tehri')
ON CONFLICT (city_id, alias) DO NOTHING;
