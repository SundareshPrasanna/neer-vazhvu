"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import dynamic from "next/dynamic";
import { getRichBody } from "@/lib/water-bodies/rich-body-registry";
import { RichBodyTimelineSlider } from "./rich-body-timeline-slider";

interface ChipManifestShape {
  chip_bbox_wsen: [number, number, number, number];
  chips: Array<{
    year: number;
    available: boolean;
    sensor?: string;
    scene_count?: number;
    url?: string;
  }>;
}

const RichBodyMap = dynamic(
  () => import("./rich-body-map").then((m) => m.RichBodyMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <span className="text-sm text-slate-500 dark:text-slate-400">Loading map…</span>
      </div>
    ),
  }
);

interface RichBodyOverlayProps {
  bodyId: string;
  onClose: () => void;
}

/**
 * Full-screen takeover for rich-data water bodies (Pallikaranai etc.).
 * Hosts an embedded map with TNSWA gazetted boundary + 1km NGT buffer +
 * cumulative water-loss / built-gain tints + year-selectable satellite
 * chip. Replaces the standard BottomSheet detail panel.
 */
export function RichBodyOverlay({ bodyId, onClose }: RichBodyOverlayProps) {
  const body = getRichBody(bodyId);
  const [manifest, setManifest] = useState<ChipManifestShape | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // When the manifest arrives, default the slider to the latest available year
  useEffect(() => {
    if (!manifest || selectedYear != null) return;
    const avail = manifest.chips.filter((c) => c.available).map((c) => c.year);
    if (avail.length) setSelectedYear(Math.max(...avail));
  }, [manifest, selectedYear]);

  if (!body) {
    return (
      <div className="fixed inset-0 z-[2000] bg-black/60 flex items-center justify-center">
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-md">
          <p className="text-sm">
            Rich-data body <code>{bodyId}</code> is not in the registry.
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-black/70 flex items-stretch">
      <div className="flex flex-col w-full md:max-w-[1100px] md:mx-auto md:my-4 md:rounded-xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-100 truncate">
              {body.name}
            </h2>
            {body.name_ta && (
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                {body.name_ta}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">
                Ramsar Site
              </span>
              {body.buffer_legal_basis && (
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                  NGT {body.buffer_metres! / 1000} km buffer
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-3 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Map area - takes the bulk of the viewport */}
        <div className="flex-1 min-h-0">
          <RichBodyMap
            body={body}
            year={selectedYear}
            onManifestLoaded={(m) => setManifest(m)}
          />
        </div>

        {/* Timeline slider - controls the year prop passed down to the map */}
        {manifest && selectedYear != null && (
          <RichBodyTimelineSlider
            chips={manifest.chips}
            year={selectedYear}
            onYearChange={setSelectedYear}
          />
        )}

        {/* Sources footnote */}
        <div className="px-4 md:px-6 py-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
          <span>
            Gazette: Tamil Nadu State Wetland Authority &middot;{" "}
            Encroachment indicator: Google Open Buildings v3 (2023) &middot;{" "}
            Water trend: JRC GSW v1.4 (1984-2021) &middot;{" "}
            Built trend: Dynamic World V1 (2016-2026)
          </span>
        </div>
      </div>
    </div>
  );
}
