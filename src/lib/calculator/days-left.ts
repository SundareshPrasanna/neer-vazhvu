import { MLD_TO_MCFT } from '@/lib/utils/constants';
import type { DaysLeftInput, DaysLeftOutput } from '@/types/calculator';

/** Maximum days to report (when inflow exceeds consumption) */
const MAX_DAYS = 999;

/**
 * Computes estimated days of water remaining in Chennai's reservoirs.
 *
 * Three scenarios:
 * 1. Pessimistic: Zero inflow, full consumption from reservoirs
 * 2. Moderate: Recent 7-day average inflow continues
 * 3. Optimistic: Historical seasonal average inflow
 *
 * Consumption is net of desalination (which doesn't draw from reservoirs).
 */
export function computeDaysLeft(input: DaysLeftInput): DaysLeftOutput {
  const {
    totalStorageMcft,
    totalCapacityMcft,
    dailyConsumptionMLD,
    desalinationMLD,
    recentAvgInflowMcftPerDay,
    seasonalAvgInflowMcftPerDay,
  } = input;

  // Net demand on reservoirs = total demand minus what desalination covers
  const netReservoirDemandMLD = dailyConsumptionMLD - desalinationMLD;
  const netReservoirDemandMcft = netReservoirDemandMLD * MLD_TO_MCFT;

  // Scenario 1: PESSIMISTIC — no rain, no inflow
  const depletionPessimistic = netReservoirDemandMcft;
  const pessimistic =
    depletionPessimistic > 0
      ? Math.max(0, Math.floor(totalStorageMcft / depletionPessimistic))
      : MAX_DAYS;

  // Scenario 2: MODERATE — recent inflow trend continues
  const depletionModerate = Math.max(0, netReservoirDemandMcft - recentAvgInflowMcftPerDay);
  const moderate =
    depletionModerate > 0
      ? Math.max(0, Math.floor(totalStorageMcft / depletionModerate))
      : MAX_DAYS;

  // Scenario 3: OPTIMISTIC — seasonal average inflow
  const depletionOptimistic = Math.max(0, netReservoirDemandMcft - seasonalAvgInflowMcftPerDay);
  const optimistic =
    depletionOptimistic > 0
      ? Math.max(0, Math.floor(totalStorageMcft / depletionOptimistic))
      : MAX_DAYS;

  return {
    pessimistic: Math.min(pessimistic, MAX_DAYS),
    moderate: Math.min(moderate, MAX_DAYS),
    optimistic: Math.min(optimistic, MAX_DAYS),
    storagePct: totalCapacityMcft > 0 ? (totalStorageMcft / totalCapacityMcft) * 100 : 0,
    netDepletionRateMcftPerDay: depletionModerate,
    lastUpdated: new Date().toISOString(),
  };
}
