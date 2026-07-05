-- 029_mmr_corporations.sql
-- Mumbai Metropolitan Region (MMR) re-scope, P0 (docs/specs/mumbai-mmr.md).
--
-- Promotes the 'mumbai' place from a single city to a region of 9 municipal
-- corporations. ADDITIVE and backward-compatible: no existing table or column
-- changes meaning, and every other city is untouched.
--   * cities.place_kind already exists (migration 018). We only flip 'mumbai'.
--   * `corporations` is a new table; the corporation is the region's
--     always-present comparable sub-unit (boundary + identity + the sources
--     that feed it). Ward-level + deep data are per-corporation enrichments,
--     flagged here, populated later (P2/P3) - thin corporations are honest
--     gaps, not blockers.
--   * `source_corporation` is the source -> corporation supply graph. At P0
--     only BMC's edges (the 7 lakes) are known; the rest (Barvi/Morbe/Surya/
--     Hetawane/Ulhas) land in P2 once those sources exist in water_sources.
--
-- corporation_id is intentionally NOT added to ward_* tables here - that lands
-- in P3 (equity/risk) where it is first used, backfilled to each city's sole
-- ULB so existing single-city queries keep working.

-- 1. Flip the region flag (ward_count stays as BMC's 24, the data-rich anchor).
UPDATE cities SET place_kind = 'region' WHERE city_id = 'mumbai';

-- 2. Corporations of a region.
CREATE TABLE IF NOT EXISTS corporations (
  city_id            TEXT NOT NULL REFERENCES cities(city_id) ON DELETE CASCADE,
  corporation_id     TEXT NOT NULL,
  display_name       TEXT NOT NULL,
  acronym            TEXT NOT NULL,
  unit_type          TEXT NOT NULL DEFAULT 'municipal_corporation'
                       CHECK (unit_type IN ('municipal_corporation', 'municipal_council')),
  district           TEXT,
  center_lat         NUMERIC,
  center_lng         NUMERIC,
  bbox_south         NUMERIC,
  bbox_north         NUMERIC,
  bbox_west          NUMERIC,
  bbox_east          NUMERIC,
  ward_count         INTEGER,            -- nullable: null where wards aren't published
  wards_vintage      TEXT,
  has_ward_geometry  BOOLEAN NOT NULL DEFAULT FALSE,
  has_supply_data    BOOLEAN NOT NULL DEFAULT FALSE,
  has_equity_data    BOOLEAN NOT NULL DEFAULT FALSE,
  has_risk_composite BOOLEAN NOT NULL DEFAULT FALSE,
  display_order      INTEGER NOT NULL DEFAULT 0,
  enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (city_id, corporation_id)
);
CREATE INDEX IF NOT EXISTS idx_corporations_city ON corporations(city_id, display_order);

-- 3. The source -> corporation supply graph (bipartite, many-to-many).
CREATE TABLE IF NOT EXISTS source_corporation (
  city_id        TEXT NOT NULL,
  source_code    TEXT NOT NULL,
  corporation_id TEXT NOT NULL,
  bulk_supplier  TEXT,                  -- BMC / MJP / MIDC / STEM / CIDCO, optional
  PRIMARY KEY (city_id, source_code, corporation_id),
  FOREIGN KEY (city_id, source_code)
    REFERENCES water_sources(city_id, source_code) ON DELETE CASCADE,
  FOREIGN KEY (city_id, corporation_id)
    REFERENCES corporations(city_id, corporation_id) ON DELETE CASCADE
);

-- 4. Seed the 9 corporations (centers/bboxes from OSM, see
--    scripts/build-mmr-corporations.py + src/lib/cities/mumbai.ts).
INSERT INTO corporations (
  city_id, corporation_id, display_name, acronym, unit_type, district,
  center_lat, center_lng, bbox_south, bbox_north, bbox_west, bbox_east,
  ward_count, wards_vintage, has_ward_geometry, has_supply_data,
  has_equity_data, has_risk_composite, display_order
) VALUES
  ('mumbai','bmc','Greater Mumbai','BMC','municipal_corporation','Mumbai City + Suburban',
   19.06,72.8325,18.8922,19.2695,72.7732,72.9817,24,'2023',TRUE,TRUE,TRUE,TRUE,1),
  ('mumbai','tmc','Thane','TMC','municipal_corporation','Thane',
   19.1976,72.9893,19.1316,19.3002,72.9104,73.0771,NULL,NULL,FALSE,FALSE,FALSE,FALSE,2),
  ('mumbai','kdmc','Kalyan-Dombivli','KDMC','municipal_corporation','Thane',
   19.2183,73.1322,19.1422,19.3118,73.0612,73.2399,NULL,NULL,FALSE,FALSE,FALSE,FALSE,3),
  ('mumbai','nmmc','Navi Mumbai','NMMC','municipal_corporation','Thane',
   19.0637,73.0059,18.9984,19.1895,72.9779,73.0497,NULL,NULL,FALSE,FALSE,FALSE,FALSE,4),
  ('mumbai','mbmc','Mira-Bhayandar','MBMC','municipal_corporation','Thane',
   19.2735,72.8202,19.2307,19.3283,72.7786,72.9376,NULL,NULL,FALSE,FALSE,FALSE,FALSE,5),
  ('mumbai','vvcmc','Vasai-Virar','VVCMC','municipal_corporation','Palghar',
   19.4226,72.8226,19.287,19.5275,72.7442,72.9625,NULL,NULL,FALSE,FALSE,FALSE,FALSE,6),
  ('mumbai','bncmc','Bhiwandi-Nizampur','BNCMC','municipal_corporation','Thane',
   19.2899,73.0653,19.2645,19.3235,73.0325,73.1036,NULL,NULL,FALSE,FALSE,FALSE,FALSE,7),
  ('mumbai','umc','Ulhasnagar','UMC','municipal_corporation','Thane',
   19.22,73.1658,19.1909,19.2548,73.146,73.1794,NULL,NULL,FALSE,FALSE,FALSE,FALSE,8),
  ('mumbai','pmc','Panvel','PMC','municipal_corporation','Raigad',
   19.0282,73.1005,18.9684,19.1146,73.0437,73.1489,NULL,NULL,FALSE,FALSE,FALSE,FALSE,9)
ON CONFLICT (city_id, corporation_id) DO NOTHING;

-- 5. Seed BMC's known source edges (the 7 lakes). Other corporations' edges
--    are added in P2 with their sources.
INSERT INTO source_corporation (city_id, source_code, corporation_id, bulk_supplier)
SELECT 'mumbai', source_code, 'bmc', 'BMC'
FROM water_sources
WHERE city_id = 'mumbai'
ON CONFLICT (city_id, source_code, corporation_id) DO NOTHING;

-- 6. RLS: read-only public exposure, matching the codebase pattern
--    (007/013/020). The anon (public) key may SELECT; writes are denied to anon
--    (no write policy) and happen only via the service_role, which bypasses RLS.
--    This is defence-in-depth: read-only is guaranteed regardless of grant drift.
ALTER TABLE corporations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_corporation  ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read corporations"
  ON corporations FOR SELECT USING (true);
CREATE POLICY "Public read source_corporation"
  ON source_corporation FOR SELECT USING (true);
GRANT SELECT ON corporations, source_corporation TO anon, authenticated;
