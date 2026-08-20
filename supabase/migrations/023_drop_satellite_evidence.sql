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

-- APPLIED 2026-08-20, four months after it was written, and NOT as written.
--
-- Supabase has since added storage.protect_delete(), a trigger that refuses
-- DELETE straight against storage.objects:
--
--   ERROR 42501: Direct deletion from storage tables is not allowed.
--                Use the Storage API instead.
--
-- So the two DELETEs below can no longer run and are kept only as a record of
-- what this migration meant. The bucket must be emptied and dropped through
-- the Storage API first, which is idempotent and safe to repeat:
--
--   curl -X POST "$SUPABASE_URL/storage/v1/bucket/satellite-evidence/empty" \
--        -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"
--   curl -X DELETE "$SUPABASE_URL/storage/v1/bucket/satellite-evidence" \
--        -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"
--
-- The empty call returns "queued, may take up to an hour"; it cleared 1,575
-- objects in under thirty seconds. Then the SQL below finishes the job.
--
-- WHAT WAS ACTUALLY REMOVED: 381 rows, 1,575 storage objects, one public
-- bucket. water_body_satellite_summary was preserved as this file always
-- intended and still carries 19,861 rows behind three live consumers
-- (api/water-bodies/gee, .../gee/history, lib/facts/live-facts).

-- Drop storage policies first (they reference the bucket).
DROP POLICY IF EXISTS "Public read for satellite-evidence" ON storage.objects;

-- HISTORICAL, NOT RUNNABLE - see the note above. Left in place rather than
-- deleted so the migration still says what it did, guarded so a fresh
-- rebuild does not abort on the trigger.
DO $$
BEGIN
  DELETE FROM storage.objects WHERE bucket_id = 'satellite-evidence';
  DELETE FROM storage.buckets WHERE id = 'satellite-evidence';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'storage rows not removable from SQL (protect_delete); use the Storage API - see header';
END $$;

-- Drop the evidence table (indices and constraints cascade automatically).
DROP TABLE IF EXISTS water_body_satellite_evidence;
