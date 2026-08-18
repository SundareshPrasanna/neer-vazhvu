"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type {
  WaterwayChapter,
  WaterwayIdentity,
  WaterwayManifest,
  WaterwayReach,
  WaterwayTimelineEntry,
} from "@/lib/waterways/types";
import { FactLine, SourceChip } from "./claim-chip";
import { TimelineView } from "./timeline-view";
import { WidthProfileChart } from "./width-profile-chart";

/**
 * The Story: eight chapters, Ennore to Mahabalipuram, scroll = chainage.
 * Depth level L0 is what renders on first paint: a verdict and one visual
 * per chapter. Every denser layer (receipts, reaches, sources) arrives only
 * by the reader's click (DECISIONS.md W2).
 *
 * Chapter prose lives here by design: the story is this page's editorial
 * voice; the numbers it leans on all come from the curated, gated data
 * (facts carry claim ids; the verify script owns the banned-claims list).
 */

const CHAPTER_BODY: Record<string, string> = {
  open:
    "This page walks the canal end to end, north to south, the way the " +
    "water does. Everything on it is measured or cited: widths from 373 " +
    "transects, the satellite record from this summer, and the paper " +
    "trail from the government's own documents. Click any number for its " +
    "source.",
  ennore:
    "The canal enters Chennai through its heaviest industry: two power " +
    "stations, a refinery belt, a port. On the regulator's current " +
    "consent books, none of it may discharge process effluent into the " +
    "canal. The measured record keeps disagreeing, and this week it " +
    "disagreed in dead fish.",
  squeeze:
    "Through the city the canal threads under the MRTS railway, built " +
    "along and over it from the 1980s on a corridor chosen because no " +
    "other was economically available. The court order that demands the " +
    "canal's restoration exempts the railway's pillars. What remains is " +
    "the narrowest water on the alignment, holding the city's worst " +
    "monitoring numbers.",
  okkiyam:
    "South Chennai drains through one channel into this canal. When it " +
    "is open, the marsh breathes with the tide and flamingos winter " +
    "there. In 2026 construction squeezed it to less than a bus length, " +
    "and the system answered: hyacinth, sewage backup, and a wintering " +
    "ground with no flamingos for the first half of the year.",
  estuary:
    "Below the city the canal widens into backwaters the tide still " +
    "reaches, and everything changes: birds in the dozens of species, " +
    "working fishers, a boat house, brackish water too salty for " +
    "hyacinth. The whole system hangs on mouths that sand shuts for " +
    "most of the year.",
  ribbon:
    "The last stretch is the canal as the city forgot it: no railway, " +
    "no walls, banks intact, and a channel so overgrown it reads from " +
    "orbit as a green ribbon. It is simultaneously the least damaged " +
    "and least tended water on the alignment, and its neighbouring " +
    "wetland is now proposed as a reservoir.",
  paper:
    "The canal has never lacked paperwork. It has a national-waterway " +
    "designation, a High Court restoration order, audits, a dropped " +
    "detailed project report, an umbrella sanction, and a live tender. " +
    "What it lacks is one agency that both owns it and holds a funded " +
    "mandate for it.",
  pilot:
    "The state's plans for the canal now outrun its knowledge of it. " +
    "The best monthly water-quality series stopped in 2023. No gauge " +
    "sits on the canal. The fish-kill samples of this week await a lab. " +
    "This page is what a measured baseline looks like; a pilot is the " +
    "machinery that keeps it alive: levels, oxygen, mouth state, " +
    "bathymetry, and ground-truth on every reach.",
};

function ChapterVisual({
  chapter,
  manifest,
  identity,
  timeline,
}: {
  chapter: WaterwayChapter;
  manifest: WaterwayManifest;
  identity: WaterwayIdentity;
  timeline: WaterwayTimelineEntry[];
}) {
  const chip = (name: string, alt: string) => (
    <figure>
      <Image
        src={`/data/waterways/${manifest.waterwayId}/chips/${name}`}
        alt={alt}
        width={1100}
        height={800}
        loading="lazy"
        unoptimized
        className="w-full rounded-xl border border-border"
      />
      <figcaption className="mt-1 text-[11px] text-muted-foreground">
        Sentinel-2, Jun–Aug 2026 composite. Contains modified Copernicus
        Sentinel data (2026).
      </figcaption>
    </figure>
  );
  switch (chapter.key) {
    case "open":
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
    case "ennore":
      return chip("site-ennore-junction.png", "The Ennore creek junction from orbit");
    case "squeeze":
      return <WidthProfileChart waterwayId={manifest.waterwayId} />;
    case "okkiyam":
      return chip("site-okkiyam-maduvu.png", "The Okkiyam Maduvu confluence area from orbit");
    case "estuary":
      return chip("site-muttukadu.png", "The Muttukadu backwater from orbit");
    case "ribbon":
      return chip("seg-km64-66.png", "The vegetation-choked southern canal from orbit");
    case "paper":
      return <TimelineView timeline={timeline} />;
    case "pilot":
      return (
        <ul className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm text-foreground/90">
          {[
            "Water level and flow at the reaches that decide floods",
            "Dissolved oxygen where the monitoring record went dark",
            "Mouth state at Ennore, Adyar and Muttukadu, continuously",
            "A boat-run bathymetry transect: the first depth profile since 2014",
            "Ground-truth on the vegetation the satellite flags",
          ].map((x) => (
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
  reaches,
  timeline,
  onExplore,
}: {
  manifest: WaterwayManifest;
  identity: WaterwayIdentity;
  chapters: WaterwayChapter[];
  reaches: WaterwayReach[];
  timeline: WaterwayTimelineEntry[];
  onExplore: (reachId: number) => void;
}) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const byId = new Map(reaches.map((r) => [r.id, r]));

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

  return (
    <div className="mx-auto flex max-w-5xl gap-8 px-4 pb-24">
      {/* Chapter rail (desktop) */}
      <nav
        aria-label="Chapters"
        className="sticky top-24 hidden h-fit shrink-0 self-start md:block"
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

      {/* Chapters */}
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
              className="scroll-mt-24"
            >
              <div className="font-mono text-xs uppercase tracking-widest text-primary">
                {i === 0
                  ? identity.scope
                  : ch.km
                    ? `km ${ch.km[0]} – ${ch.km[1]}`
                    : "the whole canal"}
              </div>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                {ch.title}
              </h2>
              <p className="mt-3 max-w-2xl text-lg leading-relaxed text-foreground">
                {ch.verdict}
              </p>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
                {CHAPTER_BODY[ch.key]}
              </p>

              <div className="mt-6">
                <ChapterVisual
                  chapter={ch}
                  manifest={manifest}
                  identity={identity}
                  timeline={timeline}
                />
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
    </div>
  );
}
