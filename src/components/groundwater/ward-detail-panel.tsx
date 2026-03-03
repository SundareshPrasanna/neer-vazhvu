import { Badge } from "@/components/ui/badge";
import { WardHistoryChart } from "@/components/groundwater/ward-history-chart";
import { getGroundwaterStatus, getGroundwaterColor, getRiskColor, getRiskLabel } from "@/types/groundwater";
import type { GroundwaterWard, WardRiskData } from "@/types/groundwater";

interface WardDetailPanelProps {
  ward: GroundwaterWard;
  riskData?: WardRiskData;
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
  stable:    { icon: "→", color: "text-yellow-600", label: "Stable" },
  declining: { icon: "↓", color: "text-red-600",   label: "Declining (water table falling)" },
  unknown:   { icon: "?", color: "text-slate-400",  label: "Trend unknown (no prior year data)" },
};

// Components are stored as raw 0–100 sub-scores; contribution = sub_score × weight
const RISK_COMPONENTS = [
  { key: "groundwaterComponent" as const, label: "Groundwater depth", weight: 0.40, max: 40 },
  { key: "trendComponent"       as const, label: "Year-on-year trend", weight: 0.30, max: 30 },
  { key: "reservoirComponent"   as const, label: "Reservoir stress",   weight: 0.20, max: 20 },
  { key: "seasonalComponent"    as const, label: "Seasonal factor",    weight: 0.10, max: 10 },
];

export function WardDetailPanel({ ward, riskData, onClose }: WardDetailPanelProps) {
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
        </>
      ) : (
        <div className="text-slate-500 dark:text-slate-400 text-sm mb-6">
          No groundwater data available for this ward.
        </div>
      )}

      {riskData && (
        <div className="mb-6 border-t border-slate-100 dark:border-slate-800 pt-6">
          <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
            Composite Risk Score
          </h4>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold" style={{ color: getRiskColor(riskData.riskLevel) }}>
              {riskData.riskScore.toFixed(0)}
            </span>
            <span className="text-sm text-slate-400 dark:text-slate-500">/ 100</span>
            <Badge
              className="ml-1"
              style={{ backgroundColor: getRiskColor(riskData.riskLevel), color: "white" }}
            >
              {getRiskLabel(riskData.riskLevel)}
            </Badge>
          </div>
          <div className="space-y-3">
            {RISK_COMPONENTS.map(({ key, label, weight, max }) => {
              const subScore = riskData[key];                        // 0–100 raw sub-score
              const contribution = subScore != null ? subScore * weight : null; // weighted points
              const pct = contribution != null ? (contribution / max) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span>{label}</span>
                    <span className="font-mono tabular-nums">
                      {contribution != null ? contribution.toFixed(0) : "—"} / {max}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: getRiskColor(riskData.riskLevel),
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
            Weights: groundwater 40% · trend 30% · reservoir 20% · seasonal 10%
          </p>
        </div>
      )}

      <div className="text-xs text-slate-400 dark:text-slate-500 space-y-1">
        <p>Depth measured in metres below ground level (mbgl).</p>
        <p>Lower values = water table closer to surface = healthier.</p>
        <p>Trend compares same month, previous year.</p>
      </div>
    </div>
  );
}
