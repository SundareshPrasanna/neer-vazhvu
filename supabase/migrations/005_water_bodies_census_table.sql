-- Create water_bodies_census table
-- Source: First Census of Water Bodies (2018-19), Ministry of Jal Shakti
-- 305 Chennai water bodies with ownership, capacity, encroachment data

CREATE TABLE water_bodies_census (
  id                              BIGSERIAL PRIMARY KEY,
  census_code                     TEXT UNIQUE,
  name                            TEXT,
  district                        TEXT NOT NULL DEFAULT 'CHENNAI',
  taluk                           TEXT,
  block                           TEXT,
  village                         TEXT,
  ward_name                       TEXT,
  water_body_type                 TEXT,
  nature                          TEXT,
  ownership                       TEXT,
  latitude                        NUMERIC(9,6),
  longitude                       NUMERIC(9,6),
  storage_capacity_original       NUMERIC(12,3),
  storage_capacity_present        NUMERIC(12,3),
  storage_loss_pct                NUMERIC(5,2),
  max_depth_m                     NUMERIC(8,2),
  water_spread_area               NUMERIC(10,3),
  construction_year               INTEGER,
  renovation_year                 INTEGER,
  basin                           TEXT,
  sub_basin                       TEXT,
  is_in_use                       BOOLEAN,
  encroachment_status             TEXT,
  encroachment_pct                NUMERIC(5,2),
  source                          data_source NOT NULL DEFAULT 'data_gov_in',
  fetched_at                      TIMESTAMPTZ DEFAULT NOW(),
  raw_json                        JSONB
);

CREATE INDEX idx_wbc_lat_lng ON water_bodies_census(latitude, longitude);
CREATE INDEX idx_wbc_type ON water_bodies_census(water_body_type);
CREATE INDEX idx_wbc_encroachment ON water_bodies_census(encroachment_status);

-- RLS: public read access
ALTER TABLE water_bodies_census ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read water_bodies_census"
  ON water_bodies_census FOR SELECT USING (true);
