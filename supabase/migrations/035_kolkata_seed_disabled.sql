-- =============================================================
-- 035_kolkata_seed_disabled.sql
-- Seeds Kolkata as a registered but disabled REGION (the MMR model,
-- not the standalone-city model used for Delhi).
--
-- Purpose: lets us scaffold Kolkata's CityConfig + water_sources +
-- corporations in code and write ingest against city_id='kolkata'
-- without exposing the place in the user-facing UI. The frontend's
-- [cityId]/layout.tsx 404s any non-enabled city; we flip enabled=TRUE
-- in a later migration once data + UI are ready.
--
-- WHY place_kind='region'. The decision is physical, not administrative.
-- The East Kolkata Wetlands treat 910 of Kolkata's 1,400 MLD of sewage -
-- 65%, roughly 5x what all five of the city's STPs manage combined - and
-- the EKW lies OUTSIDE KMC, in North and South 24 Parganas. A KMC-only
-- Kolkata would draw a boundary excluding the city's single largest piece
-- of water infrastructure. Source: KMC's own District Environment Plan
-- 2021, filed under the NGT-mandated DEP process.
--
-- ward_count is 144, primary-confirmed from that same plan. Note the
-- public ward GEOMETRY only covers 141 of them (OpenCity's 2022 KML has
-- wards 1-141; 142/143/144 are absent, and the sole attribute is a bare
-- ward number with no name and no borough). Ward surfaces stay off in the
-- frontend until that is resolved - the count here is the true count, not
-- the mappable count.
--
-- default_consumption_mld is deliberately NULL. KMC contests its own
-- denominator: the Environment Plan gives 4.5 million residents plus a
-- 6-million/day floating population, while KMC's water-distribution site
-- frames demand off a "static population" of 44.96 lakh. Every LPCD figure
-- for Kolkata is unstable at the source, so we store no number rather than
-- manufacture one.
-- =============================================================

INSERT INTO cities (
  city_id, display_name, state_code, timezone,
  center_lat, center_lng,
  bbox_south, bbox_north, bbox_west, bbox_east,
  primary_authority_acronym, primary_authority_name,
  local_gov_acronym, local_gov_name, ward_count,
  default_consumption_mld, default_desalination_mld, enabled
) VALUES (
  'kolkata', 'Kolkata', 'WB', 'Asia/Kolkata',
  22.5726, 88.3639,
  22.35, 22.85, 88.15, 88.55,
  'KMC', 'Kolkata Municipal Corporation, Water Supply Department',
  'KMC', 'Kolkata Municipal Corporation', 144,
  NULL, NULL, FALSE
) ON CONFLICT (city_id) DO NOTHING;

UPDATE cities SET place_kind = 'region' WHERE city_id = 'kolkata';

-- The corporation set is DELIBERATELY NARROW. The Kolkata Metropolitan Area
-- contains multiple corporations and ~38 municipalities, but that structure is
-- not established to primary: the 3-vs-4 corporation count is unresolved and
-- KMDA's site did not yield the figures. Rather than model ~38 units off an
-- unverified structure, we seed only units whose WATER relationship to KMC is
-- individually verified - the intake's host district, the wetlands that treat
-- its sewage, and the two bodies it sells bulk water to. The rest of KMA is a
-- named gap on the scope card, not a silent omission. Units join as their
-- relationships are verified, which is the discipline the MMR build followed.
INSERT INTO corporations (
  city_id, corporation_id, display_name, acronym, unit_type, district,
  center_lat, center_lng, bbox_south, bbox_north, bbox_west, bbox_east,
  ward_count, wards_vintage, has_ward_geometry, has_supply_data,
  has_equity_data, has_risk_composite, display_order
) VALUES
  ('kolkata','kmc','Kolkata Municipal Corporation','KMC','municipal_corporation','Kolkata',
   22.5726,88.3639,22.45,22.65,88.28,88.44,144,NULL,FALSE,TRUE,FALSE,FALSE,1),
  -- Verified relationship: buys 90 MLD in bulk from KMC.
  ('kolkata','bidhannagar','Bidhannagar Municipal Corporation','BMC-Salt Lake','municipal_corporation','North 24 Parganas',
   22.5697,88.4297,22.52,22.63,88.38,88.49,NULL,NULL,FALSE,TRUE,FALSE,FALSE,2),
  -- Verified relationship: buys 22.7 MLD in bulk from KMC.
  ('kolkata','budge_budge','Budge Budge Municipality','Budge Budge','municipal_council','South 24 Parganas',
   22.4708,88.1748,22.43,22.51,88.14,88.22,NULL,NULL,FALSE,TRUE,FALSE,FALSE,3)
ON CONFLICT (city_id, corporation_id) DO NOTHING;
