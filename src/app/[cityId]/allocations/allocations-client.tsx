"use client";

import { useEffect, useMemo, useState } from "react";
import { isDirect, forAuthority } from "@/lib/utils/allocations-grouping";
import Link from "next/link";

/* ── The Allocation Ledger (docs/specs/allocation-ledger.md) ────────────
   Shared surface: every city = one allocations-{cityId}.json. The unit of
   the page is the ARRANGEMENT (source -> authority -> recipient) with
   entitled vs received, the instrument each rests on, and a confidence
   grade. No cityId branches - all copy comes from the data file.

   UX follows the Commitments Register contract (verdict first, evidence
   on demand): a scoreboard opens the page, every arrangement is ONE
   collapsed line (gap chip · source→recipient · numbers) that expands to
   notes + instrument, groups float by their worst member, and the
   how-to-read legend lives in a collapsed <details>. */

interface Quantity {
  value: number | null;
  unit: string;
  basis?: string | null;
  year?: string | null;
  note?: string | null;
}

interface Arrangement {
  id: string;
  source: string;
  /** Absent or null = direct/owner-operated (NVDM spec 7.6: absence is an
   *  absent key; legacy files may still carry explicit null). */
  authority_id?: string | null;
  recipient: string;
  entitled: Quantity;
  received: Quantity;
  instrument: { label: string; url: string };
  confidence: "high" | "medium" | "low";
  note?: string | null;
}

interface Authority {
  id: string;
  name: string;
  role: string;
  capacity: string | null;
  committed: string | null;
  tension: string;
  source_refs: string[];
}

interface LedgerEvent {
  year: number;
  title: string;
  note: string;
  source_refs: string[];
}

interface FutureEntitlement {
  /** Stable anchor id - the Commitments register's ledger_id links land here. */
  id?: string;
  project: string;
  mld: number | null;
  earmarked_for: string[];
  status: string;
  source_refs: string[];
  /** Cross-link into the Commitments register entry that owns this project's
   *  delivery status - single source of truth for "where does it stand". */
  commitment_id?: string;
}

interface SourceEntry {
  title: string;
  publisher: string;
  year: number;
  url: string;
}

interface AllocationsFile {
  place_id: string;
  updated: string;
  headline: string;
  intro: string;
  unit_note: string;
  authorities: Authority[];
  arrangements: Arrangement[];
  events: LedgerEvent[];
  futures: FutureEntitlement[];
  gaps: string[];
  sources: Record<string, SourceEntry>;
}

const CONFIDENCE_STYLE: Record<Arrangement["confidence"], string> = {
  high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  low: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
};

/** The row verdict. "over" (drawing more than entitled - Ulhasnagar) is a
 *  finding, not an error. "unreported" = a quota exists on paper but no
 *  delivery figure is public - the ledger's central accountability finding.
 *  "own source" = the recipient owns the source outright, so there is no
 *  external quota to compare against. "no figure" = both sides carry
 *  numbers but in units we refuse to silently convert. */
type GapVerdict = "shortfall" | "over quota" | "unreported" | "own source" | "no figure" | "met";

const VERDICT_STYLE: Record<GapVerdict, string> = {
  shortfall: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  "over quota": "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  unreported: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  "own source": "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  "no figure": "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  met: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
};

/** What each verdict chip means, verbatim in the legend - never ship an
 *  unexplained badge. */
const VERDICT_LEGEND: [GapVerdict, string][] = [
  ["shortfall", "receives less than the paper entitles it to"],
  ["over quota", "draws more than its entitlement - a finding, not an error"],
  ["unreported", "a quota exists on paper, but no delivery figure is published"],
  ["own source", "owns the source outright - no external quota to compare"],
  ["met", "what flows matches the entitlement"],
  ["no figure", "the two sides carry numbers in units we refuse to silently convert"],
];

/** Sort weight: problems first, settled last - mirrors the Commitments page. */
const VERDICT_ORDER: Record<GapVerdict, number> = {
  shortfall: 0,
  "over quota": 1,
  unreported: 2,
  "no figure": 3,
  "own source": 4,
  met: 5,
};

function fmtQty(q: Quantity): string {
  if (q.value === null) return "-";
  return `${q.value.toLocaleString("en-IN")} ${q.unit}`;
}

