"use client";

import { useState } from "react";
import type { WaterwayToday } from "@/lib/waterways/types";
import { FactLine, SourceChip } from "./claim-chip";

/**
 * Today on the canal: the current-snapshot centrepiece. One ribbon of
 * surface condition over all 74.5 km from the latest satellite window,
 * three current tiles, and the silt ledger one click deep. Readiness
 * framing throughout - this panel is what a monitoring pilot would
 * refresh with every clear pass.
 */
const STATE_STYLE: Record<string, { cls: string; label: string }> = {
  "open-water": { cls: "fill-cyan-600", label: "open water" },
  vegetated: { cls: "fill-emerald-600", label: "vegetated" },
  mixed: { cls: "fill-slate-400", label: "mixed / narrow" },
  "no-data": { cls: "fill-slate-200 dark:fill-slate-700", label: "no clear view" },
};

function ConditionRibbon({ today }: { today: WaterwayToday }) {
  const W = 900;
  const H = 34;
  const total = 74.5;
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Surface condition along the canal, latest satellite window"
      >
        {today.strip.map((r, i) => (
          <rect
            key={i}
            x={(r.from / total) * W}
            y={4}
            width={Math.max(((r.to - r.from + 0.1) / total) * W, 1)}
            height={18}
            className={STATE_STYLE[r.state]?.cls ?? "fill-slate-300"}
          />
        ))}
        {[0, 15, 30, 45, 60, 74.5].map((km) => (
          <g key={km}>
            <line
              x1={(km / total) * W}
              x2={(km / total) * W}
              y1={22}
              y2={26}
              className="stroke-muted-foreground"
              strokeWidth={1}
            />
            <text
              x={(km / total) * W}
              y={33}
              textAnchor={km === 0 ? "start" : km === 74.5 ? "end" : "middle"}
              className="fill-muted-foreground text-[9px]"
            >
              {km === 0 ? "km 0 · Ennore" : km === 74.5 ? "74.5 · Mahabalipuram" : km}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {Object.entries(STATE_STYLE).map(([k, v]) => (
          <span
            key={k}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <span
              className={`inline-block h-2.5 w-2.5 rounded-sm ${v.cls.replace("fill-", "bg-").replace(" dark:fill-", " dark:bg-")}`}
            />
            {v.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TodayPanel({ today }: { today: WaterwayToday }) {
  const [siltOpen, setSiltOpen] = useState(false);
  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          Today on the canal
        </h3>
        <span className="text-[11px] text-muted-foreground">{today.as_of}</span>
      </div>

      <div className="mt-3">
        <ConditionRibbon today={today} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {today.tiles.map((t) => (
          <div key={t.claim_id} className="rounded-lg border border-border p-3">
            <div className="text-xl font-semibold tabular-nums text-foreground">
              {t.value}
            </div>
            <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {t.label}
              <SourceChip source={t.source} date={t.date} flag={t.flag} />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setSiltOpen((v) => !v)}
        aria-expanded={siltOpen}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground/90 transition-colors hover:border-primary/50 hover:bg-primary/5"
      >
        <span
          className={`inline-block transition-transform ${siltOpen ? "rotate-90" : ""}`}
        >
          ▸
        </span>
        The silt ledger: what is on record ({today.silt.length})
      </button>
      {siltOpen && (
        <ul className="mt-3 space-y-3">
          {today.silt.map((f) => (
            <FactLine key={f.claim_id} fact={f} />
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Ten-metre pixels read narrow city reaches conservatively; the ribbon
        shows surface condition, not flow. Suspended-sediment readings cover
        the reaches with enough open water; depth needs a boat, and the last
        public depth survey is from 2014.
      </p>
    </section>
  );
}
