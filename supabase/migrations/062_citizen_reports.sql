-- 062: citizen reports (the "For citizens" page). Spec: src/lib/sightings/.
--
-- Write model: every read and write goes through the Next API with the
-- service role, after the API has checked the signed-in user. RLS is on and
-- NO policy exists on any table here, so the anon and authenticated keys can
-- neither read nor write them (the public read path is the API, which returns
-- public columns only). Both buckets accept only server-re-encoded WebP.
--
-- Numbered 062: 059-061 are claimed by the open Visakhapatnam and Nagpur
-- branches.

CREATE TABLE sighting_reporters (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Set on a reporter's first approved report; raises their caps.
  trusted           BOOLEAN NOT NULL DEFAULT FALSE,
  suspended_at      TIMESTAMPTZ,
  suspended_reason  TEXT CHECK (suspended_reason IS NULL OR char_length(suspended_reason) <= 280)
);

CREATE TABLE sightings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reporter_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Server-resolved place (never trusted from the client).
  place_kind          TEXT NOT NULL CHECK (place_kind IN ('city', 'district')),
  place_id            TEXT NOT NULL,
  state_code          TEXT NOT NULL,
  corporation_id      TEXT,
  ward_id             TEXT,
  ward_name           TEXT,
  block_code          TEXT,
  panchayat_code      TEXT,
  panchayat_name      TEXT,
  water_body_id       TEXT,
  water_body_name     TEXT,

  lat                 NUMERIC(9,6) NOT NULL,
  lng                 NUMERIC(9,6) NOT NULL,
  location_accuracy_m NUMERIC(8,1),

  -- Validated against src/lib/sightings/taxonomy.ts (text, so a new type
  -- needs no migration).
  category            TEXT NOT NULL,
  subcategory         TEXT,
  note                TEXT CHECK (note IS NULL OR char_length(note) <= 280),
  -- Reviewer's tag on an "other" report that may become a new type.
  candidate_label     TEXT CHECK (candidate_label IS NULL OR char_length(candidate_label) <= 80),
  authority_role      TEXT,

  review_status       TEXT NOT NULL DEFAULT 'received'
                        CHECK (review_status IN ('received', 'needs_info', 'approved', 'rejected')),
  -- Null until approved.
  case_status         TEXT CHECK (case_status IN ('open', 'reported', 'authority_done', 'fixed', 'closed')),
  reviewed_at         TIMESTAMPTZ,

  exif_captured_at    TIMESTAMPTZ,
  exif_lat            NUMERIC(9,6),
  exif_lng            NUMERIC(9,6)
);

CREATE INDEX idx_sightings_reporter ON sightings (reporter_id, created_at);
CREATE INDEX idx_sightings_review   ON sightings (review_status, created_at);
CREATE INDEX idx_sightings_place    ON sightings (place_id, review_status);
CREATE INDEX idx_sightings_created  ON sightings (created_at);

CREATE TABLE sighting_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sighting_id   UUID NOT NULL REFERENCES sightings(id) ON DELETE CASCADE,
  reporter_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'report' CHECK (kind IN ('report', 'fixed')),
  storage_path  TEXT NOT NULL,
  public_path   TEXT,
  -- Of the uploaded bytes: the same photo cannot be sent twice by one account.
  sha256        TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  width         INTEGER,
  height        INTEGER,
  ordinal       INTEGER NOT NULL DEFAULT 0,
  UNIQUE (reporter_id, sha256)
);

CREATE INDEX idx_sighting_photos_sighting ON sighting_photos (sighting_id);

-- Append-only history: review decisions and every status change.
CREATE TABLE sighting_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sighting_id     UUID NOT NULL REFERENCES sightings(id) ON DELETE CASCADE,
  actor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role      TEXT NOT NULL CHECK (actor_role IN ('reporter', 'reviewer', 'system')),
  event           TEXT NOT NULL CHECK (event IN (
                    'submitted', 'needs_info', 'approved', 'rejected', 'reclassified',
                    'reported', 'authority_done', 'fixed', 'still_there', 'closed', 'reopened')),
  authority_body  TEXT CHECK (authority_body IS NULL OR char_length(authority_body) <= 160),
  reference       TEXT CHECK (reference IS NULL OR char_length(reference) <= 80),
  reason          TEXT CHECK (reason IS NULL OR char_length(reason) <= 280),
  category        TEXT,
  subcategory     TEXT
);

