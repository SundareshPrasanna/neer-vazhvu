"use client";

// Chennai's richer rivers renderer, recovered from the pre-namespace flat
// `/rivers` route (commit 84eb20b). It is a genuinely different surface from
// the shared RiversClient: it overlays Cooum sewage inlets, industrial
// pollution sources with a category-toggle legend, a pollution detail panel,
// and ward search on top of the CPCB NWMP river-quality map. The shared
// RiversClient (Madurai / Bangalore) does NOT carry these layers, so this is
// recovered as a config-selected variant (see data-paths.ts `riversVariant`),
// not folded into the shared client.
//
// Data paths come from the data-paths helpers (no hardcoded chennai-* literals
// here); the map center/zoom and cityId are passed down from the shared page.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { RiverPanel } from "@/components/rivers/river-panel";
import { PollutionPanel } from "@/components/pollution/pollution-panel";
import { RiversLegend } from "@/components/rivers/rivers-legend";
import type { RiverQualityData, SelectedRiver } from "@/types/river-quality";
import { QUALITY_COLORS, isRiverId } from "@/types/river-quality";
import type { IndustrialPollutionData, PollutionSource } from "@/types/industrial-pollution";
import type { SewageInletData } from "@/components/rivers/combined-rivers-map";
import { useLanguage } from "@/lib/i18n/context";
import { useLockBodyScroll } from "@/lib/hooks/use-lock-body-scroll";
import { MapInfoButton } from "@/components/map/map-info-button";
import { computeRiverStatus } from "@/lib/utils/river-classification";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { WardSearch } from "@/components/map/ward-search";
import type { WardProfile } from "@/lib/hooks/use-ward-profile";
import {
  riverQualityUrl,
  industrialSourcesUrl,
  sewageInletsUrl,
  wardProfilesUrl,
} from "@/lib/cities/data-paths";
import { BasinAtlasClient } from "@/components/basin/basin-atlas-client";
import type { BasinFloor, BasinInventory, BasinManifest } from "@/lib/basins";

interface ChennaiRiversClientProps {
  cityId: string;
  cityDisplayName: string;
  mapCenter: [number, number];
  mapZoom?: number;
  /** Optional treatment-&-waste gaps atlas, opened from a button (not on
   *  river click, which keeps showing the CPCB quality panel). */
  basin?: { manifest: BasinManifest; inventory: BasinInventory | null } | null;
}

function RiversMapLoading() {
  const { t } = useLanguage();
  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <span className="text-slate-500 dark:text-slate-400">{t("rivers_page.loading_map")}</span>
    </div>
  );
}

// Leaflet must be loaded client-side only (no SSR)
// Shared with the standard rivers client so dismissing the drill-in hint in
// one place dismisses it everywhere.
const RIVERS_COACH_KEY = "rivers-drilldown-coach-dismissed";

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

export default function ChennaiRiversClient(props: ChennaiRiversClientProps) {
  return (
    <Suspense>
      <RiversPageContent {...props} />
    </Suspense>
  );
}

