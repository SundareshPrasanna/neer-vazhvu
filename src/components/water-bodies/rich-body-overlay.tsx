"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { getRichBody } from "@/lib/water-bodies/rich-body-registry";

interface RichBodyOverlayProps {
  bodyId: string;
  onClose: () => void;
}

/**
 * Full-screen takeover for rich-data water bodies (Pallikaranai etc.).
 * Replaces the standard BottomSheet detail panel when a rich body is
 * clicked. Hosts an embedded map, timeline slider, change-tints, and
 * stats - all driven from the body's registry entry + pre-computed
 * analysis JSONs.
 *
 * V0: scaffold with title + close. Map + slider + tints + stats wired in
 * subsequent tickets.
 */
export function RichBodyOverlay({ bodyId, onClose }: RichBodyOverlayProps) {
  const body = getRichBody(bodyId);

  // Esc to close (parity with the standard panel behaviour)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!body) {
    return (
      <div className="fixed inset-0 z-[2000] bg-black/60 flex items-center justify-center">
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-md">
          <p className="text-sm">
            Rich-data body <code>{bodyId}</code> is not in the registry.
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-black/70 flex items-stretch">
      <div className="flex flex-col w-full md:max-w-[1100px] md:mx-auto md:my-4 md:rounded-xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-100 truncate">
              {body.name}
            </h2>
            {body.name_ta && (
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                {body.name_ta}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">
                Ramsar Site
              </span>
              {body.buffer_legal_basis && (
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                  NGT {body.buffer_metres! / 1000} km buffer
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-3 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - scaffold placeholder; map + slider + tints + stats land in T12-T15 */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-6 text-sm text-slate-500 dark:text-slate-400">
            Deep-zoom panel scaffold. The interactive map + timeline +
            change-tints + stats wire in over the next tickets. Data assets
            already shipped in <code className="text-xs">/data/rich-bodies/</code>
            and <code className="text-xs">/geojson/rich-bodies/</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
