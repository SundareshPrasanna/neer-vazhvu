import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The few shapes every Atlas page is built from, in the slate scale the city
 * pages use. No Atlas stylesheet: these are Tailwind over the shared tokens,
 * light and dark, so the district reads as one more place on the platform
 * rather than a second design system.
 */

export type Tone = "positive" | "warning" | "neutral" | "blocked";

const TONE_CLASSES: Record<Tone, string> = {
  positive:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  warning:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  neutral:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  blocked:
    "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300",
};

const TONE_LABELS: Record<Tone, string> = {
  positive: "Within limits",
  warning: "Watch",
  neutral: "Not characterised",
  blocked: "Blocked",
};

export function ToneBadge({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {TONE_LABELS[tone]}
    </span>
  );
}

export function AtlasContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

/** A page section: heading, one-paragraph intro, then whatever it holds. */
export function AtlasSection({
  id,
  title,
  intro,
  children,
  className,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-20 py-8 sm:py-10", className)}>
      <header className="mb-4">
        <h2 id={`${id}-title`} className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {intro ? <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-400">{intro}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** A method or provenance note under a table or figure. */
export function AtlasNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("mt-3 text-xs sm:text-sm leading-relaxed text-slate-500 dark:text-slate-400", className)}>
      {children}
    </p>
  );
}

/** A finding written as text: the reading above a table, not a caption under it. */
export function AtlasFinding({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-sm sm:text-base leading-relaxed text-slate-800 dark:text-slate-200", className)}>
      {children}
    </p>
  );
}

/** A named gap, stated rather than hidden. */
export function AtlasGap({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Named gap
      </div>
      <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">{title}</div>
      <div className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-400">{children}</div>
    </div>
  );
}

export function AtlasCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A headline figure with its date and its caveat. The caveat is not optional. */
export function StatTile({
  value,
  label,
  asOf,
  note,
  primary = false,
  flag,
}: {
  value: string;
  label: string;
  asOf?: string;
  note: string;
  primary?: boolean;
  /** A short marker beside the label, e.g. "taluk projection". */
  flag?: string;
}) {
  return (
    <AtlasCard className={cn(primary && "border-cyan-200 dark:border-cyan-900 bg-cyan-50/40 dark:bg-cyan-950/20")}>
      <div className="text-2xl sm:text-3xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
        {value}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">
        <span>{label}</span>
        {flag ? (
          <span className="rounded border border-slate-300 dark:border-slate-600 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {flag}
          </span>
        ) : null}
      </div>
      {asOf ? (
        <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {asOf}
        </div>
      ) : null}
      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{note}</p>
    </AtlasCard>
  );
}

/** Horizontal scroll container for a wide table; the page body never scrolls sideways. */
export function AtlasTableScroll({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

export const TABLE = "w-full min-w-[40rem] border-collapse text-sm";
export const THEAD =
  "bg-slate-50 dark:bg-slate-800/80 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";
export const TH = "px-3 py-2.5 font-semibold whitespace-nowrap";
export const TD = "px-3 py-2.5 align-top text-slate-700 dark:text-slate-300 tabular-nums";
export const TR = "border-t border-slate-100 dark:border-slate-800";

const STATUS_CLASSES = {
  reviewed:
    "border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300",
  profile:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  directory:
    "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400",
} as const;

export type BriefStatusKey = keyof typeof STATUS_CLASSES;

export const STATUS_LABELS: Record<BriefStatusKey, string> = {
  reviewed: "Reviewed brief",
  profile: "Water profile",
  directory: "Directory record",
};

export function StatusPill({ status }: { status: BriefStatusKey }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        STATUS_CLASSES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
