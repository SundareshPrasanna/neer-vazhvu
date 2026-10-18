"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft, Download, ImageIcon, Printer, RotateCw } from "lucide-react";

import { PACK_PRESETS, istDate, packDate, presetPeriod, type GroupPack as Pack, type MyGroup, type PackPreset } from "@/lib/sightings/groups";
import { Status } from "./report-card";
import { appLink, appSection, appTitle, btn, fieldBox, muted, rule } from "./ui";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const SITE = "neervazhvu.org";
const FAILED = "Could not make the pack. Please try again.";

/** Only the pack prints: the page under it is left out, and it prints black on white in either theme. */
const PRINT_CSS =
  "@media print{@page{margin:14mm 12mm}body>*:not(.nv-pack){display:none!important}html,body{overflow:visible!important}" +
  ".nv-pack{position:static!important;overflow:visible!important;background:#fff!important}" +
  ".nv-pack *{color:#000!important;background-color:transparent!important;border-color:#cbd5e1!important;box-shadow:none!important}}";

/** A spreadsheet never reads a cell as a formula; quotes where needed. */
const csvCell = (v: string | number) => {
  const s = String(v).replace(/^([=+\-@])/, "'$1");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Reports and clean-ups in one sheet, with full addresses for links. */
function downloadCsv(pack: Pack) {
  const page = (href: string | null) => (href ? `https://${SITE}${href}` : "");
  const rows: (string | number)[][] = [
    ["record", "date", "type", "place", "status", "people_coming", "photo", "fixed_photo", "public_page"],
    ...pack.reports.map((r) => ["report", r.date, r.type, r.place, r.status, "", r.photo ?? "", "", page(r.href)]),
    ...pack.cleanups.map((c) => ["clean-up", c.date, c.type, c.place, c.status, c.coming, c.photo ?? "", c.fixedPhoto ?? "", page(c.href)]),
  ];
  // The byte-order mark keeps names in any script readable in Excel.
  const body = `﻿${rows.map((r) => r.map(csvCell).join(",")).join("\n")}`;
  const slug = pack.group.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "group";
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}-${pack.period.from}-to-${pack.period.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Photo({ src, caption }: { src: string | null; caption?: string }) {
  return (
    <figure className="w-20 shrink-0 sm:w-24 print:w-[22mm]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={caption ?? ""} loading="lazy" decoding="async" className="aspect-square w-full rounded-lg object-cover print:rounded" />
      ) : (
        <div className="grid aspect-square w-full place-items-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
          <ImageIcon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
      {caption && <figcaption className={`mt-1 text-xs ${muted}`}>{caption}</figcaption>}
    </figure>
  );
}

/** On screen a link to the public page; on paper its address. */
function PageLink({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <>
      <Link href={href} className={`text-sm print:hidden ${appLink}`}>
        See where it appears
      </Link>
      <span className="hidden text-xs break-all print:inline">
        {SITE}
        {href}
      </span>
    </>
  );
}

function Sheet({ pack }: { pack: Pack }) {
  const { group, period, totals: t } = pack;
  const figures: [number, string][] = [
    [t.reports, t.reports === 1 ? "Report published" : "Reports published"],
    [t.places, t.places === 1 ? "Place" : "Places"],
    [t.senders, "Members who sent them"],
    [t.members, "Members now"],
    [t.cleanups, t.cleanups === 1 ? "Clean-up done" : "Clean-ups done"],
    [t.coming, "People who said they would come"],
    [t.seen, "Seen too, by other residents"],
    [t.thanks, "Thanks, once fixed"],
  ];
  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Neer Vazhvu evidence pack</p>
      <h1 id="pack-title" className={`mt-3 break-words ${appTitle}`}>
        {group.name}
      </h1>
      <p className={`mt-1 ${muted}`}>{[group.kindLabel, group.placeName].filter(Boolean).join(", ")}</p>
      <p className="mt-5 max-w-[65ch] text-lg text-slate-800 dark:text-slate-200">
        Reports sent with {group.name} and published between {packDate(period.from)} and {packDate(period.to)}.
      </p>
      <p className={`mt-1 text-sm ${muted}`}>Prepared on {packDate(pack.prepared)}.</p>

      <dl className={`mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-y py-6 sm:grid-cols-4 print:grid-cols-4 print:py-4 ${rule}`}>
        {figures.map(([n, label]) => (
          <div key={label} className="flex flex-col-reverse">
            <dt className={`text-sm leading-snug ${muted}`}>{label}</dt>
            <dd className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{n}</dd>
          </div>
        ))}
      </dl>

      {t.reports > 0 && (
        <div className="mt-8 grid gap-8 sm:grid-cols-2 print:grid-cols-2">
          <section aria-labelledby="pack-status">
            <h2 id="pack-status" className="font-semibold text-slate-900 dark:text-slate-100">
              Where they stand now
            </h2>
            <ul className={`mt-3 divide-y border-y text-sm ${rule}`}>
              {t.byStatus.map((s) => (
                <li key={s.status} className="flex items-baseline justify-between gap-4 py-2">
                  <Status status={s.status} label={s.label} />
                  <span className="tabular-nums text-slate-900 dark:text-slate-100">{s.count}</span>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="pack-types">
            <h2 id="pack-types" className="font-semibold text-slate-900 dark:text-slate-100">
              What was reported
            </h2>
            <ul className={`mt-3 divide-y border-y text-sm ${rule}`}>
              {t.byType.map((x) => (
                <li key={x.label} className="flex items-baseline justify-between gap-4 py-2">
                  <span className="text-slate-800 dark:text-slate-200">{x.label}</span>
                  <span className="tabular-nums text-slate-900 dark:text-slate-100">{x.count}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <section aria-labelledby="pack-cleanups" className="mt-12 print:mt-8">
        <h2 id="pack-cleanups" className={appSection}>
          Clean-ups
        </h2>
        {pack.cleanups.length === 0 ? (
          <p className={`mt-3 text-sm ${muted}`}>No clean-ups by the group were marked done in this period.</p>
        ) : (
          <ul className={`mt-4 divide-y border-y ${rule}`}>
            {pack.cleanups.map((c, i) => (
              <li key={i} className="flex flex-col gap-4 py-5 break-inside-avoid sm:flex-row print:flex-row print:py-3">
                <div className="flex gap-3">
                  <Photo src={c.photo} caption="Reported" />
                  {c.fixedPhoto && <Photo src={c.fixedPhoto} caption="Fixed" />}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{packDate(c.date)}</p>
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    {c.type}, {c.place}
                  </p>
                  <p className={`text-sm ${muted}`}>
                    {c.coming === 1 ? "1 person said they would come." : `${c.coming} people said they would come.`}
                  </p>
                  {c.caseStatus && (
                    <p className={`flex flex-wrap items-center gap-x-2 text-sm ${muted}`}>
                      The report now: <Status status={c.caseStatus} />
                    </p>
                  )}
                  <PageLink href={c.href} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pack-reports" className="mt-12 print:mt-8">
        <h2 id="pack-reports" className={appSection}>
          Reports
        </h2>
        {pack.reports.length === 0 ? (
          <p className={`mt-3 text-sm ${muted}`}>No reports sent with {group.name} were published in this period.</p>
        ) : (
          <ul className={`mt-4 divide-y border-y ${rule}`}>
            {pack.reports.map((r, i) => (
              <li key={i} className="flex gap-4 py-4 break-inside-avoid print:py-2">
                <Photo src={r.photo} />
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold leading-snug text-slate-900 dark:text-slate-100">{r.type}</p>
                  <p className={`text-sm ${muted}`}>{r.place}</p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className={muted}>Published {packDate(r.date)}</span>
                    {r.caseStatus && <Status status={r.caseStatus} />}
                  </p>
                  <PageLink href={r.href} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={`mt-12 space-y-2 border-t pt-6 text-sm leading-relaxed print:mt-8 ${muted} ${rule}`}>
        <p className="max-w-[70ch]">
          Each report was checked by Neer Vazhvu before it was published. Neer Vazhvu does not record members&rsquo; names; add a list of
          participants yourself if your institution needs one.
        </p>
        <p className="font-medium">{SITE}</p>
      </div>
    </>
  );
}

/**
 * A reviewed group's evidence pack, over the page: what members reported and the clean-ups the group held in a period,
 * to print, save as PDF or download as CSV. Counts only, never who.
 */
export function GroupPack({ group, authFetch, onClose }: { group: MyGroup; authFetch: Fetch; onClose: () => void }) {
  const [today] = useState(() => istDate(Date.now()));
  const [preset, setPreset] = useState<PackPreset | "custom">("3m");
  const [period, setPeriod] = useState(() => presetPeriod("3m", today));
  const [draft, setDraft] = useState(period);
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<{ key: string; pack?: Pack; error?: string; retry?: boolean } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const back = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  const key = `${period.from}/${period.to}/${tick}`;
  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ groupId: group.id, from: period.from, to: period.to });
    authFetch(`/api/sightings/groups/pack?${q}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (live) setResult(res.ok && json.data ? { key, pack: json.data } : { key, error: json.error ?? FAILED, retry: res.status >= 500 });
      })
      .catch(() => live && setResult({ key, error: "No connection. Please try again.", retry: true }));
    return () => {
      live = false;
    };
  }, [authFetch, group.id, period.from, period.to, key]);

  // Over the page: its scroll held, Escape closes, focus starts on Back.
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    back.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const loading = result?.key !== key;
  const pack = result?.pack;
  const error = loading ? null : (result?.error ?? null);

  const choose = (k: PackPreset) => {
    setPreset(k);
    setPeriod(presetPeriod(k, today));
  };
  // Photos load as they scroll in; all of them are loaded before printing.
  const print = async () => {
    setPreparing(true);
    const imgs = [...(sheet.current?.querySelectorAll("img") ?? [])];
    for (const img of imgs) img.loading = "eager";
    await Promise.race([Promise.all(imgs.map((img) => img.decode().catch(() => {}))), new Promise((r) => setTimeout(r, 8000))]);
    setPreparing(false);
    window.print();
  };
  const draftOk = !!draft.from && !!draft.to && draft.from <= draft.to;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="pack-title" className="nv-pack fixed inset-0 z-[10001] overflow-y-auto bg-white dark:bg-slate-950">
      <style>{PRINT_CSS}</style>
      <div className="mx-auto max-w-4xl px-4 pt-4 pb-16 sm:px-6 sm:pt-6 lg:px-8 print:max-w-none print:p-0">
        <div className={`space-y-5 border-b pb-6 print:hidden ${rule}`}>
          <button ref={back} type="button" onClick={() => close.current()} className={`${btn("quiet", "sm")} -ml-3`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to groups
          </button>
          <fieldset>
            <legend className="text-sm font-medium text-slate-900 dark:text-slate-100">Period</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {PACK_PRESETS.map((p) => (
                <button key={p.key} type="button" aria-pressed={preset === p.key} onClick={() => choose(p.key)} className={btn("secondary", "sm")}>
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={preset === "custom"}
                onClick={() => {
                  setPreset("custom");
                  setDraft(period);
                }}
                className={btn("secondary", "sm")}
              >
                Other dates
              </button>
            </div>
          </fieldset>
          {preset === "custom" && (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (draftOk) setPeriod(draft);
              }}
            >
              <label className="text-sm font-medium text-slate-900 dark:text-slate-100">
                From
                <input
                  type="date"
                  value={draft.from}
                  max={draft.to || today}
                  onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                  className={`${fieldBox} mt-1.5 block w-40 dark:[color-scheme:dark]`}
                />
              </label>
              <label className="text-sm font-medium text-slate-900 dark:text-slate-100">
                To
                <input
                  type="date"
                  value={draft.to}
                  min={draft.from || undefined}
                  max={today}
                  onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                  className={`${fieldBox} mt-1.5 block w-40 dark:[color-scheme:dark]`}
                />
              </label>
              <button type="submit" disabled={!draftOk} className={btn("primary", "lg")}>
                Show
              </button>
            </form>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={print} disabled={!pack || loading || preparing} className={btn("secondary", "md")}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              {preparing ? "Preparing…" : "Print or save as PDF"}
            </button>
            <button type="button" onClick={() => pack && downloadCsv(pack)} disabled={!pack || loading} className={btn("secondary", "md")}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Download CSV
            </button>
          </div>
        </div>

        <div ref={sheet} aria-busy={loading} className="pt-8 print:pt-0">
          {error ? (
            <div role="alert" className="flex flex-col items-start gap-4 py-8">
              <h1 id="pack-title" className={appSection}>
                {group.name}
              </h1>
              <p className="text-slate-800 dark:text-slate-200">{error}</p>
              {result?.retry && (
                <button type="button" onClick={() => setTick((t) => t + 1)} className={btn("secondary", "md")}>
                  <RotateCw className="h-4 w-4" aria-hidden="true" />
                  Try again
                </button>
              )}
            </div>
          ) : pack ? (
            <div className={`transition-opacity ${loading ? "opacity-50" : ""}`}>
              <Sheet pack={pack} />
            </div>
          ) : (
            <div role="status" className="space-y-4">
              <h1 id="pack-title" className={appTitle}>
                {group.name}
              </h1>
              <p className={muted}>Making the pack…</p>
              <div className="h-40 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
