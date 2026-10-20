"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { OTHER_KEY, isCommunityReport } from "@/lib/sightings/taxonomy";
import type { NearbyIssue } from "@/lib/sightings/types";
import { ActionButton } from "./action-feedback";
import { btn, enter, muted, rule } from "./ui";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const GOOD_NEWS = "recovery";
const indiaToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const utc = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** "today", "yesterday", "12 days ago", from an India date. */
export function daysAgo(ymd: string, today = indiaToday()): string {
  const n = Math.max(0, Math.round((utc(today) - utc(ymd)) / 86_400_000));
  return n === 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`;
}

/** A label read mid-sentence: "garbage on the bank", but "TDS" stays. */
const inSentence = (label: string) => (label.length > 1 && label[1] === label[1].toUpperCase() && /[A-Z]/.test(label[1]) ? label : label[0].toLowerCase() + label.slice(1));

/**
 * An open issue near the pin of the same or an easily confused type, once a public type and a point are known. Home
 * reports, "something else" and good news are never matched. Null while nothing matches or the lookup is unavailable.
 */
export function useSameIssue(authFetch: Fetch, q: { lat: number; lng: number; accuracy: number | null } | null, group: string | null, type: string | null, signedIn: boolean) {
  const ask = q && group && type && group !== OTHER_KEY && group !== GOOD_NEWS && isCommunityReport(group);
  const key = ask ? `${q.lat.toFixed(5)},${q.lng.toFixed(5)},${q.accuracy ?? ""},${group},${type},${signedIn}` : null;
  const [found, setFound] = useState<{ key: string; matches: NearbyIssue[] } | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    const t = setTimeout(() => {
      const [lat, lng, accuracy, category, subcategory] = key.split(",");
      const params = new URLSearchParams({ lat, lng, category, subcategory });
      if (accuracy) params.set("accuracy", String(Math.round(Number(accuracy))));
      authFetch(`/api/sightings/nearby?${params}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => live && setFound({ key, matches: Array.isArray(j?.data) ? j.data : [] }))
        .catch(() => live && setFound({ key, matches: [] }));
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [key, authFetch]);
  return key && found?.key === key ? found.matches : null;
}

/** "Is this the same one?": before Send, when someone has already reported this here. */
export function SameIssueCard({
  match,
  signedIn,
  busy,
  error,
  onYes,
  onNo,
}: {
  match: NearbyIssue;
  signedIn: boolean;
  busy: boolean;
  error: string | null;
  onYes: () => void;
  onNo: () => void;
}) {
  const { issue } = match;
  const people = issue.people === 1 ? "1 person has" : `${issue.people} people have`;
  return (
    <section aria-labelledby="same-issue" className={`space-y-4 rounded-xl border bg-slate-50 p-4 sm:p-5 dark:bg-slate-900 ${rule} ${enter}`}>
      <div className="flex gap-3">
        {issue.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={issue.photoUrl} alt="The earlier report's photo" className="h-16 w-16 shrink-0 rounded-md object-cover" />
        )}
        <div className="min-w-0 space-y-1">
          <h3 id="same-issue" className="font-semibold leading-snug text-slate-900 dark:text-slate-100">
            Is this the same one?
          </h3>
          <p className="text-slate-800 dark:text-slate-200">
            Someone reported {inSentence(issue.label)} here {daysAgo(issue.firstOn)}. {people} reported or seen it. Same thing?
          </p>
          {issue.where && <p className={`text-sm ${muted}`}>{issue.where}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <ActionButton label="Yes, it's still there" busyLabel="Adding…" busy={busy} onClick={onYes} className={btn("primary", "md")} />
        <button type="button" disabled={busy} onClick={onNo} className={btn("secondary", "md")}>
          No, this is new
        </button>
      </div>
      {!signedIn && <p className={`text-sm ${muted}`}>You sign in with Google first. Your photo is added to that report.</p>}
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm font-medium text-red-700 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </section>
  );
}
