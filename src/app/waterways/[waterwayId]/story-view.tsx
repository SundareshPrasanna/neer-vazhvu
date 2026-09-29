"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import type {
  WaterwayLocatorAnchor,
  WaterwayChapter,
  WaterwayIdentity,
  WaterwayManifest,
  WaterwayReach,
  WaterwayStory,
  WaterwayStoryVisual,
  WaterwayTimelineEntry,
  WaterwayToday,
  WaterwayWidthLedger,
} from "@/lib/waterways/types";
import { FactLine, SourceChip } from "./claim-chip";
import { LocatorMap } from "./locator-map";
import { TimelineView } from "./timeline-view";
import { TodayPanel } from "./today-panel";
import { WidthLedger } from "./width-ledger";

// recharts stays out of the first load; the placeholder matches the chart's height.
const WidthProfileChart = dynamic(
  () => import("./width-profile-chart").then((m) => m.WidthProfileChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-56 animate-pulse rounded-lg bg-muted/50" aria-hidden />
    ),
  },
);

/**
 * The Story: a waterway's chapters in chainage order, scroll = chainage.
 * Depth level L0 is what renders on first paint: a verdict and one visual
 * per chapter. Every denser layer (receipts, reaches, sources) arrives only
 * by the reader's click (DECISIONS.md W2).
 *
 * Chapter prose and visuals are the waterway's own (lib/waterways/<id>.story.ts);
 * the numbers they lean on all come from the curated, gated data.
 */
