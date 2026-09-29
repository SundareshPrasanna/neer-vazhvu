import type { BasinManifest } from "@/lib/basins";

// Attribute-card order + labels for the river panel (Paani Phase-1 review:
// structured attributes over prose; unknown fields say "Details coming soon").
const RIVER_ATTRIBUTE_ROWS: { key: keyof NonNullable<BasinManifest["rivers"][number]["attributes"]>; label: string }[] = [
  { key: "origin", label: "Origin" },
  { key: "length", label: "Length" },
  { key: "tributaries", label: "Tributaries" },
  { key: "flowsInto", label: "Flows into" },
  { key: "pollutedStretch", label: "Polluted river stretch" },
  { key: "restorationInitiatives", label: "Restoration initiatives" },
];

export function RiverPanel({ river, onClear }: { river: BasinManifest["rivers"][number]; onClear: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{river.displayName}</h2>
          {river.displayNameLocal && <div className="text-sm text-slate-500 dark:text-slate-400">{river.displayNameLocal}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: river.color }} />
          {/* The same close control every other panel has; "Back to whole basin" below stays for readers who scroll. */}
          <button onClick={onClear} aria-label="Close" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
      {river.attributes && (
        <dl className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
          {RIVER_ATTRIBUTE_ROWS.map(({ key, label }) => {
            const value = river.attributes?.[key];
            return (
              <div key={key} className="flex gap-2 px-2.5 py-1.5">
                <dt className="text-[12px] text-slate-500 dark:text-slate-400 w-32 shrink-0">{label}</dt>
                <dd className={`text-[12px] leading-snug ${value ? "font-medium text-slate-800 dark:text-slate-100" : "italic text-slate-400 dark:text-slate-500"}`}>
                  {value ?? "Details coming soon"}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      {river.narrative && <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{river.narrative}</p>}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Every floor is now scoped to this river&apos;s sub-catchment{river.subHydroshedIds.length > 1 ? "s" : ""}. Switch floors on the left to see its monitoring, pressures and treatment.
      </p>
      <button onClick={onClear} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">← Back to whole basin</button>
    </div>
  );
}
