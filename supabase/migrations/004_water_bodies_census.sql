-- Add data.gov.in to the data_source enum
-- Must be in its own transaction before being referenced
ALTER TYPE data_source ADD VALUE IF NOT EXISTS 'data_gov_in';
