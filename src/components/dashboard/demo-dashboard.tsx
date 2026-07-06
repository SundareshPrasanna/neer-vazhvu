"use client";

import { useState, useCallback } from "react";
import { DaysLeftHero } from "./days-left-hero";
import { ReservoirCards } from "./reservoir-cards";
import { ReservoirDetailDialog } from "./reservoir-detail-dialog";
import { StorageTrendChart } from "./storage-trend-chart";
import { GroundwaterSnapshot } from "./groundwater-snapshot";
import {
  SCENARIOS,
  COMPARISON_YEARS,
  generateMockHistory,
  generateMockGroundwater,
  generateReservoirHistory,
  generateHistoricalYear,
  type ScenarioKey,
} from "@/lib/mock-data";
import { formatDate } from "@/lib/utils/format";
import type { ReservoirSummary } from "@/types/reservoir";

export function DemoDashboard() {
  const [scenario, setScenario] = useState<ScenarioKey>("post_monsoon");
  const [selectedReservoir, setSelectedReservoir] = useState<ReservoirSummary | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const s = SCENARIOS[scenario];
  const totalStorage = s.reservoirs.reduce((sum, r) => sum + r.currentStorage, 0);
  const totalCapacity = s.reservoirs.reduce((sum, r) => sum + r.capacity, 0);
  const history = generateMockHistory(s.historyStyle);
  const groundwaterData = generateMockGroundwater(s.historyStyle);

  // Per-reservoir history for drilldown
  const reservoirHistory = selectedReservoir
    ? generateReservoirHistory(selectedReservoir.name, s.historyStyle)
    : [];

  // Historical year data getter
  const getHistoricalData = useCallback(
    (year: number) => generateHistoricalYear(year),
    []
  );

  const handleReservoirClick = (reservoir: ReservoirSummary) => {
    setSelectedReservoir(reservoir);
    setDialogOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Scenario Switcher */}
      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-amber-600 font-semibold text-sm uppercase tracking-wider">
                Demo Mode
              </span>
              <span className="text-xs text-amber-500">
                (no database connected)
              </span>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{s.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(SCENARIOS) as [ScenarioKey, typeof s][]).map(
              ([key, val]) => (
                <button
                  key={key}
                  onClick={() => setScenario(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    scenario === key
                      ? "bg-amber-600 text-white"
                      : "bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900"
                  }`}
                >
                  {val.label}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <DaysLeftHero
        totalStorageMcft={totalStorage}
        totalCapacityMcft={totalCapacity}
        recentAvgInflowMcftPerDay={s.recentAvgInflowMcftPerDay}
        seasonalAvgInflowMcftPerDay={s.seasonalAvgInflowMcftPerDay}
        lastUpdated={formatDate("2026-03-01")}
        comparisonStorage={s.comparisonStorage}
        comparisonYear={s.comparisonYear}
      />

      <ReservoirCards
        reservoirs={s.reservoirs}
        onReservoirClick={handleReservoirClick}
      />

      <StorageTrendChart
        history={history}
        comparisonYears={COMPARISON_YEARS}
        getHistoricalData={getHistoricalData}
      />

      <GroundwaterSnapshot data={groundwaterData} />

      {/* Reservoir Detail Dialog */}
      <ReservoirDetailDialog
        reservoir={selectedReservoir}
        history={reservoirHistory}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
