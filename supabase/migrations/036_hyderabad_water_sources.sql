-- =============================================================
-- 036_hyderabad_water_sources.sql
-- Hyderabad's eight reported reservoirs: six the city actually draws
-- from, plus the two parent Krishna storages reported for context.
--
-- Hyderabad is RESERVOIR-IMPOUNDED AND PUMPED, like Chennai rather than
-- Bangalore/Delhi. HMWSSB draws from six sources every day and - unusually
-- for an Indian utility - publishes the draw-off in MLD AND the inflow in
-- TMC per source, plus the level and storage on the same date last year.
-- That is why Hyderabad can run the FULL interactive days-left hero
-- (worst-case / current-trend / seasonal) with a MEASURED divisor, where
-- Mumbai had to collapse its scenarios to a single line because Pravah
-- publishes storage only.
--
-- Feed: HMWSSB "Statements of WaterLevels in Reservoirs", daily,
-- https://bms.hyderabadwater.gov.in/wlrreport/showreport1.aspx
-- Archive runs 01-Jan-2014 to present (~12.5 years), scraped by
-- neer-vazhvu-api/scripts/scrape_hmwssb_reservoirs.py
--
--   THE SIX CITY SOURCES
--   - Osman Sagar + Himayat Sagar  the Nizam-era twins on the Musi; small
--                                  but drawn on essentially every day in
--                                  the record. The reason GO 111 existed.
--   - Singur                       Manjira system, upstream storage
--   - Manjira                      Manjira system, the downstream intake
--   - Akkampally (Krishna)         largest single draw (1,253 of 2,659 MLD
--                                  on 25-Jul-2026); FTL published in METRES
--   - Sripada Yellampally          the Godavari leg; absent from the early
--                                  archive, commissioned after 2014
--
--   CONTEXT ONLY (is_primary_drinking_source = FALSE)
--   - Nagarjuna Sagar + Srisailam  the parent Krishna storages upstream of
--                                  Akkampally. They consistently report a
--                                  city drawl of 0.000 MLD, so counting
--                                  them would double-count the Krishna leg.
--                                  Kept because their level is the real
--                                  constraint on Akkampally.
--
-- UNITS: full_capacity_mcft converts the feed's TMC at 1 TMC = 1,000 Mcft.
-- full_tank_level_ft normalises the feed's MIXED level units, which are
-- declared per row by the source: Akkampally is metres (245.000 m =
-- 803.81 ft), every other row is feet. Validated over the 2022 monsoon:
-- all eight reservoirs show max(level)/FTL between 0.997 and 1.000, and
-- four touch FTL exactly, so level and FTL are on the same scale for
-- every row.
--
-- CAPACITY WARNING: HMWSSB SILENTLY REVISED the twins' capacity at FTL on
-- 01-Jul-2026 - Osman Sagar 3.900 -> 3.518 TMC, Himayat Sagar 2.967 ->
-- 2.521 TMC, bisected to the exact day, with all other sources unchanged.
-- The values below are the POST-revision ones. The cause is UNCONFIRMED:
-- it lands exactly on the water-year boundary, so it could be a re-survey,
-- a gross-vs-live redefinition, or a correction. Do NOT describe it as
-- siltation without a GO. A Headwaters detector watches this column,
-- because a cached days-left denominator would now be 10-15% wrong for
-- the twins.
--
-- COORDINATES: Osman Sagar / Himayat Sagar / Singur / Nagarjuna Sagar /
-- Srisailam / Yellampally are Nominatim-resolved and pass a plausibility
-- check. Manjira (OSM way/146343025) and Akkampally (OSM node/11031476789,
-- corroborated by node/7173815473 1.3 km away) came from bounded Overpass
-- queries after Nominatim returned false matches - notably an "Akkampalli"
-- village in Anantapur, Andhra Pradesh ~300 km from the reservoir. Both
-- are community-traced; confirm against Telangana I&CAD before using them
-- for anything beyond a map pin.
-- =============================================================

