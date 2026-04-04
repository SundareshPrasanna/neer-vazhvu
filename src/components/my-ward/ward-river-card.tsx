"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { WardProfile } from "@/lib/hooks/use-ward-profile";

interface Props {
  wardNumber: number;
  profile: WardProfile;
  getRiverLabel: (riverId: string | null, stationId: string | null) => { river: string; station: string } | null;
}

export function WardRiverCard({ wardNumber, profile, getRiverLabel }: Props) {
  const { t } = useLanguage();
  const rivers = profile.rivers;

  const label = getRiverLabel(rivers.nearest_river_id, rivers.nearest_station_id);

  if (!label || !rivers.nearest_river_id) {
    return null;
  }

  const riverLink = rivers.nearest_station_id
    ? `/rivers?river=${rivers.nearest_river_id}&station=${rivers.nearest_station_id}`
    : `/rivers?river=${rivers.nearest_river_id}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {t("my_ward.nearest_river")}
          </h2>
          <Link
            href={riverLink}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline print:hidden"
          >
            {t("my_ward.view_quality")} &rarr;
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{label.river}</p>
            {label.station && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("my_ward.monitoring_station")}: {label.station}
              </p>
            )}
          </div>
          {rivers.nearest_km != null && (
            <div className="text-right">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {rivers.nearest_km}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">km</span>
            </div>
          )}
        </div>

        {/* Source & notes */}
        <div className="text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-2">
          <p>{t("my_ward.river_source")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
