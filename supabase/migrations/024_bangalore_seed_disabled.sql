-- =============================================================
-- 024_bangalore_seed_disabled.sql
-- Seeds Bangalore as a registered but disabled city.
--
-- Purpose: lets us scaffold Bangalore's CityConfig + water_sources
-- in code and start writing migrations against city_id='bangalore'
-- without exposing the city in the user-facing UI. The `enabled`
-- column already exists on the `cities` table from migration 017.
--
-- The frontend's [cityId]/layout.tsx 404s any non-enabled city.
-- The backend's list_enabled_places() filters by enabled=TRUE.
-- We flip enabled=TRUE in a future migration once data + UI are ready.
-- =============================================================

INSERT INTO cities (
  city_id, display_name, state_code, timezone,
  center_lat, center_lng,
  bbox_south, bbox_north, bbox_west, bbox_east,
  primary_authority_acronym, primary_authority_name,
  local_gov_acronym, local_gov_name, ward_count,
  default_consumption_mld, default_desalination_mld, enabled
) VALUES (
  'bangalore', 'Bengaluru', 'KA', 'Asia/Kolkata',
  12.9716, 77.5946,
  12.83, 13.18, 77.40, 77.78,
  'BWSSB', 'Bangalore Water Supply and Sewerage Board',
  'GBA', 'Greater Bengaluru Authority', 369,
  1450, NULL, FALSE
) ON CONFLICT (city_id) DO NOTHING;
