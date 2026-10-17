"use client";

import { useEffect, useState } from "react";
import { CircleMarker, Pane, Popup, useMap } from "react-leaflet";
import L from "leaflet";

import { OPEN_STATUSES } from "@/lib/sightings/status";
import { OTHER_KEY, REPORT_GROUPS, getGroup } from "@/lib/sightings/taxonomy";
import type { PublicReport } from "@/lib/sightings/types";
import { SeenLately } from "./place-reports";
import { Status, day } from "./report-card";
import { muted } from "./ui";
import { useCitizen } from "./use-citizen";

/** What GET /api/sightings?bbox= accepts: a box inside India, at most 12 degrees a side. */
const INDIA = { w: 60, s: 0, e: 100, n: 40 };
const MAX_SPAN = 12;
const PANE = "citizen-reports";
const DEBOUNCE_MS = 300;

/** "Something else" reports have no group; the report flow draws them in this slate. */
const OTHER_GROUP = { key: OTHER_KEY, label: "Something else", color: "#475569" };
const MAPPED = [...REPORT_GROUPS.filter((g) => !g.private), OTHER_GROUP];
const groupOf = (category: string) => getGroup(category) ?? OTHER_GROUP;

/** A dot in the mapped report groups' colours, for the layer's toggle. */
export const REPORTS_SWATCH = `conic-gradient(${REPORT_GROUPS.filter((g) => !g.private).map((g) => g.color).join(",")})`;

/** What the layer drew: how many dots, and the groups among them in taxonomy order (the legend). */
export interface ReportsInView {
  count: number;
  groups: { key: string; label: string; color: string }[];
}

function inView(reports: PublicReport[]): ReportsInView {
  const present = new Set(reports.map((r) => r.category));
  return { count: reports.length, groups: MAPPED.filter((g) => present.has(g.key)).map(({ key, label, color }) => ({ key, label, color })) };
}

/** The view as the API's bbox, rounded outward so nearby views share a cached response; null when too large to ask. */
function viewBox(b: L.LatLngBounds): string | null {
  const w = Math.max(INDIA.w, Math.floor(b.getWest() * 100) / 100);
  const s = Math.max(INDIA.s, Math.floor(b.getSouth() * 100) / 100);
  const e = Math.min(INDIA.e, Math.ceil(b.getEast() * 100) / 100);
  const n = Math.min(INDIA.n, Math.ceil(b.getNorth() * 100) / 100);
  return w < e && s < n && e - w <= MAX_SPAN && n - s <= MAX_SPAN ? `${w},${s},${e},${n}` : null;
}

/** Leaflet's popup chrome in the house colours, light and dark. `!` because leaflet.css is unlayered and outranks utilities. */
const POPUP =
  "[&_.leaflet-popup-content-wrapper]:rounded-xl! [&_.leaflet-popup-content-wrapper]:bg-white! [&_.leaflet-popup-content-wrapper]:text-slate-900! " +
  "[&_.leaflet-popup-tip]:bg-white! [&_.leaflet-popup-content_p]:m-0! " +
  "dark:[&_.leaflet-popup-content-wrapper]:bg-slate-900! dark:[&_.leaflet-popup-content-wrapper]:text-slate-100! dark:[&_.leaflet-popup-tip]:bg-slate-900! " +
  "dark:[&_.leaflet-popup-close-button]:text-slate-400!";

function ReportPopup({ report, citizen }: { report: PublicReport; citizen: ReturnType<typeof useCitizen> }) {
  const photo = report.photoUrls[0];
  return (
    <div className="w-60 max-w-full space-y-2.5 font-sans">
      <div className="flex gap-3">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={report.label} className="h-14 w-14 shrink-0 rounded-md object-cover" loading="lazy" />
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">{report.label}</div>
          <div className={`mt-0.5 text-xs leading-snug ${muted}`}>{[report.where ?? report.placeName, day(report.createdAt)].join(", ")}</div>
        </div>
      </div>
      {report.caseStatus && <Status status={report.caseStatus} />}
      <SeenLately report={report} citizen={citizen} />
    </div>
  );
}

/**
 * Published citizen reports in the map's view, one dot each at its public point (about 100 m), coloured by
 * group; open ones a little larger. Generic over every Leaflet map. `onView` hears what is drawn after
 * each load, or null when the view is too large to ask for. Renders nothing unless reporting is on.
 */
export function CitizenReportsLayer({ onView }: { onView?: (view: ReportsInView | null) => void }) {
  const on = process.env.NEXT_PUBLIC_CITIZEN_REPORTS === "on";
  const map = useMap();
  const citizen = useCitizen();
  // undefined until the first load; null while the view is too large to ask for.
  const [reports, setReports] = useState<PublicReport[] | null | undefined>(undefined);
  // SVG in its own pane: its root takes no pointer events, so layers below stay clickable (a canvas would not).
  const [renderer] = useState(() => L.svg({ pane: PANE }));
  const [touch] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches);

  useEffect(() => () => void map.removeLayer(renderer), [map, renderer]);

  useEffect(() => {
    if (!on) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | undefined;
    const load = () => {
      ctrl?.abort();
      const box = viewBox(map.getBounds());
      if (!box) return setReports(null);
      const req = (ctrl = new AbortController());
      fetch(`/api/sightings?bbox=${box}`, { signal: req.signal })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((j) => {
          if (req.signal.aborted) return;
          setReports((Array.isArray(j?.data) ? (j.data as PublicReport[]) : []).filter((r) => r.point));
        })
        .catch(() => !req.signal.aborted && setReports([]));
    };
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(load, DEBOUNCE_MS);
    };
    later();
    map.on("moveend", later);
    return () => {
      clearTimeout(timer);
      ctrl?.abort();
      map.off("moveend", later);
    };
  }, [map, on]);

  useEffect(() => {
    if (on && reports !== undefined) onView?.(reports && inView(reports));
  }, [on, reports, onView]);

  if (!on) return null;
  return (
    <Pane name={PANE} style={{ zIndex: 620 }}>
      {reports?.map((r) => {
        const open = !!r.caseStatus && OPEN_STATUSES.has(r.caseStatus);
        return (
          <CircleMarker
            key={r.id}
            center={r.point!}
            radius={(open ? 7 : 5) + (touch ? 2 : 0)}
            renderer={renderer}
            bubblingMouseEvents={false}
            pathOptions={{ color: "#ffffff", weight: 1.5, opacity: 1, fillColor: groupOf(r.category).color, fillOpacity: open ? 0.95 : 0.75 }}
          >
            <Popup pane="popupPane" className={POPUP} maxWidth={280} autoPanPadding={[16, 16]}>
              <ReportPopup report={r} citizen={citizen} />
            </Popup>
          </CircleMarker>
        );
      })}
    </Pane>
  );
}
