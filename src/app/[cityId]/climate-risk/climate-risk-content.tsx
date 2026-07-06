"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ClimateRiskPanel } from "@/components/climate-risk/climate-risk-panel";
import { ClimateRiskLegend } from "@/components/climate-risk/climate-risk-legend";
import { ClimateRiskDetailPanel } from "@/components/climate-risk/climate-risk-detail-panel";
import { ClimateRiskSummary } from "@/components/climate-risk/climate-risk-summary";
import { CLIMATE_CLASSES, CLIMATE_SUBTHEMES, type ClimateSubtheme, type SubBasinProperties } from "@/types/climate-risk";
import { useLanguage } from "@/lib/i18n/context";
import { useLockBodyScroll } from "@/lib/hooks/use-lock-body-scroll";
import { MapInfoButton } from "@/components/map/map-info-button";
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
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);

  // Content owns the fetch so the side-panel list and the map share one dataset.
  useEffect(() => {
    fetch(`/geojson/${cityId}-sub-basins-risk.geojson`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [cityId]);

  const subBasins = useMemo(
    () => (data?.features ?? []).map((f) => f.properties as SubBasinProperties),
    [data]
  );

  const center: [number, number] | undefined = config
    ? [config.center.lat, config.center.lng]
    : undefined;

  const handleSubtheme = (s: ClimateSubtheme) => {
    setSubtheme(s);
    setHiddenClasses(new Set());
    const params = new URLSearchParams(searchParams.toString());
    if (s === (available[0] ?? "risk")) params.delete("subtheme");
    else params.set("subtheme", s);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  // "Show the highest-risk sub-basins" CTA: switch to overall-risk + open the
  // top-ranked sub-basin's detail.
  const showHighest = () => {
    handleSubtheme("risk");
    const top = [...subBasins].sort(
      (a, b) => CLIMATE_CLASSES.indexOf(a.risk_class) - CLIMATE_CLASSES.indexOf(b.risk_class)
    )[0];
    if (top) setSelected(top);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">

      {/* Map (left) + control/detail panel (right) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="relative flex-1 min-h-[50vh] md:min-h-0 h-full">
          <ClimateRiskMap
            cityId={cityId}
            center={center}
            subtheme={subtheme}
            onSelect={setSelected}
            hiddenClasses={hiddenClasses}
            data={data}
          />
          <div className="absolute z-[1000] left-2 bottom-2 sm:left-4 sm:bottom-4">
            <ClimateRiskLegend
              hiddenClasses={hiddenClasses}
              onToggleClass={(cls) => setHiddenClasses((prev) => {
                const next = new Set(prev);
                if (next.has(cls)) next.delete(cls); else next.add(cls);
                return next;
              })}
            />
          </div>
          <MapInfoButton className="absolute top-20 left-2.5 z-[1000]">
            <div className="max-w-[300px] space-y-2.5">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {t("climate.info_title")}
              </div>
              <div className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {t("climate.source")}
              </div>
              <div className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {t("climate.source_boundaries")}
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                {t("climate.boundary_caveat")}
              </div>
            </div>
          </MapInfoButton>
          {subBasins.length > 0 && (
            <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-[1000]">
              <ClimateRiskSummary subBasins={subBasins} onShowHighest={showHighest} />
            </div>
          )}
        </div>

        {/* Right panel: subtheme sub-sections by default; sub-basin detail on select */}
        <aside className="w-full md:w-[330px] md:h-full overflow-y-auto bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 shrink-0">
          {selected ? (
            <ClimateRiskDetailPanel
              selected={selected}
              onClose={() => setSelected(null)}
            />
          ) : (
            <ClimateRiskPanel
              value={subtheme}
              onChange={handleSubtheme}
              available={available}
              subBasins={subBasins}
              onSelect={setSelected}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
