"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CONFIDENT, searchPlaces, type PlaceTerms } from "@/lib/places/search";
import { PlaceRequestPrompt } from "@/components/landing/place-request-prompt";

export type PlaceSearchEntry = PlaceTerms & { card: ReactNode };

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
 *
 * The search runs over `places`, one entry per city, district and state with
 * its card, built from the registries on the server. The query is kept in
 * ?q= for the same reasons, read after mount, so a shared link or a return
 * from sign-in lands on the same results.
 */
export function PlaceBoard({
  cities,
  districts,
  counts,
  places,
}: {
  cities: ReactNode;
  districts: ReactNode;
  counts: Record<View, number>;
  places: PlaceSearchEntry[];
}) {
  const [view, setView] = useState<View>("cities");
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchPlaces(query, places), [query, places]);
  const searching = query.trim().length > 0;
  const found = matches.some((m) => m.score >= CONFIDENT);

  // The server always renders the Cities view with no search (there is no
  // URL on the server), so the hash and ?q= are read once after mount, then
  // the hash is followed.
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash;
      if (h === "#districts") setView("districts");
      else if (h === "#cities") setView("cities");
    };
    const onLoad = () => {
      onHash();
      const q = new URL(window.location.href).searchParams.get("q") ?? "";
      setQuery(q);
      // A shared search link may carry no #cities.
      if (q && !window.location.hash) document.getElementById("cities")?.scrollIntoView();
    };
    onLoad();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function search(next: string) {
    setQuery(next);
    const url = new URL(window.location.href);
    if (next.trim()) url.searchParams.set("q", next);
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  }

  function choose(next: View) {
    // A tab is a way back to browsing: it clears the search.
    if (searching) search("");
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

      <div className="relative mt-6 max-w-md">
        <label htmlFor="place-search" className="sr-only">
          Search a city, district or state
        </label>
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
        </svg>
        <input
          id="place-search"
          type="search"
          value={query}
          onChange={(e) => search(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && search("")}
          placeholder="Search a city, district or state"
          autoComplete="off"
          maxLength={80}
          aria-controls="place-results"
          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        />
      </div>

      <div id="place-results" aria-live="polite">
        {searching && (
          <>
            {matches.length > 0 && (
              <>
                <p className="mt-8 text-sm text-slate-600 dark:text-slate-300">
                  {found
                    ? `${matches.length} ${matches.length === 1 ? "place matches" : "places match"} \u201c${query.trim()}\u201d`
                    : `No exact match for \u201c${query.trim()}\u201d. Closest:`}
                </p>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {matches.map((m) => (
                    <div key={m.place.id}>{m.place.card}</div>
                  ))}
                </div>
              </>
            )}
            {!found && <PlaceRequestPrompt key={query.trim()} query={query.trim()} afterNear={matches.length > 0} />}
          </>
        )}
      </div>

      <div id="place-panel-cities" role="tabpanel" hidden={searching || view !== "cities"}>
        {cities}
      </div>
      <div id="place-panel-districts" role="tabpanel" hidden={searching || view !== "districts"}>
        {districts}
      </div>
    </>
  );
}
