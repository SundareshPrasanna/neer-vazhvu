"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ClimateRiskToggle } from "@/components/climate-risk/climate-risk-toggle";
import { ClimateRiskLegend } from "@/components/climate-risk/climate-risk-legend";
import { ClimateRiskDetailPanel } from "@/components/climate-risk/climate-risk-detail-panel";
import { CLIMATE_SUBTHEMES, type ClimateSubtheme, type SubBasinProperties } from "@/types/climate-risk";
import { useLanguage } from "@/lib/i18n/context";
import { useLockBodyScroll } from "@/lib/hooks/use-lock-body-scroll";
import { MapInfoButton } from "@/components/map/map-info-button";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { tryGetPlaceConfig } from "@/lib/cities";

function MapLoading() {
  const { t } = useLanguage();
  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <span className="text-slate-500 dark:text-slate-400">{t("climate.loading_map")}</span>
    </div>
  );
}

const ClimateRiskMap = dynamic(
  () => import("@/components/climate-risk/climate-risk-map").then((m) => m.ClimateRiskMap),
  { ssr: false, loading: () => <MapLoading /> }
);

export function ClimateRiskContent({ cityId }: { cityId: string }) {
  return (
    <Suspense>
      <ClimateRiskContentInner cityId={cityId} />
    </Suspense>
  );
}

function ClimateRiskContentInner({ cityId }: { cityId: string }) {
  useLockBodyScroll();
  const { t } = useLanguage();
  const searchParams = useSearchParams();

  const config = tryGetPlaceConfig(cityId);
  const available: ClimateSubtheme[] = CLIMATE_SUBTHEMES.filter(
    (s) => config?.climateRisk?.[s]
  );

  const subParam = searchParams.get("subtheme") as ClimateSubtheme | null;
  const [subtheme, setSubtheme] = useState<ClimateSubtheme>(
    subParam && available.includes(subParam) ? subParam : (available[0] ?? "risk")
  );
  const [selected, setSelected] = useState<SubBasinProperties | null>(null);
  const [hiddenClasses, setHiddenClasses] = useState<Set<string>>(new Set());

  const center: [number, number] | undefined = config
    ? [config.center.lat, config.center.lng]
    : undefined;
  const hasPanel = selected !== null;

  const handleSubtheme = (s: ClimateSubtheme) => {
    setSubtheme(s);
    setHiddenClasses(new Set());
    const params = new URLSearchParams(searchParams.toString());
    if (s === (available[0] ?? "risk")) params.delete("subtheme");
    else params.set("subtheme", s);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Context bar - the conclusion leads */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-6 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {t("climate.headline")}
        </span>
      </div>

      {/* Subtheme toggle */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between shrink-0">
        <ClimateRiskToggle value={subtheme} onChange={handleSubtheme} available={available} />
        <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:block">
          {t("climate.context")}
        </span>
      </div>

      {/* Map + panel */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="relative flex-1 h-full">
          <ClimateRiskMap
            cityId={cityId}
            center={center}
            subtheme={subtheme}
            onSelect={setSelected}
            hiddenClasses={hiddenClasses}
          />
          <div className={`absolute z-[1000] transition-[bottom] duration-300 left-2 right-auto md:left-auto md:right-4 ${hasPanel ? "bottom-[148px] md:bottom-4" : "bottom-2 sm:bottom-4"}`}>
            <ClimateRiskLegend
              hiddenClasses={hiddenClasses}
              onToggleClass={(cls) => setHiddenClasses((prev) => {
                const next = new Set(prev);
                if (next.has(cls)) next.delete(cls); else next.add(cls);
                return next;
              })}
            />
          </div>
          <MapInfoButton className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000]">
            <div className="text-xs text-slate-500 dark:text-slate-400 max-w-[280px] space-y-2">
              <div>{t("climate.source")}</div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] leading-relaxed">
                {t("climate.boundary_caveat")}
              </div>
            </div>
          </MapInfoButton>
        </div>

        {hasPanel && (
          <BottomSheet onClose={() => setSelected(null)}>
            <ClimateRiskDetailPanel
              selected={selected}
              subtheme={subtheme}
              onClose={() => setSelected(null)}
            />
          </BottomSheet>
        )}
      </div>
    </div>
  );
}
