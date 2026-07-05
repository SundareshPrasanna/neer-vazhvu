"use client";

import { useEffect, useState } from "react";

/* ── Official flood lines (red & blue) ──────────────────────────────────
   Shared surface: city = flood-lines-{cityId}.json; the component self-
   hides when a city has no file. Renders the WRD's legal flood-boundary
   map sheets per river as collapsed rows (Commitments-pattern): one line
   per river, sheet links on expand. The sheets are scanned A0 plots -
   we link the official documents, we don't redraw them. */

interface Sheet {
  label: string;
  url: string;
}

interface River {
  name: string;
  context: string;
  sheets: Sheet[];
}

interface FloodLinesFile {
  place_id: string;
  updated: string;
  title: string;
  intro: string;
  source: { label: string; url: string };
  gaps_note: string;
  rivers: River[];
}

function RiverRow({ r }: { r: River }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span
          className="min-w-0 truncate text-sm font-medium text-slate-800 dark:text-slate-200"
          title={r.name}
        >
          {r.name}
        </span>
        <span className="flex-1 min-w-0 text-xs text-slate-500 truncate hidden sm:block">
          {r.context}
        </span>
        <span className="text-xs font-mono shrink-0 text-slate-500">
          {r.sheets.length} {r.sheets.length === 1 ? "sheet" : "sheets"}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-slate-100 dark:border-slate-800 pt-2.5 space-y-1.5">
          <p className="text-[11px] text-slate-500 sm:hidden">{r.context}</p>
          <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2 text-[11px]">
            {r.sheets.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function FloodLinesSection({ cityId }: { cityId: string }) {
  const [data, setData] = useState<FloodLinesFile | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/data/flood-lines-${cityId}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<FloodLinesFile>) : null))
      .then((d) => {
        if (!cancelled && d) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  if (!data) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{data.title}</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
          {data.intro}
        </p>
      </div>
      <div className="space-y-2">
        {data.rivers.map((r) => (
          <RiverRow key={r.name} r={r} />
        ))}
      </div>
      <p className="text-[11px] text-slate-500 leading-snug">
        {data.gaps_note} Source:{" "}
        <a
          href={data.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          {data.source.label}
        </a>
        .
      </p>
    </section>
  );
}
