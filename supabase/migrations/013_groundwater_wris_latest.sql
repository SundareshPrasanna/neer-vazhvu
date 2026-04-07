-- =============================================================
-- 013_groundwater_wris_latest.sql
-- View: latest reading per CGWB station from groundwater_wris
-- Avoids client-side dedup over thousands of rows when listing stations
-- =============================================================

CREATE OR REPLACE VIEW groundwater_wris_latest AS
SELECT DISTINCT ON (station_code)
  station_code,
  station_name,
  latitude,
  longitude,
  reading_date,
  depth_to_water_m,
  acquisition_mode,
  agency,
  district
FROM groundwater_wris
ORDER BY station_code, reading_date DESC;

-- View inherits RLS from base table, but be explicit:
GRANT SELECT ON groundwater_wris_latest TO anon, authenticated;
