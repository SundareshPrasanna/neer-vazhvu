"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";

import type { OwnReport } from "@/lib/sightings/types";
import { AccountActions } from "./account-actions";
import { MyReports } from "./my-reports";
import { ReportFlow } from "./report-flow";
import { btn, link, muted, rule, serif } from "./ui";
import { signInConfigured, useCitizen } from "./use-citizen";

const INTRO: [string, string][] = [
  ["Photo and place", "Take a photo at the spot. The place comes from your phone or from the photo."],
  ["We check it", "Every report is checked before it appears on the page for that ward, water body or village."],
  ["You see who handles it", "With its complaint channels. If you file, add the reference number and keep the status up to date."],
];

function SignedOut({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-20">
      <div className="space-y-5">
        <button type="button" onClick={onSignIn} className={`${btn("primary", "xl")} w-full sm:w-auto`}>
          Continue with Google
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
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

/** Sign-in, the report form and the reporter's own reports, under the page's header (compact once signed in). */
export function CitizenApp({ header }: { header: React.ReactNode }) {
  const { session, ready, signIn, signOut, authFetch } = useCitizen();
  const [view, setView] = useState<"report" | "mine">("report");
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
  else if (!session) body = <SignedOut onSignIn={signIn} />;
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
            <ReportFlow authFetch={authFetch} onSent={load} onOpenMine={() => setView("mine")} />
          ) : (
            <MyReports reports={mine} authFetch={authFetch} onChange={load} onNew={() => setView("report")} />
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
