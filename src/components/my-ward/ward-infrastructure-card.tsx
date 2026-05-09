"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { WardProfile } from "@/lib/hooks/use-ward-profile";
import { isSectionUnavailable } from "@/lib/hooks/use-ward-profile";
import { useMyWardCity } from "./city-context";

interface Props {
  wardNumber: number;
  profile: WardProfile;
}

export function WardInfrastructureCard({ wardNumber, profile }: Props) {
  const { t } = useLanguage();
  const { cityPrefix } = useMyWardCity();
  const drain = profile.drainage;
  const sewer = profile.sewerage;

  // Both sections marked not_available - render an honest "data not yet
  // sourced" card. (For Madurai today: no public drainage / sewerage
  // GeoJSONs; tracked as RTI follow-up to MMC.)
  if (isSectionUnavailable(drain) && isSectionUnavailable(sewer)) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {t("my_ward.infrastructure")}
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ward-level drainage and sewerage data is not yet available for this city.
          </p>
          {drain._data_status_note && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {drain._data_status_note}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Mixed availability is unlikely today but defensible: if a section is
  // unavailable, treat its counts as zero for the hasData check.
  const drainHasData = !isSectionUnavailable(drain) && drain.line_count > 0;
  const sewerHasData =
    !isSectionUnavailable(sewer) &&
    (sewer.stp_count > 0 || sewer.sps_count > 0 || sewer.pumping_main_count > 0);
  const hasData = drainHasData || sewerHasData;

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {t("my_ward.infrastructure")}
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 dark:text-slate-500">{t("my_ward.no_infra_data")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
          {t("my_ward.infrastructure")}
        </h2>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Drainage */}
        {!isSectionUnavailable(drain) && drain.line_count > 0 && (
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{drain.line_count}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{t("my_ward.drainage_lines")}</span>
              </div>
            </div>
            <Link
              href={`${cityPrefix}/flood-risk?ward=${wardNumber}&view=drainage`}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline print:hidden"
            >
              {t("my_ward.view_on_map")} &rarr;
            </Link>
          </div>
        )}

        {/* Sewerage */}
        {!isSectionUnavailable(sewer) && (sewer.stp_count > 0 || sewer.sps_count > 0) && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                {t("my_ward.sewerage")}
              </h3>
              <Link
                href={`${cityPrefix}/flood-risk?ward=${wardNumber}&view=sewerage`}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline print:hidden"
              >
                {t("my_ward.view_on_map")} &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {sewer.stp_count > 0 && (
                <div className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    {sewer.stp_count} {t("my_ward.stps")}
                  </div>
                  {sewer.total_stp_capacity_mld > 0 && (
                    <div className="text-slate-500 dark:text-slate-400">
                      {sewer.total_stp_capacity_mld} MLD
                    </div>
                  )}
                </div>
              )}
              {sewer.sps_count > 0 && (
                <div className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    {sewer.sps_count} {t("my_ward.pumping_stations")}
                  </div>
                </div>
              )}
              {sewer.pumping_main_count > 0 && (
                <div className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    {sewer.pumping_main_count} {t("my_ward.pumping_mains")}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Source & notes */}
        <div className="text-[10px] text-slate-400 dark:text-slate-500 space-y-0.5 border-t border-slate-100 dark:border-slate-800 pt-2">
          {!isSectionUnavailable(sewer) && sewer.stp_count > 0 && <p>{t("my_ward.infra_stp_note")}</p>}
          <p>{t("my_ward.infra_source")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
