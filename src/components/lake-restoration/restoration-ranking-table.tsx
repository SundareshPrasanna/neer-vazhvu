"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import type { ScoredWaterBody } from "@/types/restoration";
import { getPriorityColor } from "@/types/restoration";
import { useLanguage } from "@/lib/i18n/context";

interface RestorationRankingTableProps {
  data: ScoredWaterBody[];
  onSelect: (body: ScoredWaterBody) => void;
}

type SortField = "score" | "area" | "name";

function SortButton({
  field,
  label,
  active,
  onClick,
}: {
  field: SortField;
  label: string;
  active: boolean;
  onClick: (field: SortField) => void;
}) {
  return (
    <button
      onClick={() => onClick(field)}
      className={`text-xs px-2 py-1 rounded ${
        active
          ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium"
          : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );
}

export function RestorationRankingTable({ data, onSelect }: RestorationRankingTableProps) {
  const { t, language } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>("score");

  const sorted = useMemo(() => {
    const arr = [...data];
    switch (sortBy) {
      case "score":
        arr.sort((a, b) => b.priority_score - a.priority_score);
        break;
      case "area":
        arr.sort((a, b) => (b.area_ha ?? -1) - (a.area_ha ?? -1));
        break;
      case "name":
        arr.sort((a, b) => {
          const nameA = language === "ta" ? (a.name_ta || a.name) : a.name;
          const nameB = language === "ta" ? (b.name_ta || b.name) : b.name;
          return nameA.localeCompare(nameB);
        });
        break;
    }
    return arr;
  }, [data, sortBy, language]);

  // Show only critical + high by default, because in most cities that is the
  // actionable shortlist and the full register is long.
  //
  // But fall back to the whole list when that shortlist is EMPTY. Hyderabad
  // scores nothing critical or high - its worst body, Mir Alam Tank, sits at
  // 52 - so the default filter rendered an empty table reading "0 / 14
  // scored", which looks broken rather than like a city doing comparatively
  // well. A table that knows it has 14 rows must never show zero.
  const urgent = sorted.filter(
    (wb) => wb.priority_level === "critical" || wb.priority_level === "high",
  );
  const displayed = showAll || urgent.length === 0 ? sorted : urgent;

  const getName = (wb: ScoredWaterBody) => {
    if (language === "ta") {
      return wb.name_ta?.trim() || wb.name || t("lr.unnamed");
    }
    return wb.name || t("lr.unnamed");
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* Sort controls */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">Sort:</span>
        <SortButton field="score" label={t("lr.priority_score")} active={sortBy === "score"} onClick={setSortBy} />
        <SortButton field="area" label={t("lr.area_ha")} active={sortBy === "area"} onClick={setSortBy} />
        <SortButton field="name" label={t("lr.name")} active={sortBy === "name"} onClick={setSortBy} />
        <button
          onClick={() => setShowAll(!showAll)}
          className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showAll ? t("lr.show_top") : t("lr.show_all")}
        </button>
      </div>

      {/* Table - desktop / Cards - mobile */}
      <div className="flex-1 overflow-y-auto">
        {/* Desktop table */}
        <table className="w-full hidden sm:table">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <tr className="text-xs text-slate-500 dark:text-slate-400 uppercase">
              <th className="px-4 py-2 text-left w-12">{t("lr.rank")}</th>
              <th className="px-4 py-2 text-left">{t("lr.name")}</th>
              <th className="px-4 py-2 text-left w-20">{t("lr.type")}</th>
              <th className="px-4 py-2 text-right w-20">{t("lr.area_ha")}</th>
              <th className="px-4 py-2 text-right w-16">{t("lr.priority_score")}</th>
              <th className="px-4 py-2 text-center w-24">{t("lr.priority_level")}</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((wb, i) => {
              const color = getPriorityColor(wb.priority_level);
              return (
                <tr
                  key={wb.id}
                  onClick={() => onSelect(wb)}
                  className="border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <td className="px-4 py-2 text-sm text-slate-400 dark:text-slate-500 font-mono">
                    {i + 1}
                  </td>
                  <td className="px-4 py-2 text-sm text-slate-900 dark:text-slate-100 font-medium truncate max-w-[200px]">
                    {getName(wb)}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                    {wb.water_type}
                  </td>
                  <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 text-right font-mono tabular-nums">
                    {wb.area_ha != null ? wb.area_ha.toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-bold font-mono tabular-nums" style={{ color }}>
                    {wb.priority_score}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Badge style={{ backgroundColor: color, color: "white" }} className="text-xs">
                      {t(`lr.${wb.priority_level}`)}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {displayed.map((wb, i) => {
            const color = getPriorityColor(wb.priority_level);
            return (
              <div
                key={wb.id}
                onClick={() => onSelect(wb)}
                className="px-4 py-3 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">#{i + 1}</span>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {getName(wb)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {wb.water_type}{wb.area_ha != null ? ` - ${wb.area_ha.toLocaleString()} ha` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold font-mono tabular-nums" style={{ color }}>
                      {wb.priority_score}
                    </span>
                    <Badge style={{ backgroundColor: color, color: "white" }} className="text-xs">
                      {t(`lr.${wb.priority_level}`)}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400 dark:text-slate-500">
        {displayed.length} / {data.length} {t("lr.total_scored").toLowerCase()}
      </div>
    </div>
  );
}
