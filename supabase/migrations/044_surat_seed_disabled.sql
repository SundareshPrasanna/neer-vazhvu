-- =============================================================
-- 044_surat_seed_disabled.sql
-- Seeds Surat as a registered but disabled standalone CITY (the Delhi
-- model, not Kolkata's region model).
--
-- Purpose: lets us scaffold Surat's CityConfig + water_sources in code and
-- write ingest against city_id='surat' without exposing the place in the
-- user-facing UI. The frontend's [cityId]/layout.tsx 404s any non-enabled
-- city; we flip enabled=TRUE in a later migration once data + UI are ready.
--
-- WHY place_kind stays 'city'. Surat's water story does reach past the
-- municipal line - the Tapi estuary at Hazira, the Olpad and Choryasi
-- salinity belt, the Pandesara/Sachin/Palsana industrial clusters - but
-- unlike Kolkata's East Kolkata Wetlands, none of those are infrastructure
-- that SMC operates or depends on for supply. They are context the river
-- and groundwater surfaces state their true extent for, not comparable
-- sub-units with their own water relationship to model. A region config
-- would create eight empty corporation cards.
--
-- ward_count is 30 - the electoral wards SMC is elected on (120
-- corporators, 4 per ward). This is NOT the analytical unit. "Ward" in
-- Surat means three incompatible things: these 30, about 134
-- census/administrative wards in SMC's own 1961-2011 area-and-population
-- table, and a third scheme inside SMC's GIS ward_boundary layer. The
-- analytical unit is the ZONE, which is the only one carrying live data
-- (rainfall is reported per zone, every khadi is attributed to one), an
-- official current denominator (SMC's GIS publishes 2011 census and 2024
-- estimated population per zone) and the city's own supply breakdown.
-- Ward surfaces stay off in the frontend until boundary geometry exists.
--
-- default_consumption_mld is deliberately NULL. SMC's Hydraulic department
-- page states 980 MLD gross daily average against 1,300 MLD installed
-- works capacity, but that page is explicitly dated 2015; the national
-- open-data monthly series runs to Dec 2021 and ends around 1,250 MLD.
-- Two differently-scoped figures from different years, so we store no
-- number rather than silently pick the newer one.
--
-- Note also what is NOT stored: any non-revenue-water figure. The national
-- open-data release carries a "Losses including NRW" column that is
-- exactly 20.0000% of total supply on all 48 monthly rows, alongside an
-- "actual supplied" column identical to total supply, which contradicts
-- it. That is an assumption presented as a measurement and it does not
-- enter the database.
-- =============================================================

INSERT INTO cities (
  city_id, display_name, state_code, timezone,
  center_lat, center_lng,
  bbox_south, bbox_north, bbox_west, bbox_east,
  primary_authority_acronym, primary_authority_name,
  local_gov_acronym, local_gov_name, ward_count,
  default_consumption_mld, default_desalination_mld, enabled
) VALUES (
  'surat', 'Surat', 'GJ', 'Asia/Kolkata',
  21.1702, 72.8311,
  21.0, 21.35, 72.6, 72.99,
  'SMC', 'Surat Municipal Corporation, Hydraulic Department',
  'SMC', 'Surat Municipal Corporation', 30,
  NULL, NULL, FALSE
) ON CONFLICT (city_id) DO NOTHING;
