"use client";

/**
 * The Metropolitan Water System - the regional (placeKind: 'region') dashboard
 * surface for the MMR. Renders the per-corporation water inventory
 * (public/data/mmr-corporations-water.json, synthesised from the deep-research
 * passes) as: the LPCD-inequality ranking (the headline), a card per municipal
 * corporation (verified supply/demand where we have it, an honest "data pending"
 * where we don't), and the augmentation-project pipeline. Corporation names +
 * order come from the place config; metrics come from the data file, joined on
 * corporation_id. Additive: only rendered for region places.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { tryGetPlaceConfig } from "@/lib/cities";

interface SourceDoc {
  title: string;
  publisher: string;
  year: number;
  ref?: string;
  url: string;
}
interface CorpMetrics {
  supply_mld?: number | null;
  demand_mld?: number | null;
  deficit_mld?: number | null;
  deficit_pct?: number | null;
  lpcd?: number | null;
  lpcd_confidence?: string;
  sources?: string[];
  sewage?: { stp_count?: number | null; installed_mld?: number | null; note?: string };
  confidence?: string;
  source_refs?: string[];
}
interface RegionData {
  sources: Record<string, SourceDoc>;
  region: {
    lpcd_norm_cpheeo?: string;
    lpcd_inequality_source_refs?: string[];
    augmentation_pipeline?: Array<{ project: string; mld: number | null; status: string; serves: string[]; note?: string; source_refs?: string[] }>;
    bulk_tariff?: { order?: string };
    live_storage_trackable?: { yes_via_pravah?: string[]; yes_via_bmc_feed?: string[]; no?: string[] };
  };
  corporations: Record<string, CorpMetrics>;
  open_gaps?: string[];
}

const NORM = 135; // CPHEEO LPCD norm (lower bound)

function lpcdColor(lpcd: number): string {
  if (lpcd >= NORM) return "#22c55e";
  if (lpcd >= NORM * 0.7) return "#eab308";
  if (lpcd >= NORM * 0.5) return "#f97316";
  return "#ef4444";
}

interface DamStorage { source_code: string; storage_pct_live: number | null; pravah_name: string }
interface DamStorageFile { _fetched: string; dams: DamStorage[] }

export function RegionalWaterSystem({ cityId }: { cityId: string }) {
  const [data, setData] = useState<RegionData | null>(null);
  const [storage, setStorage] = useState<DamStorageFile | null>(null);
  const config = tryGetPlaceConfig(cityId);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/data/mmr-corporations-water.json").then((r) => (r.ok ? r.json() : null)),
      fetch("/data/mmr-dam-storage.json").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([d, s]) => {
        if (cancelled) return;
        setData(d as RegionData | null);
        setStorage(s as DamStorageFile | null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const corps = config?.corporations ?? [];
  if (!data || corps.length === 0) return null;

  // Join config (names/order) + metrics; LPCD ranking = known LPCDs, desc.
  const rows = corps.map((c) => ({ corp: c, m: data.corporations[c.corporationId] ?? {} }));
  const ranked = rows
    .filter((r) => typeof r.m.lpcd === "number")
    .sort((a, b) => (b.m.lpcd as number) - (a.m.lpcd as number));
  const maxLpcd = Math.max(NORM, ...ranked.map((r) => r.m.lpcd as number));

  const trackable = new Set([
    ...(data.region.live_storage_trackable?.yes_via_bmc_feed ?? []),
    ...(data.region.live_storage_trackable?.yes_via_pravah ?? []),
  ]);

  // Scholarly-footnote citation: each source gets a stable number; cards show
  // the numbers (hover = titles), the Sources list at the foot has the links.
  // Live source storage (Pravah snapshot): the first of a corporation's sources
  // that has a current reading.
  const damByCode = new Map((storage?.dams ?? []).map((dm) => [dm.source_code, dm]));
  const corpStorage = (m: CorpMetrics): DamStorage | null => {
    for (const s of m.sources ?? []) {
      const dm = damByCode.get(s);
      if (dm && typeof dm.storage_pct_live === "number") return dm;
    }
    return null;
  };

  const srcIds = Object.keys(data.sources ?? {});
  const srcNo = (id: string) => srcIds.indexOf(id) + 1;
  const footnotes = (refs?: string[]) => {
    const nums = (refs ?? []).map(srcNo).filter((n) => n > 0);
    if (nums.length === 0) return null;
    return (
      <sup
        className="ml-0.5 text-[8px] text-sky-600 dark:text-sky-400"
        title={(refs ?? []).map((id) => data.sources[id]?.title).filter(Boolean).join(" • ")}
      >
        {nums.join(",")}
      </sup>
    );
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5">
      <div className="mb-1 flex flex-wrap items-baseline gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">
          The Metropolitan Water System
        </span>
        {config?.dashboardScopes?.region && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 whitespace-nowrap">
            {config.dashboardScopes.region}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
        The wider region around the city above: 9 municipal corporations drawing
        from one contested source pool. The same water, distributed unequally -
        from Greater Mumbai (BMC, the days-of-water card) to the metro&apos;s edge.
      </p>

      {/* The scoreboard: the whole region at one glance (Commitments pattern). */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(() => {
          const below = ranked.filter((r) => (r.m.lpcd as number) < NORM).length;
          const at = ranked.length - below;
          const pending = rows.length - ranked.length;
          return (
            <>
              {below > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                  {below} below the {NORM} LPCD norm
                </span>
              )}
              {at > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {at} at or above norm
                </span>
              )}
              {pending > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {pending} unverified
                </span>
              )}
              <span className="text-[11px] px-2 py-0.5 text-slate-500">{rows.length} corporations</span>
            </>
          );
        })()}
      </div>

      {/* LPCD inequality ranking - the headline */}
      <div className="mb-5">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Per-capita supply (LPCD), richest to poorest served
            {footnotes(data.region.lpcd_inequality_source_refs)}
          </h3>
          <span className="text-[11px] text-slate-500">norm {data.region.lpcd_norm_cpheeo ?? "135-150"}</span>
        </div>
        <div className="space-y-1.5">
          {ranked.map(({ corp, m }) => {
            const lpcd = m.lpcd as number;
            const soft = m.lpcd_confidence?.startsWith("soft");
            return (
              <div key={corp.corporationId} className="flex items-center gap-2 text-xs">
                <span className="w-28 shrink-0 truncate text-slate-700 dark:text-slate-300" title={corp.displayName}>
                  {corp.displayName}
                </span>
                <div className="flex-1 h-4 rounded bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                  <div
                    className="h-full rounded"
                    style={{ width: `${(lpcd / maxLpcd) * 100}%`, backgroundColor: lpcdColor(lpcd) }}
                  />
                  {/* norm marker */}
                  <div className="absolute top-0 bottom-0 border-l border-dashed border-slate-400/70" style={{ left: `${(NORM / maxLpcd) * 100}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right font-mono text-slate-800 dark:text-slate-100">
                  {lpcd}{soft ? "*" : ""}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-[10px] text-slate-400">
          Dashed line = CPHEEO norm. * = single-source / soft estimate. Corporations without a
          verified LPCD are shown as cards below.
        </p>
      </div>

      {/* Per-corporation cards */}
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">By corporation</h3>
        {storage && (
          <span className="text-[10px] text-slate-500">
            source storage as of {storage._fetched}{footnotes(["pravah"])}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {rows.map(({ corp, m }) => {
          const hasSupply = typeof m.supply_mld === "number";
          return (
            <div key={corp.corporationId} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-1 gap-y-0.5">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-baseline gap-1.5">
                  {corp.acronym}{footnotes(m.source_refs)}
                  {(() => {
                    const pct =
                      typeof m.deficit_pct === "number"
                        ? m.deficit_pct
                        : typeof m.demand_mld === "number" && typeof m.supply_mld === "number" && m.demand_mld > 0
                          ? Math.round(((m.demand_mld - m.supply_mld) / m.demand_mld) * 100)
                          : null;
                    if (pct === null)
                      return hasSupply ? null : (
                        <span className="text-[9px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400">pending</span>
                      );
                    return pct > 0 ? (
                      <span className="text-[9px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">{pct}% short</span>
                    ) : (
                      <span className="text-[9px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">no deficit</span>
                    );
                  })()}
                </span>
                {(() => {
                  const dm = corpStorage(m);
                  if (dm) {
                    return (
                      <span
                        className="flex items-center gap-1 text-[9px]"
                        title={`${dm.pravah_name}: ${dm.storage_pct_live}% of live capacity (Pravah feed, as of ${storage?._fetched})`}
                      >
                        <span className="w-6 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <span className="block h-full bg-sky-500" style={{ width: `${dm.storage_pct_live}%` }} />
                        </span>
                        <span className="font-mono text-sky-700 dark:text-sky-400">{dm.storage_pct_live}%</span>
                      </span>
                    );
                  }
                  return trackable.has((m.sources ?? [])[0] ?? "") ? (
                    <span className="text-[9px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400" title="Source storage tracked live">live</span>
                  ) : null;
                })()}
              </div>
              <div className="text-[10px] text-slate-500 truncate mb-1.5" title={corp.displayName}>{corp.displayName}</div>
              {hasSupply ? (
                <div className="space-y-0.5 text-[11px]">
                  <div className="flex justify-between"><span className="text-slate-500">Supply</span><span className="font-mono">{m.supply_mld} MLD</span></div>
                  {typeof m.demand_mld === "number" && (
                    <div className="flex justify-between"><span className="text-slate-500">Demand</span><span className="font-mono">{m.demand_mld} MLD</span></div>
                  )}
                  {/* The deficit verdict lives ONLY in the header badge
                      ("{pct}% short" / "no deficit") - it was previously
                      repeated as a body row, which read as two numbers. */}
                </div>
              ) : (
                <div className="text-[10px] text-slate-400 italic py-1.5 px-2 rounded bg-slate-50 dark:bg-slate-800/60">
                  Supply/demand data pending
                </div>
              )}
              {(m.sources ?? []).length > 0 && (
                <div className="mt-1.5 text-[9px] text-slate-400 truncate" title={(m.sources ?? []).join(", ")}>
                  ← {(m.sources ?? []).slice(0, 2).join(", ")}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Augmentation pipeline */}
      {data.region.augmentation_pipeline && data.region.augmentation_pipeline.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-1.5">Augmentation pipeline</h3>
          <div className="flex flex-wrap gap-1.5">
            {data.region.augmentation_pipeline.map((p) => {
              const live = p.status.includes("live");
              return (
                <span
                  key={p.project}
                  title={`${p.serves.map((s) => s.toUpperCase()).join(", ")}${p.note ? " - " + p.note : ""}`}
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    live
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {p.project}{p.mld ? ` ${p.mld} MLD` : ""}{live ? " · live" : ""}{footnotes(p.source_refs)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Deep-link into the Allocation Ledger - the entitlement layer behind
          these receipt numbers (who is OWED what, by whom, under which paper). */}
      <div className="mt-4 text-sm">
        <Link
          href={`/${cityId}/allocations`}
          className="text-blue-700 dark:text-blue-400 hover:underline font-medium"
        >
          Who owns this water? The full allocation ledger &rarr;
        </Link>
      </div>

      {/* Sources - numbered to match the footnotes on each card. */}
      <details className="mt-4 group">
        <summary className="cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 select-none">
          Sources <span className="text-slate-400 font-normal">({srcIds.length} documents)</span>
        </summary>
        <ol className="mt-2 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
          {srcIds.map((id, i) => {
            const s = data.sources[id];
            return (
              <li key={id} className="flex gap-1.5">
                <span className="shrink-0 font-mono text-slate-400">{i + 1}.</span>
                <span>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-700 dark:text-sky-400 hover:underline"
                  >
                    {s.title}
                  </a>{" "}
                  - {s.publisher}, {s.year}.
                  {s.ref ? <span className="text-slate-500"> {s.ref}.</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      </details>
      <p className="mt-2 text-[10px] text-slate-400 italic">
        Coverage is uneven by corporation - figures carry a confidence grade and
        gaps are named, not hidden.
      </p>
    </section>
  );
}
