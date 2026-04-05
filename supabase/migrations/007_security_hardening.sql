-- Lock down operational tables that should never be readable with the public anon key.
-- The frontend now ships reservoir metadata from code, so both tables can stay private.

ALTER TABLE reservoir_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE reservoir_meta FROM PUBLIC;
REVOKE ALL ON TABLE reservoir_meta FROM anon;
REVOKE ALL ON TABLE reservoir_meta FROM authenticated;

REVOKE ALL ON TABLE pipeline_log FROM PUBLIC;
REVOKE ALL ON TABLE pipeline_log FROM anon;
REVOKE ALL ON TABLE pipeline_log FROM authenticated;
