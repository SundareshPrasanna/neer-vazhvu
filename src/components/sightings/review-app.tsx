"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Copy, RotateCw, XCircle } from "lucide-react";

import { ActionButton, useFlash } from "./action-feedback";
import { Readings, day } from "./report-card";
import { appSection, appTitle, btn, enter, field, muted, rule } from "./ui";
import { useCitizen } from "./use-citizen";
import { OTHER_KEY, REPORT_GROUPS } from "@/lib/sightings/taxonomy";
import type { OwnReport } from "@/lib/sightings/types";

interface QueueItem extends OwnReport {
  note: string | null;
  candidateLabel: string | null;
  exif: { capturedAt: string | null; lat: number | null; lng: number | null };
  photos: { kind: "report" | "fixed"; published: boolean; url: string | null }[];
  reporter: { key: string; trusted: boolean; suspended: boolean; total: number; rejected: number };
}

/** Flags for the reviewer; nothing is rejected automatically. */
const OLD_PHOTO_DAYS = 30;
const FAR_KM = 1;

type Result = { ok: boolean; rejected?: number; error?: string };
/** What became of a report in this session: shown in its place until the queue is refreshed. */
type Outcome = { text: string; ok: boolean };

function Item({ item, act, onDone }: { item: QueueItem; act: (body: object) => Promise<Result>; onDone: (key: string, o: Outcome, r: Result) => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"reject" | "suspend" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState(item.subcategory ? `${item.category}:${item.subcategory}` : item.category);
  const [candidate, setCandidate] = useState(item.candidateLabel ?? "");
  const [reason, setReason] = useState("");
  const pendingFixed = item.photos.some((p) => p.kind === "fixed" && !p.published);
  const [category, subcategory] = type.split(":");

  const run = async (key: string, body: object, outcome: (r: Result) => Outcome) => {
    setPending(key);
    setError(null);
    const r = await act(body);
    setPending(null);
    if (!r.ok) return setError(r.error ?? "That did not work. Please try again.");
    onDone(key, outcome(r), r);
  };

  const exifGap =
    item.exif.lat != null && item.lat != null ? Math.hypot((item.exif.lat - item.lat) * 111, (item.exif.lng! - item.lng!) * 111 * Math.cos((item.lat * Math.PI) / 180)) : null;
  const ageDays = item.exif.capturedAt ? (new Date(item.createdAt).getTime() - new Date(item.exif.capturedAt).getTime()) / 86_400_000 : null;
  const flags = [
    ageDays != null && ageDays > OLD_PHOTO_DAYS && { text: `Old photo: taken ${Math.round(ageDays)} days before it was sent`, tone: "text-red-700 dark:text-red-400" },
    exifGap != null && exifGap > FAR_KM && { text: `Photo taken ${exifGap.toFixed(1)} km from the pin`, tone: "text-amber-800 dark:text-amber-300" },
    !item.exif.capturedAt && item.exif.lat == null && { text: "No date or location in the photo", tone: muted },
  ].filter((f): f is { text: string; tone: string } => !!f);

  const [first, ...rest] = item.photos.filter((p) => p.url);
  const facts: [string, React.ReactNode][] = [
    ["Note", item.note ?? <span className="text-slate-400">None</span>],
    ["Photo taken", item.exif.capturedAt ? day(item.exif.capturedAt) : <span className="text-slate-400">No date in photo</span>],
    ["Photo GPS", exifGap != null ? `${exifGap.toFixed(1)} km from the pin` : <span className="text-slate-400">None</span>],
    [
      "Reporter",
      <>
        <span className="font-mono text-xs">#{item.reporter.key.slice(0, 8)}</span>, {item.reporter.total} sent, {item.reporter.rejected} rejected,{" "}
        {item.reporter.trusted ? "trusted" : "new"}
        {item.reporter.suspended && <span className="font-semibold text-red-700 dark:text-red-400">, suspended</span>}
      </>,
    ],
  ];

  return (
    <article className="grid gap-6 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] md:gap-10">
      <div className="space-y-2">
        {first?.url && (
          <a href={first.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={first.url} alt={item.label} className="aspect-[4/3] w-full object-cover" />
          </a>
        )}
        {rest.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {rest.map((p, i) => (
              <a key={i} href={p.url!} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url!} alt={p.kind} className="aspect-square w-full rounded-lg object-cover" />
                <span className={`text-xs ${muted}`}>{p.kind === "fixed" ? (p.published ? "Fixed, published" : "Fixed, waiting") : "Report"}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-5">
        <div>
          <p className={`text-sm ${muted}`}>
            {[item.where, item.placeName].filter(Boolean).join(", ")}, sent {day(item.createdAt)}
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100">{item.label}</h2>
        </div>
        {flags.length > 0 && (
          <ul className="space-y-1.5">
            {flags.map((f) => (
              <li key={f.text} className={`flex items-start gap-2 text-sm font-medium ${f.tone}`}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {f.text}
              </li>
            ))}
          </ul>
        )}
        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className={muted}>{k}</dt>
              <dd className="min-w-0 break-words text-slate-800 dark:text-slate-200">{v}</dd>
            </div>
          ))}
        </dl>
        {item.readings.length > 0 && <Readings readings={item.readings} source={item.waterSource} test={item.test} />}

        {item.reviewStatus === "received" && (
          <div className={`space-y-3 border-t pt-5 ${rule}`}>
            <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
              Type
              <select value={type} onChange={(e) => setType(e.target.value)} className={`${field} mt-1.5`}>
                {REPORT_GROUPS.map((g) => (
                  <optgroup key={g.key} label={g.label}>
                    {g.types.map((t) => (
                      <option key={t.key} value={`${g.key}:${t.key}`}>
                        {t.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value={OTHER_KEY}>Other</option>
              </select>
            </label>
            {category === OTHER_KEY && (
              <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                Candidate new type <span className={`font-normal ${muted}`}>Optional</span>
                <input value={candidate} onChange={(e) => setCandidate(e.target.value)} className={`${field} mt-1.5`} />
              </label>
            )}
            <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
              Reason <span className={`font-normal ${muted}`}>Shown to the reporter if not published</span>
              <input value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} mt-1.5`} />
            </label>
            {confirm ? (
              <div
                role="alertdialog"
                aria-label={confirm === "reject" ? "Reject this report" : "Suspend this account"}
                className={`rounded-xl border p-4 ${confirm === "suspend" ? "border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/30" : `bg-slate-50 dark:bg-slate-900 ${rule}`} ${enter}`}
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{confirm === "reject" ? "Reject this report?" : "Suspend this account?"}</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {confirm === "reject"
                    ? "Its photos and note are deleted. The reason above is shown to the reporter."
                    : "Every report it has waiting is rejected, and it cannot send more."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton
                    label={confirm === "reject" ? "Reject" : "Suspend account"}
                    busyLabel={confirm === "reject" ? "Rejecting…" : "Suspending…"}
                    busy={pending === confirm}
                    onClick={() =>
                      confirm === "reject"
                        ? run("reject", { action: "reject", id: item.id, reason }, () => ({ text: "Rejected. Its photos and note are deleted.", ok: false }))
                        : run("suspend", { action: "suspend", reporterKey: item.reporter.key, reason }, () => ({ text: "Rejected, and the account is suspended.", ok: false }))
                    }
                    className={btn("danger", "md")}
                  />
                  <button type="button" onClick={() => setConfirm(null)} disabled={pending != null} className={btn("quiet", "md")}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <ActionButton
                  label="Approve"
                  busyLabel="Approving…"
                  busy={pending === "approve"}
                  disabled={pending != null}
                  icon={<Check className="h-4 w-4" aria-hidden="true" />}
                  className={btn("approve", "md")}
                  onClick={() =>
                    run("approve", { action: "approve", id: item.id, category, subcategory: subcategory ?? null, candidateLabel: candidate }, () => ({
                      text: `Approved. It is now on the ${item.placeName} pages.`,
                      ok: true,
                    }))
                  }
                />
                <button type="button" onClick={() => setConfirm("reject")} disabled={pending != null} className={btn("secondary", "md")}>
                  Reject
                </button>
                <button type="button" onClick={() => setConfirm("suspend")} disabled={pending != null} className={`${btn("dangerQuiet", "md")} ml-auto`}>
                  Suspend account
                </button>
              </div>
            )}
          </div>
        )}
        {pendingFixed && (
          <div className={`space-y-3 border-t pt-5 ${rule}`}>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">The reporter says it is fixed. Publish their new photo?</p>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                label="Publish fixed photo"
                busyLabel="Publishing…"
                busy={pending === "publish_fixed"}
                disabled={pending != null}
                className={btn("approve", "md")}
                onClick={() => run("publish_fixed", { action: "publish_fixed", id: item.id }, () => ({ text: "Fixed photo published.", ok: true }))}
              />
              <ActionButton
                label="Discard it"
                busyLabel="Discarding…"
                busy={pending === "discard_fixed"}
                disabled={pending != null}
                className={btn("secondary", "md")}
                onClick={() => run("discard_fixed", { action: "discard_fixed", id: item.id }, () => ({ text: "Fixed photo discarded.", ok: false }))}
              />
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm font-medium text-red-700 dark:text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    </article>
  );
}

interface DepartmentLink {
  key: string;
  body: string;
  acronym: string | null;
  open: number;
  all: number;
  notOurs: number;
  /** /department/<signed token> on this site. */
  path: string;
}

/** Every body with published reports and its private link, to hand over to that department. Reviewer only (the API checks). */
function DepartmentLinks({ authFetch, tick }: { authFetch: ReturnType<typeof useCitizen>["authFetch"]; tick: number }) {
  const [list, setList] = useState<DepartmentLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [copied, flash] = useFlash<string>();
  /** When the clipboard is blocked: the link in a field to copy by hand. */
  const [manual, setManual] = useState<{ key: string; url: string } | null>(null);

  useEffect(() => {
    let live = true;
    authFetch("/api/sightings/department/links")
      .then(async (res) => {
        if (!live) return;
        if (res.status === 403) return setForbidden(true);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return setError(json.error ?? "Could not load the department links.");
        setList(json.data);
        setError(null);
      })
      .catch(() => live && setError("Could not load the department links."));
    return () => {
      live = false;
    };
  }, [authFetch, tick]);

  const copy = async (d: DepartmentLink) => {
    const url = `${window.location.origin}${d.path}`;
    try {
      await navigator.clipboard.writeText(url);
      setManual(null);
      flash(d.key);
    } catch {
      setManual({ key: d.key, url });
    }
  };

  if (forbidden) return null;
  return (
    <section aria-labelledby="departments" className={`mt-16 border-t pt-10 ${rule}`}>
      <h2 id="departments" className={appSection}>
        Departments
      </h2>
      <p className={`mt-2 max-w-[75ch] text-sm ${muted}`}>
        Each body that handles published reports. Its link opens a private page where its officers see those reports, mark each one and
        print a summary, with nothing about the reporters. Anyone holding a link can mark that body&rsquo;s reports, so hand it to the
        department directly.
      </p>
      {error && (
        <p role="alert" className="mt-6 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {list && list.length === 0 && <p className={`py-8 ${muted}`}>No published report has a handling body yet.</p>}
      {list && list.length > 0 && (
        <ul className={`mt-6 divide-y border-y ${rule}`}>
          {list.map((d) => (
            <li key={d.key} className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
              <div className="min-w-0 flex-1 basis-64">
                <p className="font-semibold leading-snug break-words text-slate-900 dark:text-slate-100">
                  {d.acronym && !d.body.includes(d.acronym) ? `${d.body} (${d.acronym})` : d.body}
                </p>
                <p className={`mt-0.5 text-sm tabular-nums ${muted}`}>
                  {d.open} open of {d.all}
                  {d.notOurs > 0 && `, ${d.notOurs} marked not theirs`}
                </p>
                {manual?.key === d.key && (
                  <input
                    readOnly
                    value={manual.url}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label={`Link for ${d.body}`}
                    className={`${field} mt-2 font-mono text-xs`}
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                <a href={d.path} target="_blank" rel="noopener noreferrer" className={btn("quiet", "sm")}>
                  Open
                </a>
                <button type="button" onClick={() => copy(d)} className={btn("secondary", "sm")}>
                  {copied === d.key ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                  <span aria-live="polite">{copied === d.key ? "Copied" : "Copy link"}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Reviewer queue: oldest first. The API checks the reviewer allowlist. Decisions show in place until the next refresh. */
export function ReviewApp() {
  const { session, ready, signIn, authFetch } = useCitizen();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [done, setDone] = useState<Record<string, Outcome>>({});
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [loaded, setLoaded] = useState(-1);

  useEffect(() => {
    if (!session) return;
    let live = true;
    authFetch("/api/sightings/review")
      .then(async (res) => {
        if (!live) return;
        if (!res.ok) return setError(res.status === 403 ? "This account is not a reviewer." : "Could not load the queue.");
        setItems((await res.json()).data);
        setDone({});
        setError(null);
      })
      .catch(() => live && setError("Could not load the queue."))
      .finally(() => live && setLoaded(tick));
    return () => {
      live = false;
    };
  }, [session, authFetch, tick]);

  const act = async (body: object): Promise<Result> => {
    const res = await authFetch("/api/sightings/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    return res?.ok ? { ok: true, rejected: json.data?.rejected } : { ok: false, error: json.error ?? (res ? undefined : "No connection. Please try again.") };
  };

  const settle = (item: QueueItem, key: string, outcome: Outcome) =>
    setDone((d) => {
      const next = { ...d, [item.id]: outcome };
      // Suspending rejects everything else that account has waiting.
      if (key === "suspend")
        for (const o of items ?? []) if (o.id !== item.id && o.reporter.key === item.reporter.key && o.reviewStatus === "received") next[o.id] = { text: "Rejected: the account is suspended.", ok: false };
      return next;
    });

  const loading = !!session && loaded !== tick;
  const waiting = (items ?? []).filter((i) => !done[i.id]).length;
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      {/* Back to wherever the reviewer came from; straight to /for-citizens when the page was opened directly. */}
      <button
        type="button"
        onClick={() => (window.history.length > 1 && document.referrer.startsWith(window.location.origin) ? window.history.back() : window.location.assign("/for-citizens"))}
        className={`${btn("quiet", "sm")} -ml-3 mb-4`}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>
      <header className={`flex flex-wrap items-end justify-between gap-4 border-b pb-6 ${rule}`}>
        <div>
          <h1 className={appTitle}>Review queue</h1>
          <p className={`mt-2 ${muted}`}>{items ? `${waiting} waiting, oldest first` : session ? "Loading…" : "Citizen reports"}</p>
        </div>
        {session && (
          <button type="button" onClick={() => setTick((t) => t + 1)} disabled={loading} className={btn("secondary", "md")}>
            <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        )}
      </header>
      {!ready ? null : !session ? (
        <button type="button" onClick={signIn} className={`${btn("primary")} mt-8`}>
          Sign in
        </button>
      ) : (
        <>
          <p className={`max-w-[75ch] border-b py-4 text-sm ${muted} ${rule}`}>
            Reject a photo that shows a face, a vehicle number plate, or a house name or number, and any note or reading that names a
            person. For a water test, check the values against the meter or kit in the photo.
          </p>
          {error && (
            <p role="alert" className="mt-6 text-sm font-medium text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
          {items && waiting === 0 && Object.keys(done).length === 0 && <p className={`py-12 text-center ${muted}`}>Nothing waiting. New reports appear here, oldest first.</p>}
          <ul className={`divide-y ${rule}`}>
            {items?.map((item) => {
              const o = done[item.id];
              return (
                <li key={item.id}>
                  {o ? (
                    <div className={`flex items-start gap-3 py-5 text-sm ${enter}`} role="status">
                      {o.ok ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      ) : (
                        <XCircle className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                      )}
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{o.text}</p>
                        <p className={muted}>
                          {[item.label, item.where, item.placeName].filter(Boolean).join(", ")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <Item item={item} act={act} onDone={(key, outcome) => settle(item, key, outcome)} />
                  )}
                </li>
              );
            })}
          </ul>
          <DepartmentLinks authFetch={authFetch} tick={tick} />
        </>
      )}
    </main>
  );
}
