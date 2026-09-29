import type { ReactNode } from "react";

/** Building blocks shared by the About page frame and every city's About
 *  content (src/content/about). One copy each; the page and the ten city
 *  modules all render through these. */

export interface DataSourceItem {
  name: string;
  url: string;
  description: string;
  frequency: string;
}

export interface LostBodyEntry {
  name: string;
  status: "Fully lost" | "Severely reduced" | "Partially encroached";
  source: string;
}

/** Props every city's page-descriptions component takes. */
export interface CityPagesProps {
  cityId: string;
  cityName: string;
}

export function Section({ id, title, children, defaultOpen = false }: { id?: string; title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 open:shadow-sm"
    >
      <summary className="flex items-center justify-between gap-3 cursor-pointer list-none select-none p-4 sm:p-5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 [&::-webkit-details-marker]:hidden">
        <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        <svg className="w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 space-y-5">{children}</div>
    </details>
  );
}

export function SubSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <div id={id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      {children}
    </div>
  );
}

export function DataSourceGroupHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 pt-2 pb-1">
      {title}
    </h3>
  );
}

export function DataSource({ name, url, description, frequency }: DataSourceItem) {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
      {/* Stack on mobile: a shrink-0 badge with a long frequency string
          ("static (Nov 2017 baseline; ...)") overflowed the viewport and
          squeezed the title to one word per line at 390px (QA, Bengaluru). */}
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <a
          href={url}
          target={url.startsWith("/") ? undefined : "_blank"}
          rel={url.startsWith("/") ? undefined : "noopener noreferrer"}
          className="font-medium text-blue-600 dark:text-blue-400 hover:underline min-w-0 break-words"
        >
          {name}
        </a>
        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono whitespace-normal break-words sm:text-right sm:max-w-[45%] sm:shrink-0">
          {frequency}
        </span>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
    </div>
  );
}

export function Gap({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
      <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">{title}</h4>
      <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">{children}</div>
    </div>
  );
}
