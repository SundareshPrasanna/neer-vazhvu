import type { GapMedium, GapSector, GapStream, GapUnit } from "@/lib/basins/panel-types";

// Sector axis: one palette, used by the composition bar, the stream swatches
// and the legend so they can never disagree.
// color = base fill; dark = the stripe colour for district-wide figures (a
// darker shade of the same hue, so white labels stay legible over the stripes).
const SECTOR_META: Record<GapSector, { label: string; color: string; dark: string }> = {
  public: { label: "Public / municipal", color: "#2563eb", dark: "#1e40af" },
  industry: { label: "Industry", color: "#dc2626", dark: "#991b1b" },
  institutional: { label: "Institutional", color: "#7c3aed", dark: "#5b21b6" },
  construction: { label: "Construction", color: "#d97706", dark: "#9a3412" },
};
const SECTOR_ORDER: GapSector[] = ["public", "industry", "institutional", "construction"];
const MEDIUM_LABEL: Record<GapMedium, string> = { liquid: "Liquid waste", solid: "Solid waste" };

/** Cross-source treatment-gap panel: the "why does it persist" view - metrics,
 *  the gap over time, and what each document says, with citations. */
export function GapPanel({ unit, note, onClose, onBack }: { unit: GapUnit; note?: string | null; onClose: () => void; onBack?: () => void }) {
  return (
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to polluted stretch
        </button>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-rose-500">{unit.panelLabel ?? "District Environment Plan (DEP) 2022 Snapshot"}{unit.level ? ` - ${unit.level}` : ""}</div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">{unit.name}</h2>
          {note && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{note}</p>}
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      {unit.headline && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-3">
          <div className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-rose-500 shrink-0">▶</span>
            <p className="text-[13px] font-semibold text-rose-900 dark:text-rose-100 leading-relaxed">{unit.headline}</p>
          </div>
        </div>
      )}
      {unit.coverage && (
        <p className="text-[11px] text-slate-400">Data coverage: {unit.coverage}</p>
      )}
      <GapConflicts conflicts={unit.conflicts} />
      <GapCaveats caveats={unit.caveats} />

      <GapStreamsBody unit={unit} />
      <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700 leading-relaxed">
        Figures extracted from public documents; each line links to its source. Composition bars show generation by sector; hazardous &amp; biomedical are reported district-wide.
      </p>
    </div>
  );
}

export function GapConflicts({ conflicts }: { conflicts?: string[] }) {
  if (!conflicts?.length) return null;
  return (
    <div className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-2.5">
      <div className="text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold mb-1">Points to reconcile across sources</div>
      <ul className="space-y-1 list-disc pl-4">
        {conflicts.map((c, i) => (
          <li key={i} className="text-[12px] text-amber-800 dark:text-amber-200 leading-snug">{c}</li>
        ))}
      </ul>
    </div>
  );
}

function GapCaveats({ caveats }: { caveats?: string[] }) {
  if (!caveats?.length) return null;
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-2.5">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">Notes &amp; caveats</div>
      <ul className="space-y-1 list-disc pl-4">
        {caveats.map((c, i) => (
          <li key={i} className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug">{c}</li>
        ))}
      </ul>
    </div>
  );
}

/** The waste-stream cards for one admin unit, grouped by medium with the
 *  sector legend and composition bars. Shared by the v1 GapPanel and the
 *  taluk tier of the v2 DepPanel. */
