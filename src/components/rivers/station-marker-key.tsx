"use client";

import { useState } from "react";

interface MarkerReading {
  has_readings: boolean;
  latest_bod: number | null;
  latest_do: number | null;
}

// The fills RiversLeafletMap gives a quality point. Keep the two in step.
const RED = "#dc2626";
const AMBER = "#d97706";
const GREEN = "#16a34a";
const GREY = "#94a3b8";

function Row({ fill, children }: { fill: string; children: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
      <span
        className="w-3 h-3 rounded-full border border-slate-900 flex-shrink-0"
        style={{ backgroundColor: fill, opacity: 0.85 }}
      />
      <span>{children}</span>
    </div>
  );
}

/**
 * Key to the colour of the river-quality points. A point is coloured by its
 * latest BOD, or by its latest DO where no BOD is published. The key shows only
 * where some point is coloured by DO, the case a reader cannot guess; a city
 * whose points all carry BOD renders as before. Open on desktop, folded on a
 * phone, where it would cover the city's points.
 */
export function StationMarkerKey({ stations }: { stations: MarkerReading[] }) {
  // null = the default for the screen size (CSS decides, so no hydration flash)
  const [open, setOpen] = useState<boolean | null>(null);
  const byBod = stations.some((s) => s.has_readings && s.latest_bod !== null);
  const byDo = stations.some((s) => s.has_readings && s.latest_bod === null && s.latest_do !== null);
  const grey = stations.some((s) => !s.has_readings || (s.latest_bod === null && s.latest_do === null));
  if (!byDo) return null;

  const toggle = () =>
    setOpen((v) => !(v ?? window.matchMedia("(min-width: 768px)").matches));
  const body = open === null ? "hidden md:block" : open ? "block" : "hidden";
  const chevron = open === null ? "md:rotate-180" : open ? "rotate-180" : "";

  return (
    <div className="absolute bottom-6 left-2 z-[1000] max-w-[16rem] bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
      <button onClick={toggle} aria-expanded={open ?? undefined} className="flex items-center justify-between gap-3 w-full">
        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">Point colour, latest reading</h4>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${chevron}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`${body} mt-1.5 space-y-1`}>
        {byBod ? (
          <>
            <Row fill={RED}>BOD above 6 mg/L</Row>
            <Row fill={AMBER}>BOD above 3, up to 6 mg/L</Row>
            <Row fill={GREEN}>BOD 3 mg/L or less</Row>
            <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              Points with an oxygen (DO) reading only: red below 4 mg/L, amber 4 to under 5,
              green 5 or more.
            </p>
          </>
        ) : (
          <>
            <Row fill={RED}>DO below 4 mg/L</Row>
            <Row fill={AMBER}>DO 4 to under 5 mg/L</Row>
            <Row fill={GREEN}>DO 5 mg/L or more</Row>
          </>
        )}
        {grey && <Row fill={GREY}>No BOD or DO reading</Row>}
      </div>
    </div>
  );
}
