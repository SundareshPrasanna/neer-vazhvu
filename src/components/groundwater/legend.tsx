import type { ViewMode } from "@/types/groundwater";

const DEPTH_ITEMS = [
  { color: "#22c55e", label: "0–3m",  description: "Healthy" },
  { color: "#84cc16", label: "3–6m",  description: "Moderate" },
  { color: "#eab308", label: "6–10m", description: "Declining" },
  { color: "#f97316", label: "10–15m",description: "Stressed" },
  { color: "#ef4444", label: "15–25m",description: "Critical" },
  { color: "#7f1d1d", label: ">25m",  description: "Crisis" },
  { color: "#9ca3af", label: "—",     description: "No data" },
];

const RISK_ITEMS = [
  { color: "#22c55e", label: "0–25",   description: "Low Risk" },
  { color: "#eab308", label: "26–50",  description: "Moderate Risk" },
  { color: "#f97316", label: "51–75",  description: "High Risk" },
  { color: "#dc2626", label: "76–100", description: "Critical" },
  { color: "#9ca3af", label: "—",      description: "No data" },
];

interface GroundwaterLegendProps {
  viewMode: ViewMode;
}

export function GroundwaterLegend({ viewMode }: GroundwaterLegendProps) {
  const items = viewMode === 'risk' ? RISK_ITEMS : DEPTH_ITEMS;
  const title = viewMode === 'risk' ? 'Risk Score' : 'Depth to Water Table';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3">
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
        {title}
      </h4>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs">
            <span className="w-4 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="font-mono text-slate-600 dark:text-slate-400 w-10">{item.label}</span>
            <span className="text-slate-500 dark:text-slate-400">{item.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
