"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MapLoading } from "@/components/map/map-loading";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { MapInfoButton } from "@/components/map/map-info-button";
import { CoastalLegend } from "@/components/coastal/coastal-legend";
import { CoastalDetailPanel } from "@/components/coastal/coastal-detail-panel";
import { ShorelineSummary, type ShorelineSummaryCopy } from "@/components/coastal/shoreline-summary";
import { useLockBodyScroll } from "@/lib/hooks/use-lock-body-scroll";
import type { SelectedCoastal, CoastalSummary } from "@/types/coastal";

const CoastalMap = dynamic(
  () => import("@/components/coastal/coastal-map").then((m) => m.CoastalMap),
  { ssr: false, loading: () => <MapLoading /> },
);

/** Per-city page copy: the anchoring source differs (Chennai validates against
 *  a peer-reviewed study; other coasts anchor to their own published record).
 *  Config-not-fork: adding a coastal city = adding an entry + its geojsons. */
interface CoastalCityCopy {
  title: string;
  summaryCard: ShorelineSummaryCopy;
  anchorLabel: string;
  anchorName: string;
  anchorUrl: string;
  /** Second paragraph of the map info note - what the zones/hotspots are and
   *  how the anchor source relates to our measurement. */
  anchorNote: string;
  factsHref: string;
  /** Shown before the transects load. Both count high-confidence transects
   *  only, the same set the loaded bar uses for both numbers. */
  fallbackEroding: number;
  fallbackReliable: number;
  /** Replaces the transect panel's study comparison where the coast has no
   *  per-transect study to compare against. Omit to keep Chennai's wording. */
  transectNote?: string;
  /** Legend wording where the zones are not a study's (and no hotspots). */
  legend?: { zoneLabel: string; showHotspots: boolean };
}

