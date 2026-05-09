"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/context";

/**
 * A panel that lists the data the city utility doesn't publish.
 *
 * Why this is a first-class UI element rather than a footnote: for
 * tier-2 Indian cities like Madurai, the asymmetry vs Chennai is not
 * "we have less code" - it's "MMC publishes nothing daily." Surfacing
 * that institutional gap directly reframes the dashboard from
 * "missing features" to "what we'd need MMC to publish for full
 * urban-supply transparency." Quotable for journalists, useful for
 * RTI campaigns, and aligned with the broader governance-not-water
 * framing.
 *
 * Generic: callers pass their own list of gaps. Other cities can
 * reuse this with their own institutional asks.
 */
export interface DataGap {
  /** Translation key for what's missing. */
  labelKey: string;
  /** Why it's missing - "Internal SCADA only", "RTI pending", etc. */
  statusKey: string;
}

interface DataGapPanelProps {
  /** Translation key for the panel's heading (e.g. "What MMC doesn't publish daily"). */
  titleKey: string;
  /** Translation key for the explainer line below the heading. */
  bodyKey: string;
  gaps: DataGap[];
  /** Optional CTA - typically links to the about page or an RTI tracker. */
  cta?: { labelKey: string; href: string };
}

export function DataGapPanel({ titleKey, bodyKey, gaps, cta }: DataGapPanelProps) {
  const { t } = useLanguage();

  return (
    <Card className="border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          <svg
            className="w-4 h-4 text-slate-400 mt-0.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t(titleKey)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              {t(bodyKey)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {gaps.map((gap) => (
            <li
              key={gap.labelKey}
              className="flex items-center justify-between text-xs gap-3 py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"
            >
              <span className="text-slate-700 dark:text-slate-300">
                {t(gap.labelKey)}
              </span>
              <span className="text-slate-400 dark:text-slate-500 italic shrink-0">
                {t(gap.statusKey)}
              </span>
            </li>
          ))}
        </ul>
        {cta && (
          <a
            href={cta.href}
            className="inline-block mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            target={cta.href.startsWith("http") ? "_blank" : undefined}
            rel={cta.href.startsWith("http") ? "noopener noreferrer" : undefined}
          >
            {t(cta.labelKey)} &rarr;
          </a>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Default gap list for cities where the utility publishes nothing
 * daily downstream of the dam (Madurai pattern). Uses generic labels
 * so the same constant works as a starting point for Bangalore /
 * Coimbatore / Madurai etc.; cities can override per their own
 * institutional reality.
 */
export const URBAN_SUPPLY_DATA_GAPS: DataGap[] = [
  { labelKey: "gap.wtp_intake",       statusKey: "gap.status_internal_scada" },
  { labelKey: "gap.wtp_treated_out",  statusKey: "gap.status_internal_scada" },
  { labelKey: "gap.zone_supply",      statusKey: "gap.status_not_published" },
  { labelKey: "gap.oht_levels",       statusKey: "gap.status_internal_scada" },
  { labelKey: "gap.nrw_leakage",      statusKey: "gap.status_not_published" },
  { labelKey: "gap.lpcd_actuals",     statusKey: "gap.status_not_published" },
];
