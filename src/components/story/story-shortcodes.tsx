"use client";

/**
 * Visual building blocks for city water-story pages.
 *
 * Pages compose these shortcodes like JSX-flavored markdown - prose
 * paragraphs interleaved with figures, pull-quotes, and live data
 * widgets. Every Figure enforces caption + source attribution at the
 * component level (we do not ship images without provenance).
 */

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/context";

interface HeroProps {
  src: string;
  alt: string;
  /** Where the image came from (Wikimedia, British Library, our own GEE pipeline, etc.) */
  source: string;
  /** One-line credit; e.g. "Photograph by Lala Deen Dayal, c. 1885." */
  credit?: string;
}

export function Hero({ src, alt, source, credit }: HeroProps) {
  const { t } = useLanguage();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Scroll-driven parallax. We translate the inner image at ~25% of
  // the page scroll while the hero is near the viewport, so the photo
  // drifts behind the prose as the reader moves on. Cheap (rAF + a
  // single style mutation per frame) and degrades to a static image
  // for users with prefers-reduced-motion (the CSS class pins it).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Cap at +/- 200px so the image can't drift off its bleed area.
      const offset = Math.max(-200, Math.min(200, -rect.top * 0.25));
      el.style.setProperty("--hero-parallax", `${offset}px`);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <figure className="relative w-full h-[40vh] sm:h-[55vh] mb-8 overflow-hidden rounded-lg">
      <div
        ref={wrapperRef}
        className="absolute inset-0 will-change-transform"
        style={{ transform: "translate3d(0, var(--hero-parallax, 0px), 0)" }}
      >
        {/* Slight bleed (-6%) so the Ken Burns scale never reveals a
            transparent edge as the image drifts. */}
        <div className="absolute inset-[-6%] hero-kenburns">
          <Image
            src={src}
            alt={alt}
            fill
            priority
            sizes="(min-width: 1024px) 896px, 100vw"
            className="object-cover"
          />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
      <figcaption className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded">
        {credit ? `${credit} · ` : ""}
        {t("story.source")} {source}
      </figcaption>
    </figure>
  );
}

interface LedeProps {
  children: React.ReactNode;
}

export function Lede({ children }: LedeProps) {
  return (
    <p className="text-xl sm:text-2xl font-medium leading-relaxed text-slate-800 dark:text-slate-100 mb-10 max-w-3xl">
      {children}
    </p>
  );
}

interface ChapterProps {
  /** Stable id used for the in-page anchor and pull-quote permalinks. */
  id: string;
  number: number;
  /** Short kicker - e.g. "How it worked", "How it broke". */
  title: string;
  /** One-line thesis for the chapter. Italic, sits under the title. */
  thesis: string;
  children: React.ReactNode;
}

export function Chapter({ id, number, title, thesis, children }: ChapterProps) {
  const { t } = useLanguage();
  return (
    <section id={id} className="mb-16 scroll-mt-24">
      <header className="mb-6 border-l-4 border-blue-600 pl-4">
        <div className="text-[11px] uppercase tracking-[0.15em] text-blue-700 dark:text-blue-400 font-semibold">
          {t("story.chapter")} {number}
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
          {title}
        </h2>
        <p className="text-base text-slate-600 dark:text-slate-400 italic mt-1">
          {thesis}
        </p>
      </header>
      <div className="story-prose max-w-3xl text-base leading-relaxed text-slate-700 dark:text-slate-300 [&>p]:mb-4 [&>p]:leading-relaxed [&>ul]:mb-4 [&>ul]:list-disc [&>ul]:pl-6 [&>ul>li]:mb-2 [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline [&_strong]:text-slate-900 dark:[&_strong]:text-slate-100 [&_em]:italic">
        {children}
      </div>
    </section>
  );
}

interface FigureProps {
  src: string;
  alt: string;
  caption: string;
  source: string;
  /** Optional credit line; e.g. "Lala Deen Dayal, c. 1885" */
  credit?: string;
  /** Width hint - "full" stretches across the prose column, "wide" breaks out of it. Default "full". */
  size?: "full" | "wide";
  /** Image natural ratio to avoid layout shift before the file loads. Default 16:9. */
  aspect?: string;
  /** "cover" crops to fill (good for photos); "contain" letterboxes to show
   *  the whole image (good for maps, diagrams, dense documents). Default "cover". */
  fit?: "cover" | "contain";
}

