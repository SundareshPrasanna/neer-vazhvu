"use client";

import { useLanguage } from "@/lib/i18n/context";
import {
  CLIMATE_CLASSES,
  CLIMATE_RISK_COLORS,
  CLIMATE_SUBTHEMES,
  classForSubtheme,
  type ClimateSubtheme,
  type SubBasinProperties,
} from "@/types/climate-risk";

interface ClimateRiskPanelProps {
  value: ClimateSubtheme;
  onChange: (value: ClimateSubtheme) => void;
  /** Subthemes the city actually supports (from config.climateRisk). */
  available: ClimateSubtheme[];
  /** All sub-basins, for the ranked list under the selector. */
  subBasins: SubBasinProperties[];
  /** Open a sub-basin's detail (same as clicking it on the map). */
  onSelect: (props: SubBasinProperties) => void;
}

const RANK = Object.fromEntries(CLIMATE_CLASSES.map((c, i) => [c, i])) as Record<string, number>;

/** The subtheme selector + a ranked sub-basin list, rendered as the default
 *  side-panel content (replaced by the detail panel when a sub-basin is open). */
export function ClimateRiskPanel({ value, onChange, available, subBasins, onSelect }: ClimateRiskPanelProps) {
  const { t } = useLanguage();
  const subthemes = CLIMATE_SUBTHEMES.filter((s) => available.includes(s));

  const ranked = [...subBasins].sort(
    (a, b) => RANK[classForSubtheme(a, value)] - RANK[classForSubtheme(b, value)]
  );

  return (
    <div className="p-3 space-y-4">
      {/* Subtheme sub-sections */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase px-1 mb-2">
          {t("climate.panel_title")}
        </h4>
        <div className="space-y-1">
          {subthemes.map((sub) => {
            const active = value === sub;
            return (
              <button
                key={sub}
                onClick={() => onChange(sub)}
                aria-pressed={active}
                className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                  active
                    ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40 dark:border-sky-600"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <div className={`text-sm font-medium ${active ? "text-sky-700 dark:text-sky-300" : "text-slate-700 dark:text-slate-200"}`}>
                  {t(`climate.sub.${sub}`)}
                </div>
                <div className="text-[11px] leading-snug text-slate-500 dark:text-slate-400 mt-0.5">
                  {t(`climate.sub.${sub}.desc`)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ranked sub-basin list for the active subtheme */}
      {ranked.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase px-1 mb-1">
            {t("climate.ranked_title")}
          </h4>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {ranked.map((sb) => {
              const cls = classForSubtheme(sb, value);
              return (
                <button
                  key={sb.sub_basin}
                  onClick={() => onSelect(sb)}
                  className="w-full flex items-center gap-2.5 py-2 px-1 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-sm border border-slate-400 shrink-0"
                    style={{ backgroundColor: CLIMATE_RISK_COLORS[cls] }}
                  />
                  <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{sb.sub_basin}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t(`climate.class.${cls}`)}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1 mt-2">{t("climate.tap_hint")}</p>
        </div>
      )}
    </div>
  );
}
