"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Copy, RotateCw, XCircle } from "lucide-react";

import { ActionButton, useFlash } from "./action-feedback";
import { Readings, day } from "./report-card";
import { REVIEW_KEYS, reviewCommand } from "./review-keys";
import { appLink, appSection, appTitle, btn, enter, field, muted, rule } from "./ui";
import { useCitizen } from "./use-citizen";
import { CLEANUPS_ON } from "@/lib/sightings/groups";
import { issueHref } from "@/lib/sightings/issue-share";
import { OTHER_KEY, REPORT_GROUPS } from "@/lib/sightings/taxonomy";
import type { NearbyIssue, OwnReport, PhotoRow } from "@/lib/sightings/types";

interface QueueItem extends OwnReport {
  note: string | null;
  candidateLabel: string | null;
  exif: { capturedAt: string | null; lat: number | null; lng: number | null };
  photos: { kind: PhotoRow["kind"]; published: boolean; url: string | null }[];
  /** Open issues near a received report that it may duplicate; empty otherwise. */
  possibleSame: NearbyIssue[];
  reporter: { key: string; trusted: boolean; suspended: boolean; total: number; rejected: number };
}

/** Flags for the reviewer; nothing is rejected automatically. */
const OLD_PHOTO_DAYS = 30;
const FAR_KM = 1;

type Result = { ok: boolean; rejected?: number; error?: string };
/** What became of a report in this session: shown in its place until the queue is refreshed. */
type Outcome = { text: string; ok: boolean };
/** A decision waiting for its second step. */
type Ask = { kind: "reject" } | { kind: "suspend" } | { kind: "merge"; to: NearbyIssue };
/** Photos sent after publishing that wait for a check: "It's gone" (fixed) and "still there" (update). */
type Later = "fixed" | "update";

const PHOTO_LABELS: Record<PhotoRow["kind"], [string, string]> = {
  report: ["Report", "Report"],
  fixed: ["Fixed, published", "Fixed, waiting"],
  update: ["Still there, published", "Still there, waiting"],
};
const LATER: Record<Later, { question: string; publish: string; published: string; discarded: string }> = {
  fixed: { question: "The reporter says it is fixed. Publish their new photo?", publish: "Publish fixed photo", published: "Fixed photo published.", discarded: "Fixed photo discarded." },
  update: { question: "Someone sent a photo showing it is still there. Publish it?", publish: "Publish photo", published: "Still there photo published.", discarded: "Still there photo discarded." },
};

const people = (n: number) => (n === 1 ? "1 person" : `${n} people`);
const whereOf = (n: NearbyIssue) => [n.issue.label, n.issue.where].filter(Boolean).join(", ");

