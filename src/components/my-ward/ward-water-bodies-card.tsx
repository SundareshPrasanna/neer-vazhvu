"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { WardProfile } from "@/lib/hooks/use-ward-profile";
import { useMyWardCity } from "./city-context";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

interface Props {
  wardNumber: number;
  profile: WardProfile;
}

export function WardWaterBodiesCard({ wardNumber, profile }: Props) {
  const { t } = useLanguage();
  const { cityPrefix } = useMyWardCity();
  const wb = profile.water_bodies;
  const lost = profile.lost_bodies;
  const total = wb.current_count;

  if (total === 0 && lost.count === 0) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {t("my_ward.water_bodies")}
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 dark:text-slate-500">{t("my_ward.no_water_bodies")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {t("my_ward.water_bodies")}
          </h2>
          <Link
            href={`${cityPrefix}/water-bodies?mode=restoration&ward=${wardNumber}`}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline print:hidden"
          >
            {t("my_ward.view_on_map")} &rarr;
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary stats */}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{total}</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {t("my_ward.wb_label")}
          </span>
        </div>

        {/* Restoration priority breakdown */}
        {(wb.restoration_critical > 0 || wb.restoration_high > 0) && (
          <div className="flex flex-wrap gap-2">
            {wb.restoration_critical > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS.critical}`}>
                {wb.restoration_critical} critical
              </span>
            )}
            {wb.restoration_high > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS.high}`}>
                {wb.restoration_high} high
              </span>
            )}
          </div>
        )}

        {/* Top bodies by priority */}
        {wb.top_bodies.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              {t("my_ward.top_priority")}
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              {t("my_ward.wb_score_explainer")}
            </p>
            {wb.top_bodies.slice(0, 3).map((body, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded text-xs"
              >
                <span className="text-slate-700 dark:text-slate-300 truncate mr-2">
                  {body.name || `Unnamed body #${i + 1}`}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-slate-500 dark:text-slate-400">{body.score}/100</span>
                  <span className={`px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[body.level] ?? ""}`}>
                    {body.level}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lost bodies */}
        {lost.count > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
              {t("my_ward.wb_lost").replace("{count}", String(lost.count))}
            </p>
            {lost.names.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lost.names.join(", ")}
              </p>
            )}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              {t("my_ward.wb_lost_note")}
            </p>
          </div>
        )}

        {/* Source attribution */}
        <div className="text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-2">
          <p>{t("my_ward.wb_source")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
