-- =============================================================
-- 057_visakhapatnam_seed_disabled.sql
-- Seeds Visakhapatnam as a registered but DISABLED standalone city (the
-- Pune and Surat shape): this row is seeded false, and a later
-- visakhapatnam_enable migration flips it at cutover. Its water sources are
-- in 058_visakhapatnam_water_sources.sql.
--
-- WHAT ACTUALLY GATES THE SITE is unchanged from every prior city: the only
-- functional switch is `enabled: true` on the CityConfig in
-- src/lib/cities/visakhapatnam.ts, read by the route guard in
-- [cityId]/layout.tsx. This `enabled` column is read by no application code;
-- it is kept in step for consistency and for a reproducible fresh database.
--
-- AUTHORITY. GVMC (Greater Visakhapatnam Municipal Corporation) is both the
-- water utility and the local government; there is no separate water board.
--
-- ward_count is 98: the wards of the council elected in March 2021, drawn on
-- GVMC's own 98-ward map (gvmcnewward98.pdf, 8 Jan 2021). GVMC's preliminary
-- notification Rc.No.00165/2026/TP Section/G1/G2 of 17 May 2026 divides the
-- corporation into 120 wards; we have not found public geometry for the 120
-- wards, so the count stays at the last council's 98 until we do.
--
-- center is the city centre, 17.6868 N 83.2185 E. bbox is the extent of the
-- 98-ward polygons in circulation (Esri India's tracing of GVMC's plot;
-- 82.994-83.464 E, 17.546-17.940 N) padded to round figures. Unlike Pune's,
-- it covers the city rather than the water system: Meghadrigedda sits inside
-- it, but three reservoirs fall outside. In a straight line from the centre,
-- Raiwada is about 45 km north-west (CGWB 2025 lists 60 km, GVMC's 11 Mar
-- 2021 supply sheet 76 km), Thatipudi about 54 km north (both list 56 km)
-- and the Yeleru reservoir about 126 km west-south-west (GVMC's sheet lists
-- it at 156 km; CGWB lists the Godavari and Yeleru system at 190 km).
--
-- default_consumption_mld is NULL. The demand figures in print are planning
-- numbers, not measured delivery. CGWB's district aquifer report (Nov 2023,
-- pp64-65) repeats GVMC's 490 MLD demand projection against 391 MLD supply.
-- Its own text dates the 490 to the Year 2020, and CGWB's 2022 report has the
-- identical row (population 23,48,655) as 2020; Table 5.3 relabels it 2023.
-- The nine-source total (p63) is about 380 MLD available, GVMC's figures; the
-- nine quantities are unchanged from Table 5.1 of CGWB's June 2022 report
-- (AAP 2020-21) to Table 9.1 of its 2025 aquifer plan, and the 2022 report
-- (repeated in Nov 2023) says GVMC was able to draw 345.5 MLD of the 380.
-- The dashboard uses the supply-overview hero, not a days-left runway, so no
-- demand figure is needed.
-- =============================================================

INSERT INTO cities (
  city_id, display_name, state_code, timezone,
  center_lat, center_lng,
  bbox_south, bbox_north, bbox_west, bbox_east,
  primary_authority_acronym, primary_authority_name,
  local_gov_acronym, local_gov_name, ward_count,
  default_consumption_mld, default_desalination_mld, enabled
) VALUES (
  'visakhapatnam', 'Visakhapatnam', 'AP', 'Asia/Kolkata',
  17.6868, 83.2185,
  17.50, 18.00, 82.95, 83.55,
  'GVMC', 'Greater Visakhapatnam Municipal Corporation, Water Supply wing',
  'GVMC', 'Greater Visakhapatnam Municipal Corporation', 98,
  NULL, NULL, FALSE
) ON CONFLICT (city_id) DO NOTHING;
