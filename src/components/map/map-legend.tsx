"use client";

import { useState, type ReactNode } from "react";

/** Collapsible legend card over a map, open by default. */
export function MapLegend({
  title,
  children,
  className = "p-3",
  titleClassName = "text-slate-500 dark:text-slate-400 uppercase",
  bodyClassName = "mt-2 space-y-1",
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
  bodyClassName?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 ${className}`}>
      <button onClick={() => setExpanded((v) => !v)} className="flex items-center justify-between w-full">
        <h4 className={`text-xs font-semibold ${titleClassName}`}>{title}</h4>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`${expanded ? "block" : "hidden"} ${bodyClassName}`}>{children}</div>
    </div>
  );
}

/** A legend entry that shows or hides category `id`; faded while hidden (or `dim`). */
export function LegendRow({
  id,
  hidden,
  onToggle,
  className = "text-xs whitespace-nowrap",
  dim = false,
  title,
  children,
}: {
  id: string;
  hidden?: Set<string>;
  onToggle?: (id: string) => void;
  className?: string;
  dim?: boolean;
  title?: string;
  children: ReactNode;
}) {
  const off = hidden?.has(id) ?? false;
  return (
    <button
      onClick={() => onToggle?.(id)}
      title={title}
      className={`flex items-center gap-2 ${className} w-full text-left transition-opacity ${off ? "opacity-30" : dim ? "opacity-35" : ""} ${onToggle ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded" : ""}`}
    >
      {children}
    </button>
  );
}
