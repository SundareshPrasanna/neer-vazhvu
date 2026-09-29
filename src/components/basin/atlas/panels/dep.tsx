import { useEffect, useMemo, useState } from "react";
import { DEP_STATUS_LABEL, DEP_THEME_ORDER, depThemeTitle } from "@/lib/basins/panel-labels";
import { GapConflicts } from "./gap";
import type { DepData, DepGovernance, DepTheme, DepThemeStatus, MapMatch } from "@/lib/basins/panel-types";

// ── DEP Snapshot v2 panel (district-first) ───────────────────────────────────
// Theme labels/order live in @/lib/basins/panel-labels (shared with the PDF
// export); only the Tailwind chip classes are local to this surface.
const DEP_STATUS_CLS: Record<DepThemeStatus, string> = {
  covered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  "district-level": "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  "not-covered": "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
};

/** One thematic-area entry: status chip, summary, metrics, and the plan's own
 *  action items (the accountability payload). Collapsible - a unit has up to
 *  12 entries (7 themes, waste split into 6 sub-plans). */
function DepThemeCard({ t, defaultOpen = false }: { t: DepTheme; defaultOpen?: boolean }) {
  const hasBody = Boolean(t.summary || t.metrics?.length || t.openActions?.length);
  return (
    <details className="group py-1.5" open={defaultOpen && hasBody}>
      <summary className={`list-none flex items-center gap-2 ${hasBody ? "cursor-pointer" : "cursor-default"}`}>
        {hasBody && <span aria-hidden className="text-slate-400 text-[10px] transition-transform group-open:rotate-90">▶</span>}
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 flex-1">{depThemeTitle(t)}</span>
        <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${DEP_STATUS_CLS[t.status]}`}>{DEP_STATUS_LABEL[t.status]}</span>
      </summary>
      {hasBody && (
        <div className="pl-4 pt-1.5 space-y-2">
          {t.summary && <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">{t.summary}</p>}
          {t.metrics && t.metrics.length > 0 && (
            <dl className="space-y-1.5">
              {t.metrics.map((m, j) => (
                <div key={j} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[13px] text-slate-500 dark:text-slate-400">{m.label}</dt>
                  <dd className={`text-[13px] tabular-nums text-right ${m.emphasis === "good" ? "font-bold text-emerald-600 dark:text-emerald-400" : m.emphasis ? "font-bold text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"}`}>{m.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {t.openActions && t.openActions.length > 0 && (
            <div className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-2">
              <div className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold mb-1">Action items in the plan</div>
              <ul className="space-y-1 list-disc pl-4">
                {t.openActions.map((a, i) => (
                  <li key={i} className="text-[12px] text-amber-800 dark:text-amber-200 leading-snug">{a}</li>
                ))}
              </ul>
            </div>
          )}
          {(t.pages?.length || t.ocrUncertain) && (
            <p className="text-[10px] text-slate-400">
              {t.pages?.length ? `DEP p. ${t.pages.join(", ")}` : null}
              {t.ocrUncertain ? `${t.pages?.length ? " - " : ""}read via OCR from a scanned plan; values approximate` : null}
            </p>
          )}
        </div>
      )}
    </details>
  );
}

/** A unit's thematic areas in canonical NGT order (waste sub-plans inline). */
function DepThemeList({ themes }: { themes: DepTheme[] }) {
  const ordered = [...themes].sort((a, b) => DEP_THEME_ORDER.indexOf(a.theme) - DEP_THEME_ORDER.indexOf(b.theme));
  if (!ordered.length) return null;
  return <div className="divide-y divide-slate-100 dark:divide-slate-800">{ordered.map((t, i) => <DepThemeCard key={i} t={t} />)}</div>;
}

function DepShowOnMap({ name, match, onShowMatch }: { name: string; match?: MapMatch; onShowMatch?: (m: MapMatch) => void }) {
  if (!match || !onShowMatch) return null;
  return (
    <button onClick={() => onShowMatch(match)} className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
      Show {name} on the map →
    </button>
  );
}

export function DepPanel({ basinName, data, focusTaluk, onSelectTaluk, onHighlight, onShowMatch, onClose, onBack }: {
  basinName: string;
  data: DepData;
  focusTaluk: string | null;
  onSelectTaluk: (key: string) => void;
  /** Which gap polygon the map should light up for what this panel is showing. */
  onHighlight: (key: string | null) => void;
  onShowMatch: (m: MapMatch) => void;
  onClose: () => void;
  onBack?: () => void;
}) {
  // The key that opened the panel is a ULB key (PRS "open in the DEP" links)
  // or a taluk key (map badges): land on its district with that card open.
  // ULBs win the lookup - 'bbmp' names both the ULB and the city-taluks tab,
  // and the ULB card carries the substance. GOV_TAB is the governance tab.
  const GOV_TAB = "__governance";
  const homeDistrict = useMemo(
    () =>
      data.districts.find((d) => d.ulbs.some((u) => u.key === focusTaluk) || d.taluks.some((t) => t.key === focusTaluk)) ??
      data.districts[0],
    [data.districts, focusTaluk],
  );
  const [tab, setTab] = useState<string>(homeDistrict?.key ?? GOV_TAB);
  const [view, setView] = useState<{ kind: "district" } | { kind: "ulb"; key: string } | { kind: "taluk"; key: string }>(() => {
    if (focusTaluk && homeDistrict?.ulbs.some((u) => u.key === focusTaluk)) return { kind: "ulb", key: focusTaluk };
    if (focusTaluk && homeDistrict?.taluks.some((t) => t.key === focusTaluk)) return { kind: "taluk", key: focusTaluk };
    return { kind: "district" };
  });
  // Clicking another map badge while the panel is open changes focusTaluk
  // without remounting - follow it (state-adjustment-during-render pattern).
  //
  // A bare key can't say which kind was meant, and "bbmp" names both a ULB and
  // a taluk. Our own chips set the view before reporting the key, so if the
  // panel already shows that exact unit the caller's intent is on screen and
  // re-resolving would override it - which made the "Bengaluru North & South"
  // taluk chip bounce to the BBMP ULB card. Only genuinely external focus
  // changes get resolved, and those keep ULB precedence.
  const [lastFocus, setLastFocus] = useState(focusTaluk);
  if (focusTaluk !== lastFocus) {
    setLastFocus(focusTaluk);
    const alreadyShown = view.kind !== "district" && view.key === focusTaluk;
    if (focusTaluk && homeDistrict && !alreadyShown) {
      if (homeDistrict.ulbs.some((u) => u.key === focusTaluk)) {
        setTab(homeDistrict.key);
        setView({ kind: "ulb", key: focusTaluk });
      } else if (homeDistrict.taluks.some((t) => t.key === focusTaluk)) {
        setTab(homeDistrict.key);
        setView({ kind: "taluk", key: focusTaluk });
      }
    }
  }
  const district = data.districts.find((d) => d.key === tab) ?? null;
  const selUlb = district && view.kind === "ulb" ? district.ulbs.find((u) => u.key === view.key) ?? null : null;
  const selTaluk = district && view.kind === "taluk" ? district.taluks.find((t) => t.key === view.key) ?? null : null;

  // One place decides what the map lights up, so every route in here - chips,
  // district tabs, governance, and the map-badge sync above - stays honest.
  // Without this the old taluk stayed lit under unrelated content.
  const isPolygonKey = (key: string) => data.districts.some((d) => d.taluks.some((t) => t.key === key));
  useEffect(() => {
    if (tab === GOV_TAB || !district) return onHighlight(null);
    if (selTaluk) return onHighlight(selTaluk.key);
    // A ULB normally has no gap polygon; its map cue is "Show <ULB> on the map".
    // BBMP is the exception - it is deliberately both a ULB and a taluk key, and
    // the polygons it names are literally the "BBMP city-wide" pair, so lighting
    // them for the BBMP card shows exactly the area the card describes.
    if (selUlb) return onHighlight(isPolygonKey(selUlb.key) ? selUlb.key : null);
    return onHighlight(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, district, selTaluk, selUlb, data.districts, onHighlight]);

  const chip = (active: boolean) =>
    `text-[11px] px-2 py-0.5 rounded border transition-colors ${active
      ? "bg-rose-600 text-white border-rose-600"
      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"}`;

  return (
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to polluted stretch
        </button>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-rose-500">{data.title ?? "District Environment Plan (DEP) 2022 Snapshot"}</div>
          {data.note && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{data.note}</p>}
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* District tabs + governance. DEPs are district documents, so the
          district - not the taluk - is the entry axis (Paani review). */}
      <div className="flex flex-wrap gap-1.5">
        {data.districts.map((d) => (
          <button key={d.key} onClick={() => { setTab(d.key); setView({ kind: "district" }); }} className={chip(tab === d.key)}>
            {d.name}
          </button>
        ))}
        {data.governance && (
          <button onClick={() => { setTab(GOV_TAB); setView({ kind: "district" }); }} className={chip(tab === GOV_TAB)}>
            Governance &amp; compliance
          </button>
        )}
      </div>

      {tab === GOV_TAB && data.governance ? (
        <DepGovernanceView gov={data.governance} />
      ) : district ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">{district.name}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              <a href={district.dep.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{district.dep.label} ↗</a>
              {district.dep.note ? ` - ${district.dep.note}` : ""}
            </p>
            <DepShowOnMap name={district.name} match={district.mapMatch} onShowMatch={onShowMatch} />
          </div>

          {/* Basin-share stat + admin composition of the district. */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-slate-500 dark:text-slate-400">Share of the district inside the {basinName}</span>
              <span className="text-[15px] font-bold tabular-nums text-slate-900 dark:text-slate-100">{district.pctInBasin}%</span>
            </div>
            <div className="h-1.5 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-rose-500/80" style={{ width: `${Math.min(district.pctInBasin, 100)}%` }} />
            </div>
            {district.counts && district.counts.length > 0 && (
              <dl className="pt-1 space-y-1">
                {district.counts.map((c, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3">
                    <dt className="text-[12px] text-slate-500 dark:text-slate-400">{c.label}</dt>
                    <dd className="text-[12px] tabular-nums font-semibold text-slate-700 dark:text-slate-300">{c.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {district.countsNote && <p className="text-[10px] text-slate-400 leading-snug">{district.countsNote}</p>}
          </div>

          {/* Sub-navigation: district-wide themes / ULBs / taluks. */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <button onClick={() => setView({ kind: "district" })} className={chip(view.kind === "district")}>District-wide</button>
            {district.ulbs.map((u) => (
              <button
                key={u.key}
                // Tell the map too, or it keeps a previously picked taluk lit
                // while the panel has moved on to a ULB. A ULB key has no gap
                // polygon, so this clears the highlight rather than moving it.
                onClick={() => { setView({ kind: "ulb", key: u.key }); onSelectTaluk(u.key); }}
                className={chip(view.kind === "ulb" && view.key === u.key)}
              >
                {u.name} ({u.type})
              </button>
            ))}
          </div>
          {district.taluks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Taluks</span>
              {district.taluks.map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setView({ kind: "taluk", key: t.key }); onSelectTaluk(t.key); }}
                  className={chip(view.kind === "taluk" && view.key === t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {view.kind === "district" && (
            <>
              <GapConflicts conflicts={district.conflicts} />
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">The 7 NGT thematic areas - district-wide</div>
                <DepThemeList themes={district.districtThemes} />
              </div>
            </>
          )}
          {selUlb && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 space-y-2">
              <div>
                <div className="text-[13px] font-bold text-slate-900 dark:text-slate-100">{selUlb.name} ({selUlb.type})</div>
                {selUlb.note && <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{selUlb.note}</p>}
                {selUlb.gazette && (
                  <a href={selUlb.gazette.url} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-blue-600 dark:text-blue-400 hover:underline mt-0.5">
                    {selUlb.gazette.label} ↗
                  </a>
                )}
                <DepShowOnMap name={`${selUlb.name} (${selUlb.type})`} match={selUlb.mapMatch} onShowMatch={onShowMatch} />
              </div>
              <GapConflicts conflicts={selUlb.conflicts} />
              <DepThemeList themes={selUlb.themes} />
            </div>
          )}
          {selTaluk && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 space-y-2">
              <div>
                <div className="text-[13px] font-bold text-slate-900 dark:text-slate-100">{selTaluk.label} (taluk)</div>
                {selTaluk.note && <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{selTaluk.note}</p>}
                <DepShowOnMap name={`${selTaluk.label} (taluk)`} match={selTaluk.mapMatch} onShowMatch={onShowMatch} />
              </div>
              {selTaluk.themes.length > 0 ? (
                <>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">What the plan reports at taluk level</div>
                  <DepThemeList themes={selTaluk.themes} />
                </>
              ) : (
                <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-snug">No taluk-level reporting in this plan.</p>
              )}
            </div>
          )}

          {district.industrialAreas && district.industrialAreas.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">Industrial areas in the district (falling within the {basinName})</span>
                {district.industrialAreas.map((ia, i) =>
                  ia.mapMatch ? (
                    <button key={i} onClick={() => onShowMatch(ia.mapMatch!)} className={chip(false)}>{ia.name} ↗</button>
                  ) : (
                    <span key={i} className="text-[11px] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500">{ia.name}</span>
                  ),
                )}
              </div>
              {district.industrialAreasNote && <p className="text-[10px] text-slate-400 leading-snug">{district.industrialAreasNote}</p>}
              <GapConflicts conflicts={district.industrialAreasConflicts} />
            </div>
          )}
        </div>
      ) : null}

      <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700 leading-relaxed">
        Figures extracted from the District Environment Plans; each entry cites its page in the source document. Themes follow the NGT&apos;s 7 thematic areas (OA 360/2018).
      </p>
    </div>
  );
}

function DepGovernanceView({ gov }: { gov: DepGovernance }) {
  return (
    <div className="space-y-3">
      {gov.items.map((it, i) => (
        <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5">
          <div className="text-[13px] font-bold text-slate-900 dark:text-slate-100 mb-1">{it.heading}</div>
          <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">{it.body}</p>
          {it.source && (
            <div className="mt-1.5 text-[13px] leading-relaxed">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{it.source.source}:</span>{" "}
              <span className="text-slate-600 dark:text-slate-400">{it.source.says}</span>
              {it.source.url ? (
                <a href={it.source.url} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-blue-600 dark:text-blue-400 hover:underline mt-0.5">
                  {it.source.citation} ↗
                </a>
              ) : (
                <span className="block text-[11px] text-slate-400 italic mt-0.5">{it.source.citation}</span>
              )}
            </div>
          )}
        </div>
      ))}
      {gov.gaps.length > 0 && (
        <div className="rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-2.5">
          <div className="text-[11px] uppercase tracking-wider text-rose-700 dark:text-rose-400 font-semibold mb-1">The compliance gap</div>
          <ul className="space-y-1 list-disc pl-4">
            {gov.gaps.map((g, i) => (
              <li key={i} className="text-[12px] text-rose-800 dark:text-rose-200 leading-snug">{g}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
