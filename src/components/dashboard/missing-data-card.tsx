"use client";

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/context";
import { formatNumber } from "@/lib/utils/format";

/**
 * A dashboard tile for a tracked-but-unmonitored source.
 *
 * Use case: a city's PlaceConfig registers a reservoir or dam (so we
 * know it exists, where it is, and its capacity) but the upstream
 * authority doesn't publish daily levels - e.g. Madurai's Sothuparai
 * Dam, where TWAD's public feed only carries Vaigai + Mullaperiyar.
 *
 * The default zero-storage card mis-leadingly painted such sources red
 * ("0% / dam empty"). This component is the explicit alternative:
 * acknowledge the source exists, show what we DO know (capacity,
 * geography), and label the missing live signal honestly.
 *
 * Designed to be reusable across cities/states - no Madurai-specific
 * branching. Other gauges (e.g. river flow stations, AQI sensors) can
 * pass through this same component when their authority's feed is
 * silent.
 */
export interface MissingDataCardProps {
  /** Human-readable name of the unmonitored source. */
  title: string;
  /** Optional small line under the title (e.g. "1,272 mcft capacity"). */
  subtitle?: string;
  /** Sentence explaining why the data is unavailable. Keep short -
   *  one short clause works best in the small card footprint. */
  reason: string;
  /** Optional CTA - e.g. a link to the about page's data-gap inventory
   *  or to an authority's contact page. */
  cta?: { label: string; href: string };
  /** Optional decorative icon, defaults to a clipboard-no-data glyph. */
  icon?: ReactNode;
  /** Click handler - mirrors ReservoirCards' onReservoirClick so this
   *  card can sit alongside live cards in the same grid without an
   *  inconsistent interaction surface. */
  onClick?: () => void;
}

const DefaultIcon = () => (
  <svg
    className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.75}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6m-6 4h6"
    />
  </svg>
);

export function MissingDataCard({
  title,
  subtitle,
  reason,
  cta,
  icon,
  onClick,
}: MissingDataCardProps) {
  return (
    <Card
      className={`border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 ${
        onClick ? "cursor-pointer hover:border-slate-400 dark:hover:border-slate-600" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-2.5 sm:p-4">
        <div className="flex items-start justify-between mb-1.5 sm:mb-3 gap-2">
          <h3 className="font-semibold text-slate-700 dark:text-slate-300 text-xs sm:text-sm truncate">
            {title}
          </h3>
          {icon ?? <DefaultIcon />}
        </div>

        <div className="text-base sm:text-lg font-semibold text-slate-400 dark:text-slate-500">
          —
        </div>

        {subtitle && (
          <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1.5 sm:mb-3">
            {subtitle}
          </div>
        )}

        {/* Hatched/striped placeholder bar - visually distinct from a
            zero-pct red bar; conveys "no data" rather than "empty". */}
        <div
          className="w-full h-1.5 sm:h-2 rounded-full overflow-hidden"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(148,163,184,0.35) 0 4px, transparent 4px 8px)",
            backgroundColor: "rgba(148,163,184,0.15)",
          }}
          aria-hidden="true"
        />

        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-2 leading-snug">
          {reason}
        </p>

        {cta && (
          <a
            href={cta.href}
            target={cta.href.startsWith("http") ? "_blank" : undefined}
            rel={cta.href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="inline-block mt-2 text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {cta.label} &rarr;
          </a>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Convenience builder for the reservoir case: takes the same shape as
 * ReservoirCards, returns a MissingDataCard configured with the
 * familiar "<capacity> mcft capacity" subtitle.
 */
export function MissingReservoirCard({
  displayName,
  capacityMcft,
  reason,
  cta,
}: {
  displayName: string;
  capacityMcft: number;
  reason: string;
  cta?: { label: string; href: string };
}) {
  const { t } = useLanguage();
  const subtitle =
    capacityMcft > 0
      ? `${t("dash.capacity_of")} ${formatNumber(capacityMcft)} ${t("dash.capacity_unit")}`
      : undefined;
  return (
    <MissingDataCard
      title={displayName}
      subtitle={subtitle}
      reason={reason}
      cta={cta}
    />
  );
}
