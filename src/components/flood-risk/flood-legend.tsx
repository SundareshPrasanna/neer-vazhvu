"use client";

import { useLanguage } from "@/lib/i18n/context";
import { LegendRow, MapLegend } from "@/components/map/map-legend";
import { HAZARD_COLORS, DRAINAGE_COLORS, SEWERAGE_COLORS, VULNERABILITY_COLORS } from "@/types/flood-risk";
import type { FloodViewMode, HazardCategory } from "@/types/flood-risk";

const VULNERABILITY_ITEMS: Array<{ id: string; label: string; key: string }> = [
  { id: "vuln_very_high", label: "Very High Vulnerability", key: "flood.very_high" },
  { id: "vuln_high",      label: "High Vulnerability",      key: "flood.high" },
  { id: "vuln_low",       label: "Low Vulnerability",       key: "flood.low" },
];

const HAZARD_ITEMS: Array<{ cat: HazardCategory; key: string }> = [
  { cat: "very_high", key: "flood.very_high" },
  { cat: "high", key: "flood.high" },
  { cat: "moderate", key: "flood.moderate" },
  { cat: "low", key: "flood.low" },
  { cat: "very_low", key: "flood.very_low" },
];

const DRAINAGE_ITEMS: Array<{ type: string; key: string }> = [
  { type: "Macro Drain", key: "flood.legend_macro" },
  { type: "Micro Drain", key: "flood.legend_micro" },
  { type: "SWD", key: "flood.legend_swd" },
  { type: "Side Drain", key: "flood.legend_side" },
  { type: "Open Drain", key: "flood.legend_open" },
];

const SEWERAGE_ITEMS = [
  { id: "stp" as const, key: "flood.legend_stp", shape: "square" as const },
  { id: "sps" as const, key: "flood.legend_sps", shape: "circle" as const },
  { id: "pumping_main" as const, key: "flood.legend_pm", shape: "line" as const },
];

const LABEL = "font-medium text-slate-700 dark:text-slate-300";

interface FloodLegendProps {
  viewMode: FloodViewMode;
  historicalEvent?: "2015" | "2020";
  hiddenCategories?: Set<string>;
  onToggleCategory?: (category: string) => void;
}

export function FloodLegend({ viewMode, historicalEvent, hiddenCategories, onToggleCategory }: FloodLegendProps) {
  const { t } = useLanguage();
  const row = { hidden: hiddenCategories, onToggle: onToggleCategory };

  const title =
    viewMode === "hazard"
      ? t("flood.legend_hazard")
      : viewMode === "historical"
        ? t("flood.legend_impact")
        : viewMode === "sewerage"
          ? t("flood.legend_sewerage")
          : t("flood.legend_drainage");

  return (
    <MapLegend title={title}>
      {viewMode === "hazard" &&
        HAZARD_ITEMS.map((item) => (
          <LegendRow key={item.cat} id={item.cat} {...row}>
            <span
              className="w-4 h-3 rounded-sm border"
              style={{ backgroundColor: HAZARD_COLORS[item.cat] + "80", borderColor: HAZARD_COLORS[item.cat] }}
            />
            <span className={LABEL}>{t(item.key)}</span>
          </LegendRow>
        ))}

      {viewMode === "historical" && (
        <>
          {historicalEvent === "2015" ? (
            <>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">
                {t("flood.legend_hotspot")}
              </p>
              {VULNERABILITY_ITEMS.map((item) => {
                const color = VULNERABILITY_COLORS[item.label];
                return (
                  <LegendRow key={item.id} id={item.id} {...row}>
                    <span
                      className="w-3 h-3 rounded-full border flex-shrink-0"
                      style={{ backgroundColor: color, borderColor: color }}
                    />
                    <span className={LABEL}>
                      {t(item.key)} {t("flood.vulnerability").toLowerCase()}
                    </span>
                  </LegendRow>
                );
              })}
            </>
          ) : (
            <LegendRow id="hotspot" {...row}>
              <span className="w-3 h-3 rounded-full bg-red-500 border border-red-600 flex-shrink-0" />
              <span className={LABEL}>{t("flood.legend_hotspot")}</span>
            </LegendRow>
          )}
          {historicalEvent === "2015" && (
            <LegendRow id="depth" {...row}>
              <span className="w-3 h-3 rounded-full bg-blue-500 border border-blue-600 flex-shrink-0" />
              <span className={LABEL}>{t("flood.legend_depth")}</span>
            </LegendRow>
          )}
        </>
      )}

      {viewMode === "drainage" && (
        <>
          {DRAINAGE_ITEMS.map((item) => (
            <LegendRow key={item.type} id={item.type} {...row}>
              <span className="w-4 h-0 border-t-2" style={{ borderColor: DRAINAGE_COLORS[item.type] }} />
              <span className={LABEL}>{t(item.key)}</span>
            </LegendRow>
          ))}
          <LegendRow id="river" {...row}>
            <span className="w-4 h-0 border-t-2 border-cyan-500" />
            <span className={LABEL}>{t("flood.legend_river")}</span>
          </LegendRow>
        </>
      )}

      {viewMode === "sewerage" &&
        SEWERAGE_ITEMS.map((item) => {
          const color = SEWERAGE_COLORS[item.id];
          return (
            <LegendRow key={item.id} id={item.id} {...row}>
              {item.shape === "square" && (
                <span className="w-4 h-3 rounded-sm border" style={{ backgroundColor: color + "80", borderColor: color }} />
              )}
              {item.shape === "circle" && (
                <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: color + "80", borderColor: color }} />
              )}
              {item.shape === "line" && <span className="w-4 h-0 border-t-2" style={{ borderColor: color }} />}
              <span className={LABEL}>{t(item.key)}</span>
            </LegendRow>
          );
        })}
    </MapLegend>
  );
}
