"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { UnifiedDetailPanel } from "@/components/water-bodies/unified-detail-panel";
import { UnifiedLegend } from "@/components/water-bodies/unified-legend";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { useLanguage } from "@/lib/i18n/context";
import type { SelectedWaterBody } from "@/types/water-bodies";

interface ClientProps {
  cityId: string;
  cityDisplayName: string;
  mapCenter: [number, number];
  mapZoom?: number;
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
  mapCenter,
  mapZoom = 11,
}: ClientProps) {
  const [selected, setSelected] = useState<SelectedWaterBody | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  return (
    <div className="relative w-full h-[60vh] sm:h-[65vh] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
      <UnifiedMap
        viewMode="water-bodies"
        scoredData={[]}
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

      {/* Legend overlay - bottom-right on desktop, top-left on mobile */}
      <div
        className={`absolute z-[1000] transition-[bottom] duration-300 left-2 right-auto md:left-auto md:right-4 ${
          selected ? "bottom-[148px] md:bottom-4" : "bottom-2 md:bottom-4"
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

      {/* Place pill - top-left */}
      <div className="absolute top-2 left-2 z-[1000] bg-white/90 dark:bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-300">{cityDisplayName}</span>
        <span className="text-slate-500 dark:text-slate-400 ml-1">water bodies</span>
      </div>

      {/* Detail panel via BottomSheet */}
      {selected && (
        <BottomSheet onClose={() => setSelected(null)}>
          <UnifiedDetailPanel
            selected={selected}
            restorationData={null}
            onClose={() => setSelected(null)}
          />
        </BottomSheet>
      )}
    </div>
  );
}
