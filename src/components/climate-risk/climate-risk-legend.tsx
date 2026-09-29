"use client";

import { useLanguage } from "@/lib/i18n/context";
import { LegendRow, MapLegend } from "@/components/map/map-legend";
import { CLIMATE_CLASSES, CLIMATE_RISK_COLORS } from "@/types/climate-risk";

interface ClimateRiskLegendProps {
  hiddenClasses?: Set<string>;
  onToggleClass?: (cls: string) => void;
}

export function ClimateRiskLegend({ hiddenClasses, onToggleClass }: ClimateRiskLegendProps) {
  const { t } = useLanguage();
  return (
    <MapLegend title={t("climate.legend_title")}>
      {CLIMATE_CLASSES.map((cls) => (
        <LegendRow key={cls} id={cls} hidden={hiddenClasses} onToggle={onToggleClass}>
          <span
            className="w-4 h-3 rounded-sm border"
            style={{ backgroundColor: CLIMATE_RISK_COLORS[cls], borderColor: "#94a3b8" }}
          />
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {t(`climate.class.${cls}`)}
          </span>
        </LegendRow>
      ))}
    </MapLegend>
  );
}
