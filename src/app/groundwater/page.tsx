"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { WardDetailPanel } from "@/components/groundwater/ward-detail-panel";
import { BlockDetailPanel } from "@/components/groundwater/block-detail-panel";
import { GroundwaterLegend } from "@/components/groundwater/legend";
import type {
  GroundwaterWard,
  GroundwaterApiResponse,
  WardRiskData,
  RiskApiResponse,
  ViewMode,
  GWBlock,
} from "@/types/groundwater";
import { useLanguage } from "@/lib/i18n/context";

function GroundwaterMapLoading() {
  const { t } = useLanguage();
  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <span className="text-slate-500 dark:text-slate-400">{t("gw_page.loading_map")}</span>
    </div>
  );
}

// Leaflet must be loaded client-side only (no SSR)
const WardMap = dynamic(() => import("@/components/groundwater/ward-map").then((m) => m.WardMap), {
  ssr: false,
  loading: () => <GroundwaterMapLoading />,
});

export default function GroundwaterPage() {
  return (
    <Suspense>
      <GroundwaterPageContent />
    </Suspense>
  );
}

function GroundwaterPageContent() {
  const { t, language } = useLanguage();
  const locale = language === "ta" ? "ta-IN" : "en-IN";
  const searchParams = useSearchParams();

  const [data, setData] = useState<GroundwaterApiResponse | null>(null);
  const [riskApiData, setRiskApiData] = useState<RiskApiResponse | null>(null);
  const [blocks, setBlocks] = useState<GWBlock[]>([]);
  const [selectedWard, setSelectedWard] = useState<GroundwaterWard | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<GWBlock | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get("view") as ViewMode) || "depth"
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const wardParam = searchParams.get("ward");

    Promise.all([
      fetch("/api/groundwater").then((r) => r.json()),
      fetch("/api/groundwater/risk").then((r) => r.json()),
      fetch("/data/gwr-blocks.json").then((r) => r.json()),
    ])
      .then(([gw, risk, gwrBlocks]: [GroundwaterApiResponse, RiskApiResponse, { blocks: GWBlock[] }]) => {
        setData(gw);
        setRiskApiData(risk);
        setBlocks(gwrBlocks.blocks ?? []);
        setLoading(false);

        // Deep link: pre-select ward from ?ward= param
        if (wardParam && gw.wards) {
          const wardNum = parseInt(wardParam, 10);
          const targetWard = gw.wards.find((w) => w.wardNumber === wardNum);
          if (targetWard) {
            setSelectedWard(targetWard);
            return;
          }
        }

        // Default: pre-select the ward with deepest water level
        if (gw.wards && gw.wards.length > 0) {
          const deepest = [...gw.wards].sort((a, b) => (b.depthM ?? 0) - (a.depthM ?? 0))[0];
          if (deepest) setSelectedWard(deepest);
        }
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <span className="text-slate-500 dark:text-slate-400">{t("gw_page.loading_data")}</span>
      </div>
    );
  }

  if (!data || !data.wards || data.wards.length === 0) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center text-slate-500 dark:text-slate-400">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{t("gw_page.title")}</h1>
          <p>{t("gw_page.no_data")}</p>
          <p className="text-sm mt-2 font-mono bg-slate-100 dark:bg-slate-800 inline-block px-3 py-1 rounded">
            npx tsx scripts/seed-opencity-groundwater.ts
          </p>
        </div>
      </div>
    );
  }

  const wardMap = new Map<number, GroundwaterWard>();
  for (const w of data.wards) {
    wardMap.set(w.wardNumber, w);
  }

  const riskMap = new Map<number, WardRiskData>();
  for (const r of riskApiData?.wards ?? []) {
    riskMap.set(r.wardNumber, r);
  }

  const selectedRisk = selectedWard ? riskMap.get(selectedWard.wardNumber) : undefined;
  const hasRiskData = riskMap.size > 0;

  // Calculate how stale the data is
  const dataDate = new Date(data.period.year, data.period.month - 1);
  const now = new Date();
  const monthsStale = (now.getFullYear() - dataDate.getFullYear()) * 12 + (now.getMonth() - dataDate.getMonth());
  const isStale = monthsStale > 6;

  const stressedCount = data.summary.stressed + data.summary.critical + data.summary.crisis;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Context bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-6 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {viewMode === "exploitation"
            ? t("gw_page.source_cgwb")
            : t("context.gw_stress")
                .replace("{stressedCount}", String(stressedCount))
                .replace("{avg}", String(data.cityAverage ?? "-"))
          }
        </span>
        {viewMode === "risk" && (
          <span className="text-slate-400 dark:text-slate-500 text-xs hidden sm:inline">
            {t("context.gw_risk_explain")}
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      {/* Map area */}
      <div className={`relative flex-1 ${(selectedWard || selectedBlock) ? "h-[55vh] md:h-full" : "h-full"}`}>
        <WardMap
          groundwaterData={wardMap}
          riskData={riskMap}
          viewMode={viewMode}
          onWardSelect={(w) => { setSelectedWard(w); setSelectedBlock(null); }}
          onBlockSelect={(b) => { setSelectedBlock(b); setSelectedWard(null); }}
        />

        {/* Legend overlay */}
        <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 z-[1000]">
          <GroundwaterLegend viewMode={viewMode} />
        </div>

        {/* Period + source overlay */}
        <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000] bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
          {viewMode === "exploitation" ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t("gw_page.source_cgwb")}
            </div>
          ) : (
            <>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t("gw_page.showing_for")}{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {new Date(data.period.year, data.period.month - 1).toLocaleDateString(locale, {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              {data.cityAverage !== null && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t("gw_page.city_avg")} <span className="font-semibold">{data.cityAverage}m</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Staleness warning - only for ward views */}
        {isStale && viewMode !== "exploitation" && (
          <div className="absolute top-16 left-2 sm:top-20 sm:left-4 z-[1000] max-w-sm">
            <div className="px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 shadow-lg">
              <span className="font-semibold">{t("gw_snap.stale_title")}</span>{" "}
              {t("gw_snap.stale_msg")
                .replace("{date}", `${dataDate.toLocaleString("default", { month: "short" })} ${data.period.year}`)
                .replace("{source}", "OpenCity / CMWSSB")}
            </div>
          </div>
        )}

        {/* View mode toggle */}
        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-[1000]">
          <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 shadow-md text-xs font-medium">
            <button
              onClick={() => {
                setViewMode("depth");
                setSelectedBlock(null);
                // Re-select deepest ward
                if (data && data.wards.length > 0) {
                  const deepest = [...data.wards].sort((a, b) => (b.depthM ?? 0) - (a.depthM ?? 0))[0];
                  if (deepest) setSelectedWard(deepest);
                }
              }}
              className={`px-3 py-1.5 transition-colors ${
                viewMode === "depth"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              {t("gw_page.depth_toggle")}
            </button>
            {hasRiskData && (
              <button
                onClick={() => {
                  setViewMode("risk");
                  setSelectedBlock(null);
                  // Re-select deepest ward for risk view
                  if (data && data.wards.length > 0) {
                    const deepest = [...data.wards].sort((a, b) => (b.depthM ?? 0) - (a.depthM ?? 0))[0];
                    if (deepest) setSelectedWard(deepest);
                  }
                }}
                className={`px-3 py-1.5 transition-colors border-l border-slate-200 dark:border-slate-600 ${
                  viewMode === "risk"
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                {t("gw_page.risk_toggle")}
              </button>
            )}
            <button
              onClick={() => {
                setViewMode("exploitation");
                setSelectedWard(null);
                // Pre-select most over-exploited block
                if (blocks.length > 0) {
                  const mostExploited = [...blocks].sort((a, b) => b.latest.development_pct - a.latest.development_pct)[0];
                  if (mostExploited) setSelectedBlock(mostExploited);
                }
              }}
              className={`px-3 py-1.5 transition-colors border-l border-slate-200 dark:border-slate-600 ${
                viewMode === "exploitation"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              {t("gw_page.exploit_toggle")}
            </button>
          </div>
        </div>
      </div>

      {/* Detail panel - bottom sheet on mobile, sidebar on desktop */}
      {selectedWard && (
        <div className="h-[45vh] md:h-full md:w-80 lg:w-96 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700">
          <WardDetailPanel
            ward={selectedWard}
            riskData={selectedRisk}
            onClose={() => setSelectedWard(null)}
          />
        </div>
      )}
      {selectedBlock && (
        <div className="h-[45vh] md:h-full md:w-80 lg:w-96 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700">
          <BlockDetailPanel
            block={selectedBlock}
            onClose={() => setSelectedBlock(null)}
          />
        </div>
      )}
      </div>
    </div>
  );
}
