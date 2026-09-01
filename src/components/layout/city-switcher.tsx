"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { listVisiblePlaces } from "@/lib/cities";
import {
  FEATURE_AVAILABILITY,
  buildCityHref,
  knownCityIds,
  parsePath,
} from "@/lib/cities/routing";
import { districtHref, listVisibleAtlasDistricts } from "@/lib/atlas/registry";

/** /atlas/<state>/<district>[/...] -> the district, or null. */
function parseAtlasPath(pathname: string) {
  const m = pathname.match(/^\/atlas\/([^/]+)\/([^/]+)/);
  if (!m) return null;
  const [, state, slug] = m;
  return (
    listVisibleAtlasDistricts().find(
      (d) => d.stateSlug === state.toLowerCase() && d.slug === slug.toLowerCase(),
    ) ?? null
  );
}

const GROUP_LABEL =
  "px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500";

/**
 * The place switcher: every city, then every district, in one menu. It sits
 * in the city header and in the Atlas header, so a reader can move between
 * a city dashboard and a district directory from anywhere. The component
 * keeps its historical name because the header and tests import it.
 */
export function CitySwitcher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const places = listVisiblePlaces();
  const districts = listVisibleAtlasDistricts();
  const currentDistrict = parseAtlasPath(pathname);
  // On an Atlas page parsePath would read "atlas/tn/..." as a Chennai
  // feature; the city links must go to each city's home instead.
  const parsed = parsePath(pathname, knownCityIds());
  const currentCityId = currentDistrict ? null : parsed.cityId;
  const feature = currentDistrict ? "" : parsed.feature;
  const currentPlace = places.find((p) => p.cityId === currentCityId) ?? places[0];
  const currentLabel = currentDistrict ? currentDistrict.name : currentPlace.displayName;

  // Water-bodies view mode (?mode=catchments) to carry across a city switch.
  // Read lazily on the client only when the menu is open (avoids pulling
  // useSearchParams into this layout-level component, which would force a
  // Suspense bailout at build time). The dropdown renders only after a click.
  const carriedMode =
    open && typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("mode")
      : null;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const itemClass = (isCurrent: boolean) =>
    cn(
      "block px-4 py-2.5 text-sm transition-colors",
      isCurrent
        ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800",
    );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 px-2.5 py-2 sm:gap-1.5 sm:px-3 sm:py-2.5 rounded-md text-sm font-medium transition-colors shrink-0",
          "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
          "border border-slate-200 dark:border-slate-700",
        )}
        aria-label={`Current place: ${currentLabel}. Switch place.`}
        aria-expanded={open}
      >
        <svg className="hidden sm:block w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="whitespace-nowrap">{currentLabel}</span>
        <svg className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", open && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 min-w-[200px] max-w-[calc(100vw-1rem)] max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50">
          {districts.length > 0 && <div className={GROUP_LABEL}>Cities</div>}
          {places.map((p) => {
            const supported = FEATURE_AVAILABILITY[p.cityId];
            const featureSupported = supported ? supported.has(feature) : false;
            let targetUrl = buildCityHref(p.cityId, feature);
            // Carry the water-bodies view mode (e.g. ?mode=catchments) across a
            // city switch so the catchments/restoration view doesn't silently
            // drop back to the default tab. Only when the target city actually
            // has the water-bodies page; the page falls back gracefully if it
            // lacks the catchments overlay.
            if (carriedMode && feature === "water-bodies" && featureSupported) {
              targetUrl += `?mode=${carriedMode}`;
            }
            const isCurrent = p.cityId === currentCityId;
            return (
              <Link
                key={p.cityId}
                href={targetUrl}
                onClick={() => setOpen(false)}
                className={itemClass(isCurrent)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{p.displayName}</span>
                  <span className="text-[10px] text-slate-400 uppercase">
                    {p.stateCode}
                  </span>
                </div>
                {!isCurrent && feature !== "" && !featureSupported && (
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                    {feature.split("/")[0]} not yet available - jumps to {p.displayName} home
                  </div>
                )}
              </Link>
            );
          })}

          {districts.length > 0 && (
            <>
              <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
              <div className={GROUP_LABEL}>Districts</div>
              {districts.map((d) => {
                const isCurrent = currentDistrict?.scopeId === d.scopeId;
                return (
                  <Link
                    key={d.scopeId}
                    href={districtHref(d)}
                    onClick={() => setOpen(false)}
                    className={itemClass(isCurrent)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{d.name}</span>
                      <span className="text-[10px] text-slate-400 uppercase">
                        {d.stateCode}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
