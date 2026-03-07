"use client";

import { useState, useRef, useCallback } from "react";
import { ReservoirCards } from "./reservoir-cards";
import { StorageTrendChart } from "./storage-trend-chart";
import type { ReservoirSummary, HistoryPoint } from "@/types/reservoir";
import { useLanguage } from "@/lib/i18n/context";
import { getReservoirDisplayName } from "@/lib/i18n/reservoir-name";

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
  const { t } = useLanguage();
  const [selectedReservoir, setSelectedReservoir] = useState<ReservoirSummary | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleReservoirClick = useCallback((reservoir: ReservoirSummary) => {
    setSelectedReservoir(reservoir);
    setTimeout(() => {
      chartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, []);

  const chartHistory = selectedReservoir
    ? perReservoirHistory[selectedReservoir.name] || []
    : history;

  const chartForecast = selectedReservoir
    ? perReservoirForecast?.[selectedReservoir.name] || []
    : forecast || [];

  const chartTitle = selectedReservoir
    ? `${getReservoirDisplayName(selectedReservoir.name, t, selectedReservoir.displayName)} ${t("dash.storage_suffix")}`
    : t("dash.combined_trend");

  return (
    <>
      <ReservoirCards
        reservoirs={reservoirs}
        onReservoirClick={handleReservoirClick}
      />

      <div ref={chartRef} className="scroll-mt-20">
        <StorageTrendChart
          history={chartHistory}
          forecast={chartForecast}
          title={chartTitle}
          capacity={selectedReservoir?.capacity}
          onBack={selectedReservoir ? () => setSelectedReservoir(null) : undefined}
        />
      </div>
    </>
  );
}
