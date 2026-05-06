"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { UnifiedDetailPanel } from "@/components/water-bodies/unified-detail-panel";
import { UnifiedLegend } from "@/components/water-bodies/unified-legend";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { MapInfoButton } from "@/components/map/map-info-button";
import { useLanguage } from "@/lib/i18n/context";
import { useLockBodyScroll } from "@/lib/hooks/use-lock-body-scroll";
import type { SelectedWaterBody } from "@/types/water-bodies";
import type { RestorationPriorityData } from "@/types/restoration";

interface ClientProps {
  cityId: string;
  cityDisplayName: string;
  cityState: string;
  mapCenter: [number, number];
  mapZoom?: number;
  /** Stats bar values from the server; nulls render as dashes. */
  fullyLostCount: number;
  reducedCount: number;
  namedOsmCount: number | null;
}

function MapLoading() {
  const { t } = useLanguage();
  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <span className="text-slate-500 dark:text-slate-400">{t("wb.loading")}</span>
    </div>
  );
}

const UnifiedMap = dynamic(
  () => import("@/components/water-bodies/unified-map").then((m) => m.UnifiedMap),
  { ssr: false, loading: () => <MapLoading /> },
);

export default function WaterBodiesMapClient({
  cityId,
  cityDisplayName,
  cityState,
  mapCenter,
  mapZoom = 11,
  fullyLostCount,
  reducedCount,
  namedOsmCount,
}: ClientProps) {
  useLockBodyScroll();
  const [selected, setSelected] = useState<SelectedWaterBody | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [restorationData, setRestorationData] = useState<RestorationPriorityData | null>(null);

  // Load this city's restoration-priority JSON. Chennai's /water-bodies
  // page does the same; the JSON now conforms to the shared
  // RestorationPriorityData shape across cities.
  useEffect(() => {
    fetch(`/data/restoration-priority-${cityId}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<RestorationPriorityData>) : null))
      .then((data) => setRestorationData(data))
      .catch(() => setRestorationData(null));
  }, [cityId]);

  // Look up the score row for the selected water body so the detail
  // panel can render the priority badge + component breakdown +
  // rationale (mirrors Chennai's pattern).
  const selectedRestoration = useMemo(() => {
    if (!selected || !restorationData) return null;
    if (selected.kind === "current") {
      const osmId = selected.props.osm_id;
      return restorationData.water_bodies.find((w) => w.osm_id === osmId) ?? null;
    }
    return null;
  }, [selected, restorationData]);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Stats bar - mirror of Chennai's water-bodies header strip */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {cityDisplayName} · {cityState}
        </span>
        {namedOsmCount !== null && (
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
            <span className="w-3 h-3 rounded-sm bg-blue-500 opacity-70" />
            <span className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-slate-100">{namedOsmCount}</span> named bodies on OSM
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
          <span className="w-3 h-3 rounded-sm bg-red-500 opacity-70" />
          <span className="text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{fullyLostCount}</span> fully lost
          </span>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
          <span className="w-3 h-3 rounded-sm bg-orange-500 opacity-70" />
          <span className="text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{reducedCount}</span> at risk
          </span>
        </div>
      </div>

      {/* Map + sidebar layout - identical to Chennai's water-bodies page */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="relative flex-1 h-full">
          <UnifiedMap
            viewMode="water-bodies"
            scoredData={restorationData?.water_bodies ?? []}
            censusData={[]}
            onSelectCurrent={setSelected}
            onSelectLost={setSelected}
            hiddenCategories={hiddenCategories}
            currentGeoJsonUrl={`/geojson/${cityId}-water-bodies-current.geojson`}
            lostGeoJsonUrl={`/geojson/${cityId}-water-bodies-lost.geojson`}
            riversGeoJsonUrl={`/geojson/${cityId}-rivers.geojson`}
            mapCenter={mapCenter}
            mapZoom={mapZoom}
          />

          {/* Legend overlay */}
          <div
            className={`absolute sm:bottom-4 z-[1000] transition-[bottom] duration-300 left-2 right-auto md:left-auto md:right-4 ${
              selected ? "bottom-[148px] md:bottom-4" : "bottom-2"
            }`}
          >
            <UnifiedLegend
              viewMode="water-bodies"
              hiddenCategories={hiddenCategories}
              onToggleCategory={(cat) =>
                setHiddenCategories((prev) => {
                  const next = new Set(prev);
                  if (next.has(cat)) next.delete(cat);
                  else next.add(cat);
                  return next;
                })
              }
            />
          </div>

          {/* Map info button - sources */}
          <MapInfoButton className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000]">
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <div>
                Polygons from <span className="font-semibold text-slate-700 dark:text-slate-300">OpenStreetMap</span>
              </div>
              <div>
                Lost-tank narrative from <span className="font-semibold text-slate-700 dark:text-slate-300">Vencatesan academic inventory</span>
              </div>
            </div>
          </MapInfoButton>
        </div>

        {/* BottomSheet renders as desktop sidebar / mobile fixed-bottom. MUST
            be a sibling of the map div (not nested inside it) so the desktop
            sidebar layout works inside the parent flex flex-row container. */}
        {selected && (
          <BottomSheet onClose={() => setSelected(null)}>
            <UnifiedDetailPanel
              selected={selected}
              restorationData={selectedRestoration}
              onClose={() => setSelected(null)}
            />
          </BottomSheet>
        )}
      </div>
    </div>
  );
}
