"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

import type { OwnReport } from "@/lib/sightings/types";
import { AccountActions } from "./account-actions";
import { GroupsPanel, pendingJoin, rememberJoin } from "./groups-panel";
import { MyReports } from "./my-reports";
import { ReportFlow, type View } from "./report-flow";
import { btn, link, muted, rule, serif } from "./ui";
import { signInConfigured, useCitizen } from "./use-citizen";

const INTRO: [string, string][] = [
  ["Photo and place", "Take a photo at the spot. The place comes from your phone or from the photo."],
  ["We check it", "Every report is checked before it appears on the page for that ward, water body or village."],
  ["You see who handles it", "With its complaint channels. If you file, add the reference number and keep the status up to date."],
];

/** Google's own mark: its sign-in branding rules fix the logo and the words on the button. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

const google =
  "inline-flex h-14 items-center justify-center gap-3 rounded-lg border border-[#747775] bg-white px-6 text-base font-medium text-[#1f1f1f] transition-colors hover:bg-slate-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 active:translate-y-px " +
  "dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-[#1f1f20]";

export type Coverage = { cities: number; districts: number; basins: number };

function SignedOut({ onSignIn, coverage }: { onSignIn: () => void; coverage: Coverage }) {
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-20">
      <div className="space-y-5">
        <button type="button" onClick={onSignIn} className={`${google} w-full sm:w-auto`}>
          <GoogleMark />
          Continue with Google
        </button>
        <p className={`flex max-w-[52ch] items-start gap-2 text-sm leading-relaxed ${muted}`}>
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Sign in once, then report as often as you need. Your name and email never appear with a report.{" "}
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
      </div>
      <ol className={`border-t ${rule}`}>
        {INTRO.map(([title, text], i) => (
          <li key={title} className={`grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 border-b py-5 ${rule}`}>
            <span className={`${serif} text-2xl leading-none text-cyan-700! dark:text-cyan-400!`}>{i + 1}</span>
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

/** Sign-in, the report form and the reporter's own reports, under the page's header (compact once signed in). */
export function CitizenApp({ header, coverage }: { header: React.ReactNode; coverage: Coverage }) {
  const { session, ready, signIn, signOut, authFetch } = useCitizen();
  // An invite link (?join=) opens the Groups view, before and after sign-in.
  const [view, setView] = useState<"report" | "mine" | "groups">(() => (pendingJoin() ? "groups" : "report"));
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
  else if (!session) body = <SignedOut onSignIn={signIn} coverage={coverage} />;
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
              {!!mine?.length && <span className="rounded-full bg-slate-200 px-1.5 text-xs tabular-nums dark:bg-slate-700">{mine.length}</span>}
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
          <AccountActions authFetch={authFetch} signOut={signOut} />
        </div>
        <div className="pt-8 sm:pt-10">
          {view === "report" ? (
            <ReportFlow authFetch={authFetch} onSent={load} onOpenMine={() => setView("mine")} view={start} />
          ) : view === "mine" ? (
            <MyReports reports={mine} authFetch={authFetch} onChange={load} onNew={() => setView("report")} />
          ) : (
            <GroupsPanel citizen={{ session, authFetch }} />
          )}
        </div>
      </>
    );

  return (
    <div className="group/citizen" data-signed-in={session ? "" : undefined}>
      {header}
      {body}
    </div>
  );
}
