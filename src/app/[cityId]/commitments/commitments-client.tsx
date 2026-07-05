"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/* ── The Commitments Register ───────────────────────────────────────────
   Dated commitments by named institutions, with a verification lifecycle. UX contract (locked with
   the user, July 2026): verdict first, evidence on demand - a scoreboard +
   one headline lead; every commitment is ONE collapsed line (chip · title ·
   dates) that expands to the what/history/citations; slipped and overdue
   float to the top. Shared surface: city = commitments-{cityId}.json +
   hasCommitments flag. No cityId branches. */

type CommitmentStatus = "delivered" | "on-track" | "slipped" | "overdue" | "stalled" | "unverified";

interface StatusEvent {
  date: string;
  status: CommitmentStatus;
  note: string;
  source_label: string | null;
  source_url: string | null;
}

interface TrackedCommitment {
  id: string;
  category: string;
  title: string;
  committed_by: string;
  what: string;
  due: string | null;
  commitment_source: { label: string; url: string; date: string };
  status: CommitmentStatus;
  status_history: StatusEvent[];
  next_check: string | null;
  revised_due: string | null;
  ledger_id?: string;
}

interface CommitmentsFile {
  place_id: string;
  updated: string;
  headline: string;
  intro: string;
  status_legend: Record<string, string>;
  commitments: TrackedCommitment[];
  update_model: string;
  sources_note: string;
}

const STATUS_STYLE: Record<CommitmentStatus, string> = {
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  "on-track": "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  slipped: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  overdue: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  stalled: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  unverified: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

/** Sort weight: problems first, done last. */
const STATUS_ORDER: Record<CommitmentStatus, number> = {
  overdue: 0,
  slipped: 1,
  stalled: 2,
  unverified: 3,
  "on-track": 4,
  delivered: 5,
};

function fmtDue(p: TrackedCommitment): string {
  if (!p.due) return "no date given";
  return p.revised_due ? `${p.due} → ${p.revised_due}` : p.due;
}

function CommitmentRow({ p, cityId, highlight }: { p: TrackedCommitment; cityId: string; highlight?: boolean }) {
  const [open, setOpen] = useState(highlight ?? false);
  return (
    <div
      id={p.id}
      className={`border rounded-lg scroll-mt-24 ${highlight ? "border-blue-400 dark:border-blue-500 ring-1 ring-blue-400 dark:ring-blue-500" : "border-slate-200 dark:border-slate-700"}`}
    >
      {/* The one-line collapsed view: chip · title · dates. Nothing else. */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLE[p.status]}`}>
          {p.status}
        </span>
        <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
          {p.title}
        </span>
        <span className={`text-xs font-mono shrink-0 ${p.revised_due ? "text-amber-600 dark:text-amber-400" : "text-slate-500"}`}>
          {fmtDue(p)}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-slate-100 dark:border-slate-800 pt-2.5">
          <div className="text-[11px] text-slate-500">Committed by {p.committed_by}</div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{p.what}</p>
          <div className="text-[11px] text-slate-500">
            The commitment:{" "}
            <a href={p.commitment_source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
              {p.commitment_source.label}
            </a>{" "}
            ({p.commitment_source.date})
          </div>
          {p.status_history.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">What happened since</div>
              {p.status_history.map((e, i) => (
                <div key={i} className="border-l-2 border-slate-300 dark:border-slate-600 pl-2.5">
                  <div className="text-[11px]">
                    <span className="font-mono text-slate-500 mr-1.5">{e.date}</span>
                    <span className={`text-[9px] uppercase px-1 py-0.5 rounded ${STATUS_STYLE[e.status]}`}>{e.status}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug mt-0.5">
                    {e.note}
                    {e.source_url ? (
                      <>
                        {" "}
                        <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                          ({e.source_label})
                        </a>
                      </>
                    ) : e.source_label ? (
                      <span className="text-slate-500"> ({e.source_label})</span>
                    ) : null}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
            {p.next_check && <span>Next check: {p.next_check}</span>}
            {p.ledger_id && (
              <Link href={`/${cityId}/allocations#${p.ledger_id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                Who is owed this water? →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CommitmentsClient({ cityId }: { cityId: string }) {
  const [data, setData] = useState<CommitmentsFile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/data/commitments-${cityId}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<CommitmentsFile>) : null))
      .then((d) => (d ? setData(d) : setFailed(true)))
      .catch(() => setFailed(true));
  }, [cityId]);

  // Deep links from the Allocation Ledger's "Track this commitment" (#id):
  // data arrives after hydration, so scroll once rows exist; the target row
  // renders expanded + highlighted via the hashId prop.
  const hashId = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
  useEffect(() => {
    if (!data || !hashId) return;
    const t = window.setTimeout(() => {
      document.getElementById(hashId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [data, hashId]);

  const grouped = useMemo(() => {
    if (!data) return [];
    const byCat = new Map<string, TrackedCommitment[]>();
    for (const p of data.commitments) {
      if (!byCat.has(p.category)) byCat.set(p.category, []);
      byCat.get(p.category)!.push(p);
    }
    // Within a category: problems first; categories: by their worst status.
    const cats = [...byCat.entries()].map(([cat, ps]) => {
      ps.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
      return { cat, ps, worst: Math.min(...ps.map((p) => STATUS_ORDER[p.status])) };
    });
    cats.sort((a, b) => a.worst - b.worst);
    return cats;
  }, [data]);

  if (failed) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-500">
        The commitments register for this city hasn&apos;t been compiled yet.
      </div>
    );
  }
  if (!data) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-400">Loading the register…</div>;
  }

  const counts: Partial<Record<CommitmentStatus, number>> = {};
  for (const p of data.commitments) counts[p.status] = (counts[p.status] ?? 0) + 1;
  const scoreboard: CommitmentStatus[] = ["slipped", "overdue", "stalled", "unverified", "on-track", "delivered"];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-7">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="uppercase tracking-wider">Commitments Register</span>
          <span>·</span>
          <span>Updated {data.updated}</span>
          <span>·</span>
          <Link href={`/${cityId}/allocations`} className="text-blue-600 dark:text-blue-400 hover:underline">
            Allocation Ledger →
          </Link>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {data.headline}
        </h1>

        {/* The scoreboard: the whole page at one glance. */}
        <div className="flex flex-wrap gap-2 pt-1">
          {scoreboard.map((s) =>
            counts[s] ? (
              <span key={s} className={`text-xs px-2 py-1 rounded-md font-medium ${STATUS_STYLE[s]}`}>
                {counts[s]} {s}
              </span>
            ) : null,
          )}
          <span className="text-xs px-2 py-1 text-slate-500">{data.commitments.length} commitments tracked</span>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{data.intro}</p>
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer font-medium text-slate-600 dark:text-slate-400 select-none">
            How statuses work + how this stays current
          </summary>
          <div className="mt-2 space-y-2">
            <ul className="space-y-1">
              {Object.entries(data.status_legend).map(([k, v]) => (
                <li key={k} className="flex items-start gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded shrink-0 text-[10px] uppercase ${STATUS_STYLE[k as CommitmentStatus] ?? ""}`}>{k}</span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
            <p>{data.update_model}</p>
            <p>{data.sources_note}</p>
          </div>
        </details>
      </header>

      {grouped.map(({ cat, ps }) => (
        <section key={cat} className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {cat} <span className="text-slate-400 font-normal">({ps.length})</span>
          </h2>
          <div className="space-y-2">
            {ps.map((p) => (
              <CommitmentRow key={p.id} p={p} cityId={cityId} highlight={p.id === hashId} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