const CITY_COPY: Record<string, CoastalCityCopy> = {
  chennai: {
    title: "Chennai shoreline change",
    summaryCard: {
      title: "Chennai coastline",
      extent: "Mahabalipuram to Pulicat",
      headline: "Most of the coast is eroding - and the erosion is speeding up.",
      why: (
        <>
          the <span className="font-semibold">Ennore &amp; Kattupalli</span>{" "}ports interrupt the
          coast&apos;s natural south-to-north sand drift - trapping sand at the breakwaters, but
          starving and eroding the beaches further north (down-drift). The coast gains land where
          the <span className="font-semibold">Adyar &amp; Cooum</span> rivers drop silt at their
          mouths.
        </>
      ),
      attribution: (n: number) =>
        `Our satellite measurement (${n.toLocaleString()} transects), corroborated by Anagha, Singh & Frappart (2026).`,
    },
    anchorLabel: "Corroborated by",
    anchorName: "Anagha et al. (2026)",
    anchorUrl: "https://www.sciencedirect.com/science/article/pii/S2667010026001083",
    anchorNote:
      "The faint grey bands are the six study zones and the larger labelled dots are named hotspots, both from Anagha, Singh & Frappart (2026). Our independent method matches the study's pattern; absolute rates differ (fixed MNDWI threshold, no tidal correction), so the study serves as validation.",
    factsHref: "/chennai/facts#bucket-coastal",
    fallbackEroding: 430,
    fallbackReliable: 1041,
  },
  mumbai: {
    title: "Mumbai shoreline change",
    summaryCard: {
      title: "Mumbai coastline",
      extent: "Colaba to Arnala",
      headline:
        "The suburban beach belt erodes; the armoured island city holds - or advances on reclamation.",
      why: (
        <>
          erosion concentrates in the <span className="font-semibold">Bandra-Juhu</span> and{" "}
          <span className="font-semibold">Versova</span>{" "}zones - the natural beach belt the
          state&apos;s own assessments grade medium-to-major risk. Much of the
          &quot;accretion&quot; is not beach recovery: the Coastal Road&apos;s 111-ha reclamation
          and creek-mouth silt push the waterline seaward.
        </>
      ),
      attribution: (n: number) =>
        `Our satellite measurement (${n.toLocaleString()} transects), anchored to the NCCR 1990-2016 assessment and MSMP 2017 risk grades.`,
    },
    anchorLabel: "Anchored to",
    anchorName: "NCCR 1990-2016 + MSMP 2017",
    anchorUrl: "https://www.nccr.gov.in/sites/default/files/schangenew.pdf",
    anchorNote:
      "The faint grey bands are seven zones carrying Mumbai's published record: the NCCR national assessment's district table (Mumbai City 93.5% stable behind its seawalls; Mumbai Suburban 43.2% eroding, with Erangal, Manori and Gorai named) and the Maharashtra Shoreline Management Plan 2017 risk grades. No source publishes per-transect rates for Mumbai, so the coloured dots are our own measurement - and Mumbai's ~3-5 m spring tides add positional noise Chennai's microtidal coast lacks; lean on the pattern, not single-transect absolutes.",
    factsHref: "/mumbai/facts",
    fallbackEroding: 110,
    fallbackReliable: 555,
  },
  visakhapatnam: {
    title: "Visakhapatnam shoreline change",
    summaryCard: {
      title: "Visakhapatnam coastline",
      extent: "Appikonda to Pedda Nagamayyapalem, just north of Bheemunipatnam",
      headline:
        "Most of the city's coast is holding steady; the beaches from Mangamaripeta to Pedda Nagamayyapalem are eroding.",
      why: (
        <>
          the <span className="font-semibold">Kailasa &amp; Yarada</span>{" "}hills and rock headlands
          shelter much of this shore (NCCR&apos;s 2018 assessment calls the district the most stable
          on the Andhra coast). The sandy beaches from{" "}
          <span className="font-semibold">Mangamaripeta to Pedda Nagamayyapalem</span> lose about
          1.8 m a year at our median, in line with their official Low Erosion class.{" "}
          <span className="font-semibold">RK Beach</span> is topped up with sand by the port, so its
          steady line is partly man-made.
        </>
      ),
      attribution: (n: number) =>
        `Our satellite measurement (${n.toLocaleString()} transects, no tidal correction), anchored to NCCR's 1990-2016 assessment and the Ministry of Earth Sciences' 2024 stretch classes.`,
    },
    anchorLabel: "Anchored to",
    anchorName: "NCCR 1990-2016 + MoES 2024",
    anchorUrl: "https://www.nccr.gov.in/sites/default/files/schangenew.pdf",
    anchorNote:
      "The faint grey bands are eight zones carrying Visakhapatnam's official record. NCCR's national assessment (1990-2016) covered the old, undivided district: 136.98 km of coast, 102.74 km of it stable. A separate reply by the Ministry of Earth Sciences in the Lok Sabha (11 December 2024) covers today's smaller district (68.08 km of coast) and classes four stretches as Low Erosion: Yarada, RK Beach, Mangamari Peta to Bheemili, and Bheemunipatnam to Pedanagamayyapalem. Our measurement agrees at Yarada and from Mangamaripeta north (median retreat about 1 to 1.8 m a year). At RK Beach it reads close to stable over 1990-2026 and at a Low Erosion pace since 2015; the port regularly adds sand to this beach, so its line is partly man-made. We have found no published per-transect rates for this coast, so the coloured dots are our own measurement, with no tidal correction (spring tide range 1.43 m, Survey of India tide tables via CWC 2020). The two harbour basins are left out; dots at breakwaters, port-built shore, the Dolphin's Nose headland and river mouths are marked low confidence, as are two dots whose measured water edge jumps 180 m or more in one step (one at RK Beach, one north of the Gosthani mouth).",
    factsHref: "/visakhapatnam/facts",
    fallbackEroding: 147,
    fallbackReliable: 421,
    transectNote:
      "We have found no published per-transect rate for this coast to check against; the official record is stretch classes (NCCR; Ministry of Earth Sciences, 2024). Absolute rates carry method limits: a fixed MNDWI threshold and no tidal correction (spring tide range 1.43 m).",
    legend: { zoneLabel: "Official stretch zone (context)", showHotspots: false },
  },
};

