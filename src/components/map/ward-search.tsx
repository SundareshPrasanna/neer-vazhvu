"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useLanguage } from "@/lib/i18n/context";
import {
  type WardEntry,
  type LocalityEntry,
  type ZoneEntry,
  type SearchResult,
  deriveZones,
  searchAll,
} from "@/lib/utils/ward-filter";

export interface WardSearchProps {
  /**
   * Called when a ward, locality, or zone is selected.
   * wardNumber: the ward to select and highlight.
   * flyTo: optional precise coordinates to fly to (used for localities).
   *        If omitted, the map should fly to the ward centroid.
   */
  onSelect: (wardNumber: number, flyTo?: { lat: number; lng: number }) => void;
  className?: string;
}

export function WardSearch({ onSelect, className = "" }: WardSearchProps) {
  const { language, t } = useLanguage();
  const [wards, setWards] = useState<WardEntry[]>([]);
  const [localities, setLocalities] = useState<LocalityEntry[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sectionLabels: Record<SearchResult["kind"], string> = {
    locality: t("ward_search.section_areas"),
    ward: t("ward_search.section_wards"),
    zone: t("ward_search.section_zones"),
  };

  useEffect(() => {
    fetch("/api/wards")
      .then((r) => r.json())
      .then((d) => setWards(d.wards || []))
      .catch(console.error);
    fetch("/api/localities")
      .then((r) => r.json())
      .then((d) => setLocalities(d.localities || []))
      .catch(console.error);
  }, []);

  const zones = useMemo<ZoneEntry[]>(() => deriveZones(wards), [wards]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        if (!query) setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [query]);

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

  const handleSelect = (result: SearchResult) => {
    if (result.kind === "locality") {
      onSelect(result.locality.ward_number, {
        lat: result.locality.lat,
        lng: result.locality.lng,
      });
    } else if (result.kind === "ward") {
      onSelect(result.ward.wardNumber);
    } else {
      // Zone: select the first ward in that zone
      const firstWard = wards.find((w) => w.zone === result.zone.zoneName);
      if (firstWard) onSelect(firstWard.wardNumber);
    }
    setQuery("");
    setOpen(false);
    setSearchOpen(false);
  };

  return (
    <div ref={containerRef} className={className}>
      {/* Collapsed: search icon button */}
      {!searchOpen && (
        <button
          onClick={() => {
            setSearchOpen(true);
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
          className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          aria-label={t("ward_search.aria_open")}
        >
          <svg
            className="w-4 h-4"
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
        </button>
      )}

      {/* Expanded: search input + dropdown */}
      {searchOpen && (
        <div className="relative">
          <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
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
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => query && setOpen(true)}
              placeholder={t("ward_search.placeholder")}
              className="w-52 sm:w-64 px-2 py-2 text-sm bg-transparent outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
            <button
              onClick={() => {
                setQuery("");
                setOpen(false);
                setSearchOpen(false);
              }}
              className="px-2 py-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Results dropdown */}
          {open && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 max-h-72 overflow-y-auto z-10">
              {grouped.map((section) => (
                <div key={section.kind}>
                  {/* Section header */}
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none">
                    {sectionLabels[section.kind]}
                  </div>
                  {section.items.map((result, i) => (
                    <ResultRow
                      key={`${result.kind}-${i}`}
                      result={result}
                      language={language}
                      t={t}
                      onClick={() => handleSelect(result)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

          {open && query.trim() && results.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
              {t("ward_search.no_results")} &ldquo;{query}&rdquo;
            </div>
          )}
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
}: {
  result: SearchResult;
  language: string;
  t: (key: string) => string;
  onClick: () => void;
}) {
  if (result.kind === "locality") {
    const l = result.locality;
    const displayName = language === "ta" && l.name_ta ? l.name_ta : l.name;
    return (
      <button
        onClick={onClick}
        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex flex-col gap-0.5"
      >
        <span className="font-medium text-slate-900 dark:text-slate-100 leading-snug">
          {displayName}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {t("ward.ward")} {l.ward_number} ·{" "}
          {getZoneLabel(l.zone_name, language, t)}
        </span>
      </button>
    );
  }

  if (result.kind === "ward") {
    const w = result.ward;
    return (
      <button
        onClick={onClick}
        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-baseline justify-between gap-2"
      >
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {t("ward.ward")} {w.wardNumber}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
          {getZoneLabel(w.zone, language, t)} {t("ward_search.zone_suffix")}
        </span>
      </button>
    );
  }

  const z = result.zone;
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-baseline justify-between gap-2"
    >
      <span className="font-medium text-slate-900 dark:text-slate-100">
        {getZoneLabel(z.zoneName, language, t)}
      </span>
      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
        {z.wardCount} {t("ward_search.wards")}
      </span>
    </button>
  );
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function zoneKey(zone: string): string {
  return zone
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function getZoneLabel(
  zone: string,
  language: string,
  t: (key: string) => string,
): string {
  if (language !== "ta") return toTitleCase(zone);
  const key = `zone_name.${zoneKey(zone)}`;
  const translated = t(key);
  return translated === key ? toTitleCase(zone) : translated;
}
