"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, MapPin, Plus, Printer, RotateCw } from "lucide-react";

import { ActionButton, useFlash } from "./action-feedback";
import { Readings, Status, day } from "./report-card";
import { appLink, appSection, appTitle, btn, enter, field, muted, rule } from "./ui";
import { LIMITS } from "@/lib/sightings/limits";
import { EVENT_LABELS, OPEN_STATUSES, type CaseStatus, type DepartmentEvent } from "@/lib/sightings/status";
import type { DepartmentItem, HistoryEntry } from "@/lib/sightings/departments";

/** Status words for the department: what the record says, never a judgement of it. */
const STATUS_WORDS: Record<CaseStatus, string> = {
  open: "Open",
  reported: "Open, resident says it was filed",
  authority_done: "Marked done",
  fixed: "Fixed",
  closed: "Closed",
};

const ACTIONS: Record<DepartmentEvent, { label: string; ask: string; effect: string; word: string }> = {
  action_taken: {
    label: "Action taken",
    ask: "Mark this as action taken?",
    effect: "The public record will show that the department has acted on it, with today's date.",
    word: "action taken",
  },
  not_ours: {
    label: "Not ours",
    ask: "Mark this as not handled by your department?",
    effect: "Neer Vazhvu will check who handles it. This is not shown on public pages, and the status stays as it is.",
    word: "not theirs to handle",
  },
  closed: { label: "Closed", ask: "Mark this as closed?", effect: "The public record will show it as closed, with today's date.", word: "closed" },
};

/** History from the department's side of the table; anything else uses the public wording. */
const HISTORY: Record<string, string> = {
  approved: "Checked and published",
  reported: "Resident says it was filed with the department",
  authority_done: "Recorded as done by the department",
  fixed: "Fixed, confirmed with a checked photo",
  still_there: "A resident says it is still there",
  closed: "Closed",
  reopened: "Reopened",
};

const historyText = (e: HistoryEntry) =>
  e.by === "department" && e.event in ACTIONS
    ? `Marked by the department: ${ACTIONS[e.event as DepartmentEvent].word}`
    : (HISTORY[e.event] ?? EVENT_LABELS[e.event] ?? e.event);

/** A short handle to name an item in a meeting. */
const itemRef = (id: string) => `NV-${id.slice(0, 8).toUpperCase()}`;

/** OpenStreetMap at the public point (about 100 m), with a marker. */
const osmUrl = ([lat, lng]: [number, number]) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

/** Prints as a clean summary in either theme: dark text on white, hairlines light, status dots kept. */
const PRINT_CSS = `@media print{@page{margin:14mm 12mm}.dept-sheet{print-color-adjust:exact;-webkit-print-color-adjust:exact}.dark .dept-sheet,.dark .dept-sheet *{color:#0f172a!important;border-color:#e2e8f0!important}}`;

const GONE = "This link no longer opens any reports. Please ask Neer Vazhvu for a current link.";
const FAILED = "Could not load the reports. Please try again.";

interface Sheet {
  body: string;
  acronym: string | null;
  asOf: string;
  open: DepartmentItem[];
  done: DepartmentItem[];
}

