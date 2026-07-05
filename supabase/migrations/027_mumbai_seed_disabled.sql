-- =============================================================
-- 027_mumbai_seed_disabled.sql
-- Seeds Mumbai as a registered but disabled city.
--
-- Purpose: lets us scaffold Mumbai's CityConfig + water_sources in code
-- and start writing migrations / ingest against city_id='mumbai' without
-- exposing the city in the user-facing UI. The `enabled` column exists on
-- the `cities` table from migration 017.
--
-- The frontend's [cityId]/layout.tsx 404s any non-enabled city.
-- The backend's list_enabled_places() filters by enabled=TRUE.
-- We flip enabled=TRUE in a future migration once data + UI are ready.
--
-- ward_count is the 24 BMC administrative wards (A..T), not the 227
-- electoral wards (SEC PDFs only, no GeoJSON / per-ward data).
-- =============================================================

INSERT INTO cities (
  city_id, display_name, state_code, timezone,
  center_lat, center_lng,
  bbox_south, bbox_north, bbox_west, bbox_east,
  primary_authority_acronym, primary_authority_name,
  local_gov_acronym, local_gov_name, ward_count,
  default_consumption_mld, default_desalination_mld, enabled
) VALUES (
  'mumbai', 'Mumbai', 'MH', 'Asia/Kolkata',
  19.0760, 72.8777,
  18.89, 19.28, 72.77, 73.00,
  'BMC', 'BMC Hydraulic Engineer Department',
  'BMC', 'Brihanmumbai Municipal Corporation', 24,
  3850, NULL, FALSE
) ON CONFLICT (city_id) DO NOTHING;
