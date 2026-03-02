"use client";

import { useState } from "react";
import { ReservoirCards } from "./reservoir-cards";
import { StorageTrendChart } from "./storage-trend-chart";
import type { ReservoirSummary, HistoryPoint } from "@/types/reservoir";

interface ForecastPoint {
  date: string;
  predicted: number;
  lower: number;
  upper: number;
}

interface DashboardContentProps {
  reservoirs: ReservoirSummary[];
  history: HistoryPoint[];
  perReservoirHistory: Record<string, HistoryPoint[]>;
  forecast?: ForecastPoint[];
  perReservoirForecast?: Record<string, ForecastPoint[]>;
}

export function DashboardContent({
  reservoirs,
  history,
  perReservoirHistory,
  forecast,
  perReservoirForecast,
}: DashboardContentProps) {
  const [selectedReservoir, setSelectedReservoir] = useState<ReservoirSummary | null>(null);

  const chartHistory = selectedReservoir
    ? perReservoirHistory[selectedReservoir.name] || []
    : history;

  const chartForecast = selectedReservoir
    ? perReservoirForecast?.[selectedReservoir.name] || []
    : forecast || [];

  const chartTitle = selectedReservoir
    ? `${selectedReservoir.displayName} Storage`
    : "Combined Storage Trend";

  return (
    <>
      <ReservoirCards
        reservoirs={reservoirs}
        onReservoirClick={setSelectedReservoir}
      />

      <StorageTrendChart
        history={chartHistory}
        forecast={chartForecast}
        title={chartTitle}
        capacity={selectedReservoir?.capacity}
        onBack={selectedReservoir ? () => setSelectedReservoir(null) : undefined}
      />
    </>
  );
}