function Photos({ urls, alt }: { urls: string[]; alt: string }) {
  const [first, ...rest] = urls;
  if (!first) return <div aria-hidden="true" />;
  return (
    <div className="space-y-2">
      <a href={first} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 print:rounded-md">
        {/* Not lazy: the first photo is the one that prints. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={first} alt={alt} decoding="async" className="aspect-[4/3] w-full object-cover sm:aspect-square print:aspect-square" />
      </a>
      {rest.length > 0 && (
        <div className="flex gap-2 print:hidden">
          {rest.map((u, i) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`${alt}, photo ${i + 2}`} loading="lazy" className="h-14 w-14 rounded-lg object-cover" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function History({ entries }: { entries: HistoryEntry[] }) {
  return (
    <ol className="space-y-1.5 border-l border-slate-200 pl-3.5 text-sm dark:border-slate-700">
      {entries.map((e, i) => (
        <li key={i} className="relative">
          <span className="absolute top-[0.55rem] -left-[1.0625rem] h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" aria-hidden="true" />
          <span className={`tabular-nums ${muted}`}>{day(e.at)}</span> <span className="text-slate-800 dark:text-slate-200">{historyText(e)}</span>
          {e.note && <span className={`block break-words ${muted}`}>Note: {e.note}</span>}
        </li>
      ))}
    </ol>
  );
}

type Patch = Pick<DepartmentItem, "caseStatus" | "actions" | "history">;

function ItemCard({ item, token, onSaved }: { item: DepartmentItem; token: string; onSaved: (id: string, patch: Patch) => void }) {
  const [confirm, setConfirm] = useState<DepartmentEvent | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, flash] = useFlash<string>();

  const open = (e: DepartmentEvent) => {
    setConfirm(e);
    setNote("");
    setError(null);
  };

  const save = async () => {
    if (!confirm) return;
    const text = note.trim();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/sightings/department", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, id: item.id, event: confirm, note: text || undefined }),
    }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) return setError(json.error ?? (res ? "That did not save. Please try again." : "No connection. Please try again."));
    onSaved(item.id, {
      caseStatus: json.data.caseStatus,
      actions: json.data.actions,
      history: [...item.history, { event: confirm, at: json.data.at, by: "department", note: text || null }],
    });
    setConfirm(null);
    setNote("");
    flash(ACTIONS[confirm].word);
  };

  return (
    <article className="grid gap-4 py-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6 print:grid-cols-[28mm_minmax(0,1fr)] print:gap-4 print:py-3">
      <Photos urls={item.photoUrls} alt={item.label} />
      <div className="min-w-0 space-y-3">
        <div>
          <p className={`text-sm ${muted}`}>{[item.where, item.placeName].filter(Boolean).join(", ")}</p>
          <h3 className="mt-0.5 text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100">{item.label}</h3>
          {item.point && (
            <a href={osmUrl(item.point)} target="_blank" rel="noopener noreferrer" className={`mt-1 inline-flex items-center gap-1 text-sm print:hidden ${appLink}`}>
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Open in map
            </a>
          )}
        </div>
        <dl className="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
          <dt className={muted}>Status</dt>
          <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Status status={item.caseStatus} label={STATUS_WORDS[item.caseStatus]} />
            <span role="status" className="print:hidden">
              {saved && (
                <span className={`inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400 ${enter}`}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Saved
                </span>
              )}
            </span>
          </dd>
          <dt className={muted}>Sent</dt>
          <dd className="tabular-nums text-slate-800 dark:text-slate-200">{day(item.date)}</dd>
          <dt className={muted}>Item</dt>
          <dd className="font-mono text-xs leading-5 text-slate-800 dark:text-slate-200">{itemRef(item.id)}</dd>
        </dl>
        {item.readings.length > 0 && <Readings readings={item.readings} source={item.waterSource} test={item.test} />}
        {item.history.length > 0 && <History entries={item.history} />}

        {(item.actions.length > 0 || error) && (
          <div className={`space-y-3 border-t pt-4 print:hidden ${rule}`}>
            {confirm ? (
              <div role="group" aria-label={ACTIONS[confirm].ask} className={`rounded-xl border bg-slate-50 p-4 dark:bg-slate-900 ${rule} ${enter}`}>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ACTIONS[confirm].ask}</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{ACTIONS[confirm].effect}</p>
                <label className="mt-3 block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Note <span className={`font-normal ${muted}`}>Optional. Not shown on public pages.</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={LIMITS.noteChars}
                    placeholder="For example, the date of the site visit"
                    className={`${field} mt-1.5`}
                  />
                </label>
                <p className={`mt-1 text-right text-xs tabular-nums ${muted}`}>
                  {note.length}/{LIMITS.noteChars}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ActionButton label={`Mark as ${ACTIONS[confirm].label.toLowerCase()}`} busyLabel="Saving…" busy={busy} onClick={save} className={btn("primary", "md")} />
                  <button type="button" onClick={() => setConfirm(null)} disabled={busy} className={btn("quiet", "md")}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className={`mr-1 text-sm ${muted}`}>Mark as</span>
                {item.actions.map((e) => (
                  <button key={e} type="button" onClick={() => open(e)} className={btn("secondary", "md")}>
                    {ACTIONS[e].label}
                  </button>
                ))}
              </div>
            )}
            {error && (
              <p role="alert" className="flex items-start gap-2 text-sm font-medium text-red-700 dark:text-red-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function Group({ title, items, empty, token, onSaved }: { title: string; items: DepartmentItem[]; empty: string; token: string; onSaved: (id: string, patch: Patch) => void }) {
  return (
    <section className="pt-10 print:pt-6">
      <h2 className={appSection}>{title}</h2>
      {items.length === 0 ? (
        <p className={`mt-4 text-sm ${muted}`}>{empty}</p>
      ) : (
        <ul className={`mt-4 divide-y border-y ${rule}`}>
          {items.map((item) => (
            <li key={item.id} className="break-inside-avoid">
              <ItemCard item={item} token={token} onSaved={onSaved} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const GUIDE: [string, string][] = [
  ["Action taken", "Your department has acted on it. The public record shows this with the date."],
  ["Not ours", "Another body handles it. Neer Vazhvu checks who does. Not shown on public pages."],
  ["Closed", "Nothing more is needed. The public record shows it as closed."],
  ["Notes", `Optional, up to ${LIMITS.noteChars} characters. Not shown on public pages.`],
  ["This link", "Anyone holding it can see and mark these reports, so keep it within your office. If it reaches the wrong hands, tell Neer Vazhvu so it can be replaced."],
];

/** A department's private page: the checked reports routed to it, a mark per report, and a printable summary. No sign-in: the signed link is the key. */
export function DepartmentApp({ token, body, acronym }: { token: string; body: string | null; acronym: string | null }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    fetch(`/api/sightings/department?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!live) return;
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return setError(res.status === 404 || res.status === 410 ? GONE : FAILED);
        setSheet(json.data);
        setError(null);
      })
      .catch(() => live && setError(FAILED));
    return () => {
      live = false;
    };
  }, [token, tick]);

  // An item stays in its group until the next load, so a mark never makes it jump away.
  const onSaved = useCallback(
    (id: string, patch: Patch) =>
      setSheet((s) => s && { ...s, open: s.open.map((i) => (i.id === id ? { ...i, ...patch } : i)), done: s.done.map((i) => (i.id === id ? { ...i, ...patch } : i)) }),
    [],
  );

  const name = sheet?.body ?? body ?? "Your department";
  const abbr = sheet?.acronym ?? acronym;
  const title = abbr && !name.includes(abbr) ? `${name} (${abbr})` : name;
  const all = sheet ? [...sheet.open, ...sheet.done] : [];
  const openCount = all.filter((i) => OPEN_STATUSES.has(i.caseStatus)).length;

  return (
    <div className="dept-sheet mx-auto max-w-4xl px-4 pt-10 pb-16 sm:px-6 sm:pt-14 lg:px-8 print:max-w-none print:px-0 print:pt-0">
      <style>{PRINT_CSS}</style>
      <div className={`border-b pb-8 print:pb-4 ${rule}`}>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Neer Vazhvu</p>
        <h1 className={`mt-3 break-words ${title.length > 70 ? "text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100" : appTitle}`}>{title}</h1>
        <p className="mt-3 text-lg text-slate-800 dark:text-slate-200">Checked reports from residents in your area</p>
        <p className={`mt-2 max-w-[60ch] text-sm leading-relaxed ${muted}`}>
          Each report was checked by Neer Vazhvu before publishing. Reporters&rsquo; details are never shared.
        </p>
        {sheet && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <p className="text-sm tabular-nums text-slate-800 dark:text-slate-200">
              {openCount} open, {all.length - openCount} fixed or closed. As of {day(sheet.asOf)}.
            </p>
            <button type="button" onClick={() => window.print()} className={`${btn("secondary", "md")} print:hidden`}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print or save as PDF
            </button>
          </div>
        )}
      </div>

      {!sheet && !error && (
        <p role="status" className={`py-16 text-center ${muted}`}>
          Loading reports…
        </p>
      )}
      {error && (
        <div role="alert" className="flex flex-col items-start gap-4 py-12">
          <p className="text-slate-800 dark:text-slate-200">{error}</p>
          {error === FAILED && (
            <button type="button" onClick={() => setTick((t) => t + 1)} className={btn("secondary", "md")}>
              <RotateCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          )}
        </div>
      )}

      {sheet && (
        <>
          <details className={`group/guide border-b print:hidden ${rule}`}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 font-semibold text-slate-900 transition-colors hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-slate-100 dark:hover:text-blue-400 [&::-webkit-details-marker]:hidden">
              How marking works
              <Plus className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open/guide:rotate-45" aria-hidden="true" />
            </summary>
            <dl className="grid gap-x-6 gap-y-2 pb-6 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
              {GUIDE.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-semibold text-slate-900 dark:text-slate-100">{k}</dt>
                  <dd className={`mb-2 leading-relaxed sm:mb-0 ${muted}`}>{v}</dd>
                </div>
              ))}
            </dl>
          </details>
          <Group title="Open" items={sheet.open} empty="No open reports right now. New ones appear here after they are checked." token={token} onSaved={onSaved} />
          {sheet.done.length > 0 && <Group title="Fixed or closed" items={sheet.done} empty="" token={token} onSaved={onSaved} />}
        </>
      )}
    </div>
  );
}
