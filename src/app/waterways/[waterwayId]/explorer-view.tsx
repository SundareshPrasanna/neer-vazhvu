"use client";

import Image from "next/image";
import type { WaterwayManifest, WaterwayReach } from "@/lib/waterways/types";
import { FactLine } from "./claim-chip";

/**
 * The Reach Explorer: depth level L2. Eighteen reaches, one selected at a
 * time; everything measured or curated about the selection, each fact with
 * its receipt. Reached from the top toggle or from any story chapter, and
 * deep-linked (#reach-N) so switching never loses the reader's place.
 */
function TransectStrip({ reach }: { reach: WaterwayReach }) {
  const pts = reach.transects;
  if (!pts.length) return null;
  const [a, b] = reach.km;
  const W = 560;
  const H = 56;
  const cap = 160;
  const x = (km: number) => ((km - a) / Math.max(b - a, 0.001)) * W;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-14 w-full"
      role="img"
      aria-label={`Measured widths along ${reach.name}`}
    >
      {pts.map((p) =>
        p.w == null ? (
          <circle
            key={p.km}
            cx={x(p.km)}
            cy={H - 4}
            r={1.5}
            className="fill-muted-foreground/40"
          />
        ) : (
          <rect
            key={p.km}
            x={x(p.km) - 2}
            y={H - 4 - Math.min(p.w, cap) * ((H - 8) / cap)}
            width={4}
            height={Math.min(p.w, cap) * ((H - 8) / cap)}
            rx={1}
            className={
              p.flag === "OPEN_WATER"
                ? "fill-sky-400/50"
                : "fill-primary/70"
            }
          />
        ),
      )}
    </svg>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-lg font-semibold tabular-nums text-foreground">
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {hint && (
        <div className="mt-0.5 text-[11px] text-muted-foreground/80">{hint}</div>
      )}
    </div>
  );
}

export function ExplorerView({
  manifest,
  reaches,
  selectedId,
  onSelect,
}: {
  manifest: WaterwayManifest;
  reaches: WaterwayReach[];
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  const sel = reaches.find((r) => r.id === selectedId) ?? reaches[0];
  const veg = sel.satellite.veg_frac_recent;
  const vegDry = sel.satellite.veg_frac_dry;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 md:grid-cols-[260px_1fr]">
      {/* Reach rail */}
      <nav
        aria-label="Reaches"
        className="flex gap-2 overflow-x-auto md:sticky md:top-16 md:block md:max-h-[80vh] md:space-y-1 md:self-start md:overflow-y-auto md:overflow-x-visible"
      >
        {reaches.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect(r.id)}
            aria-current={r.id === sel.id}
            className={`min-w-44 shrink-0 rounded-lg border px-3 py-2 text-left transition-colors md:min-w-0 md:w-full ${
              r.id === sel.id
                ? "border-primary/60 bg-primary/5"
                : "border-border bg-card hover:bg-muted/60"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-foreground">
                {r.name}
              </span>
              {r.width.median_m != null && (
                <span className="font-mono text-xs text-muted-foreground">
                  {Math.round(r.width.median_m)} m
                </span>
              )}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">
              km {r.km[0]}–{r.km[1]}
            </div>
          </button>
        ))}
      </nav>

      {/* Detail panel */}
      <section aria-live="polite">
        <div className="font-mono text-xs text-muted-foreground">
          km {sel.km[0]}–{sel.km[1]} · {manifest.chainageNote}
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {sel.name}
        </h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/90">
          {sel.verdict}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Metric
            label="median width"
            value={sel.width.median_m != null ? `${Math.round(sel.width.median_m)} m` : "n/a"}
            hint={
              sel.width.n_measured
                ? `${sel.width.n_measured} transects`
                : "not separable in OSM"
            }
          />
          <Metric
            label="width range"
            value={
              sel.width.min_m != null && sel.width.max_m != null
                ? `${Math.round(sel.width.min_m)}–${Math.round(sel.width.max_m)} m`
                : "n/a"
            }
          />
          <Metric
            label="corridor vegetation"
            value={veg != null ? `${Math.round(veg * 100)}%` : "n/a"}
            hint={
              vegDry != null && veg != null
                ? `${Math.round(vegDry * 100)}% in Jan–Apr`
                : undefined
            }
          />
          <Metric
            label="open water (satellite)"
            value={
              sel.satellite.water_frac_recent != null
                ? `${Math.round(sel.satellite.water_frac_recent * 100)}%`
                : "n/a"
            }
            hint="10 m pixels undercount narrow water"
          />
          <Metric
            label="built edge"
            value={
              sel.built_edge
                ? sel.built_edge.buildings_50m.toLocaleString("en-IN")
                : "n/a"
            }
            hint={
              sel.built_edge
                ? `buildings within 50 m (${sel.built_edge.buildings_100m.toLocaleString("en-IN")} within 100 m)`
                : undefined
            }
          />
        </div>

        <div className="mt-4 rounded-lg border border-border bg-card p-3">
          <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Measured width along the reach (dots = unmeasured)
          </div>
          <TransectStrip reach={sel} />
        </div>

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          What the record says
        </h3>
        <ul className="mt-2 space-y-3">
          {sel.facts.map((f) => (
            <FactLine key={f.claim_id} fact={f} />
          ))}
        </ul>

        {sel.chips.length > 0 && (
          <>
            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              From orbit (Sentinel-2, 10 m per pixel)
            </h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {sel.chips.map((c) => (
                <Image
                  key={c}
                  src={`/data/waterways/${manifest.waterwayId}/chips/${c}`}
                  alt={`Satellite view, ${sel.name} (${c.replace(".jpg", "")})`}
                  width={560}
                  height={420}
                  loading="lazy"
                  unoptimized
                  className="w-full rounded-lg border border-border"
                />
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Building footprints: Google Open Buildings v3 (CC BY-4.0).
              Displayed at native resolution. Site views: single clear scene,
              15 Jul 2026, ~8 km across; segment views:
              Jun–Aug 2026 composite. Contains modified Copernicus Sentinel
              data (2026).
            </p>
          </>
        )}
      </section>
    </div>
  );
}
