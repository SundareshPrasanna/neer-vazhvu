-- =============================================================
-- 058_visakhapatnam_water_sources.sql
-- Visakhapatnam's six reservoir sources. Four carry a daily public feed
-- (APWRIMS, the Andhra Pradesh Water Resources Department's reservoir API,
-- scraped by neer-vazhvu-api/scripts/scrape_apwrims_reservoirs.py); two do
-- not appear in it.
--
-- CAPACITIES ARE LIVE (useful) STORAGE, the Pune convention (044): the
-- dashboard divides reservoir_daily_v2.storage_tmc, which the scraper writes
-- as LIVE storage, by full_capacity_mcft, so the two must be on the same
-- basis. Live = APWRIMS design (gross) capacity minus dead storage, x 1000 to
-- Mcft. Gross figures stay in public/data/visakhapatnam-dam-storage.json.
--
--   source         gross TMC  dead TMC  live TMC   FRL m     FRL ft
--   yeleru           24.11      6.16     17.95    86.56     283.99
--   raiwada           3.60      0.33      3.27   113.925    373.77
--   thatipudi         3.325     0.15      3.175   90.526    297.00
--   meghadrigedda     1.169     0.13      1.039   18.593     61.00
--
-- Read from APWRIMS reservoirAttrs on 2026-10-14; the scraper re-checks them
-- on every run and stops on any difference. Independent agreement: CWC's
-- National Register of Large Dams 2019 gives Yeleru 682,700,000 m3 gross and
-- 508,300,000 m3 effective (24.11 / 17.95 TMC; row AP01HH0149, pdf p63),
-- Raiwada 101,940,000 m3 gross (3.60 TMC; AP01MH0053, p60) and Thatipudi
-- 94,164,000 / 89,910,000 m3 (3.325 / 3.175 TMC; AP01HH0024, p58). On
-- 8 Oct 2026 the scraper's Yeleru live storage, 10.89 TMC (308 Mcum, 60.67%),
-- matches CWC's weekly bulletin for that date, 0.308 BCM and 60.63%.
-- Meghadrigedda is NRLD 2019 row AP01MH0042, spelt "Mehadrigedda" (pdf p59):
-- operated and maintained by the Water Resources Department, completed 1977,
-- gross 33,102,000 m3 (1.169 TMC, APWRIMS's gross) and effective
-- 29,530,000 m3 (1.043 TMC, against APWRIMS's live 1.039 TMC). GVMC's
-- floating-solar IEE (Oct 2018, p15) says constructed 1977 and commissioned
-- 1979, and gives 33.1024 Mcum at FRL +18.60 m; it describes the reservoir
-- surface as owned by GVMC (p31). CGWB's 2025 Table 9.1 lists 1976.
--
-- full_tank_level_ft is FRL in metres x 3.280839895, the conversion
-- scrape_hmwssb_reservoirs.py uses for Hyderabad's metre-unit Akkampally.
-- Coordinates for the four are APWRIMS's own reservoir points.
--
-- PRIMARY DRINKING SOURCES. All six are TRUE: the city drinks from each.
-- Five are shared: the four with a feed are also drawn on by irrigation or
-- industry, and Gambhiramgedda is an irrigation reservoir GVMC draws on from
-- March to June. Only Mudasarlova serves the city alone. TRUE on shared dams
-- follows Pune's Khadakwasla chain, an irrigation complex with a drinking
-- share; the supply-overview hero computes no runway from them. Yeleru is
-- first among them although it is an irrigation project (APWRIMS lists its
-- purpose as irrigation; AP WRD's project page, unchanged since 2016,
-- allocates 12.95 TMC to irrigation and 5.00 TMC to industry and GVMC)
-- because it anchors the Godavari and Yeleru system, the largest of GVMC's
-- sources: 182 to 204 MLD of about 380 MLD available from nine sources in
-- CGWB's 2025 aquifer plan, Table 9.1, whose quantities are unchanged since
-- Table 5.1 of CGWB's June 2022 report. Yeleru's water, and the Godavari
-- water lifted into it at Purushottapatnam or pumped from Kateru into the
-- canal, reaches the city along the Yeleru canal. GVMC's three 2020
-- bulk-water agreements with HPCL supplied clear water from Raiwada,
-- Meghadrigedda and Thatipudi; a GVMC-GVSCCL-HPCL agreement in force from
-- 29.03.2024 subsumes them and keeps 8.8 LIGD of GVMC clear water beside
-- 66.2 LIGD of recycled water from GVSCCL (HPCL EC compliance report,
-- Oct 2025-Mar 2026, pp106-110).
-- Shared storage is why the dashboard carries no days-left runway.
--
-- THE TWO WITHOUT A FEED (hasPublicFeed: false in the CityConfig):
--
--   mudasarlova   GVMC owns and maintains it (GVMC's land acquisition and
--                 resettlement due diligence report for ADB, Sep 2018, p8;
--                 completed 1902, handed to the town council in May 1903 per
--                 the 1907 gazetteer). Not in APWRIMS or NRLD. Its capacity
--                 is left NULL because GVMC's own 2018 IEE gives two figures,
--                 1,500,000 m3 (p15), which para 20 calls the original
--                 capacity, and 0.75 Mcum, the "present capacity of the lake
--                 at full tank level" (p18), with no survey or date behind
--                 it. Full tank level +50.90 m (p14) = 166.99 ft.
--                 The point is the centre of OpenStreetMap way 134100154,
--                 "Mudasarlova Reservoir" (natural=water, water=reservoir),
--                 read 2026-10-14; APWRIMS's tank layer has no Mudasarlova.
--   gambheeram    Gambhiramgedda reservoir, operated and maintained by the
--                 Water Resources Department (NRLD 2019 row AP01LH0008,
--                 pdf p58: completed 1957, gross 3,180,000 m3, effective
--                 3,158,000 m3). GVMC draws on it from 1 March to 30 June
--                 (APPCB report to the NGT, 2021). Capacity is NRLD's effective storage,
--                 3,158,000 m3 / 28,316.8 m3 per Mcft = 111.5 Mcft. The point
--                 is NRLD's dam position, 17 52'29" N 83 21'6" E; OSM's dam
--                 way 1086848421 sits 0.2 km from it. NOT APWRIMS minor-
--                 irrigation tank MI012862 "Gambheeram gedda tank" (17.8737,
--                 83.3898): that tank is 4.0 km east of the dam and carries a
--                 68.5-acre ayacut, so it is a different, smaller tank on the
--                 same stream.
--
-- No catchment areas: APWRIMS publishes command area (cca), not catchment.
-- =============================================================

INSERT INTO water_sources (
  city_id, source_code, display_name, source_type,
  full_capacity_mcft, full_tank_level_ft,
  latitude, longitude, catchment_area_sqkm,
  display_order, is_primary_drinking_source
) VALUES
  ('visakhapatnam', 'yeleru', 'Yeleru', 'reservoir',
   17950.0, 283.99, 17.30794, 82.09538, NULL, 1, TRUE),
  ('visakhapatnam', 'raiwada', 'Raiwada', 'reservoir',
   3270.0, 373.77, 18.00650, 82.96574, NULL, 2, TRUE),
  ('visakhapatnam', 'thatipudi', 'Thatipudi', 'reservoir',
   3175.0, 297.00, 18.17231, 83.19147, NULL, 3, TRUE),
  -- APWRIMS spells it "MEHADRIGADD"; same dam, Pendurthi mandal, inside GVMC.
  ('visakhapatnam', 'meghadrigedda', 'Meghadrigedda', 'reservoir',
   1039.0, 61.00, 17.75928, 83.19483, NULL, 4, TRUE),
  ('visakhapatnam', 'mudasarlova', 'Mudasarlova', 'reservoir',
   NULL, 166.99, 17.76462, 83.29412, NULL, 5, TRUE),
  ('visakhapatnam', 'gambheeram', 'Gambheeram (Gambhiramgedda)', 'reservoir',
   111.5, NULL, 17.87472, 83.35167, NULL, 6, TRUE)
ON CONFLICT (city_id, source_code) DO NOTHING;
