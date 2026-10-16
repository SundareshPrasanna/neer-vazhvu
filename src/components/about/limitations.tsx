"use client";

import { useLanguage } from "@/lib/i18n/context";
import type { PlaceConfig } from "@/lib/cities";
import { hasWardRankings } from "@/lib/ward-rankings/cities";
import { SubSection } from "./primitives";

/** Cities with v2 AutoARIMA reservoir forecasts: CITIES in
 *  neer-vazhvu-api/scripts/compute_reservoir_forecast.py, run by
 *  daily-data-pipeline.yml. No config flag carries this yet; keep in step. */
const AUTOARIMA_FORECAST_CITIES: ReadonlySet<string> = new Set(["madurai", "bangalore"]);

/** Cities whose water-body panels carry the Sentinel-2 satellite spread
 *  insight: _REGISTRY in neer-vazhvu-api/app/gee/cities.py, refreshed by
 *  gee-phase1.yml. No config flag carries this yet; keep in step. */
const SATELLITE_SPREAD_CITIES: ReadonlySet<string> = new Set(["chennai", "madurai"]);

/** Whether the dashboard shows a days-of-water-left figure: the same gate
 *  city-dashboard.tsx puts on DaysLeftHero. */
export function showsDaysLeftFigure(config: PlaceConfig): boolean {
  return config.heroMode === "days-left" && config.defaultConsumptionMld != null;
}

/** The frame's "Known Limitations": each item shows only where the city has
 *  the feature it qualifies. Chennai's list names its own sources and fills
 *  the `limitations` slot instead. */
export function CityLimitations({ config }: { config: PlaceConfig }) {
  const { t } = useLanguage();
  const has = (route: PlaceConfig["routes"][number]) => config.routes.includes(route);
  const items: string[] = [];
  if (showsDaysLeftFigure(config)) items.push(t("about.limit_estimates"));
  items.push(t("about.limit_feeds"));
  if (has("groundwater")) items.push(t("about.limit_groundwater"));
  if (AUTOARIMA_FORECAST_CITIES.has(config.cityId)) items.push(t("about.limit_forecast_autoarima"));
  const wardRiskScores =
    (has("groundwater") && config.groundwaterViews?.risk === true) ||
    (has("my-ward") && hasWardRankings(config.cityId));
  if (wardRiskScores) items.push(t("about.limit5"));
  if (SATELLITE_SPREAD_CITIES.has(config.cityId)) {
    items.push(t("about.limit6"));
    items.push(t("about.limit8"));
  }
  return (
    <SubSection title={t("about.limitations")}>
      <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </SubSection>
  );
}
