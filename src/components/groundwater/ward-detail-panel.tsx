import { Badge } from "@/components/ui/badge";
import { WardHistoryChart } from "@/components/groundwater/ward-history-chart";
import { getGroundwaterStatus, getGroundwaterColor } from "@/types/groundwater";
import type { GroundwaterWard } from "@/types/groundwater";

interface WardDetailPanelProps {
  ward: GroundwaterWard;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  healthy: "Healthy",
  moderate: "Moderate",
  declining: "Declining",
  stressed: "Stressed",
  critical: "Critical",
  crisis: "Crisis",
  noData: "No Data",
};

const TREND_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  improving: { icon: "↑", color: "text-green-600", label: "Improving (water table rising)" },
  stable: { icon: "→", color: "text-yellow-600", label: "Stable" },
  declining: { icon: "↓", color: "text-red-600", label: "Declining (water table falling)" },
  unknown: { icon: "?", color: "text-slate-400", label: "Trend unknown (no prior year data)" },
};

export function WardDetailPanel({ ward, onClose }: WardDetailPanelProps) {
  const status = getGroundwaterStatus(ward.depthM);
  const color = getGroundwaterColor(ward.depthM);
  const trend = TREND_ICONS[ward.trend];

  return (
    <div className="bg-white dark:bg-slate-900 w-full h-full p-4 sm:p-6 overflow-y-auto">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">{ward.wardName}</h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">Ward {ward.wardNumber}</span>
          {ward.zone && <span className="text-sm text-slate-400 dark:text-slate-500 ml-2">· {ward.zone}</span>}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
          aria-label="Close panel"
        >
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {ward.depthM !== null ? (
        <>
          <div className="mb-6">
            <div className="text-4xl font-bold" style={{ color }}>
              {ward.depthM.toFixed(1)}m
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">depth to water table</div>
            <Badge className="mt-2" style={{ backgroundColor: color, color: "white" }}>
              {STATUS_LABELS[status]}
            </Badge>
          </div>

          <div className="mb-6">
            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Year-over-Year Trend</h4>
            <div className="flex items-center gap-2">
              <span className={`text-2xl ${trend.color}`}>{trend.icon}</span>
              <span className={`text-sm ${trend.color} font-medium`}>{trend.label}</span>
            </div>
          </div>

          <div className="mb-6">
            <WardHistoryChart wardNumber={ward.wardNumber} />
          </div>

          <div className="text-xs text-slate-400 dark:text-slate-500 space-y-1">
            <p>Depth measured in metres below ground level (mbgl).</p>
            <p>Lower values = water table closer to surface = healthier.</p>
            <p>Trend compares same month, previous year.</p>
          </div>
        </>
      ) : (
        <div className="text-slate-500 dark:text-slate-400 text-sm">
          No groundwater data available for this ward.
        </div>
      )}
    </div>
  );
}
