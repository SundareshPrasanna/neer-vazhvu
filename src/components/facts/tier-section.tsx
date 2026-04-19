"use client";

import { useState } from "react";
import { FactCard } from "@/components/facts/fact-card";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/context";
import {
  TIER_DESCRIPTIONS,
  TIER_LABELS,
  TIER_BADGE_STYLE,
} from "@/types/facts";
import type { Fact, FactTier } from "@/types/facts";

interface TierSectionProps {
  tier: FactTier;
  facts: Fact[];
  defaultOpen?: boolean;
}

export function TierSection({
  tier,
  facts,
  defaultOpen = false,
}: TierSectionProps) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(defaultOpen);

  const labelPack = TIER_LABELS[tier];
  const descPack = TIER_DESCRIPTIONS[tier];
  const badge = TIER_BADGE_STYLE[tier];

  const label = language === "ta" ? labelPack.ta : labelPack.en;
  const desc = language === "ta" ? descPack.ta : descPack.en;

  return (
    <section
      id={`tier-${tier}`}
      className="border-t border-slate-200 dark:border-slate-800 scroll-mt-24"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 py-5 text-left"
        aria-expanded={open}
      >
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
            badge.bg,
            badge.text,
          )}
        >
          {badge.label}
        </span>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex-1">
          {label}
        </h2>
        <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
          {facts.length}
        </span>
        <svg
          className={cn(
            "w-5 h-5 text-slate-400 transition-transform",
            open && "rotate-180",
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <div className="pb-8 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {desc}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {facts.map((fact) => (
              <FactCard key={fact.id} fact={fact} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
