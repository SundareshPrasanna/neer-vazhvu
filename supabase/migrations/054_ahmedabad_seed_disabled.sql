-- =============================================================
-- 054_ahmedabad_seed_disabled.sql
-- Seeds Ahmedabad as a registered but disabled standalone CITY.
--
-- Purpose: lets reservoir ingest write rows against city_id='ahmedabad'
-- before the city is public. The frontend gate is `enabled` in
-- src/lib/cities/ahmedabad.ts; this column is kept honest with it by a later
-- enable migration.
--
-- ward_count is 48: the State Election Commission's final delimitation of
-- 3 Oct 2020 (192 councillors), used again for the 2026 polls.
--
-- default_consumption_mld is deliberately NULL. The hero is the supply-chain
-- variant, not days-left: the dams behind Ahmedabad's water (Sardar Sarovar,
-- Kadana) are shared irrigation and multi-state storage whose city share is
-- not published, so no runway is computed and no demand figure is needed.
-- No non-revenue-water figure is stored either: AMC has never published a
-- measured one, and its 2023-24 budget says connections are unmetered.
-- =============================================================

INSERT INTO cities (
  city_id, display_name, state_code, timezone,
  center_lat, center_lng,
  bbox_south, bbox_north, bbox_west, bbox_east,
  primary_authority_acronym, primary_authority_name,
  local_gov_acronym, local_gov_name, ward_count,
  default_consumption_mld, default_desalination_mld, enabled
) VALUES (
  'ahmedabad', 'Ahmedabad', 'GJ', 'Asia/Kolkata',
  23.0225, 72.5714,
  22.88, 23.17, 72.4, 72.76,
  'AMC', 'Ahmedabad Municipal Corporation, Water Project and Water Operations',
  'AMC', 'Ahmedabad Municipal Corporation', 48,
  NULL, NULL, FALSE
) ON CONFLICT (city_id) DO NOTHING;
