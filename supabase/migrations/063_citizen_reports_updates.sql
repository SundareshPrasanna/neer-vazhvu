-- Citizen reports: updates from anyone nearby, department updates, and opt-in browser notifications.
--
-- A "fixed" claim now waits for its photo to be checked: the claim is recorded as fix_submitted, and the
-- reviewer's publish records fixed and moves the status. Departments update their own items through a
-- signed link (actor_role department). Residents other than the reporter can confirm a report is still
-- there or send a fixed photo (actor_role resident).

ALTER TABLE sighting_events DROP CONSTRAINT IF EXISTS sighting_events_actor_role_check;
ALTER TABLE sighting_events ADD CONSTRAINT sighting_events_actor_role_check
  CHECK (actor_role IN ('reporter', 'reviewer', 'system', 'resident', 'department'));

ALTER TABLE sighting_events DROP CONSTRAINT IF EXISTS sighting_events_event_check;
ALTER TABLE sighting_events ADD CONSTRAINT sighting_events_event_check CHECK (event IN (
  'submitted', 'needs_info', 'approved', 'rejected', 'reclassified',
  'reported', 'authority_done', 'fixed', 'still_there', 'closed', 'reopened',
  'fix_submitted', 'fix_rejected', 'action_taken', 'not_ours'));

CREATE INDEX IF NOT EXISTS idx_sighting_events_actor ON sighting_events (actor_key, created_at);

-- One row per browser that asked to be told about its reporter's reports. Keyed by the coded reporter
-- tag only; deleted with the account.
CREATE TABLE IF NOT EXISTS sighting_push_subscriptions (
  endpoint      TEXT PRIMARY KEY CHECK (char_length(endpoint) <= 1000),
  reporter_key  TEXT NOT NULL,
  p256dh        TEXT NOT NULL CHECK (char_length(p256dh) <= 200),
  auth          TEXT NOT NULL CHECK (char_length(auth) <= 100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sighting_push_reporter ON sighting_push_subscriptions (reporter_key);
ALTER TABLE sighting_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- When the reporter was last reminded about an open report, so the two-week nudge is sent once per lull.
ALTER TABLE sightings ADD COLUMN IF NOT EXISTS nudged_at TIMESTAMPTZ;

-- How a water test was done (instrument, filtered or not, optional calibration, pump run, depth, model).
-- Set after the row is created, so create_sighting is unchanged.
ALTER TABLE sightings ADD COLUMN IF NOT EXISTS test_meta JSONB
  CHECK (test_meta IS NULL OR jsonb_typeof(test_meta) = 'object');
