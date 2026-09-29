"use client";

import { QUALITY_COLORS } from "@/types/river-quality";
import type { RiverQualityStatus } from "@/types/river-quality";
import { SOURCE_TYPE_COLORS } from "@/types/industrial-pollution";
import type { PollutionSourceType } from "@/types/industrial-pollution";
import { useLanguage } from "@/lib/i18n/context";
import { LegendRow, MapLegend } from "@/components/map/map-legend";

const QUALITY_ITEMS: RiverQualityStatus[] = [
  "dead",
  "severely_degraded",
  "degraded",
  "stressed",
  "healthy",
];

/** Statuses actually present in Chennai river data */
const ACTIVE_STATUSES = new Set<RiverQualityStatus>(["dead", "severely_degraded", "degraded"]);

const SOURCE_ITEMS: PollutionSourceType[] = [
  "thermal_power",
  "petrochemical",
  "chemical",
  "port",
  "industrial_estate",
  "discharge_zone",
];

interface RiversLegendProps {
  hiddenCategories?: Set<string>;
  onToggleCategory?: (category: string) => void;
}

export function RiversLegend({ hiddenCategories, onToggleCategory }: RiversLegendProps = {}) {
  const { t } = useLanguage();
  const row = { hidden: hiddenCategories, onToggle: onToggleCategory };

  return (
    <MapLegend
      title={t("rivers_legend.water_quality")}
      className="px-3 py-2"
      titleClassName="text-slate-700 dark:text-slate-300"
      bodyClassName="mt-1.5 space-y-2 max-h-[52vh] overflow-y-auto pr-1"
    >
      {/* Water quality section */}
      <div className="flex flex-col gap-1">
        {QUALITY_ITEMS.map((status) => (
          <LegendRow key={status} id={status} {...row} className="whitespace-nowrap" dim={!ACTIVE_STATUSES.has(status)}>
            <span
              className="w-6 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: QUALITY_COLORS[status] }}
            />
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {t(`rivers_legend.${status}`)}
            </span>
          </LegendRow>
        ))}
      </div>
      <LegendRow id="station" {...row} className="whitespace-nowrap">
        <span className="w-3 h-3 rounded-full border-2 border-slate-400 bg-white dark:bg-slate-600 flex-shrink-0" />
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {t("rivers_legend.monitoring_station")}
        </span>
      </LegendRow>

      <LegendRow id="sewage_inlet" {...row} className="">
        <span className="flex items-center gap-0.5 flex-shrink-0 w-6 justify-center">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#92400e" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#92400e" }} />
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {t("rivers_legend.sewage_inlet")}
        </span>
      </LegendRow>

      {/* Divider */}
      <div className="border-t border-slate-100 dark:border-slate-700" />

      {/* Pollution sources section */}
      <div>
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          {t("rivers_legend.pollution_sources")}
        </p>
        <div className="flex flex-col gap-1">
          {SOURCE_ITEMS.map((type) => (
            <LegendRow key={type} id={`source_${type}`} {...row} className="whitespace-nowrap">
              <span
                className="w-3 h-3 rounded-full border-2 border-white dark:border-slate-600 flex-shrink-0 shadow-sm"
                style={{ backgroundColor: SOURCE_TYPE_COLORS[type] }}
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {t(`rivers_legend.${type}`)}
              </span>
            </LegendRow>
          ))}
        </div>
        <LegendRow id="industrial_zone" {...row} className="mt-1.5">
          <span
            className="w-6 h-3 rounded flex-shrink-0 border border-dashed"
            style={{
              backgroundColor: "rgba(249,115,22,0.10)",
              borderColor: "#f97316",
            }}
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t("rivers_legend.industrial_zone")}
          </span>
        </LegendRow>
      </div>
    </MapLegend>
  );
}
