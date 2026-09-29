import { useMemo, useState, type ReactNode } from "react";
import { withEpochAccents } from "@/lib/basins/panel-labels";
import type { BasinLayer } from "@/lib/basins";
import { reviewedMprConceptLabel, reviewedMprValueLabel, type ReviewedMprRecord, type ReviewedMprSeries } from "@/lib/basins/reviewed-mpr";
import { AccountabilityMatrix } from "./accountability";
import type { AccRegion, AccountabilityData, PrsData, PrsTab, PrsUnit } from "@/lib/basins/panel-types";

/** Priority chip colour: CPCB band I/II = worst (red), III-V progressively less. */
function priorityClass(p: string): string {
  const worst = p === "I" || p === "II";
  return worst
    ? "bg-rose-600 text-white"
    : "bg-amber-500 text-white";
}

/** PRS (Polluted River Stretch) entry-point panel: lead with the conclusion
 *  (the stretch grew + worsened), the constructive BOD caveat, then the
 *  stressor themes as collapsible sub-sections that reuse the gaps data already
 *  loaded, each linking into that unit's full cross-source GapPanel. */
export function PRSPanel({
  prs,
  accountability,
  reviewedMpr,
  layerByFamily,
  onOpenUnit,
  onShowLayer,
  onShowRegion,
  depUnit,
  onClose,
}: {
  prs: PrsData;
  accountability?: AccountabilityData | null;
  reviewedMpr?: ReviewedMprSeries | null;
  layerByFamily: Record<string, BasinLayer>;
  onOpenUnit: (unit: string) => void;
  onShowLayer: (family: string) => void;
  onShowRegion?: (r: AccRegion) => void;
  /** Gap unit the DEP cross-link opens; the link renders only when set. */
  depUnit?: string;
  onClose: () => void;
}) {
  const firstSubKey = (t?: PrsTab) => t?.units?.[0]?.key ?? t?.categories?.[0]?.key ?? "";
  const [openArea, setOpenArea] = useState<string | null>(null);
  const [subKey, setSubKey] = useState<string>("");
  const [showKeyTerms, setShowKeyTerms] = useState(false);
  const openTab = openArea ? prs.tabs.find((t) => t.key === openArea) ?? null : null;
  const subs = openTab ? openTab.units ?? openTab.categories ?? [] : [];
  const unit = openTab?.units?.find((u) => u.key === subKey) ?? openTab?.units?.[0];
  const cat = openTab?.categories?.find((c) => c.key === subKey) ?? openTab?.categories?.[0];
  const openAreaFn = (t: PrsTab) => { setOpenArea(t.key); setSubKey(firstSubKey(t)); };
  const maxKm = Math.max(...prs.epochs.map((e) => e.length_km), 0) || 1;
  const rows = withEpochAccents(prs.epochs);
  const badgeTone: Record<string, string> = {
    bad: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    warn: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  };

  // ── Level 2: one area's detail ──
  if (openTab) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => setOpenArea(null)} className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
            ← All priority areas
          </button>
          <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{openTab.label}</h2>
        {openTab.intro && <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">{openTab.intro}</p>}
        {subs.length > 1 && (() => {
          const chip = (s: (typeof subs)[number], muted: boolean) => {
            const name = "name" in s ? s.name : s.label;
            const on = s.key === (unit?.key ?? cat?.key);
            return (
              <button
                key={s.key}
                onClick={() => setSubKey(s.key)}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  on
                    ? "bg-rose-600 text-white border-rose-600"
                    : muted
                      ? "bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 border-dashed hover:bg-slate-100 dark:hover:bg-slate-700"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                {name}
              </button>
            );
          };
          // Units (towns) render as one flat row - every town gets both an
          // MPR bucket and an Other-sources bucket in its detail below, so
          // the chips don't pre-sort them. Categories (thematic sub-tabs)
          // keep the register split: MPR-sourced lead, DEP/CAG/F-register/
          // OCEMS material sits under an explicit "Other sources" group.
          if (openTab.units) {
            return <div className="flex flex-wrap gap-1">{subs.map((s) => chip(s, false))}</div>;
          }
          const primary = subs.filter((s) => s.sourceTier !== "other");
          const other = subs.filter((s) => s.sourceTier === "other");
          return (
            <div className="space-y-1.5">
              {primary.length > 0 && (
                <div className="flex flex-wrap gap-1 items-center">
                  {other.length > 0 && <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mr-0.5">MPR</span>}
                  {primary.map((s) => chip(s, false))}
                </div>
              )}
              {other.length > 0 && (
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mr-0.5">Other sources</span>
                  {other.map((s) => chip(s, true))}
                </div>
              )}
            </div>
          );
        })()}
        {openTab.units && unit && (
          <div className="space-y-2">
            {/* Bucket 1: MPR - the primary baseline. Towns the MPR doesn't
                itemise get an explicit no-data state, never a silent blank. */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">MPR (primary source)</div>
              {unit.sourceTier === "other" ? (
                <p className="text-[12px] leading-snug rounded-md border border-slate-200 dark:border-slate-700 border-dashed bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 px-2.5 py-2">
                  {unit.mprNote ?? `No data: ${unit.name} is not itemised in any MPR edition we hold.`}
                </p>
              ) : (
                <UnitTimeline unit={unit} unitLabel={openTab.unitLabel ?? "MLD"} treatedVerb={openTab.treatedVerb ?? "treated"} onOpenUnit={onOpenUnit} />
              )}
            </div>
            {/* Bucket 2: other sources - the specific document is named in
                the sourceNote below the figures, never as label shorthand. */}
            {unit.sourceTier === "other" && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Other sources</div>
                <UnitTimeline unit={unit} unitLabel={openTab.unitLabel ?? "MLD"} treatedVerb={openTab.treatedVerb ?? "treated"} onOpenUnit={onOpenUnit} />
                {unit.sourceNote && <p className="mt-1 text-[10px] text-slate-400 leading-snug">Source: {unit.sourceNote}</p>}
              </div>
            )}
          </div>
        )}
        {openTab.categories && cat && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
            {(cat.level || cat.noData) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {cat.level && (
                  <span className="inline-block text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">Reported at: {cat.level}</span>
                )}
                {/* The honest gap is a marker, not a replacement: an author who
                    can say WHAT is missing keeps saying it below. */}
                {cat.noData && (
                  <span className="inline-block text-[9px] uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/50 rounded px-1.5 py-0.5">No known public data</span>
                )}
              </div>
            )}
            <>
                {cat.body ? (
                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 leading-relaxed">{cat.body}</p>
                ) : cat.noData ? (
                  <p className="text-[13px] text-slate-500 dark:text-slate-400">No known public data yet for {cat.label} along this stretch.</p>
                ) : null}
                {cat.points && cat.points.length > 0 && (
                  <ul className="space-y-2.5">
                    {cat.points.map((p, i) => {
                      const ci = p.indexOf(": ");
                      const hasLabel = ci > 0 && ci <= 42;
                      const label = hasLabel ? p.slice(0, ci) : null;
                      const rest = hasLabel ? p.slice(ci + 2) : p;
                      return (
                        <li key={i} className="flex gap-2 text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed">
                          <span aria-hidden className="mt-[7px] w-1.5 h-1.5 rounded-full bg-rose-400 dark:bg-rose-500 shrink-0" />
                          <span>
                            {label && <span className="font-semibold text-slate-900 dark:text-slate-100">{label}. </span>}
                            {rest}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {cat.layerRef && layerByFamily[cat.layerRef] && (
                  <button onClick={() => onShowLayer(cat.layerRef!)} className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
                    Show {layerByFamily[cat.layerRef].label} on the map →
                  </button>
                )}
                {cat.link && (
                  <a
                    href={cat.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 text-[12px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                  >
                    {cat.link.label} ↗
                  </a>
                )}
            </>
          </div>
        )}
        {openTab.source && <p className="text-[10px] text-slate-400">Source: {openTab.source}</p>}
      </div>
    );
  }

  // ── Level 1: summary ──
  return (
    <div className="space-y-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-rose-500">Polluted river stretch (PRS)</div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">{prs.river}</h2>
          <p className="text-[11px] text-slate-400">{prs.stretchName}</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Glossary + citation affordances (Paani Phase-1 review) */}
      {(prs.keyTerms || prs.citeSource) && (
        <div className="flex flex-wrap items-center gap-2">
          {prs.keyTerms && prs.keyTerms.length > 0 && (
            <button
              onClick={() => setShowKeyTerms(true)}
              className="inline-flex items-center gap-1 rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50"
            >
              Key terms used on this page
            </button>
          )}
          {prs.citeSource && (
            <a
              href={prs.citeSource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            >
              {prs.citeSource.label ?? "Cite this data source"} ↗
            </a>
          )}
        </div>
      )}
      {showKeyTerms && prs.keyTerms && (
        <KeyTermsPopup terms={prs.keyTerms} onClose={() => setShowKeyTerms(false)} />
      )}

      {/* Legacy prose lead - only when structured facts aren't provided */}
      {!prs.statusFacts && prs.conclusion && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-3">
          <div className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-rose-500 shrink-0">▶</span>
            <p className="text-[13px] font-semibold text-rose-900 dark:text-rose-100 leading-relaxed">{prs.conclusion}</p>
          </div>
        </div>
      )}

      {/* Current status: 2020 vs 2025 bars + plain-language line + facts */}
      <section>
        <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1.5">Current status</div>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.year}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-500 w-9 shrink-0">{r.year}</span>
                <div className="flex-1 h-4 rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-sm" style={{ width: `${(r.length_km / maxKm) * 100}%`, backgroundColor: r.accent }} />
                </div>
                <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 w-14 text-right shrink-0">{r.length_km} km</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${priorityClass(r.priority)}`}>P{r.priority}</span>
              </div>
              {r.note && (
                <p className="mt-0.5 ml-11 text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                  {r.notMapped && <span className="font-medium">Not drawn on the map. </span>}
                  {r.note}
                </p>
              )}
            </div>
          ))}
        </div>
        {prs.statusLine && (
          <p className="mt-2 text-[13px] font-semibold text-rose-900 dark:text-rose-100 leading-relaxed rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-2.5">
            {prs.statusLine}
          </p>
        )}
        {prs.statusFacts && prs.statusFacts.length > 0 && (
          <dl className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
            {prs.statusFacts.map((f) => (
              <div key={f.label} className="flex gap-2 px-2.5 py-1.5">
                <dt className="text-[12px] text-slate-500 dark:text-slate-400 w-32 shrink-0">{f.label}</dt>
                <dd className="text-[12px] font-medium text-slate-800 dark:text-slate-100 leading-snug">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {reviewedMpr && <ReviewedMprSection series={reviewedMpr} />}

      {/* Governance & compliance: who is accountable, and what they must report */}
      {prs.governance && (
        <section>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1.5">Governance &amp; Compliance</div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
            {prs.governance.rows.map((f) => (
              <div key={f.label} className="flex gap-2 px-2.5 py-1.5">
                <span className="text-[12px] text-slate-500 dark:text-slate-400 w-32 shrink-0">{f.label}</span>
                <span className="text-[12px] font-medium text-slate-800 dark:text-slate-100 leading-snug">{f.value}</span>
              </div>
            ))}
            {prs.governance.actionPlan && (
              <div className="px-2.5 py-1.5">
                <a
                  href={prs.governance.actionPlan.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {prs.governance.actionPlan.label ?? "Action Plan"} ↗
                </a>
              </div>
            )}
            {prs.governance.compliance?.map((c) => (
              <div key={c.value} className="flex gap-2 px-2.5 py-1.5">
                <span className="text-[12px] text-slate-500 dark:text-slate-400 w-32 shrink-0">Compliance</span>
                <span className="text-[12px] font-medium text-slate-800 dark:text-slate-100 leading-snug">
                  {c.value}
                  {c.link && (
                    <>
                      {" "}
                      <a href={c.link.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">{c.link.label} ↗</a>
                    </>
                  )}
                  {c.note && <span className="block mt-0.5 font-normal text-[11px] text-slate-500 dark:text-slate-400">{c.note}</span>}
                </span>
              </div>
            ))}
          </div>
          {prs.governance.note && <p className="mt-1 text-[11px] text-slate-400 leading-snug">{prs.governance.note}</p>}
        </section>
      )}

      {/* Accountability matrix: Action Plan vs MPR, region-first */}
      {accountability && <AccountabilityMatrix data={accountability} onShowRegion={onShowRegion} />}

      {depUnit && (
        <button onClick={() => onOpenUnit(depUnit)} className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
          Explore treatment and waste gaps (DEP 2022 snapshot) →
        </button>
      )}

      {/* Stretch-level obligations only; per-area rows live in the
          accountability matrix. */}
      {prs.tabs.some((t) => t.scope === "stretch") && (
      <section>
        <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1.5">Stretch-level obligations <span className="normal-case font-normal text-slate-400">(reported for the stretch as a whole; tap for detail)</span></div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
          {prs.tabs.filter((t) => t.scope === "stretch").map((t) => (
            <button
              key={t.key}
              onClick={() => openAreaFn(t)}
              className="w-full text-left flex items-center gap-2 px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              {t.summaryBadge && (
                <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 w-[88px] text-center ${badgeTone[t.summaryTone ?? "neutral"]}`}>{t.summaryBadge}</span>
              )}
              <span className="flex-1 min-w-0">
                <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{t.label}</span>
                {t.summaryLine && <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{t.summaryLine}</span>}
              </span>
              <span aria-hidden className="text-slate-400 shrink-0">›</span>
            </button>
          ))}
        </div>
      </section>
      )}

      {/* Evidence (collapsed; the "beyond BOD" beat) */}
      {prs.evidence && (
        <details className="group rounded-md border border-slate-200 dark:border-slate-700">
          <summary className="cursor-pointer list-none p-2.5 flex items-start gap-1.5">
            <span aria-hidden className="text-slate-400 group-open:rotate-90 transition-transform mt-0.5">▸</span>
            <span className="flex-1">
              <span className="text-[13px] uppercase tracking-wider text-rose-700 dark:text-rose-400 font-bold">Evidence of pollution</span>
              <span className="block text-[12px] text-slate-600 dark:text-slate-300 leading-snug">{prs.evidence.headline}</span>
            </span>
          </summary>
          <div className="px-2.5 pb-2.5 pt-0.5">
            <ul className="space-y-1 list-disc pl-4">
              {prs.evidence.points.map((p, i) => (
                <li key={i} className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug">{p}</li>
              ))}
            </ul>
            {prs.evidence.layerRef && layerByFamily[prs.evidence.layerRef] && (
              <button onClick={() => onShowLayer(prs.evidence!.layerRef!)} className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
                Show {layerByFamily[prs.evidence.layerRef].label} on the map →
              </button>
            )}
            {prs.evidence.link && (
              <a
                href={prs.evidence.link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 flex items-center gap-1.5 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 text-[12px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
              >
                {prs.evidence.link.label} ↗
              </a>
            )}
          </div>
        </details>
      )}

      {/* Report a problem (action) */}
      {prs.grievance && (
        <a
          href={prs.grievance.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold px-3 py-2"
        >
          {prs.grievance.label} →
        </a>
      )}

      {/* Footer disclosures - everything else, one tap deep */}
      <PrsDisclosure label="Priority, methodology & data coverage">
        {prs.reportingCaveat && <p className="text-[12px] text-slate-700 dark:text-slate-200 font-medium leading-relaxed">{prs.reportingCaveat}</p>}
        {prs.growthNote && <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">{prs.growthNote}</p>}
        {prs.priorityNote && <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">{prs.priorityNote}</p>}
        {prs.bodCaveat && <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">{prs.bodCaveat}</p>}
        {prs.mprOverview && <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">{prs.mprOverview}</p>}
        {prs.levelCoverage && <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed"><span className="font-semibold">Reporting level: </span>{prs.levelCoverage}</p>}
      </PrsDisclosure>

      {prs.sources && prs.sources.length > 0 && (
        <PrsDisclosure label="Sources">
          <ul className="space-y-0.5">
            {prs.sources.map((s, i) => (
              <li key={i} className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{s}</li>
            ))}
          </ul>
        </PrsDisclosure>
      )}
      {prs.grievance?.urlNote && <p className="text-[10px] text-slate-400 italic">{prs.grievance.urlNote}</p>}
    </div>
  );
}

function ReviewedMprSection({ series }: { series: ReviewedMprSeries }) {
  const latest = series.editions.at(-1);
  const [editionId, setEditionId] = useState(latest?.editionId ?? "");
  const edition = series.editions.find((item) => item.editionId === editionId) ?? latest;
  const groups = useMemo(() => {
    const grouped = new Map<string, ReviewedMprRecord[]>();
    for (const record of edition?.records ?? []) {
      const current = grouped.get(record.subjectLabel) ?? [];
      current.push(record);
      grouped.set(record.subjectLabel, current);
    }
    return [...grouped.entries()];
  }, [edition]);
  if (!edition) return null;

  const month = (date: string) => new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

  return (
    <section className="rounded-lg border border-blue-200 dark:border-blue-900/70 bg-blue-50/60 dark:bg-blue-950/20 p-3 space-y-2.5">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-blue-700 dark:text-blue-300 font-semibold">Reviewed monthly progress</div>
        <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug">
          {series.summary.editionCount} report editions · {series.summary.recordCount} source-linked values
        </p>
      </div>

      <div className="flex flex-wrap gap-1" aria-label="Monthly progress report editions">
        {series.editions.map((item) => (
          <button
            key={item.editionId}
            onClick={() => setEditionId(item.editionId)}
            className={`text-[11px] px-2 py-1 rounded border font-semibold transition-colors ${
              item.editionId === edition.editionId
                ? "bg-blue-700 text-white border-blue-700"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-800"
            }`}
          >
            {month(item.period.end)}
          </button>
        ))}
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{month(edition.period.end)}</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{edition.source.title}</p>
        </div>
        <a
          href={edition.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:underline"
        >
          Source PDF ↗
        </a>
      </div>

      <div key={edition.editionId} className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
        {groups.map(([subject, records]) => (
          <details key={subject} open={edition.records.length <= 15} className="group px-2.5 py-2">
            <summary className="cursor-pointer list-none flex items-center gap-2">
              <span aria-hidden className="text-[10px] text-slate-400 group-open:rotate-90 transition-transform">▸</span>
              <span className="flex-1 text-[12px] font-semibold text-slate-800 dark:text-slate-100 leading-snug">{subject}</span>
              <span className="text-[10px] text-slate-400">{records.length}</span>
            </summary>
            <dl className="mt-2 ml-4 space-y-1.5">
              {records.map((record) => (
                <div key={record.claimId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
                  <dt className="text-[11px] text-slate-500 dark:text-slate-400">{reviewedMprConceptLabel(record.concept)}</dt>
                  <dd className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 text-right">{reviewedMprValueLabel(record.value)}</dd>
                  <dd className="col-span-2 text-[10px] text-slate-400">Evidence: page {record.pageNumber}</dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </div>
      <p className="text-[10px] text-slate-400 leading-snug">
        Values are published only after platform review. Page numbers point back to the named report above.
      </p>
    </section>
  );
}

/** "Key Terms Used on This Page" popup (Paani Phase-1 review): full forms of
 *  the acronyms with a line of context each, so the panel stays readable for
 *  first-time visitors without diluting the summary itself. */
function KeyTermsPopup({ terms, onClose }: { terms: { term: string; full: string; note?: string }[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Key terms used on this page">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Key terms used on this page</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <dl className="space-y-2.5">
          {terms.map((t) => (
            <div key={t.term}>
              <dt className="text-[12px] font-bold text-slate-800 dark:text-slate-100">
                {t.term} <span className="font-medium text-slate-500 dark:text-slate-400">- {t.full}</span>
              </dt>
              {t.note && <dd className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug mt-0.5">{t.note}</dd>}
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** Small collapsible used for the PRS summary's footer meta sections. */
function PrsDisclosure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group border-t border-slate-200 dark:border-slate-700 pt-2">
      <summary className="cursor-pointer list-none flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
        <span aria-hidden className="text-slate-400 group-open:rotate-90 transition-transform">▸</span>
        {label}
      </summary>
      <div className="mt-1.5 space-y-1.5">{children}</div>
    </details>
  );
}

/** One year's generated-vs-treated bar: a single bar scaled to GENERATED,
 *  split into a treated/processed segment (blue) + an untreated-gap segment
 *  (red). When only one side is reported for a year, the bar is shown honestly
 *  (neutral / treated-only) rather than inventing a gap. `unit` = MLD | TPD. */
function GenTreatedBar({ year, gen, treated, max, unit }: { year: number; gen?: number; treated?: number; max: number; unit: string }) {
  const w = (v: number) => `${Math.max(0, (v / max) * 100)}%`;
  let segments: ReactNode;
  let value: string;
  if (gen != null && treated != null) {
    const tr = Math.min(treated, gen);
    segments = (
      <>
        <div style={{ width: w(tr), backgroundColor: "#3b82f6" }} title="treated/processed" />
        <div style={{ width: w(gen - tr), backgroundColor: "#b91c1c" }} title="gap" />
      </>
    );
    value = `${treated} / ${gen} ${unit}`;
  } else if (gen != null) {
    segments = <div style={{ width: w(gen), backgroundColor: "#94a3b8" }} title="generated (treatment not reported)" />;
    value = `${gen} ${unit} gen`;
  } else if (treated != null) {
    segments = <div style={{ width: w(treated), backgroundColor: "#3b82f6" }} title="treated/processed" />;
    value = `${treated} ${unit}`;
  } else {
    segments = null;
    value = "n/r";
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-slate-400 w-8 shrink-0">{year}</span>
      <div className="flex-1 h-4 rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden flex">{segments}</div>
      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-300 w-24 text-right shrink-0">{value}</span>
    </div>
  );
}

/** A unit's dual-timeline: one generated-vs-treated bar per year, then the
 *  infrastructure built + status. Generic over the quantity unit (MLD/TPD) and
 *  the treatment verb (treated/processed), so Sewage and Solid waste reuse it. */
function UnitTimeline({ unit, unitLabel, treatedVerb, onOpenUnit }: { unit: PrsUnit; unitLabel: string; treatedVerb: string; onOpenUnit: (u: string) => void }) {
  const genBy = new Map(unit.generation.map((p) => [p.year, p.value]));
  const trBy = new Map(unit.treated.map((p) => [p.year, p.value]));
  const years = Array.from(new Set([...genBy.keys(), ...trBy.keys()])).sort((a, b) => a - b);
  const maxV = Math.max(1, ...unit.generation.map((p) => p.value), ...unit.treated.map((p) => p.value));
  const gapWord = treatedVerb === "processed" ? "unprocessed" : "untreated";
  const toneColor: Record<string, string> = { good: "text-emerald-600", bad: "text-rose-600", neutral: "text-slate-400" };
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
      {unit.level && (
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">Reported at: {unit.level}</span>
        </div>
      )}
      {unit.caveat && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">⚠ {unit.caveat}</p>
      )}

      {/* Track 1: generated vs treated/processed, one bar per year */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Generated vs {treatedVerb} ({unitLabel}/year)</div>
        {years.length > 0 ? (
          <>
            <div className="space-y-1">
              {years.map((y) => (
                <GenTreatedBar key={y} year={y} gen={genBy.get(y)} treated={trBy.get(y)} max={maxV} unit={unitLabel} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[9px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2 rounded-sm" style={{ backgroundColor: "#3b82f6" }} />{treatedVerb}</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2 rounded-sm" style={{ backgroundColor: "#b91c1c" }} />{gapWord} gap</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2 rounded-sm" style={{ backgroundColor: "#94a3b8" }} />not reported</span>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-slate-400">{unit.generationNote ?? "Generation not separately reported."}</p>
        )}
        {years.length > 0 && unit.generationNote && (
          <p className="text-[10px] text-slate-400 mt-1 leading-snug">{unit.generationNote}</p>
        )}
        {typeof unit.gapValue === "number" && (
          <div className="mt-2 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 p-1.5 text-[12px] text-rose-800 dark:text-rose-200 leading-snug">
            ⚠ {gapWord.charAt(0).toUpperCase() + gapWord.slice(1)} gap {unit.gapValue} {unitLabel}{unit.gapNote ? ` - ${unit.gapNote}` : ""}
          </div>
        )}
      </div>

      {/* Track 2: infrastructure built + status */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Infrastructure &amp; status</div>
        {unit.capacity && <p className="text-[12px] text-slate-600 dark:text-slate-300">Capacity: {unit.capacity}</p>}
        {unit.infrastructure && unit.infrastructure.length > 0 && (
          <ul className="space-y-1 mt-1">
            {unit.infrastructure.map((it, i) => (
              <li key={i} className="text-[12px] text-slate-600 dark:text-slate-300 flex gap-1.5 leading-snug">
                <span aria-hidden className={`${toneColor[it.tone ?? "neutral"]} shrink-0`}>●</span>
                <span><span className="font-semibold">{it.label}:</span> {it.status}</span>
              </li>
            ))}
          </ul>
        )}
        {unit.dashboard && <p className="text-[11px] text-slate-400 mt-1">Public dashboard: {unit.dashboard}</p>}
      </div>

      {unit.otherStreams && unit.otherStreams.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Other waste streams</div>
          <ul className="space-y-0.5">
            {unit.otherStreams.map((s, i) => (
              <li key={i} className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug">
                <span className="font-semibold">{s.label}:</span> {s.value}
              </li>
            ))}
          </ul>
        </div>
      )}

      {unit.gapUnit && (
        <button onClick={() => onOpenUnit(unit.gapUnit!)} className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
          Open this unit in the DEP snapshot →
        </button>
      )}
    </div>
  );
}
