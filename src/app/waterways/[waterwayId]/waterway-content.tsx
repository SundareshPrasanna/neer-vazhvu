"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  WaterwayChapter,
  WaterwayClaim,
  WaterwayIdentity,
  WaterwayManifest,
  WaterwayReach,
  WaterwayTimelineEntry,
  WaterwayToday,
  WaterwayWidthLedger,
} from "@/lib/waterways/types";
import { ExplorerView } from "./explorer-view";
import { StoryView } from "./story-view";
import { MethodsPanel } from "./methods-panel";

/**
 * Root client shell: own chrome (site Header/Footer suppress on
 * /waterways), the Story | Explorer toggle, and hash-synced deep links
 * (#story, #explorer, #reach-N) so chapters and reaches can hand the
 * reader to each other without losing position (DECISIONS.md W1/W2).
 */
type Mode = "story" | "explorer";

export function WaterwayContent({
  manifest,
  identity,
  reaches,
  chapters,
  timeline,
  claims,
  today,
  widthLedger,
}: {
  manifest: WaterwayManifest;
  identity: WaterwayIdentity;
  reaches: WaterwayReach[];
  chapters: WaterwayChapter[];
  timeline: WaterwayTimelineEntry[];
  claims: WaterwayClaim[];
  today: WaterwayToday;
  widthLedger: WaterwayWidthLedger | null;
}) {
  const [mode, setMode] = useState<Mode>("story");
  const [selectedReach, setSelectedReach] = useState<number>(reaches[0]?.id ?? 1);

  // Hash -> state on load and back/forward.
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash;
      const m = h.match(/^#reach-(\d+)$/);
      if (m) {
        setMode("explorer");
        setSelectedReach(Number(m[1]));
      } else if (h === "#explorer") {
        setMode("explorer");
      } else if (h === "#story" || h === "") {
        setMode("story");
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const goExplorer = useCallback((reachId: number) => {
    setSelectedReach(reachId);
    setMode("explorer");
    history.replaceState(null, "", `#reach-${reachId}`);
    window.scrollTo({ top: 0 });
  }, []);

  const switchMode = useCallback((m: Mode) => {
    setMode(m);
    history.replaceState(null, "", m === "story" ? "#story" : "#explorer");
    window.scrollTo({ top: 0 });
  }, []);

  const selectReach = useCallback((id: number) => {
    setSelectedReach(id);
    history.replaceState(null, "", `#reach-${id}`);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Own chrome */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <Link
              href="/"
              className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              Neer Vazhvu
            </Link>
            <h1 className="truncate text-base font-semibold leading-tight">
              {manifest.displayName}
              <span className="ml-2 hidden text-sm font-normal text-muted-foreground sm:inline">
                {identity.scope}
              </span>
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 sm:inline">
              preview
            </span>
            <div
              role="tablist"
              aria-label="View"
              className="flex rounded-full border border-border bg-card p-0.5"
            >
              {(["story", "explorer"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                    mode === m
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="pt-8">
        {mode === "story" ? (
          <StoryView
            manifest={manifest}
            identity={identity}
            chapters={chapters}
            reaches={reaches}
            timeline={timeline}
            today={today}
            widthLedger={widthLedger}
            onExplore={goExplorer}
          />
        ) : (
          <ExplorerView
            manifest={manifest}
            reaches={reaches}
            selectedId={selectedReach}
            onSelect={selectReach}
          />
        )}
      </main>

      <MethodsPanel claimCount={claims.length} />

      <footer className="border-t border-border py-6">
        <div className="mx-auto max-w-6xl px-4 text-xs leading-relaxed text-muted-foreground">
          <p>
            {claims.length} sourced claims power this page; every number
            carries its receipt (<a href="#methods" className="underline hover:text-foreground">methods and uncertainty</a>). Base map data © OpenStreetMap contributors
            (ODbL). Satellite imagery contains modified Copernicus Sentinel
            data (2026). Assembled by Neer Vazhvu, August 2026.
          </p>
        </div>
      </footer>
    </div>
  );
}
