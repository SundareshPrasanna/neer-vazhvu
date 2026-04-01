"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useLanguage } from "@/lib/i18n/context";

interface WardEntry {
  wardNumber: number;
  wardName: string;
  wardNameTa?: string;
  zone: string;
}

interface WardSearchProps {
  onSelect: (wardNumber: number) => void;
  className?: string;
}

export function WardSearch({ onSelect, className = "" }: WardSearchProps) {
  const { language } = useLanguage();
  const [wards, setWards] = useState<WardEntry[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
        setOpen(false);
        if (!query) setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [query]);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return wards
      .filter((w) => {
        const name = w.wardName.toLowerCase();
        const nameTa = w.wardNameTa?.toLowerCase() || "";
        const zone = w.zone.toLowerCase();
        const num = String(w.wardNumber);
        return name.includes(q) || nameTa.includes(q) || zone.includes(q) || num.startsWith(q);
      })
      .sort((a, b) => {
        // Prioritize: exact ward number > ward name match > zone-only match
        const aNum = String(a.wardNumber) === q ? 0 : String(a.wardNumber).startsWith(q) ? 1 : 9;
        const bNum = String(b.wardNumber) === q ? 0 : String(b.wardNumber).startsWith(q) ? 1 : 9;
        if (aNum !== bNum) return aNum - bNum;
        const aName = a.wardName.toLowerCase().includes(q) ? 0 : 1;
        const bName = b.wardName.toLowerCase().includes(q) ? 0 : 1;
        if (aName !== bName) return aName - bName;
        return a.wardNumber - b.wardNumber;
      })
      .slice(0, 8);
  }, [query, wards]);

  const handleSelect = (ward: WardEntry) => {
    onSelect(ward.wardNumber);
    setQuery("");
    setOpen(false);
    setSearchOpen(false);
  };

  const displayName = (w: WardEntry) => {
    return `Ward ${w.wardNumber} - ${w.zone}`;
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
          aria-label="Search wards"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      )}

      {/* Expanded: search input + dropdown */}
      {searchOpen && (
        <div className="relative">
          <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <svg className="w-4 h-4 ml-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
              placeholder="Search ward, area, or zone..."
              className="w-48 sm:w-56 px-2 py-2 text-sm bg-transparent outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
            <button
              onClick={() => {
                setQuery("");
                setOpen(false);
                setSearchOpen(false);
              }}
              className="px-2 py-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Results dropdown */}
          {open && filtered.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto z-10">
              {filtered.map((w) => (
                <button
                  key={w.wardNumber}
                  onClick={() => handleSelect(w)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                >
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {displayName(w)}
                  </div>
                </button>
              ))}
            </div>
          )}

          {open && query.trim() && filtered.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
              No wards found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
