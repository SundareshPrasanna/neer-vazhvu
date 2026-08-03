-- 036: Correct drifted reservoir capacities in the 001 seed.
--
-- Migration 001 seeded reservoir_meta with Cholavaram 881 and Kannankottai
-- 1574 mcft; migration 017's water_sources seed and the frontend carry the
-- correct CMWSSB figures (Cholavaram 1081, Kannankottai 500 — verified
-- against CMWSSB lake level page and press reports; 6-reservoir total
-- 13,222 mcft). Nothing currently reads reservoir_meta, but a stale seed is
-- a drift trap for the next consumer.
-- See docs/engineering/reviews/2026-08-baseline.md P0.1.

UPDATE reservoir_meta SET full_capacity_mcft = 1081.0 WHERE reservoir = 'cholavaram';
UPDATE reservoir_meta SET full_capacity_mcft = 500.0  WHERE reservoir = 'kannankottai';