/** One report to decide. While it is the active item, the queue's keys act on it (review-keys.ts). */
function Item({ item, active, act, onDone }: { item: QueueItem; active: boolean; act: (body: object) => Promise<Result>; onDone: (key: string, o: Outcome, r: Result) => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState(item.subcategory ? `${item.category}:${item.subcategory}` : item.category);
  const [candidate, setCandidate] = useState(item.candidateLabel ?? "");
  const [reason, setReason] = useState("");
  const reasonField = useRef<HTMLInputElement>(null);
  const mergeBox = useRef<HTMLDivElement>(null);
  const received = item.reviewStatus === "received";
  const waiting = (kind: Later) => item.photos.some((p) => p.kind === kind && !p.published);
  const later: Later | null = waiting("fixed") ? "fixed" : waiting("update") ? "update" : null;
  const [category, subcategory] = type.split(":");

  const run = async (key: string, body: object, outcome: (r: Result) => Outcome) => {
    setPending(key);
    setError(null);
    const r = await act(body);
    setPending(null);
    if (!r.ok) return setError(r.error ?? "That did not work. Please try again.");
    onDone(key, outcome(r), r);
  };
  const approve = () =>
    run("approve", { action: "approve", id: item.id, category, subcategory: subcategory ?? null, candidateLabel: candidate }, () => ({
      text: `Approved. It is now on the ${item.placeName} pages.`,
      ok: true,
    }));
  const reject = () => run("reject", { action: "reject", id: item.id, reason }, () => ({ text: "Rejected. Its photos and note are deleted.", ok: false }));
  const publish = (kind: Later) => run(`publish_${kind}`, { action: `publish_${kind}`, id: item.id }, () => ({ text: LATER[kind].published, ok: true }));
  const discard = (kind: Later) => run(`discard_${kind}`, { action: `discard_${kind}`, id: item.id }, () => ({ text: LATER[kind].discarded, ok: false }));
  const merge = (to: NearbyIssue) =>
    run("merge", { action: "merge", id: item.id, targetReportId: to.reportId }, () => ({ text: `Added to the existing report: ${whereOf(to)}.`, ok: true }));

  // R puts the cursor in the reason; M puts it on "Add to it". Enter then confirms either.
  useEffect(() => {
    if (ask?.kind === "reject") reasonField.current?.focus();
    if (ask?.kind === "merge") mergeBox.current?.querySelector("button")?.focus();
  }, [ask]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const c = reviewCommand(e);
      if (!c || c === "next" || c === "previous" || pending) return;
      if (c === "cancel") {
        if (!ask) return;
        setAsk(null);
      } else if (ask) return;
      else if (c === "approve" && received) approve();
      else if (c === "reject" && received) setAsk({ kind: "reject" });
      else if (c === "publish" && later) publish(later);
      else if (c === "discard" && later) discard(later);
      else if (c === "same" && received && item.possibleSame[0]) setAsk({ kind: "merge", to: item.possibleSame[0] });
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
                <span className={`text-xs ${muted}`}>{PHOTO_LABELS[p.kind][p.published ? 0 : 1]}</span>
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

        {received && (
          <div className={`space-y-3 border-t pt-5 ${rule}`}>
            {item.possibleSame.length > 0 && (
              <div className="space-y-2 pb-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Possibly the same as:</p>
                <ul className="space-y-2">
                  {item.possibleSame.map((n) => (
                    <li key={n.reportId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-sm text-slate-800 dark:text-slate-200">
                      <span className="min-w-0">
                        {n.issue.placeHref ? (
                          <a href={issueHref(n.issue.placeHref, n.issue.id)} target="_blank" rel="noopener noreferrer" className={appLink}>
                            {n.issue.label}
                          </a>
                        ) : (
                          n.issue.label
                        )}
                        , {Math.round(n.distanceM)} m away, {people(n.issue.people)}
                      </span>
                      <button type="button" onClick={() => setAsk({ kind: "merge", to: n })} disabled={pending != null} className={btn("secondary", "sm")}>
                        Same as this
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
              <input
                ref={reasonField}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && ask?.kind === "reject" && !pending) {
                    e.preventDefault();
                    reject();
                  }
                }}
                className={`${field} mt-1.5`}
              />
            </label>
            {ask?.kind === "merge" ? (
              <div ref={mergeBox} role="alertdialog" aria-label="Add to the existing report" className={`rounded-xl border bg-slate-50 p-4 dark:bg-slate-900 ${rule} ${enter}`}>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add this to the existing report?</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {whereOf(ask.to)}. Its first photo goes on that report, published, and the person who sent it counts as having seen it. This report is
                  not published on its own, and its sender is told where it went.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton label="Add to it" busyLabel="Adding…" busy={pending === "merge"} onClick={() => merge(ask.to)} className={btn("approve", "md")} />
                  <button type="button" onClick={() => setAsk(null)} disabled={pending != null} className={btn("quiet", "md")}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : ask ? (
              <div
                role="alertdialog"
                aria-label={ask.kind === "reject" ? "Reject this report" : "Suspend this account"}
                className={`rounded-xl border p-4 ${ask.kind === "suspend" ? "border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/30" : `bg-slate-50 dark:bg-slate-900 ${rule}`} ${enter}`}
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ask.kind === "reject" ? "Reject this report?" : "Suspend this account?"}</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {ask.kind === "reject"
                    ? "Its photos and note are deleted. The reason above is shown to the reporter."
                    : "Every report it has waiting is rejected, and it cannot send more."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton
                    label={ask.kind === "reject" ? "Reject" : "Suspend account"}
                    busyLabel={ask.kind === "reject" ? "Rejecting…" : "Suspending…"}
                    busy={pending === ask.kind}
                    onClick={() =>
                      ask.kind === "reject"
                        ? reject()
                        : run("suspend", { action: "suspend", reporterKey: item.reporter.key, reason }, () => ({ text: "Rejected, and the account is suspended.", ok: false }))
                    }
                    className={btn("danger", "md")}
                  />
                  <button type="button" onClick={() => setAsk(null)} disabled={pending != null} className={btn("quiet", "md")}>
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
                  onClick={approve}
                />
                <button type="button" onClick={() => setAsk({ kind: "reject" })} disabled={pending != null} className={btn("secondary", "md")}>
                  Reject
                </button>
                <button type="button" onClick={() => setAsk({ kind: "suspend" })} disabled={pending != null} className={`${btn("dangerQuiet", "md")} ml-auto`}>
                  Suspend account
                </button>
              </div>
            )}
          </div>
        )}
        {(["fixed", "update"] as const).map(
          (kind) =>
            waiting(kind) && (
              <div key={kind} className={`space-y-3 border-t pt-5 ${rule}`}>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{LATER[kind].question}</p>
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    label={LATER[kind].publish}
                    busyLabel="Publishing…"
                    busy={pending === `publish_${kind}`}
                    disabled={pending != null}
                    className={btn("approve", "md")}
                    onClick={() => publish(kind)}
                  />
                  <ActionButton
                    label="Discard it"
                    busyLabel="Discarding…"
                    busy={pending === `discard_${kind}`}
                    disabled={pending != null}
                    className={btn("secondary", "md")}
                    onClick={() => discard(kind)}
                  />
                </div>
              </div>
            ),
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

interface PendingGroup {
  id: string;
  name: string;
  kindLabel: string;
  placeName: string | null;
  createdAt: string;
  members: number;
}

/** Groups waiting for review: approved groups can be named on reports and host clean-ups. Reviewer only (the API checks). */
function PendingGroups({ authFetch, tick }: { authFetch: ReturnType<typeof useCitizen>["authFetch"]; tick: number }) {
  const [list, setList] = useState<PendingGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [done, setDone] = useState<Record<string, Outcome>>({});
  const [confirm, setConfirm] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    authFetch("/api/sightings/groups?scope=pending")
      .then(async (res) => {
        if (!live) return;
        if (res.status === 403) return setForbidden(true);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return setError(json.error ?? "Could not load the groups.");
        setList(json.data);
        setDone({});
        setError(null);
      })
      .catch(() => live && setError("Could not load the groups."));
    return () => {
      live = false;
    };
  }, [authFetch, tick]);

  const decide = async (g: PendingGroup, action: "approve" | "reject") => {
    setPending(`${action}:${g.id}`);
    setFailed(null);
    const res = await authFetch("/api/sightings/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, groupId: g.id }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setPending(null);
    setConfirm(null);
    if (!res?.ok) return setFailed({ id: g.id, text: json.error ?? (res ? "That did not work. Please try again." : "No connection. Please try again.") });
    setDone((d) => ({ ...d, [g.id]: action === "approve" ? { text: "Approved. Its hosts are told.", ok: true } : { text: "Rejected.", ok: false } }));
  };

  if (forbidden) return null;
  return (
    <section aria-labelledby="pending-groups" className={`mt-16 border-t pt-10 ${rule}`}>
      <h2 id="pending-groups" className={appSection}>
        Groups waiting for review
      </h2>
      <p className={`mt-2 max-w-[75ch] text-sm ${muted}`}>
        {`An approved group’s name shows on reports its members send with it${CLEANUPS_ON ? ", and its hosts can plan clean-ups" : ""}.`} Reject
        a name that names a person, misleads, or is not a real group.
      </p>
      {error && (
        <p role="alert" className="mt-6 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {list && list.length === 0 && <p className={`py-8 ${muted}`}>No groups waiting.</p>}
      {list && list.length > 0 && (
        <ul className={`mt-6 divide-y border-y ${rule}`}>
          {list.map((g) => {
            const o = done[g.id];
            return (
              <li key={g.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="font-semibold leading-snug break-words text-slate-900 dark:text-slate-100">{g.name}</p>
                  <p className={`mt-0.5 text-sm tabular-nums ${muted}`}>
                    {[g.kindLabel, g.placeName].filter(Boolean).join(", ")}. Started {day(g.createdAt)}. {g.members} {g.members === 1 ? "member" : "members"}.
                  </p>
                  {failed?.id === g.id && (
                    <p role="alert" className="mt-1 text-sm font-medium text-red-700 dark:text-red-400">
                      {failed.text}
                    </p>
                  )}
                </div>
                {o ? (
                  <p role="status" className={`flex items-center gap-2 text-sm font-medium ${o.ok ? "text-emerald-700 dark:text-emerald-400" : muted} ${enter}`}>
                    {o.ok ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
                    {o.text}
                  </p>
                ) : confirm === g.id ? (
                  <div role="alertdialog" aria-label={`Reject ${g.name}`} className={`flex flex-wrap items-center gap-2 ${enter}`}>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Reject this group?</span>
                    <ActionButton label="Reject" busyLabel="Rejecting…" busy={pending === `reject:${g.id}`} onClick={() => decide(g, "reject")} className={btn("danger", "sm")} />
                    <button type="button" onClick={() => setConfirm(null)} disabled={pending != null} className={btn("quiet", "sm")}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <ActionButton
                      label="Approve"
                      busyLabel="Approving…"
                      busy={pending === `approve:${g.id}`}
                      disabled={pending != null}
                      icon={<Check className="h-4 w-4" aria-hidden="true" />}
                      onClick={() => decide(g, "approve")}
                      className={btn("approve", "sm")}
                    />
                    <button type="button" onClick={() => setConfirm(g.id)} disabled={pending != null} className={btn("secondary", "sm")}>
                      Reject
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
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
  /** The item the keys act on: the one chosen with J and K or last touched, else the first still waiting. */
  const [activeId, setActiveId] = useState<string | null>(null);
  /** An item to bring into view once the list has re-rendered (a new object each time, so the same item can be shown again). */
  const [reveal, setReveal] = useState<{ id: string } | null>(null);

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

  useEffect(() => {
    if (!reveal) return;
    const el = document.getElementById(`review-${reveal.id}`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [reveal]);

  const open = (items ?? []).filter((i) => !done[i.id]);
  const active = open.some((i) => i.id === activeId) ? activeId : (open[0]?.id ?? null);
  const go = (id: string | undefined) => {
    if (!id) return;
    setActiveId(id);
    setReveal({ id });
  };

  // J and K move between the items still waiting; the active item handles its own keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = reviewCommand(e);
      if (c !== "next" && c !== "previous") return;
      const at = open.findIndex((i) => i.id === active);
      const to = open[c === "next" ? at + 1 : at - 1];
      if (!to) return;
      e.preventDefault();
      go(to.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const act = async (body: object): Promise<Result> => {
    const res = await authFetch("/api/sightings/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    return res?.ok ? { ok: true, rejected: json.data?.rejected } : { ok: false, error: json.error ?? (res ? undefined : "No connection. Please try again.") };
  };

  const settle = (item: QueueItem, key: string, outcome: Outcome) => {
    // Suspending rejects everything else that account has waiting.
    const swept = (o: QueueItem) => key === "suspend" && o.id !== item.id && o.reporter.key === item.reporter.key && o.reviewStatus === "received";
    setDone((d) => {
      const next = { ...d, [item.id]: outcome };
      for (const o of items ?? []) if (swept(o)) next[o.id] = { text: "Rejected: the account is suspended.", ok: false };
      return next;
    });
    // On to the next one still waiting below it.
    go(open.slice(open.findIndex((o) => o.id === item.id) + 1).find((o) => !swept(o))?.id);
  };

  const loading = !!session && loaded !== tick;
  const waiting = open.length;
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      {/* Back to wherever the reviewer came from; straight to /mitra when the page was opened directly. */}
      <button
        type="button"
        onClick={() => (window.history.length > 1 && document.referrer.startsWith(window.location.origin) ? window.history.back() : window.location.assign("/mitra"))}
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
          <div className={`border-b py-4 text-sm ${muted} ${rule}`}>
            <p className="max-w-[75ch]">
              Reject a photo that shows a face, a vehicle number plate, or a house name or number, and any note or reading that names a
              person. For a water test, check the values against the meter or kit in the photo.
            </p>
            <p className="mt-2 hidden text-xs sm:block">
              Keys:{" "}
              {REVIEW_KEYS.map((k) => (
                <span key={k.key}>
                  <kbd className="font-mono font-semibold text-slate-800 dark:text-slate-200">{k.key}</kbd> {k.label},{" "}
                </span>
              ))}
              <kbd className="font-mono font-semibold text-slate-800 dark:text-slate-200">Esc</kbd> cancel.
            </p>
          </div>
          {error && (
            <p role="alert" className="mt-6 text-sm font-medium text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
          {items && waiting === 0 && Object.keys(done).length === 0 && <p className={`py-12 text-center ${muted}`}>Nothing waiting. New reports appear here, oldest first.</p>}
          <ul className={`divide-y ${rule}`}>
            {items?.map((item) => {
              const o = done[item.id];
              const isActive = !o && item.id === active;
              return (
                <li
                  key={item.id}
                  id={`review-${item.id}`}
                  tabIndex={-1}
                  aria-current={isActive || undefined}
                  onFocusCapture={() => !o && setActiveId(item.id)}
                  onPointerDown={() => !o && setActiveId(item.id)}
                  className="relative scroll-mt-20 outline-none"
                >
                  {isActive && <span className="absolute inset-y-8 -left-3 w-0.5 rounded-full bg-cyan-700 sm:-left-4 dark:bg-cyan-400" aria-hidden="true" />}
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
                    <Item item={item} active={isActive} act={act} onDone={(key, outcome) => settle(item, key, outcome)} />
                  )}
                </li>
              );
            })}
          </ul>
          <PendingGroups authFetch={authFetch} tick={tick} />
          <DepartmentLinks authFetch={authFetch} tick={tick} />
        </>
      )}
    </main>
  );
}
