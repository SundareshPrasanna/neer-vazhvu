"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { filterWards, type WardEntry } from "@/lib/utils/ward-filter";

const RECENT_WARDS_KEY = "neer-vazhvu-recent-wards";
const MAX_RECENT = 5;

function getRecentWards(): number[] {
  try {
    const stored = localStorage.getItem(RECENT_WARDS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentWard(wardNumber: number): void {
  try {
    const recent = getRecentWards().filter((w) => w !== wardNumber);
    recent.unshift(wardNumber);
    localStorage.setItem(RECENT_WARDS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // localStorage unavailable
  }
}

interface WardSelectorProps {
  onSelect: (wardNumber: number) => void;
  selectedWard: number | null;
}

export function WardSelector({ onSelect, selectedWard }: WardSelectorProps) {
  const { t } = useLanguage();
  const [wards, setWards] = useState<WardEntry[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [recentWards, setRecentWards] = useState<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/wards")
      .then((r) => r.json())
      .then((d) => setWards(d.wards || []))
      .catch(console.error);
    setRecentWards(getRecentWards());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = useMemo(() => filterWards(wards, query), [wards, query]);

  const handleSelect = useCallback(
    (wardNumber: number) => {
      saveRecentWard(wardNumber);
      setRecentWards(getRecentWards());
      setQuery("");
      setOpen(false);
      onSelect(wardNumber);
    },
    [onSelect],
  );

  const wardLabel = useCallback(
    (wardNumber: number): string => {
      const w = wards.find((w) => w.wardNumber === wardNumber);
      return w ? `Ward ${w.wardNumber} - ${w.zone}` : `Ward ${wardNumber}`;
    },
    [wards],
  );

  // If no ward is selected, show the full selector as the page hero
  if (selectedWard == null) {
    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-24 px-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg mb-6">
          <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="none">
            <path d="M12 3s-5 6.1-5 9.9A5 5 0 0 0 12 18a5 5 0 0 0 5-5.1C17 9.1 12 3 12 3z" fill="currentColor" />
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
            <svg className="w-5 h-5 ml-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => query && setOpen(true)}
              placeholder={t("my_ward.search_placeholder")}
              className="flex-1 px-3 py-4 text-base bg-transparent outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
          </div>

          {/* Results dropdown */}
          {open && filtered.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto z-10">
              {filtered.map((w) => (
                <button
                  key={w.wardNumber}
                  onClick={() => handleSelect(w.wardNumber)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    Ward {w.wardNumber}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 ml-2">{w.zone}</span>
                </button>
              ))}
            </div>
          )}

          {open && query.trim() && filtered.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              {t("my_ward.no_results")}
            </div>
          )}
        </div>

        {/* Recent wards */}
        {recentWards.length > 0 && (
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">{t("my_ward.recent_wards")}</p>
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
          <svg className="w-4 h-4 ml-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => query && setOpen(true)}
            placeholder={t("my_ward.change_ward")}
            className="flex-1 px-2 py-2 text-sm bg-transparent outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
        </div>
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto z-10 max-w-xs">
          {filtered.map((w) => (
            <button
              key={w.wardNumber}
              onClick={() => handleSelect(w.wardNumber)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0"
            >
              <span className="font-medium text-slate-900 dark:text-slate-100">Ward {w.wardNumber}</span>
              <span className="text-slate-500 dark:text-slate-400 ml-2">{w.zone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
