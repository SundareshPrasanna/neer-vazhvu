-- Citizen reports: where the reporter said they were, how much there is, and photos from people who
-- confirm a report is still there (checked before they are published, like fixed photos).

ALTER TABLE sighting_photos DROP CONSTRAINT IF EXISTS sighting_photos_kind_check;
ALTER TABLE sighting_photos ADD CONSTRAINT sighting_photos_kind_check CHECK (kind IN ('report', 'fixed', 'update'));

-- The kind of place the reporter chose (home, lake, river, drain, street), apart from place_kind (city, district, basin).
ALTER TABLE sightings ADD COLUMN IF NOT EXISTS seen_at TEXT
  CHECK (seen_at IS NULL OR seen_at IN ('home', 'lake', 'river', 'drain', 'street', 'other'));
-- Optional: a small patch, along a stretch, or across most of the place.
ALTER TABLE sightings ADD COLUMN IF NOT EXISTS extent TEXT
  CHECK (extent IS NULL OR extent IN ('spot', 'stretch', 'widespread'));
