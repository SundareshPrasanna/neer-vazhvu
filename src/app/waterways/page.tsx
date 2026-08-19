import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listWaterways } from "@/lib/waterways";

/**
 * The waterways index: one card per visible waterway, straight from the
 * registry. The per-city "Waterways" nav entry lands here once a city has
 * more than one waterway (see waterwayNavHref); with a single entry the
 * nav deep-links past this page, but the URL stays real either way.
 */
export const metadata: Metadata = {
  title: "Waterways | Neer Vazhvu",
  description:
    "Named waterways measured end to end - widths, satellite record and " +
    "the paper trail, every number with its source.",
};

export default function WaterwaysIndexPage() {
  const waterways = listWaterways();
  if (waterways.length === 0) notFound();
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        Waterways
      </h1>
      <p className="mt-2 max-w-2xl text-base text-slate-600 dark:text-slate-400">
        Named waterways measured end to end: widths, the satellite record,
        and the paper trail, every number with its source.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {waterways.map((w) => (
          <Link
            key={w.waterwayId}
            href={`/waterways/${w.waterwayId}`}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 transition-colors hover:border-cyan-400 dark:hover:border-cyan-600"
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {w.displayName}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {w.description}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
