import { useState } from "react";
import { ACC_KIND_LABEL, ACC_VERDICT_LABEL } from "@/lib/basins/panel-labels";
import type { AccCategory, AccRegion, AccountabilityData } from "@/lib/basins/panel-types";

// Verdict chips for the accountability matrix. Plain-language labels: the
// value of the matrix is making "exists in MPR vs doesn't" explicit per
// region x category, so absence reads as a finding, not a blank.
const ACC_VERDICT_CLS: Record<AccCategory["verdict"], string> = {
  tracked: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  "in-plan-not-reported": "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  "reported-not-in-plan": "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  silent: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
};

export function AccountabilityMatrix({ data, onShowRegion }: { data: AccountabilityData; onShowRegion?: (r: AccRegion) => void }) {
  const kinds = (["ulb", "ia", "gp"] as const).filter((k) => data.regions.some((r) => r.kind === k));
  // Nothing pre-selected: the three kind tabs render alone; region chips
  // appear on tab click, the detail card on chip click.
  const [kind, setKind] = useState<AccRegion["kind"] | null>(null);
  const regions = kind ? data.regions.filter((r) => r.kind === kind) : [];
  const [regionKey, setRegionKey] = useState<string | null>(null);
  const region = regions.find((r) => r.key === regionKey) ?? (regions.length === 1 ? regions[0] : undefined);

  return (
    <section>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1.5">Accountability: plan vs progress reports</div>
      <p className="text-[12px] font-medium text-slate-700 dark:text-slate-200 leading-snug mb-1.5">{data.question}</p>
      {data.baseline.banner && (
        <p className="text-[11px] leading-snug rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 px-2 py-1.5 mb-2">
          {data.baseline.banner}
        </p>
      )}

      {/* Region-kind tabs */}
      <div className="flex gap-1 mb-1.5">
        {kinds.map((k) => (
          <button
            key={k}
            onClick={() => { setKind(k); setRegionKey(null); }}
            className={`text-[11px] px-2 py-1 rounded font-semibold border transition-colors ${
              k === kind
                ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            {ACC_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      {kind && data.portalNote && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 italic leading-snug mb-1.5">{data.portalNote}</p>
      )}
      {/* Region chips */}
      {regions.length > 1 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {regions.map((r) => (
            <button
              key={r.key}
              onClick={() => setRegionKey(r.key)}
              className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                r.key === region?.key
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              {r.name}
              {r.silentNote && <span aria-hidden className="ml-1 text-[9px] opacity-70">∅</span>}
            </button>
          ))}
        </div>
      )}

      {region && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 space-y-2">
          <div>
            <div className="text-[13px] font-bold text-slate-900 dark:text-slate-100">{region.name}</div>
            {region.inBasinNote && <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{region.inBasinNote}</p>}
            {region.mapMatch && onShowRegion && (
              <button onClick={() => onShowRegion(region)} className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
                Show {region.name} on the map →
              </button>
            )}
          </div>

          {region.silentNote ? (
            <p className="text-[12px] leading-snug rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-100 px-2 py-1.5">
              <span className={`inline-block align-middle mr-1.5 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${ACC_VERDICT_CLS.silent}`}>{ACC_VERDICT_LABEL.silent}</span>
              {region.silentNote}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {region.categories.map((c) => (
                <details key={c.key} className="group py-1.5">
                  <summary className="cursor-pointer list-none flex items-center gap-2">
                    <span aria-hidden className="text-slate-400 group-open:rotate-90 transition-transform text-[10px]">▸</span>
                    <span className="flex-1 text-[13px] font-semibold text-slate-800 dark:text-slate-100">{c.label}</span>
                    <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${ACC_VERDICT_CLS[c.verdict]}`}>{ACC_VERDICT_LABEL[c.verdict]}</span>
                  </summary>
                  <div className="mt-1.5 ml-4 space-y-1.5">
                    <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 px-2 py-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Action Plan{data.baseline.actionPlan.asOf ? ` (${data.baseline.actionPlan.asOf})` : ""}</div>
                      <p className="text-[12px] text-slate-700 dark:text-slate-200 leading-snug">{c.actionPlan.summary}</p>
                      {c.actionPlan.cite && <p className="text-[10px] text-slate-400 mt-0.5">{c.actionPlan.cite}</p>}
                    </div>
                    <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 px-2 py-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">MPR status <span className="normal-case">(as of {c.mpr.asOf})</span></div>
                      <p className="text-[12px] text-slate-700 dark:text-slate-200 leading-snug">{c.mpr.summary}</p>
                    </div>
                    {c.gaps && c.gaps.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-rose-500 font-semibold">Gap identified</div>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {c.gaps.map((g, i) => (
                            <li key={i} className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug">{g}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {c.legalRef && data.legalLibrary?.[c.legalRef] && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Legal requirement</div>
                        {data.legalLibrary[c.legalRef].map((l, i) => (
                          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="block text-[12px] text-blue-600 dark:text-blue-400 hover:underline leading-snug">
                            {l.label} ↗
                          </a>
                        ))}
                      </div>
                    )}
                    {c.media && c.media.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Media reports</div>
                        {c.media.map((m, i) => (
                          <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="block text-[12px] text-blue-600 dark:text-blue-400 hover:underline leading-snug">
                            {m.label} ↗
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}

          {region.grievance && (
            <a
              href={region.grievance.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {region.grievance.label} ↗
            </a>
          )}
        </div>
      )}

      <p className="mt-1.5 text-[10px] text-slate-400 leading-snug">
        Baseline: {data.baseline.primary.label}, {data.baseline.primary.asOf}.{" "}
        <a href={data.baseline.actionPlan.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-400 hover:underline">{data.baseline.actionPlan.label} ↗</a>
        {data.baseline.primary.note && <span> {data.baseline.primary.note}</span>}
      </p>
    </section>
  );
}
