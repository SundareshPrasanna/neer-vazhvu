"use client";

import type { WaterwayWidthLedger } from "@/lib/waterways/types";
import { SourceChip } from "./claim-chip";

/**
 * The width ledger: the Cooum-Adyar link road by road, three vintages
 * deep (original survey, HSCTC ~2012, our 2026 measurement in the
 * footer line). Lives one click deep in the city-squeeze chapter
 * (DECISIONS.md W2: no table on first paint).
 */
export function WidthLedger({ ledger }: { ledger: WaterwayWidthLedger }) {
  return (
    <details className="group mt-4 rounded-xl border border-border bg-card">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="mr-2 inline-block transition-transform group-open:rotate-90">
          &#9656;
        </span>
        The width ledger, road by road ({ledger.rows.length} stretches)
        <SourceChip
          source={ledger.source}
          date={ledger.date}
          flag={ledger.flag}
        />
      </summary>
      <div className="px-4 pb-4">
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          {ledger.note}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Stretch</th>
                <th className="py-2 pr-3 text-right font-semibold">
                  Recorded in the survey era (m)
                </th>
                <th className="py-2 pr-3 text-right font-semibold">
                  Found in ~2012 (m)
                </th>
                <th className="py-2 text-right font-semibold">
                  Measured 2026 (m)
                </th>
              </tr>
            </thead>
            <tbody>
              {ledger.rows.map((r) => (
                <tr key={r.stretch} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 text-foreground/90">{r.stretch}</td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-foreground/80">
                    {r.orig_min}&#8211;{r.orig_max}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-foreground/80">
                    {r.hsctc_min}&#8211;{r.hsctc_max}
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums font-semibold text-foreground">
                    {r.m2026_min != null && r.m2026_max != null
                      ? r.m2026_min === r.m2026_max
                        ? r.m2026_min
                        : `${r.m2026_min}\u2013${r.m2026_max}`
                      : "\u2013"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-foreground/90">
          {ledger.today_line}
        </p>
      </div>
    </details>
  );
}