export function Figure({
  src,
  alt,
  caption,
  source,
  credit,
  size = "full",
  aspect = "16/9",
  fit = "cover",
}: FigureProps) {
  const { t } = useLanguage();
  // "wide" breaks well past the prose column. The negative margins are
  // heavy on large screens so detailed images (maps, diagrams) render
  // close to viewport width rather than being squeezed into the
  // 768px reading column.
  const wrapperCls =
    size === "wide"
      ? "my-8 -mx-6 sm:-mx-12 md:-mx-24 lg:-mx-40 xl:-mx-56"
      : "my-8";
  // For "contain" we add a subtle background so letterboxed sides don't
  // sit awkwardly against the prose - especially noticeable in dark mode.
  const innerCls = fit === "contain"
    ? "relative w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
    : "relative w-full overflow-hidden rounded-lg";
  const imgCls = fit === "contain" ? "object-contain" : "object-cover";
  return (
    <figure className={wrapperCls}>
      <div className={innerCls} style={{ aspectRatio: aspect }}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={size === "wide" ? "100vw" : "(min-width: 1024px) 768px, 100vw"}
          className={imgCls}
        />
      </div>
      <figcaption className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
        <span className="text-slate-700 dark:text-slate-300">{caption}</span>
        {" "}
        <span className="text-slate-400 dark:text-slate-500">
          {credit ? `· ${credit} ` : ""}· {t("story.source")} {source}
        </span>
      </figcaption>
    </figure>
  );
}

interface TimeLapseProps {
  /** Path under /public/, e.g. "/images/story/madurai/vandiyur-2018-2026.gif" */
  src: string;
  alt: string;
  caption: string;
  /** GEE / Sentinel-2 / Landsat - the source of the underlying tiles. */
  source: string;
}

export function TimeLapse({ src, alt, caption, source }: TimeLapseProps) {
  const { t } = useLanguage();
  // GIFs need a plain <img> - next/image won't animate them.
  return (
    <figure className="my-8">
      <div className="relative w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="w-full h-auto" />
      </div>
      <figcaption className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
        <span className="text-slate-700 dark:text-slate-300">{caption}</span>{" "}
        <span className="text-slate-400 dark:text-slate-500">· {t("story.source")} {source}</span>
      </figcaption>
    </figure>
  );
}

interface BeforeAfterProps {
  /** Older / "then" image. Sits underneath; revealed on the left. */
  beforeSrc: string;
  beforeAlt: string;
  beforeLabel: string; // e.g. "1870" or "Pre-encroachment"
  /** Newer / "now" image. Sits on top; clipped from the right. */
  afterSrc: string;
  afterAlt: string;
  afterLabel: string; // e.g. "2026"
  caption: string;
  source: string;
  credit?: string;
  /** Image natural ratio. Default 4/3 (works for most archival prints). */
  aspect?: string;
  /** Initial handle position 0-100. Default 50. */
  initial?: number;
}

/**
 * Draggable before/after image scrubber. The reader pulls a handle
 * across the figure to wipe between two states - typically a historical
 * photograph and a present-day equivalent of the same view. We keep
 * the rest of the Figure contract (caption + source + credit) intact
 * so attribution lives in the same place across all story figures.
 */
