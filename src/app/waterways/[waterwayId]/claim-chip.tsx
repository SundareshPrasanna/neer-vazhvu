"use client";

import { useState } from "react";
import type { WaterwayFact } from "@/lib/waterways/types";

/**
 * The receipt on a number (DECISIONS.md W3): a small chip that expands to
 * source + vintage + flag. Depth level L3 of the progressive-disclosure
 * ladder: nothing about a source renders until the reader asks.
 */
const FLAG_STYLE: Record<string, { label: string; cls: string }> = {
  verified: {
    label: "verified",
    cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-600/20",
  },
  inferred: {
    label: "our analysis",
    cls: "bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-600/20",
  },
  asserted: {
    label: "as asserted",
    cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-600/20",
  },
};

export function SourceChip({
  source,
  date,
  flag,
}: Pick<WaterwayFact, "source" | "date" | "flag">) {
  const [open, setOpen] = useState(false);
  const style = FLAG_STYLE[flag] ?? FLAG_STYLE.verified;
  return (
    <span className="inline-block align-baseline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`ml-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset transition-colors ${style.cls}`}
        title="Show source"
      >
        {style.label}
      </button>
      {open && (
        <span className="mx-1 inline rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {source} · {date}
        </span>
      )}
    </span>
  );
}

/** One fact line with its receipt. */
export function FactLine({ fact }: { fact: WaterwayFact }) {
  return (
    <li className="text-sm leading-relaxed text-foreground/90">
      {fact.text}
      <SourceChip source={fact.source} date={fact.date} flag={fact.flag} />
    </li>
  );
}