INSERT INTO water_sources (
  city_id, source_code, display_name, source_type,
  full_capacity_mcft, full_tank_level_ft,
  latitude, longitude, catchment_area_sqkm,
  display_order, is_primary_drinking_source
) VALUES
  ('hyderabad', 'osman_sagar',     'Osman Sagar',                    'reservoir',   3518.0, 1790.00, 17.37470, 78.29970, NULL, 1, TRUE),
  ('hyderabad', 'himayat_sagar',   'Himayat Sagar',                  'reservoir',   2521.0, 1763.50, 17.31360, 78.35720, NULL, 2, TRUE),
  ('hyderabad', 'singur',          'Singur',                         'reservoir',  29917.0, 1717.93, 17.74720, 77.92560, NULL, 3, TRUE),
  ('hyderabad', 'manjira',         'Manjira',                        'reservoir',   1500.0, 1651.75, 17.65680, 78.07560, NULL, 4, TRUE),
  ('hyderabad', 'akkampally',      'Akkampally (Krishna)',           'reservoir',   1499.0,  803.81, 16.68910, 79.09570, NULL, 5, TRUE),
  ('hyderabad', 'yellampally',     'Sripada Yellampally (Godavari)', 'reservoir',  20175.0,  485.56, 18.84570, 79.37640, NULL, 6, TRUE),
  ('hyderabad', 'nagarjuna_sagar', 'Nagarjuna Sagar',                'reservoir', 312045.0,  590.00, 16.54170, 79.31830, NULL, 7, FALSE),
  ('hyderabad', 'srisailam',       'Srisailam',                      'reservoir', 215807.0,  885.00, 16.08680, 78.89700, NULL, 8, FALSE)
ON CONFLICT (city_id, source_code) DO NOTHING;

-- Aliases cover the labels HMWSSB's own report prints (which are run
-- together and carry unit suffixes), plus the spellings that appear in
-- Telangana I&CAD bulletins and news coverage. Mapping the report labels
-- explicitly means an upstream relabelling surfaces as an unmatched alias
-- rather than silently orphaning a source.
INSERT INTO water_source_name_aliases (city_id, alias, source_code) VALUES
  ('hyderabad', 'OsmanSagar',                    'osman_sagar'),
  ('hyderabad', 'Osman Sagar',                   'osman_sagar'),
  ('hyderabad', 'Gandipet',                      'osman_sagar'),
  ('hyderabad', 'HimayathSagar',                 'himayat_sagar'),
  ('hyderabad', 'Himayat Sagar',                 'himayat_sagar'),
  ('hyderabad', 'Himayatsagar',                  'himayat_sagar'),
  ('hyderabad', 'Singur(Ft./M)',                 'singur'),
  ('hyderabad', 'Singur',                        'singur'),
  ('hyderabad', 'Singur Dam',                    'singur'),
  ('hyderabad', 'Manjira',                       'manjira'),
  ('hyderabad', 'Manjira Barrage',               'manjira'),
  ('hyderabad', 'AkkamPally[Krishna](M)',        'akkampally'),
  ('hyderabad', 'Akkampally',                    'akkampally'),
  ('hyderabad', 'Akkampalli',                    'akkampally'),
  ('hyderabad', 'AMR Project',                   'akkampally'),
  ('hyderabad', 'SriPadaYellampally(Godavari)',  'yellampally'),
  ('hyderabad', 'Sripada Yellampally',           'yellampally'),
  ('hyderabad', 'Yellampalli',                   'yellampally'),
  ('hyderabad', 'NagarjunSagar',                 'nagarjuna_sagar'),
  ('hyderabad', 'Nagarjuna Sagar',               'nagarjuna_sagar'),
  ('hyderabad', 'Nagarjunasagar',                'nagarjuna_sagar'),
  ('hyderabad', 'Srisailam',                     'srisailam'),
  ('hyderabad', 'Srisailam Dam',                 'srisailam')
ON CONFLICT (city_id, alias) DO NOTHING;
