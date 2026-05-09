"use client";

import { Network } from "lucide-react";

interface CascadeToggleProps {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}

/**
 * Small button that toggles the cascade reconstruction overlay on
 * /<city>/water-bodies. Default state is off; when pressed, the parent
 * dynamic-imports the cascade map layer (so the layer code and the
 * protomaps-leaflet runtime stay out of the initial bundle).
 */
export function CascadeToggle({ pressed, onPressedChange }: CascadeToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onPressedChange(!pressed)}
      aria-pressed={pressed}
      title={
        pressed
          ? "Hide cascade reconstruction overlay"
          : "Show cascade reconstruction overlay"
      }
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
        pressed
          ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950 dark:text-sky-200"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      <Network className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Cascade</span>
    </button>
  );
}
