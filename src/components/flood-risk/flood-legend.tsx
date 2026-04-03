"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { HAZARD_COLORS, DRAINAGE_COLORS, SEWERAGE_COLORS, VULNERABILITY_COLORS } from "@/types/flood-risk";
import type { FloodViewMode, HazardCategory, SewerageLayer } from "@/types/flood-risk";

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

interface FloodLegendProps {
  viewMode: FloodViewMode;
  historicalEvent?: "2015" | "2020";
  hiddenCategories?: Set<string>;
  onToggleCategory?: (category: string) => void;
}

export function FloodLegend({ viewMode, historicalEvent, hiddenCategories, onToggleCategory }: FloodLegendProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(true);

  const title =
    viewMode === "hazard"
      ? t("flood.legend_hazard")
      : viewMode === "historical"
        ? t("flood.legend_impact")
        : viewMode === "sewerage"
          ? t("flood.legend_sewerage")
          : t("flood.legend_drainage");

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full"
      >
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
          {title}
        </h4>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`${expanded ? "block" : "hidden"} mt-2 space-y-1`}>
        {viewMode === "hazard" &&
          HAZARD_ITEMS.map((item) => {
            const hidden = hiddenCategories?.has(item.cat) ?? false;
            return (
              <button
                key={item.cat}
                onClick={() => onToggleCategory?.(item.cat)}
                className={`flex items-center gap-2 text-xs whitespace-nowrap w-full text-left transition-opacity ${hidden ? "opacity-30" : ""} ${onToggleCategory ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
              >
                <span
                  className="w-4 h-3 rounded-sm border"
                  style={{
                    backgroundColor: HAZARD_COLORS[item.cat] + "80",
                    borderColor: HAZARD_COLORS[item.cat],
                  }}
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {t(item.key)}
                </span>
              </button>
            );
          })}

        {viewMode === "historical" && (
          <>
            {historicalEvent === "2015" ? (
              <>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">
                  {t("flood.legend_hotspot")}
                </p>
                {VULNERABILITY_ITEMS.map((item) => {
                  const hidden = hiddenCategories?.has(item.id) ?? false;
                  const color = VULNERABILITY_COLORS[item.label];
                  return (
                    <button
                      key={item.id}
                      onClick={() => onToggleCategory?.(item.id)}
                      className={`flex items-center gap-2 text-xs whitespace-nowrap w-full text-left transition-opacity ${hidden ? "opacity-30" : ""} ${onToggleCategory ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border flex-shrink-0"
                        style={{ backgroundColor: color, borderColor: color }}
                      />
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {t(item.key)} {t("flood.vulnerability").toLowerCase()}
                      </span>
                    </button>
                  );
                })}
              </>
            ) : (
              (() => {
                const hidden = hiddenCategories?.has("hotspot") ?? false;
                return (
                  <button
                    onClick={() => onToggleCategory?.("hotspot")}
                    className={`flex items-center gap-2 text-xs whitespace-nowrap w-full text-left transition-opacity ${hidden ? "opacity-30" : ""} ${onToggleCategory ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
                  >
                    <span className="w-3 h-3 rounded-full bg-red-500 border border-red-600 flex-shrink-0" />
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {t("flood.legend_hotspot")}
                    </span>
                  </button>
                );
              })()
            )}
            {historicalEvent === "2015" && (() => {
              const hidden = hiddenCategories?.has("depth") ?? false;
              return (
                <button
                  onClick={() => onToggleCategory?.("depth")}
                  className={`flex items-center gap-2 text-xs whitespace-nowrap w-full text-left transition-opacity ${hidden ? "opacity-30" : ""} ${onToggleCategory ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
                >
                  <span className="w-3 h-3 rounded-full bg-blue-500 border border-blue-600 flex-shrink-0" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {t("flood.legend_depth")}
                  </span>
                </button>
              );
            })()}
          </>
        )}

        {viewMode === "drainage" && (
          <>
            {DRAINAGE_ITEMS.map((item) => {
              const hidden = hiddenCategories?.has(item.type) ?? false;
              return (
                <button
                  key={item.type}
                  onClick={() => onToggleCategory?.(item.type)}
                  className={`flex items-center gap-2 text-xs whitespace-nowrap w-full text-left transition-opacity ${hidden ? "opacity-30" : ""} ${onToggleCategory ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
                >
                  <span
                    className="w-4 h-0 border-t-2"
                    style={{ borderColor: DRAINAGE_COLORS[item.type] }}
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {t(item.key)}
                  </span>
                </button>
              );
            })}
            {(() => {
              const hidden = hiddenCategories?.has("river") ?? false;
              return (
                <button
                  onClick={() => onToggleCategory?.("river")}
                  className={`flex items-center gap-2 text-xs whitespace-nowrap w-full text-left transition-opacity ${hidden ? "opacity-30" : ""} ${onToggleCategory ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
                >
                  <span className="w-4 h-0 border-t-2 border-cyan-500" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {t("flood.legend_river")}
                  </span>
                </button>
              );
            })()}
          </>
        )}

        {viewMode === "sewerage" && (
          <>
            {[
              { id: "stp" as const, key: "flood.legend_stp", shape: "square" as const },
              { id: "sps" as const, key: "flood.legend_sps", shape: "circle" as const },
              { id: "pumping_main" as const, key: "flood.legend_pm", shape: "line" as const },
            ].map((item) => {
              const hidden = hiddenCategories?.has(item.id) ?? false;
              const color = SEWERAGE_COLORS[item.id];
              return (
                <button
                  key={item.id}
                  onClick={() => onToggleCategory?.(item.id)}
                  className={`flex items-center gap-2 text-xs whitespace-nowrap w-full text-left transition-opacity ${hidden ? "opacity-30" : ""} ${onToggleCategory ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
                >
                  {item.shape === "square" && (
                    <span className="w-4 h-3 rounded-sm border" style={{ backgroundColor: color + "80", borderColor: color }} />
                  )}
                  {item.shape === "circle" && (
                    <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: color + "80", borderColor: color }} />
                  )}
                  {item.shape === "line" && (
                    <span className="w-4 h-0 border-t-2" style={{ borderColor: color }} />
                  )}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {t(item.key)}
                  </span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
