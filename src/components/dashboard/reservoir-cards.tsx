"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatNumber, formatPct } from "@/lib/utils/format";
import type { ReservoirSummary } from "@/types/reservoir";
import { useLanguage } from "@/lib/i18n/context";
import { getReservoirDisplayName } from "@/lib/i18n/reservoir-name";
import { MissingReservoirCard } from "./missing-data-card";

interface ReservoirCardsProps {
  reservoirs: ReservoirSummary[];
  onReservoirClick?: (reservoir: ReservoirSummary) => void;
}

function getBarColor(pct: number): string {
  if (pct > 60) return "bg-green-500";
  if (pct > 30) return "bg-yellow-500";
  if (pct > 15) return "bg-orange-500";
  return "bg-red-500";
}

export function ReservoirCards({ reservoirs, onReservoirClick }: ReservoirCardsProps) {
  const { t } = useLanguage();
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
        {t("dash.reservoir_status")}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
        {reservoirs.map((r) => {
          // Tracked-but-unmonitored sources (e.g. Madurai's Sothuparai
          // Dam, where TWAD doesn't publish daily levels) get a
          // dedicated MissingDataCard rather than the default
          // zero-storage card. The default card paints 0% red, which
          // misleadingly reads as "the dam is empty".
          if (r.isLive === false) {
            return (
              <MissingReservoirCard
                key={r.name}
                displayName={getReservoirDisplayName(r.name, t, r.displayName)}
                capacityMcft={r.capacity}
                reason={r.noLiveDataReason ?? t("dash.no_live_data")}
              />
            );
          }
          return (
          <Card
            key={r.name}
            className={`border-slate-200 dark:border-slate-700 transition-all ${
              onReservoirClick
                ? "cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md active:scale-[0.98]"
                : ""
            }`}
            onClick={() => onReservoirClick?.(r)}
          >
            <CardContent className="p-2.5 sm:p-4">
              <div className="flex items-start justify-between mb-1 sm:mb-3">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate mr-1">
                  {getReservoirDisplayName(r.name, t, r.displayName)}
                </h3>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 shrink-0">
                  {formatPct(r.storagePct)}
                </span>
              </div>

              <div className="text-lg sm:text-2xl font-bold text-slate-800 dark:text-slate-200">
                {formatNumber(r.currentStorage)}
                <span className="text-xs sm:text-sm font-normal text-slate-400 dark:text-slate-500 ml-0.5">mcft</span>
              </div>

              <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1.5 sm:mb-3">
                {t("dash.capacity_of")} {formatNumber(r.capacity)} {t("dash.capacity_unit")}
              </div>

              {/* Storage bar */}
              <div className="w-full h-1.5 sm:h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getBarColor(r.storagePct)}`}
                  style={{ width: `${Math.min(r.storagePct, 100)}%` }}
                />
              </div>

              {/* Inflow/outflow */}
              <div className="flex flex-row justify-between mt-1.5 sm:mt-3 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {t("dash.in_label")}{" "}
                  {r.inflowCusecs === null ? (
                    <span className="italic text-slate-400">{t("dash.no_flow_data")}</span>
                  ) : (
                    <span className="font-medium text-green-600 dark:text-green-400">{formatNumber(r.inflowCusecs)}</span>
                  )}
                </span>
                <span>
                  {t("dash.out_label")}{" "}
                  {r.outflowCusecs === null ? (
                    <span className="italic text-slate-400">{t("dash.no_flow_data")}</span>
                  ) : (
                    <span className="font-medium text-red-600 dark:text-red-400">{formatNumber(r.outflowCusecs)}</span>
                  )}
                </span>
              </div>

              {onReservoirClick && (
                <div className="mt-1.5 sm:mt-3 text-[10px] sm:text-xs text-blue-500 font-medium text-center">
                  {t("dash.click_details")}
                </div>
              )}
            </CardContent>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
