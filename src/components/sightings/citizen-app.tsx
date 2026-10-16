"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import type { OwnReport } from "@/lib/sightings/types";
import { MyReports } from "./my-reports";
import { ReportFlow } from "./report-flow";
import { signInConfigured, useCitizen } from "./use-citizen";

/** Sign-in, the report form and the reporter's own reports. */
export function CitizenApp() {
  const { session, ready, signIn, signOut, authFetch } = useCitizen();
  const [tab, setTab] = useState<"report" | "mine">("report");
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

  if (!signInConfigured) return <p className="text-sm text-slate-600 dark:text-slate-400">Reporting is unavailable right now. Please try again later.</p>;
  if (!ready) return <div className="h-40 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />;
  if (!session) {
    return (
      <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-700">
        <p className="font-medium text-slate-900 dark:text-slate-100">Sign in once to send reports</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Signing in keeps reports accountable and lets you follow each one. Your name and email are never shown.
        </p>
        <button type="button" onClick={signIn} className="mt-4 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800">
          Continue with Google
        </button>
      </div>
    );
  }

  const tabClass = (on: boolean) =>
    `rounded-md px-3 py-2 text-sm font-medium ${on ? "bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300" : "text-slate-600 dark:text-slate-400"}`;
  return (
    <div>
      <div className="mb-4 flex items-center gap-1 border-b border-slate-200 pb-2 dark:border-slate-700">
        <button type="button" className={tabClass(tab === "report")} onClick={() => setTab("report")}>
          Report
        </button>
        <button type="button" className={tabClass(tab === "mine")} onClick={() => setTab("mine")}>
          My reports{mine?.length ? ` (${mine.length})` : ""}
        </button>
        {reviewer && (
          <Link href="/admin/sightings" className={tabClass(false)}>
            Review
          </Link>
        )}
        <button type="button" onClick={signOut} className="ml-auto text-xs text-slate-500 underline underline-offset-2 dark:text-slate-400">
          Sign out
        </button>
      </div>
      {tab === "report" ? <ReportFlow authFetch={authFetch} onSent={load} /> : <MyReports reports={mine ?? []} authFetch={authFetch} onChange={load} />}
    </div>
  );
}
