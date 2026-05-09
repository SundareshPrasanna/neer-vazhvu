"use client";

import { useState, useRef, useEffect } from "react";

interface MapInfoButtonProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Compact (i) info button on the map. Collapsed by default on every
 * breakpoint; click to expand a small popover with sources / methodology
 * notes. Click outside to dismiss.
 *
 * Earlier this auto-expanded on desktop, which dominated the viewport
 * once the cascade overlay added its methodology brief.
 */
export function MapInfoButton({ children, className = "" }: MapInfoButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Map sources and methodology"
        aria-expanded={open}
        className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
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
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
      {open && (
        <div
          className="absolute top-10 left-0 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 w-[280px] sm:w-[320px] max-h-[70vh] overflow-y-auto z-10"
          role="dialog"
        >
          {children}
        </div>
      )}
    </div>
  );
}
