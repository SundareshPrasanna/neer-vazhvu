-- =============================================================
-- 035_hyderabad_seed_disabled.sql
-- Seeds Hyderabad (Core Urban Region, standalone city - NOT a region)
-- as a registered but disabled city.
--
-- Purpose: lets us scaffold Hyderabad's CityConfig + water_sources in
-- code and ingest against city_id='hyderabad' without exposing the city
-- in the user-facing UI. The frontend's [cityId]/layout.tsx 404s any
-- non-enabled city. We flip enabled=TRUE in a later migration once data
-- + UI are ready.
--
-- SCOPE - standalone city, and this is the counter-intuitive call.
-- GHMC was TRIFURCATED on 11 Feb 2026 into GHMC (150 wards) / Cyberabad
-- (76) / Malkajgiri (74), which superficially resembles Mumbai's nine
-- corporations. It is the opposite case. MMR needed a region model
-- because nine corporations each run their own water system off a
-- contested pool with NO utility above them. Hyderabad merged 27 urban
-- local bodies UPWARD into a Core Urban Region and put ONE utility -
-- HMWSSB - over all three corporations. One board, one daily reservoir
-- statement, one tanker fleet, one sewerage network. Only the ward layer
-- is three-headed, and that is a scope badge, not a place model.
--
-- ward_count is the 300-ward delimitation gazetted 25 Dec 2025, summed
-- across the three corporations. NOTE: the GEOMETRY for these 300 wards
-- is not public yet - only the superseded 150-ward GHMC 2022 KML is. So
-- ward-dependent surfaces stay off until it lands. The corporations are
-- also currently under a Special Officer with elections pending, so
-- there are no sitting councillors to join against.
--
-- default_consumption_mld: MEASURED, not estimated. HMWSSB publishes
-- today's draw-off per reservoir in MLD; the six city sources totalled
-- 2,659.493 MLD on 25-Jul-2026. Refine to a trailing-365-day mean once
-- the 2014-present backfill lands. Widely-quoted service figures
-- (~1,954 MLD, 1,480 sq km, 1.68 crore) are news-sourced only and are
-- deliberately NOT used here.
--
-- bbox: computed from the GHMC 2022 ward KML (43,510 vertices span
-- 17.2907-17.5610 N, 78.2390-78.6217 E), padded outward to cover the
-- Core Urban Region, whose own boundary file is not yet public.
-- =============================================================

INSERT INTO cities (
  city_id, display_name, state_code, timezone,
  center_lat, center_lng,
  bbox_south, bbox_north, bbox_west, bbox_east,
  primary_authority_acronym, primary_authority_name,
  local_gov_acronym, local_gov_name, ward_count,
  default_consumption_mld, default_desalination_mld, enabled
) VALUES (
  'hyderabad', 'Hyderabad', 'TG', 'Asia/Kolkata',
  17.4260, 78.4300,
  17.15, 17.70, 78.10, 78.75,
  'HMWSSB', 'Hyderabad Metropolitan Water Supply and Sewerage Board',
  'GHMC', 'Greater Hyderabad Municipal Corporation', 300,
  2659, NULL, FALSE
) ON CONFLICT (city_id) DO NOTHING;
