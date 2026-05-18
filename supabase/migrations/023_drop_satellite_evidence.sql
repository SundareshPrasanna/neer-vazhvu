-- Drop the GEE satellite evidence pipeline.
--
-- The reviewed-evidence-chip pipeline (created in migration 011) generated
-- ~6 manually-reviewed Sentinel-2 thumbnails + NDWI overlays per flagship
-- water body. It has been superseded by the rich-data deep-zoom panel,
-- which produces 39 yearly chips + cumulative water-loss / built-gain
-- tints per body via scripts/ingest_rich_body_imagery.py (no manual
-- review gate, lower per-body cost).
--
-- The water_body_satellite_summary table (area-over-time chart) is
-- preserved - it powers the recent-trend chart that complements the
-- rich-body panel's decade-scale view.

-- Drop storage policies first (they reference the bucket).
DROP POLICY IF EXISTS "Public read for satellite-evidence" ON storage.objects;

-- Empty the bucket (Supabase will error if you try to delete a non-empty bucket).
DELETE FROM storage.objects WHERE bucket_id = 'satellite-evidence';

-- Drop the bucket itself.
DELETE FROM storage.buckets WHERE id = 'satellite-evidence';

-- Drop the evidence table (indices and constraints cascade automatically).
DROP TABLE IF EXISTS water_body_satellite_evidence;
