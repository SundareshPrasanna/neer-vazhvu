"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWardProfile } from "@/lib/hooks/use-ward-profile";
import { useLanguage } from "@/lib/i18n/context";

interface WardContextProps {
  wardNumber: number;
  /** Pre-loaded groundwater data. When provided, skips the API fetch. */
  groundwater?: { depthM: number; trend: string; riskLevel: string };
  /** When true, hides groundwater row entirely and skips fetch. */
  hideGroundwater?: boolean;
}

interface GWData {
  depthM: number | null;
  trend: string;
  riskLevel: string;
}

const RISK_BADGE_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function WardContext({ wardNumber, groundwater, hideGroundwater }: WardContextProps) {
  const { t } = useLanguage();
  const { profile, getRiverLabel } = useWardProfile(wardNumber);
  const [gw, setGW] = useState<GWData | null>(groundwater ?? null);

  // Fetch groundwater data only when not provided via props and not hidden
  useEffect(() => {
    if (groundwater || hideGroundwater) return;
    let cancelled = false;
    fetch(`/api/groundwater/ward?ward=${wardNumber}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setGW({ depthM: d.depthM, trend: d.trend, riskLevel: d.riskLevel });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [wardNumber, groundwater, hideGroundwater]);

  if (!profile) return null;

  const riverLabel = getRiverLabel(
    profile.rivers.nearest_river_id,
    profile.rivers.nearest_station_id
  );

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-3">
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
        {t("ward_ctx.title")} - {t("ward.ward")} {wardNumber}
      </h4>
      <div className="space-y-1.5">
        {/* Groundwater */}
        {!hideGroundwater && gw && gw.depthM != null && (
          <ContextRow
            href={`/groundwater?ward=${wardNumber}`}
            label={t("ward_ctx.groundwater")}
            value={`${gw.depthM.toFixed(1)}m, ${t(`ward_ctx.trend_${gw.trend}`)}`}
            badge={gw.riskLevel !== "noData" ? gw.riskLevel : undefined}
          />
        )}

        {/* Water bodies */}
        {profile.water_bodies.current_count > 0 && (
          <ContextRow
            href={`/water-bodies?mode=restoration&ward=${wardNumber}`}
            label={t("ward_ctx.water_bodies")}
            value={
              profile.water_bodies.restoration_critical > 0
                ? t("ward_ctx.wb_with_critical")
                    .replace("{count}", String(profile.water_bodies.current_count))
                    .replace("{critical}", String(profile.water_bodies.restoration_critical))
                : t("ward_ctx.wb_count").replace("{count}", String(profile.water_bodies.current_count))
            }
          />
        )}

        {/* Flood - skip when ward profile has no flood data layer for this city */}
        {!("_data_status" in profile.flood) && profile.flood.dominant_hazard && (
          <ContextRow
            href={`/flood-risk?ward=${wardNumber}`}
            label={t("ward_ctx.flood")}
            value={t("ward_ctx.dominant_hazard").replace("{level}", t(`flood.${profile.flood.dominant_hazard}`))}
          />
        )}

        {/* River */}
        {riverLabel && profile.rivers.nearest_station_id && (
          <ContextRow
            href={`/rivers?river=${profile.rivers.nearest_river_id}&station=${profile.rivers.nearest_station_id}`}
            label={t("ward_ctx.river")}
            value={
              profile.rivers.nearest_km != null
                ? `${riverLabel.station || riverLabel.river} (${profile.rivers.nearest_km} km)`
                : riverLabel.station || riverLabel.river
            }
          />
        )}

        {/* Drainage - skip when ward profile has no drainage layer for this city */}
        {!("_data_status" in profile.drainage) && profile.drainage.line_count > 0 && (
          <ContextRow
            href={`/flood-risk?ward=${wardNumber}&view=drainage`}
            label={t("ward_ctx.drainage")}
            value={t("ward_ctx.drain_count").replace("{count}", String(profile.drainage.line_count))}
          />
        )}
      </div>
    </div>
  );
}

function ContextRow({
  href,
  label,
  value,
  badge,
}: {
  href: string;
  label: string;
  value: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group text-sm"
    >
      <span className="text-slate-500 dark:text-slate-400 text-xs">{label}</span>
      <span className="flex items-center gap-1.5 text-right">
        <span className="text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 text-xs">
          {value}
        </span>
        {badge && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RISK_BADGE_COLORS[badge] ?? ""}`}>
            {badge}
          </span>
        )}
        <svg
          className="w-3 h-3 text-slate-300 dark:text-slate-600 group-hover:text-blue-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}
