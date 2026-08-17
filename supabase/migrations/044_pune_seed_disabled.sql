-- =============================================================
-- 044_pune_seed_disabled.sql
-- Seeds Pune as city ten, DISABLED (preview-gated), plus its six water
-- sources. Two migrations, the Delhi/Hyderabad/Kolkata shape: this one seeds
-- the row false, and a later `045_pune_enable.sql` flips it at cutover.
-- Gurugram's single seed_enabled migration was correct for Gurugram because
-- that city had never been seeded at all; Pune is seeded here during preview,
-- so there IS a row to flip.
--
-- WHAT ACTUALLY GATES THE SITE - unchanged from every prior city: the ONLY
-- functional switch is `enabled: true` on the CityConfig in
-- src/lib/cities/pune.ts, read by the route guard in [cityId]/layout.tsx.
-- This `enabled` COLUMN is read by no application code. It is kept in step
-- for consistency and for reproducibility on a fresh database.
--
-- SCOPE: a standalone CITY, not a region. Pimpri-Chinchwad is a genuinely
-- separate corporation - 181 sq km, its own Pavana source, its own annual
-- Environment Status Report - and the MMR `region` shape would fit it. It is
-- excluded because NO PCMC WARD BOUNDARY EXISTS PUBLICLY: no OpenCity
-- dataset, a login-walled GeoServer (WFS/WMS GetCapabilities 403, REST 401,
-- and the open WMTS carries five raster basemaps and no vector layer), and
-- no PCMC polygon in OpenStreetMap at all. A region place whose second
-- corporation cannot be drawn is worse than an honest single-city place.
--
-- ward_count is 41: the ELECTORAL prabhags of the 2025 delimitation, drafted
-- 22 August 2025 on Census 2011 per Supreme Court guidelines and used for the
-- 2026 PMC election (165 corporators - 40 four-member wards plus
-- Ambegaon-Katraj with five). NOT the 15 administrative ward offices, which
-- are a different geography and are what PMC's own operational records key to.
--
-- center is the Sangam, where the Mula joins the Mutha. bbox covers the WATER
-- SYSTEM rather than the municipal boundary: PMC's wards span 73.73-74.02 E
-- and 18.39-18.62 N, but every dam that fills the city sits outside that -
-- Temghar 73.52, Warasgaon 73.53, Panshet 73.55, Pavana 73.45, and Bhama
-- Askhed north at 18.88. A map clipped to the corporation would show the taps
-- and hide the sources.
--
-- default_consumption_mld is 1631.84, PMC's own total requirement from its
-- Water Budget 2025-26. It is a REQUIREMENT PMC states, not a measured
-- delivery: PMC publishes no measured daily abstraction, and its accounts
-- explicitly exclude groundwater, private tankers and other sources.
--
-- NO days-left hero, and this is the considered reason. The Khadakwasla
-- Complex is an IRRIGATION project with a drinking-water share inside it -
-- 33.77 TMC of use, of which 22.55 TMC is the irrigation provision against an
-- 8.3 TMC drinking provision in the project's own planning (Executive
-- Engineer's affidavit via MWRRA Order 19/2018). Dividing total storage by
-- urban demand would credit the city with water that is legally and
-- physically the canal's, in the middle of a live regulatory dispute about
-- exactly that. See heroMode: 'cauvery-pumping' in the CityConfig.
-- =============================================================

INSERT INTO cities (
  city_id, display_name, state_code, timezone,
  center_lat, center_lng,
  bbox_south, bbox_north, bbox_west, bbox_east,
  primary_authority_acronym, primary_authority_name,
  local_gov_acronym, local_gov_name, ward_count,
  default_consumption_mld, default_desalination_mld, enabled
) VALUES (
  'pune', 'Pune', 'MH', 'Asia/Kolkata',
  18.5204, 73.8567,
  18.3, 18.95, 73.4, 74.05,
  'PMC', 'Pune Municipal Corporation, Water Supply Department',
  'PMC', 'Pune Municipal Corporation', 41,
  1631.84, NULL, FALSE
) ON CONFLICT (city_id) DO NOTHING;

-- -------------------------------------------------------------
-- Water sources.
--
-- Capacities are LIVE (useful) storage from the Maharashtra WRD Pravah daily
-- bulletin, converted at 1 Mcft = 0.0283168 Mcum. They are NOT taken on trust
-- from one publisher: CWC's National Register of Large Dams 2019 agrees to
-- the cubic metre on Panshet (301,610,000 m3), Warasgaon (363,130,000),
-- Temghar and Bhama Askhed (217,100,000), and the four Khadakwasla-chain
-- capacities sum to 825.66 Mcum = 29.158 TMC, independently reproducing the
-- 29.15 TMC / 825.43 MCM that PMC publishes in its own ESR 2025-26.
--
-- TWO REGISTER ERRORS FOUND while checking, recorded so nobody re-derives
-- from them: NRLD-2019's Khadakwasla row reads 860,000,000 m3 gross against a
-- true 85.91 Mcum - a stray zero, 10x high - and NRLD-2023 is a scanned OCR
-- document whose Chaskaman and Bhama Askhed rows are 1000x low. Pravah and
-- NRLD also disagree on Pavana alone by ~11% (live 240.97 vs 274.32 Mcum)
-- with no published explanation; Pravah is used as the operator's own current
-- figure.
--
-- Pawana is is_primary_drinking_source = FALSE: it is PCMC's principal
-- source, carried here because PMC lifts 27 MLD off the Pavana at Ravet and
-- because the Pavana joins the Mula inside the urban area.
-- -------------------------------------------------------------

INSERT INTO water_sources (
  city_id, source_code, display_name, source_type,
  full_capacity_mcft, full_tank_level_ft,
  latitude, longitude, catchment_area_sqkm,
  display_order, is_primary_drinking_source
) VALUES
  -- The chain's SMALLEST and its operational heart: Khadakwasla is the
  -- balancing reservoir the other three release into, and its discharge in
  -- cusecs is the number Pune actually hears on a flood day.
  ('pune', 'khadakwasla', 'Khadakwasla', 'reservoir',
   1974.4, NULL, 18.4163, 73.7225, NULL, 1, TRUE),
  ('pune', 'panshet', 'Panshet (Tanajisagar)', 'reservoir',
   10651.2, NULL, 18.3500, 73.5507, NULL, 2, TRUE),
  -- Pravah prints "Warasgaon"; most secondary writing says Varasgaon; CWC's
  -- register calls it Vir Baji Pasalkar. Same dam.
  ('pune', 'warasgaon', 'Warasgaon (Vir Baji Pasalkar)', 'reservoir',
   12824.9, NULL, 18.3857, 73.5278, NULL, 3, TRUE),
  ('pune', 'temghar', 'Temghar', 'reservoir',
   3708.4, NULL, 18.4530, 73.5176, NULL, 4, TRUE),
  ('pune', 'bhama_askhed', 'Bhama Askhed', 'reservoir',
   7666.7, NULL, 18.8842, 73.6688, NULL, 5, TRUE),
  ('pune', 'pawana', 'Pawana', 'reservoir',
   8510.0, NULL, 18.6594, 73.4509, NULL, 6, FALSE)
ON CONFLICT (city_id, source_code) DO NOTHING;