CREATE INDEX idx_sighting_events ON sighting_events (sighting_id, created_at);

ALTER TABLE sighting_reporters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sightings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sighting_photos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sighting_events    ENABLE ROW LEVEL SECURITY;

-- Caps and insert in one transaction under one lock, so parallel requests
-- cannot overshoot a cap. Caps come from src/lib/sightings/limits.ts.
CREATE FUNCTION create_sighting(
  p_row             JSONB,
  p_daily_new       INTEGER,
  p_daily_trusted   INTEGER,
  p_pending_new     INTEGER,
  p_pending_trusted INTEGER,
  p_site_daily      INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_reporter UUID := (p_row->>'reporter_id')::UUID;
  v_rep      sighting_reporters%ROWTYPE;
  v_id       UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('sightings:intake'));

  INSERT INTO sighting_reporters (user_id) VALUES (v_reporter) ON CONFLICT DO NOTHING;
  SELECT * INTO v_rep FROM sighting_reporters WHERE user_id = v_reporter;

  IF v_rep.suspended_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'suspended');
  END IF;
  IF (SELECT count(*) FROM sightings WHERE created_at > NOW() - INTERVAL '1 day') >= p_site_daily THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'site_paused');
  END IF;
  IF (SELECT count(*) FROM sightings WHERE reporter_id = v_reporter
        AND created_at > NOW() - INTERVAL '1 day')
     >= CASE WHEN v_rep.trusted THEN p_daily_trusted ELSE p_daily_new END THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap');
  END IF;
  IF (SELECT count(*) FROM sightings WHERE reporter_id = v_reporter
        AND review_status IN ('received', 'needs_info'))
     >= CASE WHEN v_rep.trusted THEN p_pending_trusted ELSE p_pending_new END THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pending_cap');
  END IF;

  INSERT INTO sightings (
    reporter_id, place_kind, place_id, state_code, corporation_id, ward_id, ward_name,
    block_code, panchayat_code, panchayat_name, water_body_id, water_body_name,
    lat, lng, location_accuracy_m, category, subcategory, note, authority_role,
    exif_captured_at, exif_lat, exif_lng
  ) VALUES (
    v_reporter, p_row->>'place_kind', p_row->>'place_id', p_row->>'state_code',
    p_row->>'corporation_id', p_row->>'ward_id', p_row->>'ward_name',
    p_row->>'block_code', p_row->>'panchayat_code', p_row->>'panchayat_name',
    p_row->>'water_body_id', p_row->>'water_body_name',
    (p_row->>'lat')::NUMERIC, (p_row->>'lng')::NUMERIC, (p_row->>'location_accuracy_m')::NUMERIC,
    p_row->>'category', p_row->>'subcategory', p_row->>'note', p_row->>'authority_role',
    (p_row->>'exif_captured_at')::TIMESTAMPTZ, (p_row->>'exif_lat')::NUMERIC, (p_row->>'exif_lng')::NUMERIC
  ) RETURNING id INTO v_id;

  INSERT INTO sighting_events (sighting_id, actor_id, actor_role, event)
  VALUES (v_id, v_reporter, 'reporter', 'submitted');

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION create_sighting(JSONB, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_sighting(JSONB, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO service_role;

-- 2 MB is generous: the server stores only its own WebP re-encode (~0.3 MB).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('sightings-intake', 'sightings-intake', false, 2097152, ARRAY['image/webp']),
  ('sightings-public', 'sightings-public', true,  2097152, ARRAY['image/webp'])
ON CONFLICT (id) DO NOTHING;
