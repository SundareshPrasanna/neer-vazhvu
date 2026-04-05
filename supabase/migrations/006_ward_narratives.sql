-- =============================================================
-- 006_ward_narratives.sql
-- Neer Vazhvu - AI-Generated Ward Narratives + City Briefing AI
-- =============================================================

-- ----- WARD-LEVEL AI NARRATIVES -----

CREATE TABLE ward_narrative (
    id              BIGSERIAL PRIMARY KEY,
    ward_number     INTEGER NOT NULL,
    narrative_date  DATE NOT NULL,
    headline_en     TEXT NOT NULL,
    headline_ta     TEXT NOT NULL,
    body_en         TEXT NOT NULL,
    body_ta         TEXT NOT NULL,
    source_dates    JSONB NOT NULL,
    key_facts       JSONB,
    model           TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ward_number, narrative_date)
);

CREATE INDEX idx_ward_narrative_lookup
    ON ward_narrative(ward_number, narrative_date DESC);

ALTER TABLE ward_narrative ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read ward_narrative"
    ON ward_narrative FOR SELECT USING (true);

-- ----- EXTEND DAILY BRIEFING WITH AI COLUMNS -----

ALTER TABLE daily_briefing
    ADD COLUMN IF NOT EXISTS ai_headline_en TEXT,
    ADD COLUMN IF NOT EXISTS ai_headline_ta TEXT,
    ADD COLUMN IF NOT EXISTS ai_body_en TEXT,
    ADD COLUMN IF NOT EXISTS ai_body_ta TEXT,
    ADD COLUMN IF NOT EXISTS ai_source_dates JSONB,
    ADD COLUMN IF NOT EXISTS ai_model TEXT;