function verdictOf(a: Arrangement): GapVerdict {
  const e = a.entitled;
  const r = a.received;
  if (e.value === null) return "own source";
  if (r.value === null) return "unreported";
  if (e.unit !== r.unit) return "no figure";
  if (e.value === r.value) return "met";
  return e.value > r.value ? "shortfall" : "over quota";
}

/** Entitled-minus-received as a phrase, for the expanded gap cell. */
function gapLabel(a: Arrangement): string | null {
  const e = a.entitled;
  const r = a.received;
  if (e.value === null || r.value === null || e.unit !== r.unit) return null;
  const gap = e.value - r.value;
  if (gap === 0) return "met";
  if (gap < 0) return `+${Math.abs(gap).toLocaleString("en-IN")} ${e.unit} over`;
  return `${gap.toLocaleString("en-IN")} ${e.unit} short`;
}

/** The one-line collapsed number pair, phrased per verdict. */
function pairLabel(a: Arrangement): string {
  const e = a.entitled;
  const r = a.received;
  if (e.value === null) return `${fmtQty(r)} from own source`;
  if (r.value === null) return `${fmtQty(e)} entitled · delivery unreported`;
  if (e.unit === r.unit) {
    return `${e.value.toLocaleString("en-IN")} → ${r.value.toLocaleString("en-IN")} ${e.unit}`;
  }
  return `${fmtQty(e)} → ${fmtQty(r)}`;
}

function ArrangementRow({ a, highlight }: { a: Arrangement; highlight?: boolean }) {
  const [open, setOpen] = useState(highlight ?? false);
  const verdict = verdictOf(a);
  const gap = gapLabel(a);
  return (
    <div
      id={a.id}
      className={`border rounded-lg scroll-mt-24 ${highlight ? "border-blue-400 dark:border-blue-500 ring-1 ring-blue-400 dark:ring-blue-500" : "border-slate-200 dark:border-slate-700"}`}
    >
      {/* The one-line collapsed view: gap chip · route · numbers. */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${VERDICT_STYLE[verdict]}`}>
          {verdict}
        </span>
        <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
          {a.source} <span className="text-slate-400 font-normal">→</span> {a.recipient}
        </span>
        <span className="text-xs font-mono shrink-0 text-slate-500 hidden sm:inline">{pairLabel(a)}</span>
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-slate-100 dark:border-slate-800 pt-2.5">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-[10px] uppercase text-slate-500">Entitled</div>
              <div className="font-mono font-semibold">{fmtQty(a.entitled)}</div>
              {a.entitled.basis && <div className="text-[10px] text-slate-500">{a.entitled.basis}</div>}
            </div>
            <div>
              <div className="text-[10px] uppercase text-slate-500">Received</div>
              <div className="font-mono font-semibold">
                {fmtQty(a.received)}
                {a.received.year ? <span className="text-slate-400 font-normal"> ({a.received.year})</span> : null}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-slate-500">Gap</div>
              <div className={`font-mono font-semibold ${verdict === "shortfall" ? "text-amber-600 dark:text-amber-400" : verdict === "over quota" ? "text-sky-600 dark:text-sky-400" : ""}`}>
                {gap ?? (verdict === "unreported" ? "delivery unreported" : verdict === "own source" ? "no quota applies" : "no common figure")}
              </div>
            </div>
          </div>
          {(a.entitled.note || a.received.note || a.note) && (
            <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
              {a.entitled.note && <p>{a.entitled.note}</p>}
              {a.received.note && <p>{a.received.note}</p>}
              {a.note && <p className="italic">{a.note}</p>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500">
            <span>
              Based on:{" "}
              <a href={a.instrument.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                {a.instrument.label}
              </a>
            </span>
            <span className="flex items-center gap-1">
              confidence
              <span
                className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${CONFIDENCE_STYLE[a.confidence]}`}
                title="Confidence in the instrument + figures"
              >
                {a.confidence}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function AuthorityRow({ auth }: { auth: Authority }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        {/* NOT shrink-0. Authority names run long - Delhi's "Haryana
            Irrigation & Water Resources (Western Yamuna Canal)" measures
            465px - and refusing to shrink pushed the whole page's layout
            viewport to 522px on a 393px phone, so the browser scaled every
            page element down ~25% to fit. min-w-0 lets the flex item shrink
            below its content width; the name then wraps instead. */}
        <span className="min-w-0 text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
          {auth.name}
        </span>
        <span className="flex-1 min-w-0 text-xs text-slate-500 truncate hidden sm:block">
          {auth.role}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-2.5">
          <div className="text-[11px] text-slate-500">{auth.role}</div>
          {(auth.capacity || auth.committed) && (
            <div className="flex gap-4 text-xs">
              {auth.capacity && (
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Capacity</span>
                  <span className="font-mono">{auth.capacity}</span>
                </div>
              )}
              {auth.committed && (
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Committed</span>
                  <span className="font-mono">{auth.committed}</span>
                </div>
              )}
            </div>
          )}
          <p className="text-[11px] leading-snug pt-1 border-l-2 border-amber-400 dark:border-amber-600 pl-2 text-slate-700 dark:text-slate-300">
            {auth.tension}
          </p>
        </div>
      )}
    </div>
  );
}

