"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { RiverPanel } from "@/components/rivers/river-panel";
import { PollutionPanel } from "@/components/pollution/pollution-panel";
import { RiversLegend } from "@/components/rivers/rivers-legend";
import type { RiverQualityData, SelectedRiver } from "@/types/river-quality";
import { QUALITY_COLORS } from "@/types/river-quality";
import type { IndustrialPollutionData, PollutionSource } from "@/types/industrial-pollution";
import { useLanguage } from "@/lib/i18n/context";
import { useLockBodyScroll } from "@/lib/hooks/use-lock-body-scroll";
import { MapInfoButton } from "@/components/map/map-info-button";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { WardSearch } from "@/components/map/ward-search";
import type { WardProfile } from "@/lib/hooks/use-ward-profile";

function RiversMapLoading() {
  const { t } = useLanguage();
  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <span className="text-slate-500 dark:text-slate-400">{t("rivers_page.loading_map")}</span>
    </div>
  );
}

// Leaflet must be loaded client-side only (no SSR)
const CombinedRiversMap = dynamic(
  () =>
    import("@/components/rivers/combined-rivers-map").then(
      (m) => m.CombinedRiversMap
    ),
  {
    ssr: false,
    loading: () => <RiversMapLoading />,
  }
);

export default function RiversPage() {
  return (
    <Suspense>
      <RiversPageContent />
    </Suspense>
  );
}

function RiversPageContent() {
  useLockBodyScroll();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [qualityData, setQualityData] = useState<RiverQualityData | null>(null);
  const [pollutionData, setPollutionData] = useState<IndustrialPollutionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRiver, setSelectedRiver] = useState<SelectedRiver | null>(null);
  const [selectedSource, setSelectedSource] = useState<PollutionSource | null>(null);
  const [focusCenter, setFocusCenter] = useState<[number, number] | undefined>();
  const [wardProfiles, setWardProfiles] = useState<WardProfile[]>([]);

  useEffect(() => {
    const riverParam = searchParams.get("river");
    const stationParam = searchParams.get("station");

    Promise.all([
      fetch("/data/river-quality.json").then((r) => r.json()),
      fetch("/data/industrial-sources.json").then((r) => r.json()),
    ])
      .then(([quality, pollution]: [RiverQualityData, IndustrialPollutionData]) => {
        setQualityData(quality);
        setPollutionData(pollution);
        setLoading(false);

        // Deep link: pre-select river + station from ?river= and ?station= params
        if (riverParam) {
          const river = quality.rivers.find((r: { id: string }) => r.id === riverParam);
          if (river && river.stations.length > 0) {
            const station = stationParam
              ? river.stations.find((s: { id: string }) => s.id === stationParam) ?? river.stations[0]
              : river.stations[0];
            setSelectedRiver({ riverId: riverParam, stationId: station.id, latlng: [station.lat, station.lng] });
            return;
          }
        }

        // Default: pre-select Cooum (most polluted)
        const cooum = quality.rivers.find((r: { id: string }) => r.id === "cooum");
        if (cooum && cooum.stations.length > 0) {
          const s = cooum.stations[0];
          setSelectedRiver({ riverId: "cooum", stationId: s.id, latlng: [s.lat, s.lng] });
        }
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch ward profiles for search fly-to
  useEffect(() => {
    fetch("/data/ward-profiles.json")
      .then((r) => r.json())
      .then((profiles: WardProfile[]) => setWardProfiles(profiles))
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <span className="text-slate-500 dark:text-slate-400">
          {t("rivers_page.loading")}
        </span>
      </div>
    );
  }

  if (!qualityData || !pollutionData) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center text-slate-500 dark:text-slate-400">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {t("rivers_page.title")}
          </h1>
          <p>{t("rivers_page.no_data")}</p>
        </div>
      </div>
    );
  }

  const cooum = qualityData.rivers.find((r) => r.id === "cooum");
  const cooumLatestDO = cooum?.stations[0]?.readings.sort(
    (a, b) => b.year - a.year
  )[0]?.do_mgl;

  const hasPanel = selectedRiver !== null || selectedSource !== null;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-6 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {qualityData.rivers.length} {t("rivers_page.rivers")} · {pollutionData.sources.length} {t("rivers_page.poll_sources")}
        </span>
        {cooum && cooumLatestDO !== undefined && cooumLatestDO !== null && (
          <span className="text-slate-500 dark:text-slate-400">
            {t("rivers_page.cooum_do")}{" "}
            <span
              className="font-semibold"
              style={{ color: QUALITY_COLORS[cooum.overall_status] }}
            >
              ~{cooumLatestDO} mg/L
            </span>{" "}
            <span className="text-xs">{t("rivers_page.aquatic_note")}</span>
          </span>
        )}
        <span className="text-slate-400 dark:text-slate-500 text-xs hidden sm:inline">
          {t("context.rivers_recharge")}
        </span>
        <span className="text-slate-400 dark:text-slate-500 text-xs ml-auto whitespace-nowrap">
          {t("rivers_page.quality_data")} {qualityData.data_year_range[0]}-{qualityData.data_year_range[1]}
        </span>
      </div>

      {/* Map + panel area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map */}
        <div className="relative flex-1 h-full">
          <CombinedRiversMap
            qualityData={qualityData}
            pollutionData={pollutionData}
            selectedRiver={selectedRiver}
            onSelectRiver={(sel) => { setSelectedRiver(sel); setSelectedSource(null); }}
            onSelectSource={(source) => { setSelectedSource(source); setSelectedRiver(null); }}
            focusCenter={focusCenter}
          />

          {/* Legend overlay - shifts up on mobile when bottom sheet is open */}
          <div className={`absolute left-2 sm:bottom-4 sm:left-4 z-[1000] transition-[bottom] duration-300 ${hasPanel ? "bottom-[148px] md:bottom-4" : "bottom-2"}`}>
            <RiversLegend />
          </div>

          {/* Source note overlay */}
          <MapInfoButton className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000]">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t("rivers_page.quality_label")}{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {t("rivers_page.quality_value")}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t("rivers_page.sources_label")}{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {t("rivers_page.sources_value")}
              </span>
            </div>
          </MapInfoButton>
          <WardSearch
            className="absolute top-2 right-2 sm:top-4 sm:right-4 z-[1000]"
            onSelect={(wardNum) => {
              const profile = wardProfiles.find((p) => p.ward_number === wardNum);
              if (profile) setFocusCenter([profile.centroid[1], profile.centroid[0]]);
            }}
          />
        </div>

        {/* Detail panel - bottom sheet on mobile, sidebar on desktop */}
        {hasPanel && (
          <BottomSheet onClose={() => { setSelectedRiver(null); setSelectedSource(null); }}>
            {selectedRiver && (
              <RiverPanel
                key={`${selectedRiver.riverId}-${selectedRiver.stationId ?? ""}`}
                selected={selectedRiver}
                qualityData={qualityData}
                onClose={() => setSelectedRiver(null)}
              />
            )}
            {selectedSource && (
              <PollutionPanel
                source={selectedSource}
                data={pollutionData}
                onClose={() => setSelectedSource(null)}
              />
            )}
          </BottomSheet>
        )}
      </div>
    </div>
  );
}
