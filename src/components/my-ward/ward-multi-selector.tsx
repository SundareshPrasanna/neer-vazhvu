"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { filterWards, type WardEntry } from "@/lib/utils/ward-filter";

const MAX_WARDS = 3;

const RECENT_WARDS_KEY = "neer-vazhvu-recent-wards";

function getRecentWards(): number[] {
  try {
    const stored = localStorage.getItem(RECENT_WARDS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

interface WardMultiSelectorProps {
  selectedWards: number[];
  onUpdate: (wards: number[]) => void;
}

export function WardMultiSelector({ selectedWards, onUpdate }: WardMultiSelectorProps) {
  const { t } = useLanguage();
  const [wards, setWards] = useState<WardEntry[]>([]);
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/wards")
      .then((r) => r.json())
      .then((d) => setWards(d.wards || []))
      .catch(console.error);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenSlot(null);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Focus input when a slot opens
  useEffect(() => {
    if (openSlot != null) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [openSlot]);

  const filtered = useMemo(() => {
    const results = filterWards(wards, query);
    // Exclude already-selected wards
    return results.filter((w) => !selectedWards.includes(w.wardNumber));
  }, [wards, query, selectedWards]);

  const recentWards = useMemo(() => {
    if (typeof window === "undefined") return [];
    return getRecentWards().filter((w) => !selectedWards.includes(w));
  }, [selectedWards]);

  const handleSelect = useCallback(
    (wardNumber: number) => {
      if (selectedWards.includes(wardNumber)) return;
      const next = [...selectedWards, wardNumber].slice(0, MAX_WARDS);
      onUpdate(next);
      setOpenSlot(null);
      setQuery("");
    },
    [selectedWards, onUpdate],
  );

  const handleRemove = useCallback(
    (wardNumber: number) => {
      onUpdate(selectedWards.filter((w) => w !== wardNumber));
    },
    [selectedWards, onUpdate],
  );

  const wardLabel = useCallback(
    (wardNumber: number): string => {
      const w = wards.find((entry) => entry.wardNumber === wardNumber);
      return w ? `${wardNumber} - ${w.zone}` : String(wardNumber);
    },
    [wards],
  );

  // Build slot array: filled slots + empty slots up to MAX_WARDS
  const slots: (number | null)[] = [];
  for (let i = 0; i < MAX_WARDS; i++) {
    slots.push(selectedWards[i] ?? null);
  }

  return (
    <div ref={containerRef} className="print:hidden">
      <div className="flex flex-col sm:flex-row gap-3">
        {slots.map((ward, idx) => (
          <div key={idx} className="relative flex-1 min-w-0">
            {ward != null ? (
              /* Filled slot */
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {t("ward.ward")} {wardLabel(ward)}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(ward)}
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                  aria-label={`${t("compare.remove_ward")} ${ward}`}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              /* Empty slot */
              <button
                type="button"
                onClick={() => { setOpenSlot(openSlot === idx ? null : idx); setQuery(""); }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-500 dark:hover:text-blue-400 transition-colors text-sm"
                aria-label={t("compare.add_ward")}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {t("compare.add_ward")}
              </button>
            )}

            {/* Search dropdown for this slot */}
            {openSlot === idx && ward == null && (
              <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center border-b border-slate-100 dark:border-slate-700">
                  <svg className="w-4 h-4 ml-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("compare.search_placeholder")}
                    className="flex-1 px-2 py-2.5 text-sm bg-transparent outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400"
                  />
                </div>

                {/* Recent wards chips */}
                {!query.trim() && recentWards.length > 0 && (
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-1.5">{t("my_ward.recent_wards")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {recentWards.slice(0, 5).map((w) => (
                        <button
                          key={w}
                          onClick={() => handleSelect(w)}
                          className="px-2 py-1 text-xs rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {t("ward.ward")} {wardLabel(w)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search results */}
                <div className="max-h-48 overflow-y-auto">
                  {filtered.length > 0 ? (
                    filtered.map((w) => (
                      <button
                        key={w.wardNumber}
                        onClick={() => handleSelect(w.wardNumber)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-b border-slate-50 dark:border-slate-700/50 last:border-b-0"
                      >
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          Ward {w.wardNumber}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 ml-2">{w.zone}</span>
                      </button>
                    ))
                  ) : query.trim() ? (
                    <div className="px-3 py-2.5 text-sm text-slate-400">
                      {t("my_ward.no_results")}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
