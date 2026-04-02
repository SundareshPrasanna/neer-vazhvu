-- News articles from RSS feeds (Google News, direct publisher feeds)
-- Cron job fetches every 30 min, classifies by domain, auto-expires after 30 days

CREATE TABLE news_articles (
  id              BIGSERIAL PRIMARY KEY,
  guid            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  source_name     TEXT NOT NULL,
  url             TEXT NOT NULL,
  published_at    TIMESTAMPTZ NOT NULL,
  snippet         TEXT,
  domains         TEXT[] NOT NULL DEFAULT '{}',
  fetched_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_news_published ON news_articles(published_at DESC);
CREATE INDEX idx_news_domains ON news_articles USING GIN(domains);
CREATE INDEX idx_news_expires ON news_articles(expires_at);

ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read news_articles" ON news_articles FOR SELECT USING (true);
