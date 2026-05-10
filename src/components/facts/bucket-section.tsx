"use client";

import { useState } from "react";
import Link from "next/link";
import { FactCard } from "@/components/facts/fact-card";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/context";
import type { Fact } from "@/types/facts";
import type { FactBucketDef } from "@/lib/facts/buckets";

interface BucketSectionProps {
  bucket: FactBucketDef;
  /** Already sorted in the order to render (typically by tier ascending). */
  facts: Fact[];
  /** Path prefix for the linked dashboard page. "" for Chennai legacy
   *  (so e.g. dashboard sits at "/", groundwater at "/groundwater");
   *  "/<cityId>" for multi-city (so groundwater sits at
   *  "/madurai/groundwater"). */
  pagePathPrefix: string;
  defaultOpen?: boolean;
}

/**
 * Collapsible section grouping facts by the dashboard concept they
 * speak to (reservoirs, groundwater, rivers, water bodies, floods,
 * infrastructure). Sub-sorts cards by tier inside, but keeps the tier
 * badge on each card so the time-horizon (today / this year / history /
 * infrastructure) is still visible at the card level.
 *
 * Replaces the previous TierSection, which grouped purely by tier and
 * left the concept dimension scrambled across cards.
 */
export function BucketSection({
  bucket,
  facts,
  pagePathPrefix,
  defaultOpen = false,
}: BucketSectionProps) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(defaultOpen);

  const label = bucket.label[language] ?? bucket.label.en;
  const description = bucket.description[language] ?? bucket.description.en;
  const pageLabel = bucket.pageLabel[language] ?? bucket.pageLabel.en;

  const pageHref =
    bucket.pagePathSuffix !== null
      ? `${pagePathPrefix}${bucket.pagePathSuffix}` || "/"
      : null;

  return (
    <section
      id={`bucket-${bucket.id}`}
      className="border-t border-slate-200 dark:border-slate-800 scroll-mt-24"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 py-5 text-left"
        aria-expanded={open}
      >
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
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {description}
            </p>
            {pageHref && pageLabel && (
              <Link
                href={pageHref}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                See live data on {pageLabel} &rarr;
              </Link>
            )}
          </div>
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
