"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReservoirHeadroomConfig } from "@/lib/cities/types";
import type { Headroom, HeadroomRow } from "@/lib/insights/reservoir-headroom";
import { useLanguage } from "@/lib/i18n/context";
import { getReservoirDisplayName } from "@/lib/i18n/reservoir-name";
import { formatDate, formatNumber, interpolate } from "@/lib/utils/format";

/**
 * Leads the dashboard during the city's monsoon: how much more each reservoir
 * can hold before it is full. Days-left answers the dry-season question; in
 * the rains the question turns to room.
 *
 * Every figure is the publisher's storage or capacity, or their difference.
 * One neutral colour for every lake: the card states distances and leaves the
 * reading to the reader. A full reservoir is a trigger for the operator's
 * release decision, not a flood forecast, and the card says so.
 */
const SEASON_KEY = {
  northeast: "headroom.season_northeast",
  southwest: "headroom.season_southwest",
} as const;

export function ReservoirHeadroomCard({
  headroom,
  asOf,
  isStale,
  config,
}: {
  headroom: Headroom;
  asOf: string;
  isStale: boolean;
  config: ReservoirHeadroomConfig;
}) {
  const { t } = useLanguage();
  const name = (r: HeadroomRow) => getReservoirDisplayName(r.name, t, r.displayName);
  const mcft = (n: number) => formatNumber(Math.round(n));
  const pct = (n: number) => String(Math.round(n));
  const date = formatDate(asOf);
  const lead = headroom.rows[0];
  const { total } = headroom;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold sm:text-xl">{t("headroom.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {interpolate(t("headroom.reading_of"), { date })}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0">
            {t(SEASON_KEY[config.monsoon])}
          </Badge>
        </div>

        <div className="mt-5 rounded-lg border bg-muted/40 p-4">
          {lead.roomMcft >= 0 ? (
            <>
              <p className="text-base font-semibold sm:text-lg">
                {interpolate(t("headroom.fullest"), { name: name(lead), pct: pct(lead.fillPct) })}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {interpolate(t("headroom.room_for"), { room: mcft(lead.roomMcft) })}
              </p>
            </>
          ) : (
            <p className="text-base font-semibold sm:text-lg">
              {interpolate(t("headroom.above_full"), { name: name(lead), over: mcft(-lead.roomMcft) })}
            </p>
          )}
        </div>

        <ul className="mt-5 space-y-4">
          {headroom.rows.map((r) => (
            <li key={r.name}>
              <div className="flex flex-col text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-3">
                <span className="font-medium">{name(r)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {interpolate(t("headroom.row_full"), { pct: pct(r.fillPct) })}
                  {" - "}
                  {r.roomMcft >= 0
                    ? interpolate(t("headroom.row_room"), { room: mcft(r.roomMcft) })
                    : interpolate(t("headroom.row_over"), { over: mcft(-r.roomMcft) })}
                </span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${name(r)}: ${interpolate(t("headroom.row_full"), { pct: pct(r.fillPct) })}`}
              >
                <div
                  className="h-full rounded-full bg-cyan-600 dark:bg-cyan-500"
                  style={{ width: `${Math.min(100, Math.max(0, r.fillPct))}%` }}
                />
              </div>
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                {r.inflowCusecs == null && r.outflowCusecs == null
                  ? t("headroom.flows_none")
                  : interpolate(t("headroom.flows"), {
                      in: r.inflowCusecs == null ? "n/a" : formatNumber(r.inflowCusecs),
                      out: r.outflowCusecs == null ? "n/a" : formatNumber(r.outflowCusecs),
                    })}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-5 space-y-1.5 border-t pt-4 text-xs text-muted-foreground">
          {headroom.rows.length > 1 && (
            <p className="text-sm text-foreground">
              {interpolate(t("headroom.together"), {
                n: headroom.rows.length,
                pct: pct(total.fillPct),
                room: mcft(total.roomMcft),
              })}
            </p>
          )}
          {headroom.missing.length > 0 && (
            <p>{interpolate(t("headroom.missing"), { names: headroom.missing.join(", ") })}</p>
          )}
          {isStale && (
            <p>{interpolate(t("headroom.stale"), { publisher: config.source.publisher, date })}</p>
          )}
          <p>
            {interpolate(t("headroom.source"), { publisher: config.source.publisher })}{" "}
            <a
              href={config.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {config.source.url.replace(/^https?:\/\//, "")}
            </a>
          </p>
          <p>{interpolate(t("headroom.not_forecast"), { authority: t(config.releasesBy) })}</p>
        </div>
      </CardContent>
    </Card>
  );
}