export default function AllocationsClient({ cityId }: { cityId: string }) {
  const [data, setData] = useState<AllocationsFile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/data/allocations-${cityId}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<AllocationsFile>) : null))
      .then((d) => (d ? setData(d) : setFailed(true)))
      .catch(() => setFailed(true));
  }, [cityId]);

  // Deep links from the Commitments register (#arrangement-id / #future-id):
  // the data arrives after hydration, so the browser's native hash scroll has
  // already missed. Once rows exist, scroll the target into view - the row
  // itself renders expanded + highlighted via the hashId prop.
  const hashId = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
  useEffect(() => {
    if (!data || !hashId) return;
    const t = window.setTimeout(() => {
      document.getElementById(hashId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [data, hashId]);

  // Group arrangements by seller; within a group problems float first, and
  // the groups themselves order by their worst member (Commitments pattern).
  const grouped = useMemo(() => {
    if (!data) return [];
    const groups: { key: string; label: string; rows: Arrangement[] }[] = [];
    const ownerOperated = data.arrangements.filter(isDirect);
    if (ownerOperated.length > 0) {
      groups.push({ key: "_owner", label: "Owner-operated + direct arrangements", rows: ownerOperated });
    }
    for (const auth of data.authorities) {
      const rows = data.arrangements.filter((a) => forAuthority(a, auth.id));
      if (rows.length > 0) groups.push({ key: auth.id, label: `Via ${auth.name}`, rows });
    }
    const decorated = groups.map((g) => {
      const rows = [...g.rows].sort((a, b) => VERDICT_ORDER[verdictOf(a)] - VERDICT_ORDER[verdictOf(b)]);
      return { ...g, rows, worst: Math.min(...rows.map((r) => VERDICT_ORDER[verdictOf(r)])) };
    });
    decorated.sort((a, b) => a.worst - b.worst);
    return decorated;
  }, [data]);

  if (failed) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-500">
        The allocation ledger for this city hasn&apos;t been compiled yet.
      </div>
    );
  }
  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-400">Loading the ledger…</div>
    );
  }

  // The scoreboard: the whole ledger at one glance.
  const counts: Partial<Record<GapVerdict, number>> = {};
  for (const a of data.arrangements) {
    const v = verdictOf(a);
    counts[v] = (counts[v] ?? 0) + 1;
  }
  const scoreboard: GapVerdict[] = ["shortfall", "over quota", "unreported", "no figure", "own source", "met"];
  const lowConfidence = data.arrangements.filter((a) => a.confidence === "low").length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-7">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="uppercase tracking-wider">Allocation Ledger</span>
          <span>·</span>
          <span>Updated {data.updated}</span>
          <span>·</span>
          <Link href={`/${data.place_id}/commitments`} className="text-blue-600 dark:text-blue-400 hover:underline">
            Commitments Register →
          </Link>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {data.headline}
        </h1>

        <div className="flex flex-wrap gap-2 pt-1">
          {scoreboard.map((v) =>
            counts[v] ? (
              <span key={v} className={`text-xs px-2 py-1 rounded-md font-medium ${VERDICT_STYLE[v]}`}>
                {counts[v]} {v}
              </span>
            ) : null,
          )}
          <span className="text-xs px-2 py-1 text-slate-500">
            {data.arrangements.length} arrangements tracked
            {lowConfidence > 0 ? ` · ${lowConfidence} on a single source` : ""}
          </span>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{data.intro}</p>
        <p className="text-xs text-slate-500">{data.unit_note}</p>

        {/* How to read this - the column definitions and confidence grades,
            collapsed like the Register's status legend. */}
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer font-medium text-slate-600 dark:text-slate-400 select-none">
            How to read this ledger
          </summary>
          <div className="mt-2 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3 text-xs text-slate-600 dark:text-slate-400">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">Entitled</span>
                What the paper promises - a quota, a scheme share, or ownership of the source.
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">Received</span>
                What actually flows, as most recently reported - with the year it was reported.
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">Gap</span>
                Entitled minus received, compared when both sides carry the same unit.
              </div>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                The verdict chip on each row
              </div>
              <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2 text-[11px] text-slate-600 dark:text-slate-400">
                {VERDICT_LEGEND.map(([v, meaning]) => (
                  <div key={v} className="flex items-start gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded shrink-0 uppercase text-[10px] ${VERDICT_STYLE[v]}`}>{v}</span>
                    <span>{meaning}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Confidence = how solid the paper is
              </div>
              <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-3 text-[11px] text-slate-600 dark:text-slate-400">
                <div className="flex items-start gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded shrink-0 ${CONFIDENCE_STYLE.high}`}>high</span>
                  <span>the operator&apos;s own document or an official order</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded shrink-0 ${CONFIDENCE_STYLE.medium}`}>medium</span>
                  <span>a quota corroborated across press reports</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded shrink-0 ${CONFIDENCE_STYLE.low}`}>low</span>
                  <span>a single secondary source</span>
                </div>
              </div>
            </div>
          </div>
        </details>
      </header>

      {/* The ledger - the page's main event, so it leads. */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">The ledger</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Every arrangement, grouped by who sells the water. Shortfalls float to the top.
            Click a row for its notes and the underlying document.
          </p>
        </div>
        {grouped.map((g) => (
          <div key={g.key} className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-slate-500">
              {g.label} <span className="normal-case">({g.rows.length})</span>
            </h3>
            <div className="space-y-2">
              {g.rows.map((a) => (
                <ArrangementRow key={a.id} a={a} highlight={a.id === hashId} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Authorities strip - where the structural tensions headline */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            The authorities in between
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            The middlemen most of this water passes through - and what each one has promised
            against what it can actually deliver. Click a row for the tension.
          </p>
        </div>
        <div className="space-y-2">
          {data.authorities.map((auth) => (
            <AuthorityRow key={auth.id} auth={auth} />
          ))}
        </div>
      </section>

      {/* Reallocation events */}
      {data.events.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Reallocations &amp; instruments in history
          </h2>
          <div className="space-y-2">
            {data.events.map((e) => (
              <div key={`${e.year}-${e.title}`} className="border-l-2 border-slate-300 dark:border-slate-600 pl-3">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <span className="font-mono text-slate-500 mr-2">{e.year}</span>
                  {e.title}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug mt-0.5">{e.note}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Futures shelf */}
      {data.futures.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Entitlements in waiting</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.futures.map((f) => (
              <div
                key={f.project}
                id={f.id}
                className={`border border-dashed rounded-lg p-3 space-y-1 scroll-mt-24 ${f.id === hashId ? "border-blue-400 dark:border-blue-500 ring-1 ring-blue-400 dark:ring-blue-500" : "border-slate-300 dark:border-slate-600"}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{f.project}</span>
                  {f.mld !== null && <span className="font-mono text-xs">{f.mld.toLocaleString("en-IN")} MLD</span>}
                </div>
                <div className="text-[11px] text-slate-500">for {f.earmarked_for.join(", ")}</div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">{f.status}</p>
                {f.commitment_id && (
                  <Link
                    href={`/${data.place_id}/commitments#${f.commitment_id}`}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Track this commitment →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Named gaps */}
      {data.gaps.length > 0 && (
        <section className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg p-4 space-y-2">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            What this ledger can&apos;t show yet
          </h2>
          <ul className="list-disc list-inside text-[12px] text-amber-800 dark:text-amber-300 space-y-1">
            {data.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Sources */}
      <section className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sources</h2>
        <ul className="text-[11px] text-slate-500 space-y-1">
          {Object.entries(data.sources).map(([key, s]) => (
            <li key={key}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                {s.title}
              </a>{" "}
              - {s.publisher}, {s.year}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-slate-500">
          Methodology and the full source registry live at{" "}
          <Link href={`/${data.place_id}/about#data-sources`} className="text-blue-600 dark:text-blue-400 hover:underline">
            /{data.place_id}/about
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