function GapStreamsBody({ unit }: { unit: GapUnit }) {
  const media: GapMedium[] = ["liquid", "solid"];
  const orphans = unit.streams.filter((s) => !s.medium);
  const presentSectors = SECTOR_ORDER.filter((sec) => unit.streams.some((s) => s.sector === sec));
  return (
    <div className="space-y-4">
      {presentSectors.length > 0 && (
        <div className="pt-1">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Colour = who generates it</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {presentSectors.map((sec) => (
              <span key={sec} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SECTOR_META[sec].color }} />
                {SECTOR_META[sec].label}
              </span>
            ))}
          </div>
        </div>
      )}
      {media.map((med) => {
        const ms = unit.streams.filter((s) => s.medium === med);
        if (!ms.length) return null;
        return (
          <section key={med} className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-3">
            <h3 className="text-[13px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{MEDIUM_LABEL[med]}</h3>
            <CompositionBar streams={ms} />
            <div className="space-y-3.5">
              {ms.map((s, i) => <StreamCard key={i} s={s} />)}
            </div>
          </section>
        );
      })}
      {orphans.map((s, i) => (
        <section key={`x${i}`} className="border-t border-slate-200 dark:border-slate-700 pt-3"><StreamCard s={s} /></section>
      ))}
    </div>
  );
}

/** Sector composition for one medium: a single stacked bar, normalised to the
 *  medium's common unit (MLD / TPD), coloured by who generates the waste.
 *  District-wide figures are striped so taluk precision is never implied. */