function ChapterVisual({
  chapter,
  visual,
  manifest,
  identity,
  timeline,
}: {
  chapter: WaterwayChapter;
  visual: WaterwayStoryVisual | undefined;
  manifest: WaterwayManifest;
  identity: WaterwayIdentity;
  timeline: WaterwayTimelineEntry[];
}) {
  if (chapter.key === "open") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {identity.headline_stats.map((s) => (
          <div
            key={s.claim_id}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="text-2xl font-semibold tabular-nums text-foreground">
              {s.value}
            </div>
            <div className="mt-1 text-xs leading-snug text-muted-foreground">
              {s.label}
              <SourceChip source={s.source} date={s.date} flag={s.flag} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  switch (visual?.kind) {
    case "chip":
      return (
        <figure>
          <div className="relative">
            <Image
              src={`/images/waterways/${manifest.waterwayId}/chips/${visual.file}`}
              alt={visual.alt}
              width={1100}
              height={800}
              loading="lazy"
              unoptimized
              className="w-full rounded-xl border border-border"
            />
            <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
              Sentinel-2 · Jun–Aug 2026
            </span>
          </div>
          <figcaption className="mt-1 text-[11px] text-muted-foreground">
            Sentinel-2, 10 m per pixel: each dot is a 10 m square. Site views
            are a clearest-pixel composite (Jun–Aug 2026), about 8 km across;
            segment views are a median composite of the same window. Contains modified Copernicus Sentinel data (2026).
          </figcaption>
        </figure>
      );
    case "width-profile":
      return (
        <WidthProfileChart
          waterwayId={manifest.waterwayId}
          xLabel={visual.xLabel}
          band={visual.band}
          caption={visual.caption}
        />
      );
    case "timeline":
      return <TimelineView timeline={timeline} />;
    case "list":
      return (
        <ul className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm text-foreground/90">
          {visual.items.map((x) => (
            <li key={x} className="flex gap-2">
              <span aria-hidden className="text-primary">■</span>
              {x}
            </li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

export function StoryView({
  manifest,
  identity,
  chapters,
  story,
  reaches,
  timeline,
  today,
  widthLedger,
  locatorAnchors,
  onExplore,
}: {
  manifest: WaterwayManifest;
  identity: WaterwayIdentity;
  chapters: WaterwayChapter[];
  story: WaterwayStory;
  reaches: WaterwayReach[];
  timeline: WaterwayTimelineEntry[];
  today: WaterwayToday;
  widthLedger: WaterwayWidthLedger | null;
  locatorAnchors: WaterwayLocatorAnchor[];
  onExplore: (reachId: number) => void;
}) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const byId = useMemo(
    () => new Map(reaches.map((r) => [r.id, r])),
    [reaches]
  );

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = Number((e.target as HTMLElement).dataset.chapter);
            if (!Number.isNaN(idx)) setActive(idx);
          }
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    refs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // The observer's setActive fires at every chapter crossing; memoizing
  // the sections keeps that re-render to the rail alone (the chapters
  // hold the profile chart, locators and receipt lists - a heavy tree).
  const sections = useMemo(
    () => (
      <div className="min-w-0 flex-1 space-y-20 pt-4">
        {chapters.map((ch, i) => {
          const chapterFacts = ch.reach_ids
            .flatMap((id) => (byId.get(id)?.facts ?? []).slice(0, 2))
            .slice(0, 5);
          return (
            <section
              key={ch.key}
              id={`ch-${ch.key}`}
              data-chapter={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className="scroll-mt-36"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-xs uppercase tracking-widest text-primary">
                    {i === 0
                      ? identity.scope
                      : ch.km
                        ? `km ${ch.km[0]} – ${ch.km[1]}`
                        : "end to end"}
                  </div>
                  <h2 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                    {ch.title}
                  </h2>
                </div>
                {ch.km && (
                  <div className="hidden sm:block">
                    <LocatorMap
                      waterwayId={manifest.waterwayId}
                      span={ch.km}
                      anchors={locatorAnchors}
                    />
                  </div>
                )}
              </div>
              <p className="mt-3 max-w-2xl text-lg leading-relaxed text-foreground">
                {ch.verdict}
              </p>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
                {story.chapters[ch.key]?.body}
              </p>

              <div className="mt-6">
                <ChapterVisual
                  chapter={ch}
                  visual={story.chapters[ch.key]?.visual}
                  manifest={manifest}
                  identity={identity}
                  timeline={timeline}
                />
                {ch.key === "open" && (
                  <TodayPanel
                    today={today}
                    lengthKm={identity.length_km}
                    anchors={locatorAnchors}
                    noun={story.noun}
                    note={story.todayNote}
                  />
                )}
                {ch.key === story.ledgerChapter && widthLedger && (
                  <WidthLedger ledger={widthLedger} />
                )}
              </div>

              {chapterFacts.length > 0 && (
                <details className="group mt-5 rounded-xl border border-border bg-card">
                  <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="mr-2 inline-block transition-transform group-open:rotate-90">
                      ▸
                    </span>
                    The receipts ({chapterFacts.length})
                  </summary>
                  <ul className="space-y-3 px-4 pb-4">
                    {chapterFacts.map((f) => (
                      <FactLine key={f.claim_id} fact={f} />
                    ))}
                  </ul>
                </details>
              )}

              {ch.reaches.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {ch.reaches.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onExplore(r.id)}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground/90 transition-colors hover:border-primary/50 hover:bg-primary/5"
                    >
                      {r.name} · km {r.km[0]}–{r.km[1]} →
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [byId, chapters, story, reaches, timeline, today, widthLedger, locatorAnchors, manifest, identity, onExplore]
  );

  return (
    <div className="mx-auto flex max-w-5xl gap-8 px-4 pb-24">
      {/* Chapter rail (desktop) */}
      <nav
        aria-label="Chapters"
        className="sticky top-36 hidden h-fit shrink-0 self-start md:block"
      >
        <ol className="space-y-3 border-l border-border pl-4">
          {chapters.map((ch, i) => (
            <li key={ch.key}>
              <a
                href={`#ch-${ch.key}`}
                className={`block max-w-36 text-xs leading-snug transition-colors ${
                  active === i
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {ch.km && (
                  <span className="block font-mono text-[10px] opacity-70">
                    km {ch.km[0]}–{ch.km[1]}
                  </span>
                )}
                {ch.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections}
    </div>
  );
}
