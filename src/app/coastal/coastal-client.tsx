"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { MapInfoButton } from "@/components/map/map-info-button";
import { CoastalLegend } from "@/components/coastal/coastal-legend";
import { CoastalDetailPanel } from "@/components/coastal/coastal-detail-panel";
import { useLockBodyScroll } from "@/lib/hooks/use-lock-body-scroll";
import type { SelectedCoastal, CoastalViewMode } from "@/types/coastal";

function MapLoading() {
  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <span className="text-slate-500 dark:text-slate-400">Loading map…</span>
    </div>
  );
}

const CoastalMap = dynamic(
  () => import("@/components/coastal/coastal-map").then((m) => m.CoastalMap),
  { ssr: false, loading: () => <MapLoading /> },
);

function ModeToggle({
  mode,
  onChange,
}: {
  mode: CoastalViewMode;
  onChange: (m: CoastalViewMode) => void;
}) {
  const opts: { id: CoastalViewMode; label: string }[] = [
    { id: "zones", label: "Study zones" },
    { id: "transects", label: "Our transects" },
  ];
  return (
    <div className="inline-flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden text-xs">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-2.5 py-1 ${
            mode === o.id
              ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
              : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function CoastalClient() {
  useLockBodyScroll();
  const [selected, setSelected] = useState<SelectedCoastal | null>(null);
  const [mode, setMode] = useState<CoastalViewMode>("zones");

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Stats / context bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
          Chennai coast · 1990-2024
        </span>
        {mode === "zones" ? (
          <>
            <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
              <span className="w-3 h-3 rounded-sm bg-red-600 opacity-80" />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-900 dark:text-slate-100">58.65%</span> of 86 km eroding
              </span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Ennore <span className="font-semibold text-slate-900 dark:text-slate-100">-21.3</span> · Kattupalli{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-100">-16</span> m/yr down-drift
              </span>
            </div>
          </>
        ) : (
          <span className="text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-100">895</span> transects we computed
            from satellite imagery · click any point for its rate
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <ModeToggle mode={mode} onChange={(m) => { setMode(m); setSelected(null); }} />
          <Link
            href="/facts#bucket-coastal"
            className="text-xs text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap"
          >
            Coastal facts →
          </Link>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="relative flex-1 h-full">
          <CoastalMap mode={mode} selected={selected} onSelect={setSelected} />

          {/* Legend overlay */}
          <div
            className={`absolute z-[1000] transition-[bottom] duration-300 left-2 right-auto md:left-auto md:right-4 ${
              selected ? "bottom-[148px] md:bottom-4" : "bottom-2 md:bottom-4"
            }`}
          >
            <CoastalLegend mode={mode} />
          </div>

          {/* Sources / honesty note */}
          <MapInfoButton className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000]">
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 max-w-xs">
              <div>
                Shoreline-change study:{" "}
                <a
                  href="https://www.sciencedirect.com/science/article/pii/S2667010026001083"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-slate-700 dark:text-slate-300 underline"
                >
                  Anagha, Singh &amp; Frappart (2026), Environmental Challenges
                </a>
                .
              </div>
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Study zones</span> show the
                paper&apos;s published per-zone rates over the OSM coastline.{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">Our transects</span> are
                neervazhvu&apos;s own measurement (MNDWI on Landsat + Sentinel-2 via Google Earth Engine, 8
                epochs) - independent of the paper&apos;s CoastSat + DSAS. The spatial pattern matches; absolute
                rates differ by method.
              </div>
            </div>
          </MapInfoButton>
        </div>

        {selected ? (
          <BottomSheet onClose={() => setSelected(null)}>
            <CoastalDetailPanel selected={selected} onClose={() => setSelected(null)} />
          </BottomSheet>
        ) : null}
      </div>
    </div>
  );
}
