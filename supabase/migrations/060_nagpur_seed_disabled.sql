-- =============================================================
-- 060_nagpur_seed_disabled.sql
-- Seeds Nagpur as a registered but disabled standalone CITY.
--
-- Purpose: lets reservoir ingest write rows against city_id='nagpur'
-- before the city is public. The frontend gate is `enabled` in
-- src/lib/cities/nagpur.ts; this column is kept honest with it by a later
-- enable migration. The water_sources rows follow in 061.
--
-- Numbering: 060 and 061 follow Visakhapatnam's 057-059; 062 is the
-- citizen-reports migration, so the switch-on is 063.
--
-- ward_count is 38: the final delimitation in the Maharashtra Gazette of
-- 4 Oct 2025 (No. 1600-E.D.-NMC-2025), 37 four-member wards and one
-- three-member ward, 151 councillors. Not the 10 administrative zones.
--
-- default_consumption_mld is deliberately NULL. The hero is the supply-chain
-- variant, not days-left: Totladoh (hydro-electric, shared with Madhya
-- Pradesh) and Navegaon Khairi (irrigation) are project reservoirs in which
-- NMC holds a reservation (190 Mcum a year, WRD GR of 19 Mar 2020), so no
-- runway is computed and no demand figure is needed.
-- =============================================================

INSERT INTO cities (
  city_id, display_name, state_code, timezone,
  center_lat, center_lng,
  bbox_south, bbox_north, bbox_west, bbox_east,
  primary_authority_acronym, primary_authority_name,
  local_gov_acronym, local_gov_name, ward_count,
  default_consumption_mld, default_desalination_mld, enabled
) VALUES (
  'nagpur', 'Nagpur', 'MH', 'Asia/Kolkata',
  21.1423, 79.0868,
  20.9, 21.75, 78.75, 79.45,
  'NMC', 'Nagpur Municipal Corporation, Water Works Department',
  'NMC', 'Nagpur Municipal Corporation', 38,
  NULL, NULL, FALSE
) ON CONFLICT (city_id) DO NOTHING;
