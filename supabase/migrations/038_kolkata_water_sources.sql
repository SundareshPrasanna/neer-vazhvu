-- =============================================================
-- 038_kolkata_water_sources.sql
-- Kolkata's four supply arms, plus the source -> corporation graph.
--
-- Kolkata is RUN-OF-RIVER. It impounds nothing: supply is Hooghly
-- abstraction at Palta plus ~110 MLD of deep tube wells. This is why the
-- days-left hero is not merely awkward here but UNDEFINED - dividing live
-- storage by draw rate needs a numerator that does not exist. Kolkata
-- ships heroMode 'drainage-capacity' instead.
--
--   - Hooghly at Palta      Indira Gandhi WTP, ~22 km north in
--                           Barrackpore (North 24 Parganas). The main
--                           intake. WBPCB samples the Ganga AT Palta, so
--                           raw-water QUALITY is observable even though
--                           abstraction VOLUME is not published anywhere.
--   - Garden Reach          Garden Reach Water Works.
--   - Dhapa                 Jai Hind Jal Prokolpo.
--   - KMC tube wells        ~110 MLD; the only non-river source, and the
--                           arm that ties supply to the KMA arsenic belt.
--
-- full_capacity_mcft is NULL throughout: river abstraction points and
-- borewell fields have no impoundment capacity semantics. The per-plant
-- DESIGN capacities (1,180 / 839.4 / 136.3 MLD) live in the city config
-- for identity and provenance and are NEVER SUMMED into a published total
-- - KMC's own page lists plants totalling 2,324.7 MLD while simultaneously
-- describing a ~1,900 MLD target and ~1,660 MLD requirement, is labelled
-- "(DRAFT)", and is footered 2013. That reconciliation is an open item;
-- until it closes, no capacity total enters the product.
--
-- is_primary_drinking_source=TRUE for the three surface arms that are the
-- daily tap; tube wells are supplementary.
--
-- NOTE: Jorabagan (36.3 MLD) and Watgunge (22.7 MLD) are named on KMC's
-- page but are not seeded as separate sources - they are small boosters on
-- the same Hooghly abstraction, not independent arms, and giving them
-- source rows would imply a granularity the data does not support.
-- =============================================================

INSERT INTO water_sources (
  city_id, source_code, display_name, source_type,
  full_capacity_mcft, full_tank_level_ft,
  latitude, longitude, catchment_area_sqkm,
  display_order, is_primary_drinking_source
) VALUES
  ('kolkata', 'hooghly_palta',  'Hooghly at Palta (Indira Gandhi WTP)', 'river',          NULL, NULL, 22.79250, 88.37220, NULL, 1, TRUE),
  ('kolkata', 'garden_reach',   'Garden Reach Water Works',             'river',          NULL, NULL, 22.54840, 88.29210, NULL, 2, TRUE),
  ('kolkata', 'dhapa',          'Jai Hind Jal Prokolpo (Dhapa)',        'river',          NULL, NULL, 22.54530, 88.41420, NULL, 3, TRUE),
  ('kolkata', 'kmc_tubewells',  'KMC deep tube wells',                  'borewell_field', NULL, NULL, 22.57260, 88.36390, NULL, 4, FALSE)
ON CONFLICT (city_id, source_code) DO NOTHING;

-- The source -> corporation supply graph. The two bulk sales are the edges
-- that put Bidhannagar and Budge Budge in scope at all, and they are
-- ready-made Allocation Ledger rows: 90 MLD and 22.7 MLD, both sold BY KMC.
INSERT INTO source_corporation (city_id, source_code, corporation_id, bulk_supplier) VALUES
  ('kolkata', 'hooghly_palta',  'kmc',          NULL),
  ('kolkata', 'garden_reach',   'kmc',          NULL),
  ('kolkata', 'dhapa',          'kmc',          NULL),
  ('kolkata', 'kmc_tubewells',  'kmc',          NULL),
  ('kolkata', 'hooghly_palta',  'bidhannagar',  'KMC'),
  ('kolkata', 'garden_reach',   'budge_budge',  'KMC')
ON CONFLICT (city_id, source_code, corporation_id) DO NOTHING;
