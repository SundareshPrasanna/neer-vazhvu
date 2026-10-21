"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

import type { OwnReport } from "@/lib/sightings/types";
import { AccountActions } from "./account-actions";
import { draftPending, useOutbox, useOutboxSender } from "./draft-store";
import { GoogleButton } from "./google-button";
import { GroupsPanel, pendingJoin, rememberJoin } from "./groups-panel";
import { MyReports } from "./my-reports";
import { ReportFlow, type View } from "./report-flow";
import { btn, link, muted, rule, headingCls } from "./ui";
import { signInConfigured, useCitizen } from "./use-citizen";

const INTRO: [string, string][] = [
  ["Photo and place", "Take a photo at the spot. The place comes from your phone or from the photo."],
  ["We check it", "Every report is checked before it appears on the page for that ward, water body or village."],
  ["You see who handles it", "With its complaint channels. If you file, add the reference number and keep the status up to date."],
];

export type Coverage = { cities: number; districts: number; basins: number };

/** The front door: start a report straight away; signing in waits until it is sent. */
function SignedOut({ onStart, onSignIn, coverage }: { onStart: () => void; onSignIn: () => void; coverage: Coverage }) {
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-20">
      <div className="space-y-5">
        <button type="button" onClick={onStart} className={`${btn("primary", "xl")} w-full sm:w-auto`}>
          Start a report
        </button>
        <p className={`flex max-w-[52ch] items-start gap-2 text-sm leading-relaxed ${muted}`}>
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            You sign in with Google only to send, and your name and email never appear with a report.{" "}
            <a href="#privacy" className={link}>
              How we protect you
            </a>
          </span>
        </p>
        <p className={`max-w-[52ch] text-sm leading-relaxed ${muted}`}>
          Open in {coverage.cities} cities, {coverage.districts} districts and {coverage.basins} river basins so far.{" "}
          <a href="#where" className={link}>
            See where
          </a>
        </p>
        <div className={`space-y-3 border-t pt-5 ${rule}`}>
          <p className={`text-sm ${muted}`}>Sent reports before, or joining a group? Sign in to see them.</p>
          <GoogleButton onClick={onSignIn} size="md" className="w-full sm:w-auto" />
        </div>
      </div>
      <ol className={`border-t ${rule}`}>
        {INTRO.map(([title, text], i) => (
          <li key={title} className={`grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 border-b py-5 ${rule}`}>
            <span className={`${headingCls} text-2xl leading-none text-cyan-700! dark:text-cyan-400!`}>{i + 1}</span>
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{title}</p>
              <p className={`mt-1 ${muted}`}>{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const tab =
  "inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 " +
  "focus-visible:outline-2 focus-visible:outline-cyan-500 aria-pressed:bg-white aria-pressed:text-slate-900 aria-pressed:shadow-sm " +
  "dark:text-slate-400 dark:hover:text-slate-100 dark:aria-pressed:bg-slate-950 dark:aria-pressed:text-slate-100";

const FROM_KEY = "nv-report-from";

/** The report form (open to anyone; sign-in at Send), sign-in and the reporter's own reports, under the page's header (compact once reporting). */
export function CitizenApp({ header, coverage }: { header: React.ReactNode; coverage: Coverage }) {
  const citizen = useCitizen();
  const { session, ready, signIn, signOut, authFetch } = citizen;
  // A report kept on the phone across sign-in opens the form; else an invite link (?join=) opens Groups, before and after sign-in.
  const [view, setView] = useState<"report" | "mine" | "groups">(() => (draftPending() ? "report" : pendingJoin() ? "groups" : "report"));
  // Signed out but reporting: the form instead of the front door. Read on the client only; nothing shows it before `ready`.
  const [started, setStarted] = useState(draftPending);
  const [start, setStart] = useState<View | null>(null);

  // A report started from a place page opens its map there; kept across the Google sign-in round trip, which drops the query.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    rememberJoin();
    try {
      if (q.get("place")) sessionStorage.setItem(FROM_KEY, q.toString());
    } catch {
      // Storage blocked: the map opens on the default view.
    }
  }, []);
  // Signed in from a place page's "Still there / It's gone": go back there.
  useEffect(() => {
    if (!session) return;
    let back: string | null = null;
    try {
      back = sessionStorage.getItem("nv-return");
      sessionStorage.removeItem("nv-return");
    } catch {
      // Storage blocked: stay here.
    }
    if (back?.startsWith("/") && !back.startsWith("//")) window.location.assign(back);
  }, [session]);
  useEffect(() => {
    if (!session) return;
    let from: string | null = null;
    try {
      from = sessionStorage.getItem(FROM_KEY);
      sessionStorage.removeItem(FROM_KEY);
    } catch {
      // As above.
    }
    if (!from) return;
    authFetch(`/api/sightings/locate?${from}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.data && setStart(j.data))
      .catch(() => {});
  }, [session, authFetch]);
  const [mine, setMine] = useState<OwnReport[] | null>(null);
  const [reviewer, setReviewer] = useState(false);

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);
  // Reports saved on this phone while offline: sent now, and whenever it comes back online.
  const owner = session?.user.id ?? null;
  useOutboxSender(owner, authFetch, load);
  const waiting = useOutbox(owner).items.length;

  useEffect(() => {
    if (!session) return;
    let live = true;
    authFetch("/api/sightings/mine")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!live || !json) return;
        setMine(json.data);
        setReviewer(!!json.reviewer);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [session, authFetch, tick]);

  let body: React.ReactNode;
  if (!signInConfigured) body = <p className={muted}>Reporting is unavailable right now. Please try again later.</p>;
  else if (!ready) body = <div className="h-14 w-full animate-pulse rounded-lg bg-slate-100 sm:w-72 dark:bg-slate-800" />;
  else if (!session && started) body = <ReportFlow citizen={citizen} onSent={load} onOpenMine={() => setView("mine")} view={start} />;
  else if (!session) body = <SignedOut onStart={() => setStarted(true)} onSignIn={signIn} coverage={coverage} />;
  else
    body = (
      <>
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-3 border-b pb-4 ${rule}`}>
          <div role="group" aria-label="View" className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800/80">
            <button type="button" aria-pressed={view === "report"} onClick={() => setView("report")} className={tab}>
              New report
            </button>
            <button type="button" aria-pressed={view === "mine"} onClick={() => setView("mine")} className={tab}>
              My reports{" "}
              {!!(mine?.length || waiting) && <span className="rounded-full bg-slate-200 px-1.5 text-xs tabular-nums dark:bg-slate-700">{(mine?.length ?? 0) + waiting}</span>}
            </button>
            <button type="button" aria-pressed={view === "groups"} onClick={() => setView("groups")} className={tab}>
              Groups
            </button>
          </div>
          {reviewer && (
            <Link href="/admin/sightings" className={btn("quiet", "sm")}>
              Review queue
            </Link>
          )}
          <AccountActions authFetch={authFetch} signOut={signOut} ownerId={session?.user.id} />
        </div>
        <div className="pt-8 sm:pt-10">
          {view === "report" ? (
            <ReportFlow citizen={citizen} onSent={load} onOpenMine={() => setView("mine")} view={start} />
          ) : view === "mine" ? (
            <MyReports reports={mine} authFetch={authFetch} onChange={load} onNew={() => setView("report")} />
          ) : (
            <GroupsPanel citizen={{ session, authFetch }} />
          )}
        </div>
      </>
    );

  return (
    <div className="group/citizen" data-compact={session || (started && ready && signInConfigured) ? "" : undefined}>
      {header}
      {body}
    </div>
  );
}
