const LEGEND_ITEMS = [
  { color: "#3b82f6", label: "Existing", description: "Surviving water body" },
  { color: "#dc2626", label: "Fully lost", description: "Completely built over" },
  { color: "#f97316", label: "Severely reduced", description: ">70% area lost" },
  { color: "#eab308", label: "Encroached", description: "Partially built over" },
];

export function WaterBodiesLegend() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3">
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
        Water Bodies
      </h4>
      <div className="space-y-1">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs">
            <span
              className="w-4 h-3 rounded-sm border"
              style={{
                backgroundColor: item.color + "80",
                borderColor: item.color,
              }}
            />
            <span className="font-medium text-slate-700 dark:text-slate-300 w-24">{item.label}</span>
            <span className="text-slate-500 dark:text-slate-400">{item.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
