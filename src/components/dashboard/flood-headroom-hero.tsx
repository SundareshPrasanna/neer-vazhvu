"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FloodChainConfig } from "@/lib/cities/types";

/**
 * "Flood-headroom" hero for the city dashboard.
 *
 * Most heroes on this platform answer "how much water is left". Surat has no
 * answer to that: it impounds nothing of its own, so the days-left runway is
 * undefined rather than merely awkward - the same structural fact that gave
 * Kolkata its drainage-capacity hero.
 *
 * Surat's question is the opposite one. Not how little is left, but how much
 * room is left before water arrives. And uniquely on this platform, the
 * publisher answers both halves: SMC's live page carries a reading AND the
 * operational threshold it is measured against, at every link of the chain -
 * Ukai's full reservoir level, the causeway's overflow level, and a danger
 * level for each of five urban khadis.
 *
 * WHY THIS IS NOT drainage-capacity. That hero MODELS exceedance of a design
 * property quoted from an engineering document. This one STATES distance to an
 * operational trigger level published by the operator alongside the reading.
 * One is an inference we draw; the other is a subtraction. Keeping them apart
 * matters because the honesty contracts differ: drainage-capacity has to warn
 * that reanalysis smooths convective bursts, and this one has to warn that a
 * threshold crossing is a trigger for action, not a forecast of flooding.
 *
 * HONESTY CONTRACT, load-bearing, do not quietly drop:
 *  1. NO THRESHOLD IS OURS. Every figure rendered as a threshold comes from
 *     `surat-flood-chain.json`, scraped from the publisher. None is in config,
 *     precisely so config and source cannot drift apart silently.
 *  2. Headroom is the only derived number and it is a subtraction. Negative
 *     headroom is rendered as such (the causeway routinely sits above its
 *     overflow level and is closed) rather than clamped to zero, because
 *     "submerged" is the true state and hiding it would be a lie of omission.
 *  3. The archive has no pre-history. SMC publishes a rolling ~10-reading
 *     window with no archive, so the series starts the day the scraper first
 *     ran. The hero never implies a longer record than exists.
 *  4. NO 2006 COMPARISON. Rendering today's release against the August 2006
 *     peak is the obvious move and it is deliberately absent: every figure for
 *     that peak currently traces to secondary sources. It returns when it is
 *     primary-sourced, not before.
 */

interface ChainData {
  generatedAt: string;
  source: {
    publisher: string;
    url: string;
    licence?: string;
    attribution?: string;
    lastUpdatedOnPage?: string | null;
  };
  ukai: {
    name: string;
    fullReservoirLevelFt: number | null;
    levelFt: number | null;
    inflowCusec: number | null;
    outflowCusec: number | null;
    headroomFt: number | null;
    observedAt: string | null;
    operatedBy?: string;
  };
  weir: {
    name: string;
    overflowLevelM: number | null;
    levelM: number | null;
    outflowCusec: number | null;
    headroomM: number | null;
    causewayState: string | null;
    observedAt: string | null;
  };
  khadis: {
    id: string;
    name: string;
    zone: string;
    dangerLevelM: number;
    levelM: number | null;
    headroomM: number | null;
    observedAt: string | null;
  }[];
  rainfall: {
    zonesMm: Record<string, number>;
    observedAt: string | null;
    seasonTotalMm: number | null;
  };
}

/** Colour by how much room is left, as a fraction of the threshold.
 *  Deliberately conservative: "amber" starts at a third of the way up. */
function headroomTone(headroom: number | null, threshold: number): string {
  if (headroom === null) return "text-muted-foreground";
  if (headroom <= 0) return "text-red-600 dark:text-red-400";
  const frac = headroom / threshold;
  if (frac < 0.15) return "text-red-600 dark:text-red-400";
  if (frac < 0.3) return "text-orange-500 dark:text-orange-400";
  if (frac < 0.5) return "text-amber-500 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "n/a";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "n/a";
  return Math.round(n).toLocaleString("en-IN");
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
}

