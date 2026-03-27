"use client";

import { useMemo } from "react";
import { getBlockClassColor } from "@/types/groundwater";
import type { GWBlock } from "@/types/groundwater";
import { useLanguage } from "@/lib/i18n/context";

interface BlockDetailPanelProps {
  block: GWBlock;
  onClose: () => void;
}

export function BlockDetailPanel({ block, onClose }: BlockDetailPanelProps) {
  const { t } = useLanguage();
  const { latest, history } = block;

  const classKey = latest.class.toLowerCase().replace(/ /g, "_");
  const classLabel = t(`gw_block.${classKey}`) || latest.class;
  const color = getBlockClassColor(latest.class);

  // Chart: bar chart of development % over years
  const maxDev = useMemo(() => Math.max(...history.map((h) => h.development_pct), 100), [history]);
  const barMax = Math.ceil(maxDev / 50) * 50; // Round up to nearest 50

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {block.name}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm font-medium" style={{ color }}>
              {classLabel}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl leading-none"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      {/* Key metrics */}
      <div className="px-4 py-3 grid grid-cols-2 gap-3 border-b border-slate-200 dark:border-slate-700">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("gw_block.development")}</div>
          <div className="text-lg font-bold font-mono" style={{ color }}>
            {latest.development_pct}%
          </div>
        </div>
        {latest.availability_ham != null && (
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t("gw_block.availability")}</div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
              {latest.availability_ham.toLocaleString()} <span className="text-xs font-normal text-slate-400">{t("gw_block.ham")}</span>
            </div>
          </div>
        )}
        {latest.draft_total_ham != null && (
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t("gw_block.draft")}</div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
              {latest.draft_total_ham.toLocaleString()} <span className="text-xs font-normal text-slate-400">{t("gw_block.ham")}</span>
            </div>
          </div>
        )}
      </div>

      {/* Trend chart - horizontal bar chart */}
      <div className="px-4 py-3 flex-1">
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
          {t("gw_block.trend")}
        </h4>
        <div className="space-y-2">
          {history.map((h) => {
            const pct = (h.development_pct / barMax) * 100;
            const barColor = getBlockClassColor(h.class);
            return (
              <div key={h.year} className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-10 shrink-0">
                  {h.year}
                </span>
                <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden relative">
                  <div
                    className="h-full rounded transition-all"
                    style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
                  />
                  {/* 100% threshold line */}
                  <div
                    className="absolute top-0 bottom-0 border-l-2 border-dashed border-slate-400 dark:border-slate-500"
                    style={{ left: `${(100 / barMax) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono font-bold w-14 text-right shrink-0" style={{ color: barColor }}>
                  {h.development_pct}%
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
          <span className="border-l-2 border-dashed border-slate-400 dark:border-slate-500 h-3 inline-block" />
          <span>100% = extraction equals recharge</span>
        </div>
      </div>

      {/* Note */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700">
        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
          {t("gw_block.cgwb_note")}
        </p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
          {t("gw_page.source_cgwb")}
        </p>
      </div>
    </div>
  );
}
