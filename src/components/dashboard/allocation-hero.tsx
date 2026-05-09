"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n/context";
import { formatNumber, formatPct } from "@/lib/utils/format";
import type { UrbanSupplyConfig } from "@/lib/cities/types";

/**
 * The allocation-hero is the honest counterpart to the Chennai
 * `DaysLeftHero` for cities whose tracked storage is upstream
 * irrigation rather than terminal urban supply.
 *
 * Why a separate component, not a flag on the existing hero: the math
 * is fundamentally different. DaysLeftHero divides total storage by
 * urban demand to produce a runway. That formula is wrong for cities
 * like Madurai because the dam isn't "the city's water" - it's a
 * shared irrigation reservoir with a small drinking-water allocation.
 *
 * What this hero shows instead:
 *   1) Live dam fill % (the only daily, public, defensible number).
 *   2) The published *annual allocation* the city is entitled to draw.
 *   3) The recent annual draw vs that allocation, as a ratio.
 *   4) The WTP design capacity that physically caps daily off-take.
 *
 * No "days of water left" headline. The page is honest about the fact
 * that daily volumetric tracking (Pannaipatty intake, OHT levels,
 * zone supply) isn't published by the city utility today.
 */

interface AllocatedSourceLevel {
  /** Source code from waterSources (e.g. "vaigai"). */
  sourceCode: string;
  displayName: string;
  /** Live storage at the most recent reading, mcft. null if no data. */
  liveStorageMcft: number | null;
  /** FRL capacity, mcft. */
  capacityMcft: number;
  /** Live storage as a fraction of FRL, 0-100. null if no data. */
  storagePct: number | null;
  /** Date stamp of the live reading (already formatted). */
  lastUpdated: string | null;
}

export interface AllocationHeroProps {
  cityDisplayName: string;
  supply: UrbanSupplyConfig;
  /** One row per `allocatedSourceCodes` in `supply`. The page wires
   *  these from snapshotToSummaries; we keep the contract narrow so
   *  the hero doesn't have to re-derive storage. */
  sources: AllocatedSourceLevel[];
}

/** Convert MLD to mcft per day (matches dashboard's MLD_TO_MCFT). */
const MLD_TO_MCFT_PER_DAY = 35.3147; // 1 ML * 1000 m³/ML / (28.3168 m³/mcft) - approx
// Note: matches utils/constants for parity with DaysLeftHero math.

function deriveDrawMld(annualMcft: number): number {
  // Convert annual mcft to continuous MLD: mcft × 28316.85 L/m³ / 365 / 1e6 ≈
  // simpler: 1 mcft = 0.0283 MLD on a 1-day basis, scaled over 365 days:
  return (annualMcft * 28.3168) / 365;
}

export function AllocationHero({
  cityDisplayName,
  supply,
  sources,
}: AllocationHeroProps) {
  const { t } = useLanguage();

  // Aggregate the allocated-source live storage. Today this is just
  // Vaigai for Madurai; structured as an array so future cities can
  // anchor allocation on multiple sources without a rewrite.
  const liveSources = sources.filter((s) => s.liveStorageMcft != null);
  const primaryLive = liveSources[0] ?? null;

  const drawMldFromRecent = deriveDrawMld(supply.recentDrawMcft);
  const drawMldFromAlloc = deriveDrawMld(supply.annualAllocationMcft);
  const drawUtilizationPct =
    supply.annualAllocationMcft > 0
      ? (supply.recentDrawMcft / supply.annualAllocationMcft) * 100
      : null;

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-amber-50/40 dark:from-slate-900 dark:to-slate-800">
      <CardContent className="p-6 sm:p-8 space-y-5">
        {/* Header - title and timestamp share one row, subtitle drops
            to its own full-width line below so a short title doesn't
            leave a huge dead stripe between H2 and the badge.
            (See git blame for hero-header reshuffle.) */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t("hero.alloc_title")}
            </h2>
            {primaryLive?.lastUpdated && (
              <Badge variant="outline" className="text-xs shrink-0">
                {t("hero.updated")} {primaryLive.lastUpdated}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
            {t("hero.alloc_subtitle").replace("{city}", cityDisplayName)}
          </p>
        </div>

        {/* Headline: live dam fill */}
        {primaryLive ? (
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-8">
            <div>
              <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-slate-900 dark:text-slate-100">
                {primaryLive.storagePct != null
                  ? formatPct(primaryLive.storagePct)
                  : "—"}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t("hero.alloc_dam_fill").replace(
                  "{name}",
                  primaryLive.displayName,
                )}
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 tabular-nums">
                {formatNumber(primaryLive.liveStorageMcft ?? 0)} /{" "}
                {formatNumber(primaryLive.capacityMcft)} mcft
              </div>
            </div>

            {/* Storage bar */}
            <div className="flex-1 min-w-0 sm:max-w-md">
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{
                    width: `${Math.min(primaryLive.storagePct ?? 0, 100)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-snug">
                {t("hero.alloc_chain_label")}: {supply.supplyChainDescription}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500 dark:text-slate-400 py-4">
            {t("hero.alloc_no_data")}
          </div>
        )}

        {/* Allocation + draw stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-2">
          <Stat
            label={t("hero.alloc_annual_label")}
            value={formatNumber(supply.annualAllocationMcft)}
            unit="mcft/yr"
            sub={`≈ ${drawMldFromAlloc.toFixed(0)} MLD`}
          />
          <Stat
            label={t("hero.alloc_recent_label")}
            value={formatNumber(supply.recentDrawMcft)}
            unit="mcft/yr"
            sub={`≈ ${drawMldFromRecent.toFixed(0)} MLD`}
          />
          <Stat
            label={t("hero.alloc_util_label")}
            value={
              drawUtilizationPct != null
                ? formatPct(drawUtilizationPct)
                : "—"
            }
            unit=""
            sub={t("hero.alloc_util_sub")}
          />
          <Stat
            label={t("hero.alloc_wtp_label")}
            value={String(supply.wtpCapacityMld)}
            unit="MLD"
            sub={supply.wtpName}
          />
        </div>

        {/* Why this looks different from Chennai */}
        <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-3">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {t("hero.alloc_why_label")}:
          </span>{" "}
          {t("hero.alloc_why_body")}{" "}
          <a
            href={supply.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t("hero.alloc_source_label")}
          </a>
          .
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit: string;
  sub?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
        {value}
        {unit && (
          <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1">
            {unit}
          </span>
        )}
      </p>
      {sub && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
          {sub}
        </p>
      )}
    </div>
  );
}
