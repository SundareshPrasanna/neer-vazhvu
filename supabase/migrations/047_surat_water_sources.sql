-- =============================================================
-- 047_surat_water_sources.sql
-- Surat's two tracked points on the Tapi. Neither is a reservoir, and
-- that is the whole point.
--
-- Surat is RUN-OF-RIVER, like Kolkata, and the days-left hero is
-- undefined here for the same reason: dividing live storage by draw rate
-- needs a numerator that does not exist. Surat impounds nothing of its
-- own. It abstracts from a weir-cum-causeway pond and the water that
-- fills that pond is released from a dam it does not operate.
--
--   - Ukai dam            ~100 km upstream, operated by the Gujarat
--                         Water Resources Department, NOT by SMC. It is
--                         an irrigation and power dam serving the lower
--                         Tapi command area. SMC republishes its level,
--                         inflow and outflow hourly. Recorded as a
--                         flow_station rather than a reservoir precisely
--                         so it can never be counted as Surat storage:
--                         no storage volume is published, and Surat's
--                         share of it is not published anywhere either.
--   - Singanpor weir      The weir-cum-causeway pond IS the city's
--                         intake. Level and outflow are published hourly
--                         against a stated 6.0 m overflow threshold.
--                         A river reach, not a reservoir.
--
-- full_capacity_mcft is NULL for both. Ukai has a gross capacity in the
-- literature, but storing it against city_id='surat' would invite exactly
-- the arithmetic this config exists to prevent - a "% full" that reads as
-- Surat's water when it is the command area's. full_tank_level_ft is set
-- for Ukai alone because 345 ft is SMC's own published full reservoir
-- level and the flood-headroom hero measures against it.
--
-- is_primary_drinking_source is TRUE for the weir only. Ukai is upstream
-- context and a flood control, not the city's tap.
-- =============================================================

INSERT INTO water_sources (
  city_id, source_code, display_name, source_type,
  full_capacity_mcft, full_tank_level_ft,
  latitude, longitude, catchment_area_sqkm,
  display_order, is_primary_drinking_source
) VALUES
  ('surat', 'ukai',           'Ukai dam (upstream, not SMC-operated)', 'flow_station', NULL, 345.0, 21.24830, 73.59030, NULL, 1, FALSE),
  ('surat', 'singanpor_weir', 'Weir-cum-causeway (Singanpor)',         'flow_station', NULL, NULL,  21.21670, 72.82360, NULL, 2, TRUE)
ON CONFLICT (city_id, source_code) DO NOTHING;
