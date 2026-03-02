export interface DaysLeftInput {
  totalStorageMcft: number;
  totalCapacityMcft: number;
  dailyConsumptionMLD: number;
  desalinationMLD: number;
  recentAvgInflowMcftPerDay: number;
  seasonalAvgInflowMcftPerDay: number;
}

export interface DaysLeftOutput {
  pessimistic: number;
  moderate: number;
  optimistic: number;
  storagePct: number;
  netDepletionRateMcftPerDay: number;
  lastUpdated: string;
}

export interface CalculatorApiResponse {
  daysLeft: {
    pessimistic: number;
    moderate: number;
    optimistic: number;
  };
  assumptions: {
    consumptionMLD: number;
    desalinationMLD: number;
    netReservoirDemandMLD: number;
    recentAvgInflowMcftPerDay: number;
    seasonalAvgInflowMcftPerDay: number;
  };
  storage: {
    totalMcft: number;
    capacityMcft: number;
    pct: number;
  };
  comparison2019: {
    storageOnThisDateIn2019: number | null;
    dayZeroStorage: number;
    dayZeroDate: string;
  };
  computedAt: string;
}