function CompositionBar({ streams }: { streams: GapStream[] }) {
  const segs = streams
    .filter((s) => s.magnitude && s.sector)
    .sort((a, b) => SECTOR_ORDER.indexOf(a.sector!) - SECTOR_ORDER.indexOf(b.sector!));
  if (!segs.length) return null;
  const total = segs.reduce((n, s) => n + s.magnitude!.perDay, 0);
  if (total <= 0) return null;
  const u = segs[0].magnitude!.unit;
  const anyDistrict = segs.some((s) => s.granularity === "district");
  const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString() : n >= 10 ? n.toFixed(0) : n.toFixed(n < 1 ? 2 : 1));
  const swatch = (sec: GapSector, district: boolean) => {
    const { color, dark } = SECTOR_META[sec];
    return district
      ? { backgroundImage: `repeating-linear-gradient(45deg, ${color}, ${color} 4px, ${dark} 4px, ${dark} 8px)` }
      : { backgroundColor: color };
  };
  return (
    <div>
      <div className="flex h-5 w-full rounded overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700">
        {segs.map((s, i) => {
          const pct = (s.magnitude!.perDay / total) * 100;
          const district = s.granularity === "district";
          return (
            <div
              key={i}
              style={{ width: `${pct}%`, ...swatch(s.sector!, district) }}
              title={`${s.stream}: ${fmt(s.magnitude!.perDay)} ${u} - ${district ? "district-wide" : "this taluk"}`}
              className="flex items-center justify-center overflow-hidden"
            >
              {pct >= 11 && (
                <span className="text-[9px] font-semibold text-white px-0.5 truncate" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                  {fmt(s.magnitude!.perDay)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {segs.map((s, i) => {
          const district = s.granularity === "district";
          return (
            <li key={i} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={swatch(s.sector!, district)} />
                <span className="truncate text-slate-600 dark:text-slate-300">{s.stream}</span>
                {district && <span className="text-[8px] uppercase tracking-wide text-slate-400 shrink-0">district</span>}
              </span>
              <span className="tabular-nums text-slate-500 dark:text-slate-400 shrink-0">{fmt(s.magnitude!.perDay)} {u}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-[10px] text-slate-400 mt-1 leading-snug">
        Generation by sector ({u}){anyDistrict ? "; striped = district-wide, shared across the district's taluks" : ""}.
      </p>
    </div>
  );
}

/** Plain-language gloss for a waste stream: what it is, so "hazardous" or "C&D"
 *  isn't jargon. Keyed by keyword so it survives label tweaks. */
function wasteWhat(stream: string): string {
  const n = stream.toLowerCase();
  if (n.includes("hazardous")) return "toxic/chemical waste needing special disposal - solvents, acids, used oil, heavy-metal sludge";
  if (n.includes("biomedical")) return "infectious/clinical waste from hospitals and clinics";
  if (n.includes("c&d") || n.includes("construction")) return "rubble, concrete and soil from building and demolition";
  if (n.includes("municipal") || n.includes("solid waste")) return "everyday household and commercial garbage";
  if (n.includes("sewage")) return "domestic wastewater from homes and businesses";
  if (n.includes("effluent")) return "liquid waste discharged by factories";
  return "";
}

/** One stream's detail card: sector swatch + granularity tag, metrics, optional
 *  trend, and the cited "what the documents say" block. */
function StreamCard({ s }: { s: GapStream }) {
  const what = wasteWhat(s.stream);
  return (
    <div>
      <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {s.sector && <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: SECTOR_META[s.sector].color }} />}
        <span>{s.stream}</span>
        {s.granularity === "district" && (
          <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">district-wide</span>
        )}
      </h4>
      {s.sector && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          <span className="font-medium text-slate-600 dark:text-slate-300">Generated by {SECTOR_META[s.sector].label.toLowerCase()}</span>
          {what ? ` - ${what}` : ""}
        </p>
      )}
      <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-2.5 mt-1.5 leading-relaxed">{s.summary}</p>

      <dl className="space-y-1.5 mb-3">
        {s.metrics.map((m, j) => (
          <div key={j} className="flex items-baseline justify-between gap-3">
            <dt className="text-[13px] text-slate-500 dark:text-slate-400">{m.label}</dt>
            <dd className={`text-[13px] tabular-nums text-right ${m.emphasis === "good" ? "font-bold text-emerald-600 dark:text-emerald-400" : m.emphasis ? "font-bold text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"}`}>{m.value}</dd>
          </div>
        ))}
      </dl>

      {s.trend && s.trend.points.length > 0 && <GapTrend trend={s.trend} />}

      <div className="mt-3 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-slate-400">What the documents say</div>
        {s.sources.map((src, k) => (
          <div key={k} className="text-[13px] leading-relaxed">
            <span className="font-semibold text-slate-700 dark:text-slate-300">{src.source}:</span>{" "}
            <span className="text-slate-600 dark:text-slate-400">{src.says}</span>
            {src.url ? (
              <a href={src.url} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-blue-600 dark:text-blue-400 hover:underline mt-0.5">
                {src.citation} ↗
              </a>
            ) : (
              <span className="block text-[11px] text-slate-400 italic mt-0.5">{src.citation}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tiny inline bar chart - equal bars across years make "frozen, nothing
 *  changed" read at a glance. */
function GapTrend({ trend }: { trend: NonNullable<GapStream["trend"]> }) {
  const max = Math.max(...trend.points.map((p) => p.value ?? 0), 1);
  return (
    <div className="mb-2">
      <div className="text-[11px] text-slate-400 mb-1">{trend.label}</div>
      <div className="flex items-end gap-1 h-14">
        {trend.points.map((p, i) => {
          const hasVal = p.value != null;
          const bar = hasVal ? (
            <div className="w-full bg-rose-400/80 dark:bg-rose-500/70 rounded-sm group-hover:bg-rose-500" style={{ height: `${Math.max(((p.value as number) / max) * 100, 6)}%` }} />
          ) : (
            <div className="w-full border border-dashed border-slate-400/60 rounded-sm" style={{ height: "30%" }} />
          );
          const yr = <span className={`text-[9px] tabular-nums ${p.url ? "text-blue-600 dark:text-blue-400 group-hover:underline" : "text-slate-400"}`}>{String(p.year).slice(2)}</span>;
          const title = hasVal
            ? `${p.year}: ${p.value}${trend.unit ? " " + trend.unit : ""}${p.url ? " - open report" : ""}`
            : `${p.year}: ${p.note ?? "not reported"}${p.url ? " - open report" : ""}`;
          const inner = (<>{bar}{!hasVal && <span className="text-[8px] text-slate-400 leading-none">n/r</span>}{yr}</>);
          return p.url ? (
            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" title={title} className="group flex-1 flex flex-col items-center justify-end gap-0.5">
              {inner}
            </a>
          ) : (
            <div key={i} title={title} className="flex-1 flex flex-col items-center justify-end gap-0.5">{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
