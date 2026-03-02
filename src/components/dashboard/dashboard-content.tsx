"use client";

import { useState } from "react";
import { ReservoirCards } from "./reservoir-cards";
import { StorageTrendChart } from "./storage-trend-chart";
import type { ReservoirSummary } from "@/types/reservoir";

interface DashboardContentProps {
  reservoirs: ReservoirSummary[];
  history: Array<{ date: string; totalStorage: number }>;
  perReservoirHistory: Record<string, Array<{ date: string; totalStorage: number }>>;
}

export function DashboardContent({
  reservoirs,
  history,
  perReservoirHistory,
}: DashboardContentProps) {
  const [selectedReservoir, setSelectedReservoir] = useState<ReservoirSummary | null>(null);

  const chartHistory = selectedReservoir
    ? perReservoirHistory[selectedReservoir.name] || []
    : history;

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
        title={chartTitle}
        capacity={selectedReservoir?.capacity}
        onBack={selectedReservoir ? () => setSelectedReservoir(null) : undefined}
      />
    </>
  );
}
