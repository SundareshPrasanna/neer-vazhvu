-- =============================================================
-- 065_jaipur_seed_disabled.sql
-- Seeds Jaipur as a registered but disabled standalone CITY.
--
-- Purpose: lets reservoir ingest write rows against city_id='jaipur'
-- before the city is public. The frontend gate is `enabled` in
-- src/cities/jaipur/config.ts; a later enable migration keeps this
-- column honest with it.
--
-- Numbering: 064 is citizen_reports_updates (PR #471, applied to
-- production on 20 Oct 2026 ahead of its merge), so Jaipur takes 065.
--
-- ward_count 150: LSG notification DLB/25/19631, 16 Sep 2025.
-- Centre and box are provisional (OSM 2020 outline; no official 2025
-- vector). DRAFT, NOT APPLIED.
-- =============================================================

INSERT INTO cities (
  city_id, display_name, state_code, timezone,
  center_lat, center_lng,
  bbox_south, bbox_north, bbox_west, bbox_east,
  primary_authority_acronym, primary_authority_name,
  local_gov_acronym, local_gov_name, ward_count,
  default_consumption_mld, default_desalination_mld, enabled
) VALUES (
  'jaipur', 'Jaipur', 'RJ', 'Asia/Kolkata',
  26.9, 75.8,
  26.73, 27.07, 75.64, 75.96,
  'PHED', 'Public Health Engineering Department, Government of Rajasthan',
  'JMC', 'Nagar Nigam Jaipur (Jaipur Municipal Corporation)', 150,
  NULL, NULL, FALSE
) ON CONFLICT (city_id) DO NOTHING;