export function BeforeAfter({
  beforeSrc,
  beforeAlt,
  beforeLabel,
  afterSrc,
  afterAlt,
  afterLabel,
  caption,
  source,
  credit,
  aspect = "4/3",
  initial = 50,
}: BeforeAfterProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(initial);
  const draggingRef = useRef(false);

  // Pointer events handle mouse + touch + pen uniformly. We capture
  // the pointer on the container so a fast drag past the figure edge
  // still updates until release.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      const pct = ((clientX - rect.left) / rect.width) * 100;
      setPos(Math.max(0, Math.min(100, pct)));
    };
    const onDown = (e: PointerEvent) => {
      draggingRef.current = true;
      el.setPointerCapture(e.pointerId);
      update(e.clientX);
    };
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      update(e.clientX);
    };
    const onUp = (e: PointerEvent) => {
      draggingRef.current = false;
      try { el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); setPos((p) => Math.max(0, p - 5)); }
    if (e.key === "ArrowRight") { e.preventDefault(); setPos((p) => Math.min(100, p + 5)); }
    if (e.key === "Home") { e.preventDefault(); setPos(0); }
    if (e.key === "End") { e.preventDefault(); setPos(100); }
  };

  return (
    <figure className="my-8">
      <div
        ref={containerRef}
        role="slider"
        tabIndex={0}
        aria-label={`${beforeLabel} vs ${afterLabel}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        onKeyDown={onKey}
        className="relative w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 select-none touch-none cursor-ew-resize focus:outline-none focus:ring-2 focus:ring-blue-500"
        style={{ aspectRatio: aspect }}
      >
        {/* "Before" sits underneath - shown on the left side of the wipe. */}
        <Image src={beforeSrc} alt={beforeAlt} fill sizes="(min-width: 1024px) 768px, 100vw" className="object-cover pointer-events-none" />
        {/* "After" is clipped from the right; the visible portion grows
            with `pos`. inset-y/left=0, right calculated as 100-pos. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          <Image src={afterSrc} alt={afterAlt} fill sizes="(min-width: 1024px) 768px, 100vw" className="object-cover" />
        </div>
        {/* Labels */}
        <div className="absolute top-2 left-2 bg-black/60 text-white text-[11px] px-2 py-0.5 rounded font-semibold tracking-wide pointer-events-none">
          {beforeLabel}
        </div>
        <div className="absolute top-2 right-2 bg-black/60 text-white text-[11px] px-2 py-0.5 rounded font-semibold tracking-wide pointer-events-none">
          {afterLabel}
        </div>
        {/* Divider + handle */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.25)] pointer-events-none"
          style={{ left: `${pos}%` }}
        />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-700 pointer-events-none"
          style={{ left: `${pos}%` }}
          aria-hidden
        >
          <span className="text-base leading-none font-bold">⇔</span>
        </div>
      </div>
      <figcaption className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
        <span className="text-slate-700 dark:text-slate-300">{caption}</span>{" "}
        <span className="text-slate-400 dark:text-slate-500">
          {credit ? `· ${credit} ` : ""}· {t("story.source")} {source}
        </span>
      </figcaption>
    </figure>
  );
}

interface PullQuoteProps {
  children: React.ReactNode;
  /** Optional attribution line, e.g. "Columbia GSAPP, 2016" */
  attribution?: string;
}

export function PullQuote({ children, attribution }: PullQuoteProps) {
  return (
    <blockquote className="my-10 border-y-2 border-blue-600/30 dark:border-blue-400/30 py-6 px-4 bg-blue-50/40 dark:bg-blue-950/20 rounded">
      <p className="text-xl sm:text-2xl font-semibold leading-snug text-slate-900 dark:text-slate-100 not-italic">
        &ldquo;{children}&rdquo;
      </p>
      {attribution && (
        <footer className="text-xs text-slate-500 dark:text-slate-400 mt-3 uppercase tracking-wider">
          {attribution}
        </footer>
      )}
    </blockquote>
  );
}

interface CTAProps {
  href: string;
  children: React.ReactNode;
}

export function CTA({ href, children }: CTAProps) {
  const isExternal = /^https?:\/\//.test(href);
  // Dark mode keeps the same dark-blue tone instead of flipping to a
  // bright white pill (which clashes with the dark background and reads
  // as a quote/highlight rather than an action). `mr-2 mb-2` gives
  // adjacent CTAs breathing room when stacked or wrapped on a row.
  // `!text-white !no-underline` use Tailwind's important modifier to
  // beat the Chapter wrapper's `[&_a]:text-blue-600 [&_a]:underline`
  // descendant rule (which otherwise renders the pill as blue-on-blue
  // and adds an underline through the label).
  const cls =
    "inline-flex items-center gap-2 mt-4 mr-2 mb-2 px-4 py-2.5 rounded-md " +
    "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 " +
    "!text-white text-sm font-medium transition-colors !no-underline";
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
        <span aria-hidden>→</span>
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

interface StatRowProps {
  label: string;
  value: string;
  unit?: string;
  /** Tiny note below the value - usually the date/source */
  note?: string;
}

export function StatRow({ label, value, unit, note }: StatRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-slate-200 dark:border-slate-800 last:border-0">
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <span className="text-right">
        <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">{value}</span>
        {unit && <span className="text-xs text-slate-500 ml-1">{unit}</span>}
        {note && <div className="text-[10px] text-slate-400 mt-0.5">{note}</div>}
      </span>
    </div>
  );
}

/**
 * "Then vs now" comparison block - two columns of StatRows.
 */
interface ThenNowProps {
  thenLabel: string;
  nowLabel: string;
  rows: { metric: string; then: string; now: string; verdict?: "better" | "worse" | "same" }[];
}

export function ThenNow({ thenLabel, nowLabel, rows }: ThenNowProps) {
  // Note: thenLabel/nowLabel/rows.then/rows.now/rows.metric are passed
  // pre-translated by the (city-language)-aware story content file.
  // Verdict badge text is the only chrome we localise here.
  const { t } = useLanguage();
  const VERDICT_COLOR = {
    better: "text-emerald-700 dark:text-emerald-400",
    worse: "text-rose-700 dark:text-rose-400",
    same: "text-slate-600 dark:text-slate-400",
  } as const;
  return (
    <div className="my-8 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="grid grid-cols-3 bg-slate-50 dark:bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
        <div className="px-3 py-2"></div>
        <div className="px-3 py-2 border-l border-slate-200 dark:border-slate-700">{thenLabel}</div>
        <div className="px-3 py-2 border-l border-slate-200 dark:border-slate-700">{nowLabel}</div>
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-3 text-sm border-t border-slate-200 dark:border-slate-800"
        >
          <div className="px-3 py-2.5 text-slate-700 dark:text-slate-300">{row.metric}</div>
          <div className="px-3 py-2.5 border-l border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
            {row.then}
          </div>
          <div className={`px-3 py-2.5 border-l border-slate-200 dark:border-slate-800 font-semibold ${row.verdict ? VERDICT_COLOR[row.verdict] : "text-slate-900 dark:text-slate-100"}`}>
            {row.now}
          </div>
        </div>
      ))}
    </div>
  );
}
