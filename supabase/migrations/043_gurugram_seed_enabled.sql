-- =============================================================
-- 043_gurugram_seed_enabled.sql
-- Seeds Gurugram as city nine, ALREADY ENABLED.
--
-- WHY ONE MIGRATION AND NOT THE USUAL TWO. Delhi, Hyderabad and Kolkata each
-- got a seed_disabled migration during their preview phase and an enable
-- migration at cutover, because their rows already existed and had to be
-- flipped. Gurugram was never seeded: it ran preview-gated purely on
-- NEXT_PUBLIC_PREVIEW_CITIES, with no row in this table at all. There is
-- nothing to flip, so seeding it enabled is the honest single step rather
-- than writing a row false and immediately contradicting it.
--
-- WHAT ACTUALLY GATES THE SITE - unchanged from 033_delhi_enable.sql,
-- 039_hyderabad_enable.sql and 042_kolkata_enable.sql:
--   The ONLY functional switch is `enabled: true` on the CityConfig in
--   src/lib/cities/gurugram.ts, read by the route guard in
--   [cityId]/layout.tsx. This `enabled` COLUMN is read by no code at all -
--   neither the Next.js app nor the Python API queries it. Bengaluru shipped
--   in June 2026 and sat at enabled=FALSE here for weeks with nothing
--   breaking (see 034_bangalore_enable_fix.sql), which is the evidence for
--   that claim rather than an assumption.
--
-- So this migration is for CONSISTENCY and reproducibility on a fresh
-- database, not for gating.
--
-- SCOPE: a standalone CITY, not a region. GMDA is the metropolitan authority
-- that runs bulk supply, the two WTPs and the tanker fleet; MCG is the
-- municipal corporation holding the 36 wards. One utility over one
-- corporation is the Hyderabad shape (HMWSSB over GHMC), not the MMR shape
-- where nine corporations each run their own system off a contested pool.
--
-- ward_count is 36, counted from GMDA OneMap's own MCG_Wards_Boundary layer
-- rather than taken from a news figure. That layer publishes a ward number
-- and a zone code and NO ward name, which is why ward surfaces label by
-- number and zone.
--
-- center/bbox are COMPUTED from that harvested ward geometry (wards span
-- 76.9351-77.1762 E, 28.3306-28.5415 N), then padded west and south to cover
-- the GMDA metropolitan area - the water-body register legitimately reaches
-- to 76.66 E / 28.21 N, out past Farrukhnagar and Sohna. The map should show
-- the water system, not the municipal boundary.
--
-- default_consumption_mld is deliberately NULL, and this is a considered
-- refusal rather than a missing value. Every supply and demand figure in
-- circulation for Gurugram is press-sourced - "570 MLD supplied", "675-700
-- MLD peak demand" - and GMDA's own GIS contradicts the most-quoted pair:
-- it publishes Chandu Budhera at 300 MLD and Basai at 272, against the 400
-- and 270 that circulate. Until a primary figure replaces them the city
-- carries no consumption denominator and no days-left style hero. See
-- heroMode: 'none' in the CityConfig.
--
-- NO water_sources migration accompanies this one, unlike 038 and 041.
-- Gurugram impounds nothing: no reservoir, no dam, no storage. The empty
-- waterSources array in the CityConfig is the finding, not an omission.
-- =============================================================

INSERT INTO cities (
  city_id, display_name, state_code, timezone,
  center_lat, center_lng,
  bbox_south, bbox_north, bbox_west, bbox_east,
  primary_authority_acronym, primary_authority_name,
  local_gov_acronym, local_gov_name, ward_count,
  default_consumption_mld, default_desalination_mld, enabled
) VALUES (
  'gurugram', 'Gurugram', 'HR', 'Asia/Kolkata',
  28.436, 77.056,
  28.2, 28.56, 76.64, 77.25,
  'GMDA', 'Gurugram Metropolitan Development Authority',
  'MCG', 'Municipal Corporation of Gurugram', 36,
  NULL, NULL, TRUE
) ON CONFLICT (city_id) DO UPDATE SET enabled = TRUE;
