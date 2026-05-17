"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { TimelineEvent } from "@/lib/water-bodies/rich-body-registry";

interface Chip {
  year: number;
  available: boolean;
  sensor?: string;
  scene_count?: number;
}

interface RichBodyTimelineSliderProps {
  chips: Chip[];
  year: number;
  onYearChange: (year: number) => void;
  events?: TimelineEvent[];
}

const ERA_COLORS: Record<string, string> = {
  landsat5: "#94a3b8",         // slate-400
  "landsat5+7": "#94a3b8",
  landsat7: "#a8b3c4",
  "landsat7+8": "#cbd5e1",     // slate-300
  sentinel2: "#7dd3fc",        // sky-300
};

const ERA_LABELS: Record<string, string> = {
  landsat5: "Landsat 5",
  "landsat5+7": "Landsat 5+7",
  landsat7: "Landsat 7",
  "landsat7+8": "Landsat 7+8",
  sentinel2: "Sentinel-2",
};

export function RichBodyTimelineSlider({
  chips,
  year,
  onYearChange,
  events = [],
}: RichBodyTimelineSliderProps) {
  const availableChips = useMemo(
    () => chips.filter((c) => c.available).sort((a, b) => a.year - b.year),
    [chips]
  );

  const [openEventYear, setOpenEventYear] = useState<number | null>(null);

  const minYear = availableChips[0]?.year ?? 1988;
  const maxYear = availableChips[availableChips.length - 1]?.year ?? 2026;
  const total = maxYear - minYear;

  // Only show events that fall within the slider range
  const visibleEvents = useMemo(
    () => events.filter((e) => e.year >= minYear && e.year <= maxYear),
    [events, minYear, maxYear]
  );

  const openEvent = visibleEvents.find((e) => e.year === openEventYear) ?? null;

  // Pick the chip metadata for the displayed year
  const currentChip = useMemo(
    () => availableChips.find((c) => c.year === year) ?? null,
    [availableChips, year]
  );

  // Snap any slider position to the nearest available year
  const snapToAvailable = (raw: number) => {
    let best = availableChips[0];
    let bestDist = Infinity;
    for (const c of availableChips) {
      const d = Math.abs(c.year - raw);
      if (d < bestDist) {
        best = c;
        bestDist = d;
      }
    }
    return best.year;
  };

  // Build era band: contiguous runs of the same sensor
  const eraSegments = useMemo(() => {
    const runs: Array<{ sensor: string; start: number; end: number }> = [];
    for (const c of availableChips) {
      const s = c.sensor ?? "unknown";
      const last = runs[runs.length - 1];
      if (last && last.sensor === s && c.year === last.end + 1) {
        last.end = c.year;
      } else {
        runs.push({ sensor: s, start: c.year, end: c.year });
      }
    }
    return runs;
  }, [availableChips]);

  return (
    <div className="px-4 md:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
      {/* Year + sensor readout */}
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {year}
          </span>
          {currentChip?.sensor && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {ERA_LABELS[currentChip.sensor] ?? currentChip.sensor}
              {currentChip.scene_count != null && (
                <> &middot; {currentChip.scene_count} scenes</>
              )}
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          {minYear} - {maxYear}
        </span>
      </div>

      {/* Event stamps - clickable markers above the slider rail */}
      {visibleEvents.length > 0 && (
        <div className="relative h-4 mb-0.5">
          {visibleEvents.map((event) => {
            const pct = total > 0 ? ((event.year - minYear) / total) * 100 : 50;
            return (
              <button
                key={event.year}
                onClick={() => {
                  setOpenEventYear(openEventYear === event.year ? null : event.year);
                  onYearChange(snapToAvailable(event.year));
                }}
                className="absolute -translate-x-1/2 group"
                style={{ left: `${pct}%`, top: 0 }}
                title={`${event.year}: ${event.label_short ?? event.label}`}
                aria-label={`Jump to ${event.year}`}
              >
                <span className="block w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-900 group-hover:scale-150 transition-transform" />
              </button>
            );
          })}
        </div>
      )}

      {/* Native range slider */}
      <input
        type="range"
        min={minYear}
        max={maxYear}
        step={1}
        value={year}
        onChange={(e) => onYearChange(snapToAvailable(parseInt(e.target.value, 10)))}
        className="w-full h-2 cursor-pointer accent-emerald-600"
        aria-label="Year"
      />

      {/* Inline event detail card - shown when a stamp was clicked */}
      {openEvent && (
        <div className="mt-2 p-2.5 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-xs text-slate-700 dark:text-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-amber-900 dark:text-amber-200">
                {openEvent.year}
              </div>
              <div className="mt-0.5">{openEvent.label}</div>
              {openEvent.source_url && (
                <a
                  href={openEvent.source_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 hover:underline"
                >
                  Source
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <button
              onClick={() => setOpenEventYear(null)}
              aria-label="Dismiss"
              className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 text-sm leading-none"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Era band */}
      <div className="mt-1.5 flex w-full h-1.5 overflow-hidden rounded-sm" aria-hidden>
        {eraSegments.map((seg, i) => {
          const span = seg.end - seg.start + 1;
          const flexBasis = total > 0 ? `${(span / (total + 1)) * 100}%` : "100%";
          return (
            <div
              key={i}
              style={{
                backgroundColor: ERA_COLORS[seg.sensor] ?? "#cbd5e1",
                flexBasis,
              }}
              title={`${ERA_LABELS[seg.sensor] ?? seg.sensor} (${seg.start}-${seg.end})`}
            />
          );
        })}
      </div>

      <div className="mt-1.5 flex justify-between text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
        <span>{minYear}</span>
        <span>{Math.round((minYear + maxYear) / 2)}</span>
        <span>{maxYear}</span>
      </div>
    </div>
  );
}
