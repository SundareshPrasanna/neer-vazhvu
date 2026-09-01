"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type View = "cities" | "districts";

const VIEWS: { id: View; label: string }[] = [
  { id: "cities", label: "Cities" },
  { id: "districts", label: "Districts" },
];

const INTRO: Record<View, string> = {
  cities:
    "Each city is its own dashboard, built on whatever public data can carry an honest picture.",
  districts:
    "A district is the administrative view of its river basin: blocks compared, groundwater by taluk, and a directory of every Gram Panchayat, with the gaps named.",
};

/**
 * The landing page's places board: one section, two views. The cards are
 * server-rendered and passed in as children, so this component owns only the
 * switch. The view is kept in the URL hash (#cities / #districts) rather than
 * a search param: the landing page stays statically rendered, deep links
 * work, and the existing #cities anchor keeps resolving.
 */
export function PlaceBoard({
  cities,
  districts,
  counts,
}: {
  cities: ReactNode;
  districts: ReactNode;
  counts: Record<View, number>;
}) {
  const [view, setView] = useState<View>("cities");

  // The server always renders the Cities view (there is no hash on the
  // server), so the hash is read once after mount, then followed.
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash;
      if (h === "#districts") setView("districts");
      else if (h === "#cities") setView("cities");
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function choose(next: View) {
    setView(next);
    // replaceState, not a hash assignment: switching a tab must not scroll
    // the page or add a history entry.
    window.history.replaceState(null, "", `#${next}`);
  }

  return (
    <>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Places
          </h2>
          <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
            {INTRO[view]}
          </p>
        </div>
        <div
          id="districts"
          role="tablist"
          aria-label="Choose a place type"
          className="scroll-mt-24 inline-flex shrink-0 self-start rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1"
        >
          {VIEWS.map((v) => {
            const active = v.id === view;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`place-panel-${v.id}`}
                onClick={() => choose(v.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500",
                  active
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100",
                )}
              >
                {v.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                    active
                      ? "bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300"
                      : "bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
                  )}
                >
                  {counts[v.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div id="place-panel-cities" role="tabpanel" hidden={view !== "cities"}>
        {cities}
      </div>
      <div id="place-panel-districts" role="tabpanel" hidden={view !== "districts"}>
        {districts}
      </div>
    </>
  );
}
