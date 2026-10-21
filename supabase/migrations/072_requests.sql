-- 072: requests from signed-in visitors - a city or district to onboard now,
-- data or a feature later. Spec: src/lib/requests/.
--
-- Write model as 062: every read and write goes through the Next API with the
-- service role, after the API has checked the signed-in user. RLS is on and
-- NO policy exists, so the anon and authenticated keys can neither read nor
-- write the table.
--
-- No column references auth.users. A request carries requester_key, the same
-- HMAC of the account id that sightings use (SIGHTINGS_REPORTER_KEY_SECRET),
-- so an account suspended for sightings is suspended here too. The name is
-- what the person chose to show; the email is stored only when they ticked
-- "you can contact me".
--
-- Numbered 072: main ends at Jaipur's 071, and production applies in order.

-- "  Navi   Mumbai " and "navi mumbai" are one subject.
CREATE FUNCTION request_subject_key(p_subject TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$ SELECT lower(btrim(regexp_replace(p_subject, '\s+', ' ', 'g'))) $$;

CREATE TABLE requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 'deleted' once the account is deleted; name and email are cleared then.
  requester_key   TEXT NOT NULL,
  requester_name  TEXT CHECK (requester_name IS NULL OR char_length(requester_name) BETWEEN 1 AND 120),
  contact_email   TEXT CHECK (contact_email IS NULL OR (char_length(contact_email) <= 254
                    AND contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),

  -- Validated against src/lib/requests/ (text, so a new kind needs only the
  -- check below widened).
  kind            TEXT NOT NULL CHECK (kind IN ('city', 'district', 'data', 'feature')),
  -- What they typed: "Madurai", or a short title for data and features.
  subject         TEXT NOT NULL CHECK (char_length(btrim(subject)) BETWEEN 2 AND 120),
  subject_key     TEXT GENERATED ALWAYS AS (request_subject_key(subject)) STORED,
  state_code      TEXT CHECK (state_code IS NULL OR state_code ~ '^[A-Z]{2}$'),
  message         TEXT CHECK (message IS NULL OR char_length(message) <= 1000),
  -- The page the request was sent from, e.g. "/" or "/chennai/groundwater".
  source_path     TEXT CHECK (source_path IS NULL OR char_length(source_path) <= 200),

  status          TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'triaged', 'planned', 'done', 'declined')),
  reviewed_at     TIMESTAMPTZ,
  reviewer_note   TEXT CHECK (reviewer_note IS NULL OR char_length(reviewer_note) <= 280)
);

CREATE INDEX idx_requests_requester ON requests (requester_key, created_at);
CREATE INDEX idx_requests_status    ON requests (status, created_at);
-- Demand: how many accounts asked for the same place or feature.
CREATE INDEX idx_requests_subject   ON requests (kind, subject_key);
-- One open request per account per subject (deleted accounts excepted).
CREATE UNIQUE INDEX uq_requests_open ON requests (requester_key, kind, subject_key)
  WHERE status IN ('new', 'triaged', 'planned') AND requester_key <> 'deleted';

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- Caps and insert in one transaction under one lock, as create_sighting.
-- Caps come from src/lib/requests/limits.ts; the all-requests ceiling is a
-- backstop against a flood of fresh accounts.
CREATE FUNCTION create_request(
  p_row        JSONB,
  p_daily      INTEGER,
  p_open       INTEGER,
  p_site_daily INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_key TEXT := p_row->>'requester_key';
  v_id  UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('requests:intake'));

  IF EXISTS (SELECT 1 FROM sighting_reporters WHERE reporter_key = v_key AND suspended_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'suspended');
  END IF;
  IF (SELECT count(*) FROM requests WHERE created_at > NOW() - INTERVAL '1 day') >= p_site_daily THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'site_paused');
  END IF;
  IF EXISTS (SELECT 1 FROM requests WHERE requester_key = v_key AND kind = p_row->>'kind'
        AND subject_key = request_subject_key(p_row->>'subject')
        AND status IN ('new', 'triaged', 'planned')) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate');
  END IF;
  IF (SELECT count(*) FROM requests WHERE requester_key = v_key
        AND created_at > NOW() - INTERVAL '1 day') >= p_daily THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap');
  END IF;
  IF (SELECT count(*) FROM requests WHERE requester_key = v_key
        AND status IN ('new', 'triaged', 'planned')) >= p_open THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'open_cap');
  END IF;

  INSERT INTO requests (
    requester_key, requester_name, contact_email, kind, subject, state_code, message, source_path
  ) VALUES (
    v_key, p_row->>'requester_name', p_row->>'contact_email', p_row->>'kind', btrim(p_row->>'subject'),
    p_row->>'state_code', p_row->>'message', p_row->>'source_path'
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION create_request(JSONB, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_request(JSONB, INTEGER, INTEGER, INTEGER) TO service_role;