function RiversPageContent({ cityId, cityDisplayName, mapCenter, mapZoom, basin }: ChennaiRiversClientProps) {
  useLockBodyScroll();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [openBasin, setOpenBasin] = useState(false);
  const [atlasRiver, setAtlasRiver] = useState<string | null>(null);
  const [atlasFloor, setAtlasFloor] = useState<BasinFloor | undefined>(undefined);
  const [coachDismissed, setCoachDismissed] = useState(true);
  useEffect(() => { setCoachDismissed(localStorage.getItem(RIVERS_COACH_KEY) === "1"); }, []);
  const [qualityData, setQualityData] = useState<RiverQualityData | null>(null);
  const [pollutionData, setPollutionData] = useState<IndustrialPollutionData | null>(null);
  const [sewageInletData, setSewageInletData] = useState<SewageInletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRiver, setSelectedRiver] = useState<SelectedRiver | null>(null);
  const [selectedSource, setSelectedSource] = useState<PollutionSource | null>(null);
  const [focusCenter, setFocusCenter] = useState<[number, number] | undefined>();
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [wardProfiles, setWardProfiles] = useState<WardProfile[]>([]);

  useEffect(() => {
    const riverParam = searchParams.get("river");
    const stationParam = searchParams.get("station");
    const inletsUrl = sewageInletsUrl(cityId);

    Promise.all([
      fetch(riverQualityUrl(cityId)).then((r) => r.json()),
      fetch(industrialSourcesUrl(cityId)).then((r) => r.json()),
      inletsUrl
        ? fetch(inletsUrl).then((r) => r.json()).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([quality, pollution, inlets]: [RiverQualityData, IndustrialPollutionData, SewageInletData | null]) => {
        setQualityData(quality);
        setSewageInletData(inlets);
        setPollutionData(pollution);
        setLoading(false);

        // Deep link: pre-select river + station from ?river= and ?station= params
        if (riverParam && isRiverId(riverParam)) {
          const river = quality.rivers.find((r) => r.id === riverParam);
          if (river && river.stations.length > 0) {
            const station = stationParam
              ? river.stations.find((s: { id: string }) => s.id === stationParam) ?? river.stations[0]
              : river.stations[0];
            setSelectedRiver({ riverId: riverParam, stationId: station.id, latlng: [station.lat, station.lng] });
            setFocusCenter([station.lat, station.lng]);
            return;
          }
        }

        // No auto-selection: clicking a river opens the basin atlas (which
        // folds in the CPCB quality as monitoring points). The standalone
        // quality panel remains only as a deep-link fallback.
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId]);

  // Fetch ward profiles for search fly-to
  useEffect(() => {
    fetch(wardProfilesUrl(cityId))
      .then((r) => r.json())
      .then((profiles: WardProfile[]) => setWardProfiles(profiles))
      .catch(() => {});
  }, [cityId]);

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
  // Use worst (minimum) DO across all Cooum stations for the latest year
  const cooumLatestDO = cooum?.stations.reduce<number | undefined>((worst, station) => {
    const latest = [...station.readings].sort((a, b) => b.year - a.year)[0];
    if (latest?.do_mgl == null) return worst;
    return worst == null ? latest.do_mgl : Math.min(worst, latest.do_mgl);
  }, undefined);

  const hasPanel = selectedRiver !== null || selectedSource !== null;

  return (
    <div className="relative h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-6 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {qualityData.rivers.length} {t("rivers_page.rivers")} - {pollutionData.sources.length} {t("rivers_page.poll_sources")}
        </span>
        {cooum && cooumLatestDO !== undefined && cooumLatestDO !== null && (
          <span className="text-slate-500 dark:text-slate-400">
            {t("rivers_page.cooum_do")}{" "}
            <span
              className="font-semibold"
              style={{ color: QUALITY_COLORS[computeRiverStatus(cooum)] }}
            >
              ~{cooumLatestDO} mg/L
            </span>{" "}
            <span className="text-xs">{t("rivers_page.aquatic_note")}</span>
          </span>
        )}
        <span className="text-slate-400 dark:text-slate-500 text-xs hidden sm:inline">
          {t("context.rivers_recharge")}
        </span>
        <span className="text-slate-400 dark:text-slate-500 text-xs whitespace-nowrap">
          {t("rivers_page.quality_data")} {qualityData.data_year_range[0]}-{qualityData.data_year_range[1]}
        </span>
        {basin && (
          <button
            onClick={() => { setAtlasRiver(null); setAtlasFloor("governance"); setOpenBasin(true); }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-1 shadow-sm"
          >
            Treatment &amp; waste gaps
            <span aria-hidden>&rarr;</span>
          </button>
        )}
      </div>

      {/* Map + panel area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map */}
        <div className="relative flex-1 h-full">
          <CombinedRiversMap
            qualityData={qualityData}
            pollutionData={pollutionData}
            sewageInletData={sewageInletData}
            selectedRiver={selectedRiver}
            onSelectRiver={(sel) => {
              // Match the Arkavathi flow: clicking a river opens the basin
              // atlas at that river (CPCB quality is folded in as monitoring
              // points). Fall back to the quality panel only if no basin.
              if (basin && sel) { setAtlasRiver(sel.riverId); setAtlasFloor(undefined); setOpenBasin(true); }
              else { setSelectedRiver(sel); setSelectedSource(null); }
            }}
            onSelectSource={(source) => { setSelectedSource(source); setSelectedRiver(null); }}
            focusCenter={focusCenter}
            hiddenCategories={hiddenCategories}
            mapCenter={mapCenter}
            mapZoom={mapZoom}
          />

          {/* Drill-in hint: same affordance as the shared rivers client. */}
          {basin && !coachDismissed && !openBasin && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[600] max-w-[88%] sm:max-w-md bg-slate-900/95 text-white text-xs rounded-xl px-3.5 py-2 shadow-lg flex items-center gap-3">
              <span>Click on a river to drill into the basin - pollution, monitoring &amp; infrastructure</span>
              <button
                onClick={() => { localStorage.setItem(RIVERS_COACH_KEY, "1"); setCoachDismissed(true); }}
                className="shrink-0 text-slate-300 hover:text-white underline"
              >
                don&apos;t show again
              </button>
            </div>
          )}

          {/* Legend overlay - bottom-right on desktop (sea side), bottom-left on mobile; shifts up when bottom sheet is open */}
          <div className={`absolute sm:bottom-4 z-[1000] transition-[bottom] duration-300 left-2 right-auto md:left-auto md:right-4 ${hasPanel ? "bottom-[148px] md:bottom-4" : "bottom-2"}`}>
            <RiversLegend
              hiddenCategories={hiddenCategories}
              onToggleCategory={(cat) => setHiddenCategories((prev) => {
                const next = new Set(prev);
                if (next.has(cat)) next.delete(cat); else next.add(cat);
                return next;
              })}
            />
          </div>

          {/* Source note overlay */}
          <MapInfoButton className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000]">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t("rivers_page.quality_label")}{" "}
              <a
                href="https://cpcb.nic.in/nwmp-data-2024/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t("rivers_page.quality_value")}
              </a>
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
                key={selectedRiver.riverId}
                selected={selectedRiver}
                qualityData={qualityData}
                cityId={cityId}
                onClose={() => setSelectedRiver(null)}
                onStationChange={(stationId) => {
                  const river = qualityData.rivers.find((r) => r.id === selectedRiver.riverId);
                  const station = river?.stations.find((s) => s.id === stationId);
                  if (station) {
                    setSelectedRiver({ ...selectedRiver, stationId, latlng: [station.lat, station.lng] });
                  }
                }}
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

      {/* Treatment & waste gaps atlas - opened from the stats-bar button, not
          on river click (river click keeps the CPCB quality panel, so the two
          no longer compete). */}
      {basin && openBasin && (
        <div className="absolute inset-0 z-[1000] bg-white dark:bg-slate-950">
          <BasinAtlasClient
            cityId={cityId}
            cityDisplayName={cityDisplayName}
            manifest={basin.manifest}
            inventory={basin.inventory}
            initialRiverId={atlasRiver}
            initialFloor={atlasFloor}
            embedded
            onClose={() => { setOpenBasin(false); setAtlasRiver(null); }}
            renderFeatureDetail={({ family, props, onClose }) =>
              family === "monitoring-points" && qualityData && props.stationId ? (
                <RiverPanel
                  selected={{
                    riverId: String(props.river_id),
                    stationId: String(props.stationId),
                    latlng: [Number(props.lat), Number(props.lng)],
                  }}
                  qualityData={qualityData}
                  cityId={cityId}
                  onClose={onClose}
                />
              ) : null
            }
          />
        </div>
      )}
    </div>
  );
}
