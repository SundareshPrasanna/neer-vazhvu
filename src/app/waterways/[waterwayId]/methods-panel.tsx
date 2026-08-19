"use client";

import type { WaterwayMethodsSection } from "@/lib/waterways/types";

/**
 * Methods and uncertainty: the page's own error model, in one place
 * (rendered above the footer for both modes, anchored #methods).
 * The sections are DATA - curated per waterway in its
 * waterway-curation.json and served in reaches.json - so every
 * waterway describes its own method, spacing, sources and limits, and
 * a reader can validate the numbers independently. The closing block
 * on claim flags is common to every waterway.
 */
function M({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <div className="mt-1 space-y-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

export function MethodsPanel({
  claimCount,
  methods,
}: {
  claimCount: number;
  methods: WaterwayMethodsSection[];
}) {
  return (
    <section id="methods" className="mx-auto max-w-5xl scroll-mt-36 px-4 pb-16">
      <details className="group rounded-xl border border-border bg-card">
        <summary className="cursor-pointer select-none px-5 py-4 text-base font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="mr-2 inline-block transition-transform group-open:rotate-90">
            &#9656;
          </span>
          How every number on this page was made, and how to check it
        </summary>
        <div className="grid gap-6 px-5 pb-6 md:grid-cols-2">
          {methods.map((m) => (
            <M key={m.title} title={m.title}>
              <p>{m.body}</p>
            </M>
          ))}
          <M title="Cited facts and their flags">
            <p>
              {claimCount} claims power this page, each carrying its source,
              date and a flag: <em>verified</em>{" "}= checked against the cited
              document; <em>our analysis</em>{" "}= derived by Neer Vazhvu with
              the method stated; <em>as asserted</em>{" "}= a named
              party&apos;s claim, reported, not endorsed. Corrected figures
              are barred from the page by a build-time gate, and corrections
              are recorded, never silently swapped.
            </p>
          </M>
        </div>
      </details>
    </section>
  );
}
