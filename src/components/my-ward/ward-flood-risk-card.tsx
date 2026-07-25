"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { WardProfile } from "@/lib/hooks/use-ward-profile";
import { isSectionUnavailable } from "@/lib/hooks/use-ward-profile";
import { useMyWardCity } from "./city-context";

const HAZARD_COLORS: Record<string, { bg: string; bar: string }> = {
  very_high: { bg: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", bar: "bg-red-500" },
  high: { bg: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", bar: "bg-orange-500" },
  moderate: { bg: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", bar: "bg-yellow-500" },
  low: { bg: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", bar: "bg-green-500" },
  very_low: { bg: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", bar: "bg-blue-400" },
};

interface Props {
  wardNumber: number;
  profile: WardProfile;
}

export function WardFloodRiskCard({ wardNumber, profile }: Props) {
  const { cityId } = useMyWardCity();
  const { t } = useLanguage();
  const { cityPrefix } = useMyWardCity();
  const flood = profile.flood;

  // Sections marked not_available (e.g. Madurai - no public CFLOWS layer)
  // render an honest "data not yet sourced" card rather than fabricating
  // zero counts.
  if (isSectionUnavailable(flood)) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {t("my_ward.flood_risk")}
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ward-level flood-hazard data is not yet available for this city.
          </p>
          {flood._data_status_note && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {flood._data_status_note}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (
    "by_category" in flood &&
    !flood.dominant_hazard &&
    flood.hazard_zone_count === 0 &&
    flood.hotspot_2015_count === 0 &&
    flood.hotspot_2020_count === 0
  ) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {t("my_ward.flood_risk")}
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 dark:text-slate-500">{t("my_ward.no_flood_data")}</p>
        </CardContent>
      </Card>
    );
  }

  // Chronic-waterlogging cities (Delhi): no modelled hazard polygons, but a
  // register of perennial flooding points. Render what exists rather than a
  // zeroed hazard card.
  if ("chronic_hotspots" in flood) {
    const names = flood.hotspot_names ?? [];
    return (
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {t("my_ward.flood_risk")}
          </h2>
        </CardHeader>
        <CardContent>
          {flood.chronic_hotspots > 0 ? (
            <>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <span className="font-semibold">{flood.chronic_hotspots}</span>{" "}
                chronic waterlogging {flood.chronic_hotspots === 1 ? "hotspot" : "hotspots"} recorded in this ward
              </p>
              {names.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {names.map((n) => (
                    <li key={n} className="text-sm text-slate-600 dark:text-slate-400">- {n}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No perennial waterlogging point recorded in this ward.
            </p>
          )}
          {flood._note && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 leading-snug">{flood._note}</p>
          )}
          <Link
            href={`${cityPrefix}/flood-risk`}
            className="inline-block mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t("my_ward.view_on_map")} &rarr;
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Defensive: an unrecognised flood shape must degrade to the honest
  // "not sourced" card, never crash the whole ward page (it did - every
  // Delhi ward 500'd on Object.values(undefined) before this guard).
  if (!("by_category" in flood) || !flood.by_category) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {t("my_ward.flood_risk")}
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 dark:text-slate-500">{t("my_ward.no_flood_data")}</p>
        </CardContent>
      </Card>
    );
  }

  const totalZones = Object.values(flood.by_category).reduce((a, b) => a + b, 0);
  const veryHighCount = flood.by_category["very_high"] ?? 0;
  const highCount = flood.by_category["high"] ?? 0;
  const severeCount = veryHighCount + highCount;

  // Find the worst hazard level present
  const SEVERITY_ORDER = ["very_high", "high", "moderate", "low", "very_low"] as const;
  const worstHazard = SEVERITY_ORDER.find((cat) => (flood.by_category[cat] ?? 0) > 0) ?? null;
  const worstColors = worstHazard ? HAZARD_COLORS[worstHazard] : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {t("my_ward.flood_risk")}
          </h2>
          <Link
            href={`${cityPrefix}/flood-risk?ward=${wardNumber}`}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline print:hidden"
          >
            {t("my_ward.view_on_map")} &rarr;
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Highlight severe zones first */}
        {severeCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {veryHighCount > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${HAZARD_COLORS.very_high.bg}`}>
                {veryHighCount} {t("flood.very_high")}
              </span>
            )}
            {highCount > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${HAZARD_COLORS.high.bg}`}>
                {highCount} {t("flood.high")}
              </span>
            )}
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t("my_ward.flood_severe_zones")}
            </span>
          </div>
        ) : worstHazard && (
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${worstColors?.bg ?? ""}`}>
              {t(`flood.${worstHazard}`)}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t("my_ward.flood_worst_level")}
            </span>
          </div>
        )}

        {/* Hazard category breakdown bar */}
        {totalZones > 0 && (
          <div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1">
              {t("my_ward.flood_bar_label")} ({totalZones} {totalZones === 1 ? "zone" : "zones"})
            </p>
            <div className="flex h-3 rounded-full overflow-hidden">
              {(["very_high", "high", "moderate", "low", "very_low"] as const).map((cat) => {
                const count = flood.by_category[cat] ?? 0;
                if (count === 0) return null;
                const pct = (count / totalZones) * 100;
                return (
                  <div
                    key={cat}
                    className={`${HAZARD_COLORS[cat]?.bar ?? "bg-slate-300"}`}
                    style={{ width: `${pct}%` }}
                    title={`${t(`flood.${cat}`)}: ${count}`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
              {(["very_high", "high", "moderate", "low", "very_low"] as const).map((cat) => {
                const count = flood.by_category[cat] ?? 0;
                if (count === 0) return null;
                return (
                  <span key={cat} className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${HAZARD_COLORS[cat]?.bar ?? ""} inline-block`} />
                    {t(`flood.${cat}`)} ({count})
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Historical floods */}
        {(flood.hotspot_2015_count > 0 || flood.hotspot_2020_count > 0) && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-2 space-y-1">
            <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              {t("my_ward.historical_floods")}
            </h3>
            <div className="flex gap-4">
              {flood.hotspot_2015_count > 0 && (
                <div className="text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{t("flood.event_2015")}: </span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {flood.hotspot_2015_count} {t("flood.hotspots")}
                  </span>
                </div>
              )}
              {flood.hotspot_2020_count > 0 && (
                <div className="text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{t("flood.event_2020")}: </span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {flood.hotspot_2020_count} {t("flood.hotspots")}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Source & caveats */}
        <div className="text-[10px] text-slate-400 dark:text-slate-500 space-y-0.5 border-t border-slate-100 dark:border-slate-800 pt-2">
          <p>{t("my_ward.flood_hazard_note")}</p>
          <p>{t(cityId === "bangalore" || cityId === "mumbai" ? `my_ward.flood_source_${cityId}` : "my_ward.flood_source")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
