"use client";

import { useLanguage } from "@/lib/i18n/context";
import { LegendRow, MapLegend } from "@/components/map/map-legend";
import { getPriorityColor } from "@/types/restoration";
import type { PriorityLevel } from "@/types/restoration";
import type { ViewMode } from "./view-mode-toggle";

const WB_LEGEND_DEFS = [
  { id: "existing",         color: "#3b82f6", labelKey: "wb_legend.existing",         descKey: "wb_legend.surviving" },
  { id: "fully_lost",       color: "#dc2626", labelKey: "wb_legend.fully_lost",       descKey: "wb_legend.fully_lost_desc" },
  { id: "severely_reduced", color: "#f97316", labelKey: "wb_legend.severely_reduced", descKey: "wb_legend.severely_reduced_desc" },
  { id: "encroached",       color: "#eab308", labelKey: "wb_legend.encroached",       descKey: "wb_legend.encroached_desc" },
  { id: "census_healthy",   color: "#10b981", labelKey: "wb_legend.census_healthy",   descKey: "wb_legend.census_healthy_desc" },
  { id: "census_encroached", color: "#ef4444", labelKey: "wb_legend.census_encroached", descKey: "wb_legend.census_encroached_desc" },
  { id: "census_degraded",  color: "#f97316", labelKey: "wb_legend.census_degraded",  descKey: "wb_legend.census_degraded_desc" },
] as const;

const PRIORITY_ITEMS: Array<{ level: PriorityLevel; labelKey: string }> = [
  { level: "critical", labelKey: "lr.critical" },
  { level: "high",     labelKey: "lr.high" },
  { level: "moderate", labelKey: "lr.moderate" },
  { level: "low",      labelKey: "lr.low" },
];

interface UnifiedLegendProps {
  viewMode: ViewMode;
  hiddenCategories?: Set<string>;
  onToggleCategory?: (category: string) => void;
  /** Optional whitelist of category ids to render. When provided, the
   *  legend only shows these entries (in the canonical order).
   *  Use for cities whose data layer doesn't include certain categories
   *  (Bengaluru today: no census-to-OSM polygon join, so the three
   *  census_* categories are misleading - pass
   *  ["existing","fully_lost","severely_reduced","encroached"] to hide
   *  them). When omitted, the full Chennai-shape legend renders. */
  visibleCategoryIds?: ReadonlySet<string> | readonly string[];
}

export function UnifiedLegend({ viewMode, hiddenCategories, onToggleCategory, visibleCategoryIds }: UnifiedLegendProps) {
  const { t } = useLanguage();
  const allowed = visibleCategoryIds && new Set(visibleCategoryIds);

  return (
    <MapLegend title={viewMode === "water-bodies" ? t("wb_legend.title") : t("lr.priority_level")}>
      {viewMode === "water-bodies"
        ? WB_LEGEND_DEFS.filter((item) => !allowed || allowed.has(item.id)).map((item) => (
            <LegendRow key={item.id} id={item.id} hidden={hiddenCategories} onToggle={onToggleCategory}>
              <span
                className="w-4 h-3 rounded-sm border flex-shrink-0"
                style={{ backgroundColor: item.color + "80", borderColor: item.color }}
              />
              <span className="font-medium text-slate-700 dark:text-slate-300 shrink-0">{t(item.labelKey)}</span>
              <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">{t(item.descKey)}</span>
            </LegendRow>
          ))
        : PRIORITY_ITEMS.map((item) => (
            <LegendRow key={item.level} id={item.level} hidden={hiddenCategories} onToggle={onToggleCategory}>
              <span
                className="w-4 h-3 rounded-sm border flex-shrink-0"
                style={{
                  backgroundColor: getPriorityColor(item.level) + "80",
                  borderColor: getPriorityColor(item.level),
                }}
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {t(item.labelKey)}
              </span>
            </LegendRow>
          ))}
    </MapLegend>
  );
}
