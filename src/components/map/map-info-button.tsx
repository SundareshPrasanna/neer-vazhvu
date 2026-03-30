"use client";

import { useState, useRef, useEffect } from "react";

interface MapInfoButtonProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * On desktop (sm+): renders children as a normal overlay.
 * On mobile: renders an (i) icon that expands to show the content on tap.
 */
export function MapInfoButton({ children, className = "" }: MapInfoButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when tapping outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className={className}>
      {/* Desktop: show full content */}
      <div className="hidden sm:block bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
        {children}
      </div>

      {/* Mobile: info icon + expandable popover */}
      <div className="sm:hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400"
          aria-label="Data info"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        {open && (
          <div className="absolute top-10 left-0 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2 min-w-[200px] max-w-[280px] z-10">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
