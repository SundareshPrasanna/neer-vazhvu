import { Card, CardContent } from "@/components/ui/card";
import { formatNumber, formatPct } from "@/lib/utils/format";
import type { ReservoirSummary } from "@/types/reservoir";

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
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
        Reservoir Status
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {reservoirs.map((r) => (
          <Card
            key={r.name}
            className={`border-slate-200 dark:border-slate-700 transition-all ${
              onReservoirClick
                ? "cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md active:scale-[0.98]"
                : ""
            }`}
            onClick={() => onReservoirClick?.(r)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{r.displayName}</h3>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {formatPct(r.storagePct)}
                </span>
              </div>

              <div className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-1">
                {formatNumber(r.currentStorage)}
                <span className="text-sm font-normal text-slate-400 dark:text-slate-500 ml-1">mcft</span>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                of {formatNumber(r.capacity)} mcft capacity
              </div>

              {/* Storage bar */}
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getBarColor(r.storagePct)}`}
                  style={{ width: `${Math.min(r.storagePct, 100)}%` }}
                />
              </div>

              {/* Inflow/outflow */}
              <div className="flex justify-between mt-3 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  In: <span className="font-medium text-green-600">{formatNumber(r.inflowCusecs)}</span> cusecs
                </span>
                <span>
                  Out: <span className="font-medium text-red-600">{formatNumber(r.outflowCusecs)}</span> cusecs
                </span>
              </div>

              {onReservoirClick && (
                <div className="mt-3 text-xs text-blue-500 font-medium text-center">
                  Click for details
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
