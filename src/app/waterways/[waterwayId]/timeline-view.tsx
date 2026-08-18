"use client";

import type { WaterwayTimelineEntry } from "@/lib/waterways/types";
import { SourceChip } from "./claim-chip";

/**
 * The paper canal: seventeen years of sanctions, orders and tenders as a
 * vertical ledger. States facts and dates; grades nobody (DECISIONS.md W6).
 */
const STATUS_STYLE: Record<string, string> = {
  standing: "bg-muted text-muted-foreground",
  partial: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "dropped/stalled": "bg-red-500/10 text-red-700 dark:text-red-400",
  "dropped Nov 2024": "bg-red-500/10 text-red-700 dark:text-red-400",
  event: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  finding: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  ongoing: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  sanctioned: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "deadlines lapsed": "bg-red-500/10 text-red-700 dark:text-red-400",
  "in motion": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "open window": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

export function TimelineView({
  timeline,
}: {
  timeline: WaterwayTimelineEntry[];
}) {
  return (
    <ol className="relative ml-3 space-y-5 border-l border-border pl-5">
      {timeline.map((t) => (
        <li key={t.claim_id} className="relative">
          <span
            className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary"
            aria-hidden
          />
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-mono text-sm font-semibold text-foreground">
              {t.year}
            </span>
            {t.amount && (
              <span className="font-mono text-xs text-muted-foreground">
                {t.amount}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[t.status] ?? "bg-muted text-muted-foreground"}`}
            >
              {t.status}
            </span>
          </div>
          <p className="mt-0.5 text-sm leading-relaxed text-foreground/90">
            {t.label}
            <SourceChip source={t.source} date={t.date} flag="verified" />
          </p>
        </li>
      ))}
    </ol>
  );
}
