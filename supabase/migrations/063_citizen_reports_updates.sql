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
  'fix_submitted', 'fix_rejected', 'action_taken', 'not_ours', 'seen_too', 'thanks'));

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

-- Community: "seen this too", thanks on fixed reports, following a place, groups, and fix-it days.
-- Once per person per report.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sighting_events_once ON sighting_events (sighting_id, actor_key, event)
  WHERE event IN ('seen_too', 'thanks');

-- A follow is a person's tag on a place key (see src/lib/sightings/follows.ts), e.g. city:chennai:body:32945537.
CREATE TABLE IF NOT EXISTS sighting_follows (
  reporter_key  TEXT NOT NULL,
  target        TEXT NOT NULL CHECK (char_length(target) <= 120),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (reporter_key, target)
);
CREATE INDEX IF NOT EXISTS idx_sighting_follows_target ON sighting_follows (target);

-- Groups (colleges, schools, residents' associations, lake groups): reviewed before they can host or be named.
CREATE TABLE IF NOT EXISTS sighting_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 80),
  kind         TEXT NOT NULL CHECK (kind IN ('college', 'school', 'residents', 'lake_group', 'ngo', 'other')),
  place_id     TEXT CHECK (place_id IS NULL OR char_length(place_id) <= 40),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  join_code    TEXT NOT NULL UNIQUE CHECK (char_length(join_code) BETWEEN 8 AND 40),
  created_by   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS sighting_group_members (
  group_id      UUID NOT NULL REFERENCES sighting_groups(id) ON DELETE CASCADE,
  reporter_key  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('host', 'member')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, reporter_key)
);
CREATE INDEX IF NOT EXISTS idx_sighting_group_members_reporter ON sighting_group_members (reporter_key);
-- A report sent with a group shows the group's name, never the reporter's.
ALTER TABLE sightings ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES sighting_groups(id) ON DELETE SET NULL;

-- Fix-it days: a reviewed group's clean-up at a reported spot, for safe report types only (enforced in the API).
CREATE TABLE IF NOT EXISTS sighting_fixits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sighting_id    UUID NOT NULL REFERENCES sightings(id) ON DELETE CASCADE,
  group_id       UUID NOT NULL REFERENCES sighting_groups(id) ON DELETE CASCADE,
  starts_at      TIMESTAMPTZ NOT NULL,
  meeting_point  TEXT NOT NULL CHECK (char_length(meeting_point) BETWEEN 3 AND 160),
  note           TEXT CHECK (note IS NULL OR char_length(note) <= 280),
  status         TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'done', 'cancelled')),
  created_by     TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reminded_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sighting_fixits_sighting ON sighting_fixits (sighting_id);
CREATE INDEX IF NOT EXISTS idx_sighting_fixits_planned ON sighting_fixits (starts_at) WHERE status = 'planned';
CREATE TABLE IF NOT EXISTS sighting_fixit_rsvps (
  fixit_id      UUID NOT NULL REFERENCES sighting_fixits(id) ON DELETE CASCADE,
  reporter_key  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (fixit_id, reporter_key)
);

ALTER TABLE sighting_follows        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sighting_groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sighting_group_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sighting_fixits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sighting_fixit_rsvps    ENABLE ROW LEVEL SECURITY;
