"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import type { Language } from "@/lib/i18n/translations";
import { getZoneLabel } from "@/lib/utils/zone-label";
import {
  filterWards,
  type WardEntry,
  type LocalityEntry,
  type ZoneEntry,
  type SearchResult,
  deriveZones,
  searchAll,
} from "@/lib/utils/ward-filter";

const MAX_RECENT = 5;

/** Recently-viewed wards are namespaced per city. Without this, a
 *  Chennai ward number (e.g. 139 = Valasaravakkam) leaks into the
 *  Madurai selector as "ward 139" because the underlying numbers
 *  collide. The legacy unsuffixed `neer-vazhvu-recent-wards` key is
 *  retained for Chennai for back-compat with returning users; other
 *  cities namespace explicitly. */
function recentWardsKey(cityId: string): string {
  return cityId === "chennai"
    ? "neer-vazhvu-recent-wards"
    : `neer-vazhvu-recent-wards-${cityId}`;
}

function getRecentWards(cityId: string): number[] {
  try {
    const stored = localStorage.getItem(recentWardsKey(cityId));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentWard(wardNumber: number, cityId: string): void {
  try {
    const recent = getRecentWards(cityId).filter((w) => w !== wardNumber);
    recent.unshift(wardNumber);
    localStorage.setItem(recentWardsKey(cityId), JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // localStorage unavailable
  }
}

interface WardSelectorProps {
  onSelect: (wardNumber: number) => void;
  selectedWard: number | null;
  /** City id for the ward / locality data lookup. Defaults to Chennai
   *  for back-compat with the existing flat /my-ward route. */
  cityId?: string;
}

export function WardSelector({ onSelect, selectedWard, cityId = "chennai" }: WardSelectorProps) {
  const { t, language } = useLanguage();
  const [wards, setWards] = useState<WardEntry[]>([]);
  const [localities, setLocalities] = useState<LocalityEntry[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [recentWards, setRecentWards] = useState<number[]>([]);
  // Hydrate recently-viewed from localStorage on mount and when the
  // city changes. Per-city namespacing prevents Chennai wards leaking
  // into Madurai's selector (see recentWardsKey).
  useEffect(() => {
    setRecentWards(getRecentWards(cityId));
  }, [cityId]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sectionLabels = useMemo<Record<SearchResult["kind"], string>>(
    () => ({
      locality: t("ward_search.section_areas"),
      ward: t("ward_search.section_wards"),
      zone: t("ward_search.section_zones"),
    }),
    [t],
  );

  useEffect(() => {
    // For Chennai, hit the legacy unsuffixed API. For other cities, pass
    // the cityId so the API can read the matching <city>-ward-profiles.json
    // and (optional) <city>-localities.json. Localities is allowed to 404
    // - some cities don't have a curated locality list yet, and the
    // selector still works (search by ward # / zone name only).
    const wardsUrl = cityId === "chennai" ? "/api/wards" : `/api/wards?city=${encodeURIComponent(cityId)}`;
    const locUrl = cityId === "chennai" ? "/api/localities" : `/api/localities?city=${encodeURIComponent(cityId)}`;
    fetch(wardsUrl)
      .then((r) => r.json())
      .then((d) => setWards(d.wards || []))
      .catch(console.error);
    fetch(locUrl)
      .then((r) => (r.ok ? r.json() : { localities: [] }))
      .then((d) => setLocalities(d.localities || []))
      .catch(() => setLocalities([]));
  }, [cityId]);

  const zones = useMemo<ZoneEntry[]>(() => deriveZones(wards), [wards]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const results = useMemo<SearchResult[]>(
    () => searchAll(localities, wards, zones, query),
    [query, localities, wards, zones],
  );

  // Group results by kind for section headers
  const grouped = useMemo(() => {
    const sections: { kind: SearchResult["kind"]; items: SearchResult[] }[] =
      [];
    let current: SearchResult["kind"] | null = null;
    for (const r of results) {
      if (r.kind !== current) {
        sections.push({ kind: r.kind, items: [r] });
        current = r.kind;
      } else {
        sections[sections.length - 1].items.push(r);
      }
    }
    return sections;
  }, [results]);

  const handleSelect = useCallback(
    (wardNumber: number) => {
      saveRecentWard(wardNumber, cityId);
      setRecentWards(getRecentWards(cityId));
      setQuery("");
      setOpen(false);
      onSelect(wardNumber);
    },
    [onSelect, cityId],
  );

  const handleResultSelect = useCallback(
    (result: SearchResult) => {
      if (result.kind === "locality") {
        handleSelect(result.locality.ward_number);
      } else if (result.kind === "ward") {
        handleSelect(result.ward.wardNumber);
      } else {
        // Zone: navigate to first ward in that zone
        const firstWard = wards.find((w) => w.zone === result.zone.zoneName);
        if (firstWard) handleSelect(firstWard.wardNumber);
      }
    },
    [handleSelect, wards],
  );

  const wardLabel = useCallback(
    (wardNumber: number): string => {
      const w = wards.find((w) => w.wardNumber === wardNumber);
      return w
        ? `${t("ward.ward")} ${w.wardNumber} - ${getZoneLabel(w.zone, language)}`
        : `${t("ward.ward")} ${wardNumber}`;
    },
    [language, t, wards],
  );

  const resultsDropdown = (
    <>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 max-h-72 overflow-y-auto z-10">
          {grouped.map((section) => (
            <div key={section.kind}>
              <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none">
                {sectionLabels[section.kind]}
              </div>
              {section.items.map((result, i) => (
                <ResultRow
                  key={`${result.kind}-${i}`}
                  result={result}
                  language={language}
                  t={t}
                  onClick={() => handleResultSelect(result)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {open && query.trim() && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          {t("my_ward.no_results")}
        </div>
      )}
    </>
  );

  // If no ward is selected, show the full selector as the page hero
  if (selectedWard == null) {
    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-24 px-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg mb-6">
          <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="none">
            <path
              d="M12 3s-5 6.1-5 9.9A5 5 0 0 0 12 18a5 5 0 0 0 5-5.1C17 9.1 12 3 12 3z"
              fill="currentColor"
            />
          </svg>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 text-center mb-2">
          {t("my_ward.title")}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-center mb-8 max-w-md">
          {t("my_ward.subtitle")}
        </p>

        <div ref={containerRef} className="w-full max-w-md relative">
          <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <svg
              className="w-5 h-5 ml-4 text-slate-400 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => query && setOpen(true)}
              placeholder={t("my_ward.search_placeholder")}
              className="flex-1 px-3 py-4 text-base bg-transparent outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
          </div>

          {resultsDropdown}
        </div>

        {/* Browse-all entry point. Search is great when the user
            already knows their ward; the rankings table is the
            entry point for everyone else (journalists, residents
            who don't know their ward number, planners) - those
            users had nothing to click before. */}
        <div className="mt-5">
          <Link
            href={
              cityId === "chennai"
                ? "/my-ward/rankings"
                : `/${cityId}/my-ward/rankings`
            }
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Browse all wards ranked &rarr;
          </Link>
        </div>

        {/* Recent wards */}
        {recentWards.length > 0 && (
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
              {t("my_ward.recent_wards")}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {recentWards.map((w) => (
                <button
                  key={w}
                  onClick={() => handleSelect(w)}
                  className="px-3 py-1.5 text-sm rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-700 dark:hover:text-blue-400 transition-colors border border-slate-200 dark:border-slate-700"
                >
                  {wardLabel(w)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Compact inline selector when ward is already selected
  return (
    <div ref={containerRef} className="relative print:hidden">
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex-1 max-w-xs">
          <svg
            className="w-4 h-4 ml-3 text-slate-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => query && setOpen(true)}
            placeholder={t("my_ward.change_ward")}
            className="flex-1 px-2 py-2 text-sm bg-transparent outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Compact dropdown uses same grouped results */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 max-h-72 overflow-y-auto z-10 max-w-xs">
          {grouped.map((section) => (
            <div key={section.kind}>
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none">
                {sectionLabels[section.kind]}
              </div>
              {section.items.map((result, i) => (
                <ResultRow
                  key={`${result.kind}-${i}`}
                  result={result}
                  language={language}
                  t={t}
                  onClick={() => handleResultSelect(result)}
                  compact
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultRow({
  result,
  language,
  t,
  onClick,
  compact = false,
}: {
  result: SearchResult;
  language: Language;
  t: (key: string) => string;
  onClick: () => void;
  compact?: boolean;
}) {
  const px = compact ? "px-3 py-2" : "px-4 py-3";

  if (result.kind === "locality") {
    const l = result.locality;
    const displayName = language === "ta" && l.name_ta ? l.name_ta : l.name;
    return (
      <button
        onClick={onClick}
        className={`w-full text-left ${px} text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex flex-col gap-0.5`}
      >
        <span className="font-medium text-slate-900 dark:text-slate-100 leading-snug">
          {displayName}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {t("ward.ward")} {l.ward_number} ·{" "}
          {getZoneLabel(l.zone_name, language)}
        </span>
      </button>
    );
  }

  if (result.kind === "ward") {
    const w = result.ward;
    return (
      <button
        onClick={onClick}
        className={`w-full text-left ${px} text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-baseline justify-between gap-2`}
      >
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {t("ward.ward")} {w.wardNumber}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
          {getZoneLabel(w.zone, language)} {t("ward_search.zone_suffix")}
        </span>
      </button>
    );
  }

  const z = result.zone;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left ${px} text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-baseline justify-between gap-2`}
    >
      <span className="font-medium text-slate-900 dark:text-slate-100">
        {getZoneLabel(z.zoneName, language)}
      </span>
      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
        {z.wardCount} {t("ward_search.wards")}
      </span>
    </button>
  );
}
