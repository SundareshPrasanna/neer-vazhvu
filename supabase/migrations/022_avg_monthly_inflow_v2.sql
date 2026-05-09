-- =============================================================
-- 022_avg_monthly_inflow_v2.sql
-- City/source-scoped seasonal inflow helper for reservoir_daily_v2.
-- Keeps dashboard page renders from scanning full historical inflow
-- rows in application code.
-- =============================================================

CREATE OR REPLACE FUNCTION avg_monthly_inflow_v2(
  target_city_id TEXT,
  target_source_codes TEXT[],
  target_month INTEGER
)
RETURNS TABLE(avg_inflow_mcft_per_day NUMERIC) AS $$
  SELECT
    AVG(daily_total_cusecs) * 0.0864 AS avg_inflow_mcft_per_day
  FROM (
    SELECT date, SUM(inflow_cusecs) AS daily_total_cusecs
    FROM reservoir_daily_v2
    WHERE city_id = target_city_id
      AND source_code = ANY(target_source_codes)
      AND EXTRACT(MONTH FROM date) = target_month
      AND inflow_cusecs IS NOT NULL
      AND inflow_cusecs > 0
    GROUP BY date
  ) daily_sums;
$$ LANGUAGE SQL STABLE;