function LinkRow({
  step,
  label,
  sublabel,
  reading,
  threshold,
  thresholdLabel,
  headroom,
  headroomUnit,
  tone,
  extra,
}: {
  step: number;
  label: string;
  sublabel?: string;
  reading: string;
  threshold: string;
  thresholdLabel: string;
  headroom: string;
  headroomUnit: string;
  tone: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-mono text-muted-foreground">{step}</span>
          <span className="font-medium">{label}</span>
        </div>
        {sublabel && (
          <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-4 sm:gap-6">
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums">{reading}</div>
          <div className="text-[11px] text-muted-foreground">
            {thresholdLabel} {threshold}
          </div>
        </div>
        <div className="min-w-[5.5rem] text-right">
          <div className={`text-lg font-bold tabular-nums ${tone}`}>{headroom}</div>
          <div className="text-[11px] text-muted-foreground">{headroomUnit}</div>
        </div>
      </div>
      {extra}
    </div>
  );
}

export function FloodHeadroomHero({
  cityId,
  cityDisplayName,
  config,
}: {
  cityId: string;
  cityDisplayName: string;
  config: FloodChainConfig;
}) {
  const [data, setData] = useState<ChainData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/data/${cityId}-flood-chain.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: ChainData) => {
        if (live) setData(d);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [cityId]);

  if (failed) return null;
  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-24 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const { ukai, weir, khadis, rainfall } = data;

  // The tightest khadi drives the headline: a chain is as safe as its
  // narrowest margin, and averaging five creeks would hide the one that
  // matters.
  const withHeadroom = khadis.filter((k) => k.headroomM !== null);
  const tightest =
    withHeadroom.length > 0
      ? withHeadroom.reduce((a, b) => (a.headroomM! <= b.headroomM! ? a : b))
      : null;

  const rainZones = Object.entries(rainfall.zonesMm ?? {});
  const wettest =
    rainZones.length > 0
      ? rainZones.reduce((a, b) => (a[1] >= b[1] ? a : b))
      : null;

  const causewayOpen = (weir.causewayState ?? "").toUpperCase() === "OPEN";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold sm:text-xl">
              How much room is left
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {config.chainNote}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0">
            live
          </Badge>
        </div>

        {/* The headline: the tightest margin anywhere on the chain. */}
        {tightest && (
          <div className="mt-5 rounded-lg border bg-muted/40 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tightest margin on the chain
                </p>
                <p className="mt-1 text-sm font-medium">
                  {tightest.name}
                  <span className="text-muted-foreground"> · {tightest.zone}</span>
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`text-3xl font-bold tabular-nums sm:text-4xl ${headroomTone(
                    tightest.headroomM,
                    tightest.dangerLevelM,
                  )}`}
                >
                  {fmt(tightest.headroomM)}
                </span>
                <span className="ml-1 text-sm text-muted-foreground">
                  m below danger
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              At {fmt(tightest.levelM)} m against a danger level of{" "}
              {fmt(tightest.dangerLevelM)} m, published by SMC.
            </p>
          </div>
        )}

        {/* The chain, in the order water travels it. */}
        <div className="mt-5">
          <LinkRow
            step={1}
            label="Rain over the city"
            sublabel={
              wettest
                ? `Wettest zone in the last reading: ${wettest[0]}`
                : "Zone-wise, as reported by SMC"
            }
            reading={wettest ? `${fmt(wettest[1], 1)} mm` : "n/a"}
            threshold={
              rainfall.seasonTotalMm !== null
                ? `${fmtInt(rainfall.seasonTotalMm)} mm`
                : "n/a"
            }
            thresholdLabel="season to date"
            headroom={String(rainZones.length)}
            headroomUnit="zones reporting"
            tone="text-foreground"
          />

          <LinkRow
            step={2}
            label="Ukai dam"
            sublabel={
              config.upstreamOperator
                ? `Operated by ${config.upstreamOperator.name}`
                : undefined
            }
            reading={`${fmt(ukai.levelFt)} ft`}
            threshold={`${fmt(ukai.fullReservoirLevelFt)} ft`}
            thresholdLabel="full at"
            headroom={fmt(ukai.headroomFt)}
            headroomUnit="ft below full"
            tone={headroomTone(ukai.headroomFt, ukai.fullReservoirLevelFt ?? 345)}
          />

          <LinkRow
            step={3}
            label="Weir-cum-causeway"
            sublabel={`Releasing ${fmtInt(weir.outflowCusec)} cusec · causeway ${
              weir.causewayState?.toLowerCase() ?? "unknown"
            }`}
            reading={`${fmt(weir.levelM)} m`}
            threshold={`${fmt(weir.overflowLevelM)} m`}
            thresholdLabel="overflows at"
            headroom={fmt(weir.headroomM)}
            headroomUnit={
              (weir.headroomM ?? 0) < 0 ? "m over the crest" : "m below crest"
            }
            tone={headroomTone(weir.headroomM, weir.overflowLevelM ?? 6)}
          />
        </div>

        {/* The five khadis, which is where the chain reaches the street. */}
        <div className="mt-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Khadis through the city, against SMC&apos;s published danger levels
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {khadis.map((k) => (
              <div
                key={k.id}
                className="rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{k.name}</span>
                  <span
                    className={`shrink-0 font-bold tabular-nums ${headroomTone(
                      k.headroomM,
                      k.dangerLevelM,
                    )}`}
                  >
                    {fmt(k.headroomM)} m
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate">{k.zone}</span>
                  <span className="shrink-0 tabular-nums">
                    {fmt(k.levelM)} / {fmt(k.dangerLevelM)} m
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Honesty contract, on the face of the hero rather than in a tooltip. */}
        <div className="mt-5 space-y-1.5 border-t pt-4 text-xs text-muted-foreground">
          <p>
            Every threshold on this card is {data.source.publisher}&apos;s own
            published figure, not ours. Headroom is the only number we compute
            and it is a subtraction.
          </p>
          {!causewayOpen && (weir.headroomM ?? 0) < 0 && (
            <p>
              The causeway currently sits above its overflow level and is closed.
              That is its normal monsoon state, not an alarm.
            </p>
          )}
          <p>
            A level past a danger mark is a trigger for the corporation to act,
            not a forecast that a given street will flood.
          </p>
          {config.upstreamOperator?.note && <p>{config.upstreamOperator.note}</p>}
          <p>
            Readings as of{" "}
            {fmtTime(
              ukai.observedAt ?? weir.observedAt ?? rainfall.observedAt ?? null,
            )}{" "}
            IST.{" "}
            {config.sourceLink && (
              <a
                href={config.sourceLink.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                {config.sourceLink.label}
              </a>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
