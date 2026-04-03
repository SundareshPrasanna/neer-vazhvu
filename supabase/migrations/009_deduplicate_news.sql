-- Removes duplicate news articles that cover the same story from different publishers.
-- Normalizes titles (lowercase, strip non-alphanumeric) and keeps the earliest published row.
CREATE OR REPLACE FUNCTION deduplicate_news() RETURNS void AS $$
BEGIN
  DELETE FROM news_articles
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY REGEXP_REPLACE(LOWER(title), '[^a-z0-9 ]', '', 'g')
          ORDER BY published_at ASC
        ) AS rn
      FROM news_articles
    ) ranked
    WHERE rn > 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
