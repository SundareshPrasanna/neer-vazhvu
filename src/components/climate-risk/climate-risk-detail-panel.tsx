"use client";

import { useLanguage } from "@/lib/i18n/context";
import {
  CLIMATE_RISK_COLORS,
  DRIVER_GROUPS,
  type ClimateClass,
  type ClimateSubtheme,
  type DriverGroup,
  type SubBasinProperties,
} from "@/types/climate-risk";

interface ClimateRiskDetailPanelProps {
  selected: SubBasinProperties;
  /** The active subtheme, so the matching component is highlighted first. */
  subtheme: ClimateSubtheme;
  onClose: () => void;
}

const COMPONENT_CLASS: Array<{ sub: ClimateSubtheme; field: keyof SubBasinProperties }> = [
  { sub: "hazard", field: "hazard_class" },
  { sub: "exposure", field: "exposure_class" },
  { sub: "vulnerability", field: "vulnerability_class" },
];

function ClassChip({ cls, label }: { cls: ClimateClass; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
      <span
        className="w-3 h-3 rounded-sm border border-slate-400"
        style={{ backgroundColor: CLIMATE_RISK_COLORS[cls] }}
      />
      {label}
    </span>
  );
}

export function ClimateRiskDetailPanel({ selected, subtheme, onClose }: ClimateRiskDetailPanelProps) {
  const { t } = useLanguage();
  const p = selected;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("climate.sub_basin")}</div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{p.sub_basin}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl leading-none"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      <div className="px-4 py-3 space-y-4 flex-1">
        {/* Overall risk + component classes */}
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3.5 h-3.5 rounded-sm border border-slate-400"
              style={{ backgroundColor: CLIMATE_RISK_COLORS[p.risk_class] }}
            />
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t("climate.sub.risk")}: {t(`climate.class.${p.risk_class}`)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {COMPONENT_CLASS.map(({ sub, field }) => (
              <ClassChip
                key={sub}
                cls={p[field] as ClimateClass}
                label={`${t(`climate.sub.${sub}`)}: ${t(`climate.class.${p[field] as ClimateClass}`)}`}
              />
            ))}
          </div>
        </div>

        {/* Unmet demand (where the report gives it) */}
        {p.unmet_mcm_2050 != null && (
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t("climate.unmet_demand")}</div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
              {p.unmet_mcm_2020 != null ? `${p.unmet_mcm_2020} -> ` : ""}{p.unmet_mcm_2050}
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400"> MCM</span>
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500">{t("climate.unmet_demand_note")}</div>
          </div>
        )}

        {/* Top contributing indicators per group; active subtheme's group first */}
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
            {t("climate.top_drivers")}
          </div>
          <div className="space-y-3">
            {orderedGroups(subtheme).map((group) => (
              <div key={group}>
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">
                  {t(`climate.driver.${group}`)}
                </div>
                <ol className="list-decimal list-inside text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                  {p.drivers[group].map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>

        {/* Provenance */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
          {p.boundary_quality === "approximate" && (
            <span className="inline-block text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              {t("climate.boundary_approximate")}
            </span>
          )}
          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
            {t("climate.source")}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Put the active subtheme's matching driver group first (vulnerability maps
 *  to adaptive_capacity + sensitivity; risk shows all in default order). */
function orderedGroups(subtheme: ClimateSubtheme): DriverGroup[] {
  if (subtheme === "hazard") return ["hazard", "exposure", "adaptive_capacity", "sensitivity"];
  if (subtheme === "exposure") return ["exposure", "hazard", "adaptive_capacity", "sensitivity"];
  if (subtheme === "vulnerability") return ["adaptive_capacity", "sensitivity", "hazard", "exposure"];
  return DRIVER_GROUPS;
}