export default function CoastalClient({ cityId }: { cityId: string }) {
  // No entry -> render nothing (after the hooks - hooks must run
  // unconditionally) rather than fall back to another city's coastal copy
  // and statistics. FEATURE_AVAILABILITY gates this page to cities with an
  // entry, so this only fires on a config mistake.
  const copy: (typeof CITY_COPY)[string] | undefined = CITY_COPY[cityId];
  useLockBodyScroll();
  const [selected, setSelected] = useState<SelectedCoastal | null>(null);
  const [summary, setSummary] = useState<CoastalSummary | null>(null);
  // Bumped by the summary's "zoom to worst spot" button to fly the map there.
  const [flySignal, setFlySignal] = useState(0);
  // Pre-select the worst-eroding transect once the data loads, so the panel
  // opens with a clear, self-explanatory example. Runs in the map's data-load
  // callback (not an effect), and only the first time; the user is in control
  // after that.
  const didAutoSelect = useRef(false);

  if (!copy) return null;
  const handleSummary = (s: CoastalSummary) => {
    setSummary(s);
    if (!didAutoSelect.current && s.featured) {
      didAutoSelect.current = true;
      setSelected({ kind: "transect", props: s.featured });
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Stats / context bar - our measurement leads; the study validates. */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {copy.title} - {summary?.period ?? "1990-2026"}
        </span>
        {/* Both numbers count the same set: high-confidence transects only
            (the eroding count never includes the low-confidence ones). */}
        <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
          <span className="w-3 h-3 rounded-sm bg-red-600 opacity-80" />
          <span
            className="text-xs text-slate-600 dark:text-slate-400"
            title="Both numbers count high-confidence transects only; low-confidence ones are left out of both."
          >
            <span className="font-semibold text-slate-900 dark:text-slate-100">{summary?.eroding ?? copy.fallbackEroding}</span> eroding
            {" / "}
            <span className="font-semibold text-slate-900 dark:text-slate-100">{summary?.highConf ?? copy.fallbackReliable}</span> reliable transects
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap hidden sm:inline">
            {copy.anchorLabel}{" "}
            <a href={copy.anchorUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700 dark:hover:text-slate-300">
              {copy.anchorName}
            </a>
          </span>
          <Link
            href={copy.factsHref}
            className="text-xs text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap"
          >
            Coastal facts →
          </Link>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="relative flex-1 h-full">
          <CoastalMap
            cityId={cityId}
            selected={selected}
            onSelect={setSelected}
            onSummary={handleSummary}
            flyToFeaturedSignal={flySignal}
          />

          {/* "At a glance" summary - semi-transparent overlay, top-right. */}
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-[1000]">
            <ShorelineSummary
              copy={copy.summaryCard}
              summary={summary}
              onShowWorst={() => {
                if (summary?.featured) setSelected({ kind: "transect", props: summary.featured });
                setFlySignal((s) => s + 1);
              }}
            />
          </div>

          {/* Legend overlay */}
          <div
            className={`absolute z-[1000] transition-[bottom] duration-300 left-2 right-auto md:left-auto md:right-4 ${
              selected ? "bottom-[148px] md:bottom-4" : "bottom-2 md:bottom-4"
            }`}
          >
            <CoastalLegend zoneLabel={copy.legend?.zoneLabel} showHotspots={copy.legend?.showHotspots} />
          </div>

          {/* Sources / honesty note */}
          <MapInfoButton className="absolute top-20 left-2.5 z-[1000]">
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 max-w-xs">
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">What you see:</span> each dot is a
                100 m transect along the coast, coloured by how fast its shoreline is eroding (red) or accreting (blue),
                from our own measurement - an MNDWI water index on Landsat + Sentinel-2 via Google Earth Engine, 10
                epochs 1990-2026.
              </div>
              <div>
                {copy.anchorNote}{" "}
                <a href={copy.anchorUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-700 dark:text-slate-300 underline">
                  Source
                </a>
              </div>
            </div>
          </MapInfoButton>
        </div>

        {selected ? (
          <BottomSheet onClose={() => setSelected(null)}>
            <CoastalDetailPanel
              selected={selected}
              onClose={() => setSelected(null)}
              transectNote={copy.transectNote}
            />
          </BottomSheet>
        ) : null}
      </div>
    </div>
  );
}
