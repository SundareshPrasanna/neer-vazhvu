"use client";

import { useState } from "react";
import Image from "next/image";
import type {
  WaterwayLocatorAnchor,
  WaterwayManifest,
  WaterwayReach,
} from "@/lib/waterways/types";
import { LocatorMap } from "./locator-map";
import { FactLine } from "./claim-chip";
import { WorksLens } from "./works-lens";

/**
 * The Reach Explorer: depth level L2. Eighteen reaches, one selected at a
 * time; everything measured or curated about the selection, each fact with
 * its receipt. Reached from the top toggle or from any story chapter, and
 * deep-linked (#reach-N) so switching never loses the reader's place.
 */
function TransectStrip({ reach }: { reach: WaterwayReach }) {
  const pts = reach.transects;
  const [hi, setHi] = useState<number | null>(null);
  if (!pts.length) return null;
  const [a, b] = reach.km;
  const W = 560;
  const H = 56;
  const cap = 160;
  const x = (km: number) => ((km - a) / Math.max(b - a, 0.001)) * W;
  const barW = Math.max(1.5, Math.min(4, (W / pts.length) * 0.55));
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    let bd = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(x(p.km) - vx);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHi(best);
  };
  const h = hi != null ? pts[hi] : null;
  const label = h
    ? h.w == null
      ? `km ${h.km} - no traced water surface in OSM here`
      : h.flag === "OPEN_WATER"
        ? `km ${h.km} - opens into backwater (${Math.round(h.w)} m across)`
        : h.flag === "SPECTRAL"
          ? `km ${h.km} - about ${Math.round(h.w)} m, spectral estimate (Sentinel-2), low confidence`
          : h.flag === "OFFSET"
            ? `km ${h.km} - ${Math.round(h.w)} m, mapped water sits offset from the drawn centreline, low confidence`
            : `km ${h.km} - ${Math.round(h.w)} m wide`
    : "move along the strip to read each transect";
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-14 w-full touch-none"
        role="img"
        aria-label={`Measured widths along ${reach.name}`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setHi(null)}
      >
        {h && (
          <line
            x1={x(h.km)}
            x2={x(h.km)}
            y1={0}
            y2={H}
            strokeWidth={1}
            className="stroke-muted-foreground/50"
          />
        )}
        {pts.map((p, i) => {
          const active = i === hi;
          return p.w == null ? (
            <circle
              key={p.km}
              cx={x(p.km)}
              cy={H - 4}
              r={active ? 2.5 : 1.5}
              className={
                active ? "fill-muted-foreground" : "fill-muted-foreground/40"
              }
            />
          ) : p.flag === "SPECTRAL" ? (
            <rect
              key={p.km}
              x={x(p.km) - barW / 2}
              y={H - 4 - Math.min(p.w, cap) * ((H - 8) / cap)}
              width={barW}
              height={Math.min(p.w, cap) * ((H - 8) / cap)}
              rx={0.8}
              fill="none"
              strokeWidth={1}
              className={
                active ? "stroke-primary" : "stroke-primary/50"
              }
            />
          ) : (
            <rect
              key={p.km}
              x={x(p.km) - barW / 2}
              y={H - 4 - Math.min(p.w, cap) * ((H - 8) / cap)}
              width={barW}
              height={Math.min(p.w, cap) * ((H - 8) / cap)}
              rx={0.8}
              className={
                active
                  ? "fill-primary"
                  : p.flag === "OPEN_WATER"
                    ? "fill-sky-400/50"
                    : p.flag === "OFFSET"
                      ? "fill-primary/40"
                      : "fill-primary/70"
              }
            />
          );
        })}
      </svg>
      <div
        aria-live="polite"
        className="mt-1 font-mono text-[11px] text-muted-foreground"
      >
        {label}
      </div>
    </div>
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
  locatorAnchors,
  selectedId,
  onSelect,
}: {
  manifest: WaterwayManifest;
  reaches: WaterwayReach[];
  locatorAnchors: WaterwayLocatorAnchor[];
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  const sel = reaches.find((r) => r.id === selectedId) ?? reaches[0];
  const veg = sel.satellite.veg_frac_recent;
  const nEstimated = sel.transects.filter(
    (t) => t.flag === "SPECTRAL" || t.flag === "OFFSET"
  ).length;
  const nSpectral = sel.transects.filter((t) => t.flag === "SPECTRAL").length;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 md:grid-cols-[260px_1fr]">
      {/* Reach rail */}
      <nav
        aria-label="Reaches"
        className="flex gap-2 overflow-x-auto md:sticky md:top-36 md:block md:max-h-[70vh] md:space-y-1 md:self-start md:overflow-y-auto md:overflow-x-visible"
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
                <span className="shrink-0 whitespace-nowrap font-mono text-xs text-muted-foreground">
                  {Math.round(r.width.median_m)}&nbsp;m
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-xs text-muted-foreground">
              km {sel.km[0]}–{sel.km[1]} · {manifest.chainageNote}
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {sel.name}
            </h2>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/90">
              {sel.verdict}
            </p>
          </div>
          <div className="hidden sm:block">
            <LocatorMap
              waterwayId={manifest.waterwayId}
              span={sel.km}
              anchors={locatorAnchors}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Metric
            label="median width"
            value={sel.width.median_m != null ? `${Math.round(sel.width.median_m)} m` : "n/a"}
            hint={
              sel.width.n_measured
                ? `${sel.width.n_measured} transects · confidence ${sel.width.confidence.tier}${sel.width.confidence.tracing_years ? ` (traced ${sel.width.confidence.tracing_years})` : ""}${nEstimated ? ` · +${nEstimated} estimated` : ""}`
                : nEstimated
                  ? `not separable in OSM · ${nEstimated} estimated transects (low confidence)`
                  : "not separable in OSM · confidence C"
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
            label="vegetation on the water"
            value={
              sel.satellite.veg_on_water_frac != null
                ? `${Math.round(sel.satellite.veg_on_water_frac * 100)}%`
                : "n/a"
            }
            hint={
              sel.satellite.veg_on_water_frac != null
                ? `share of the mapped water surface under floating or emergent growth${veg != null ? ` · corridor incl. banks: ${Math.round(veg * 100)}%` : ""}`
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
            hint={
              nSpectral
                ? `10 m pixels undercount narrow water; the spectral test finds a dark channel on ${nSpectral} transects here (see the strip)`
                : "10 m pixels undercount narrow water"
            }
          />
          <Metric
            label="built edge"
            value={
              sel.built_edge
                ? sel.built_edge.buildings_50m > 0
                  ? sel.built_edge.buildings_50m.toLocaleString("en-IN")
                  : "none mapped"
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
            Width along the reach (solid = measured, hollow = estimated, dots = unmeasured)
          </div>
          <TransectStrip reach={sel} />
        </div>

        <WorksLens reach={sel} />

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          What the record says
        </h3>
        <ul className="mt-2 space-y-3">
          {sel.facts.map((f) => (
            <FactLine key={f.claim_id} fact={f} />
          ))}
        </ul>

        {sel.photos.length > 0 && (
          <>
            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              From the ground
            </h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {sel.photos.map((ph) => (
                <figure key={ph.file}>
                  <Image
                    src={`/images/waterways/${manifest.waterwayId}/photos/${ph.file}`}
                    alt={`Ground photograph, ${sel.name} (${ph.credit})`}
                    width={900}
                    height={620}
                    loading="lazy"
                    unoptimized
                    className="w-full rounded-lg border border-border"
                  />
                  <figcaption className="mt-1 text-[11px] text-muted-foreground">
                    {ph.credit} · Wikimedia Commons
                  </figcaption>
                </figure>
              ))}
            </div>
          </>
        )}

        {sel.chips.length > 0 && (
          <>
            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              From orbit (Sentinel-2, 10 m per pixel)
            </h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {sel.chips.map((c) => (
                <div key={c} className="relative">
                  <Image
                    src={`/images/waterways/${manifest.waterwayId}/chips/${c}`}
                    alt={`Satellite view, ${sel.name} (${c.replace(".jpg", "")})`}
                    width={560}
                    height={420}
                    loading="lazy"
                    unoptimized
                    className="w-full rounded-lg border border-border"
                  />
                  <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
                    Jun–Aug 2026
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Building footprints: Google Open Buildings v3 (CC BY-4.0).
              Displayed at native resolution. Site views: clearest-pixel
              composite, ~8 km across; segment views:
              Jun–Aug 2026 composite. Contains modified Copernicus Sentinel
              data (2026).
            </p>
          </>
        )}
      </section>
    </div>
  );
}
