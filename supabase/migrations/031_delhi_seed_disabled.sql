-- =============================================================
-- 031_delhi_seed_disabled.sql
-- Seeds Delhi (NCT, standalone city - NOT an NCR region) as a
-- registered but disabled city.
--
-- Purpose: lets us scaffold Delhi's CityConfig + water_sources in code
-- and start writing migrations / ingest against city_id='delhi' without
-- exposing the city in the user-facing UI. The `enabled` column exists on
-- the `cities` table from migration 017.
--
-- The frontend's [cityId]/layout.tsx 404s any non-enabled city.
-- We flip enabled=TRUE in a future migration once data + UI are ready.
--
-- ward_count is the 250 post-2022-unification MCD wards (NOT the
-- pre-merger 272 across 3 MCDs, and NOT the commonly-cited 270).
-- NDMC (Lutyens) + Delhi Cantonment sit outside MCD/DJB retail supply
-- and are flagged in copy, not modelled as separate units.
--
-- default_consumption_mld: ~960 MGD DJB WTP production = ~4,365 MLD
-- (supply side; demand ~1,400 MGD is narrative, not the denominator).
-- Sources: DJB water page + CAG Report No. 3 of 2025.
-- =============================================================

INSERT INTO cities (
  city_id, display_name, state_code, timezone,
  center_lat, center_lng,
  bbox_south, bbox_north, bbox_west, bbox_east,
  primary_authority_acronym, primary_authority_name,
  local_gov_acronym, local_gov_name, ward_count,
  default_consumption_mld, default_desalination_mld, enabled
) VALUES (
  'delhi', 'Delhi', 'DL', 'Asia/Kolkata',
  28.6100, 77.2100,
  28.40, 28.90, 76.85, 77.40,
  'DJB', 'Delhi Jal Board',
  'MCD', 'Municipal Corporation of Delhi', 250,
  4365, NULL, FALSE
) ON CONFLICT (city_id) DO NOTHING;
