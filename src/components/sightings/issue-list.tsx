"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, House } from "lucide-react";

import { CARDS_PER_ISSUE, issueLine, issueNotes, issueStatusText } from "@/lib/sightings/issues";
import { focusedIssue, isShareable, sharePath, shareText, shareTitle } from "@/lib/sightings/issue-share";
import { isCommunityReport } from "@/lib/sightings/taxonomy";
import type { PublicIssue, PublicReport } from "@/lib/sightings/types";
import { useFlash } from "./action-feedback";
import { CommunityActions } from "./community-actions";
import { ReportCard, Status, day } from "./report-card";
import { appLink, field, muted, rule } from "./ui";
import type { useCitizen } from "./use-citizen";

type Citizen = ReturnType<typeof useCitizen>;

/** The phone's share sheet where there is one; else WhatsApp and a copied link. The words carry counts and the place, never who. */
function ShareIssue({ issue, placeName }: { issue: PublicIssue; placeName: string | null }) {
  const [more, setMore] = useState(false);
  const [manual, setManual] = useState(false);
  const [copied, flash] = useFlash<true>(2500);
  const url = () => `${window.location.origin}${sharePath(issue.id)}`;
  const text = shareText(issue, placeName, day);

  const share = async () => {
    if (navigator.share) {
      try {
        return await navigator.share({ title: shareTitle(issue, placeName), text, url: url() });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    setMore(true);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
      setManual(false);
      flash(true);
    } catch {
      setManual(true);
    }
  };

  return (
    <div className="-mt-1 flex flex-wrap items-center gap-x-5 gap-y-2 pb-3 pl-[4.25rem] text-sm">
      {!more ? (
        <button type="button" onClick={share} className={appLink}>
          Share
        </button>
      ) : (
        <>
          <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url()}`)}`} target="_blank" rel="noopener noreferrer" className={appLink}>
            Send on WhatsApp
          </a>
          <button type="button" onClick={copy} className={appLink}>
            <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
          </button>
          {manual && <input readOnly value={url()} onFocus={(e) => e.currentTarget.select()} aria-label="Link to this issue" className={`${field} font-mono text-xs`} />}
        </>
      )}
    </div>
  );
}

/** One issue as a row: photo, what, where, dates and counts; a tap opens its reports, each with its own actions. */
function IssueRow({ issue, reports, citizen, focused }: { issue: PublicIssue; reports: Map<string, PublicReport>; citizen: Citizen; focused: boolean }) {
  const [open, setOpen] = useState(focused);
  const panel = useId();
  const row = useRef<HTMLLIElement>(null);
  const home = !isCommunityReport(issue.category);
  const status = issueStatusText(issue, day);
  const notes = issueNotes(issue);
  const cards = issue.reportIds.slice(0, CARDS_PER_ISSUE).flatMap((id) => reports.get(id) ?? []);
  const placeName = (reports.get(issue.id) ?? cards[0])?.placeName ?? null;

  // Opened from a shared link: bring it into view.
  useEffect(() => {
    if (!focused) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.current?.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
  }, [focused]);

  return (
    <li ref={row} className="scroll-mt-20">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen(!open)}
        className="flex w-full gap-3 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:hover:bg-slate-900/60"
      >
        {issue.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={issue.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" loading="lazy" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500" aria-hidden="true">
            {home && <House className="h-5 w-5" />}
          </span>
        )}
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block font-semibold leading-snug text-slate-900 dark:text-slate-100">{issue.label}</span>
          {!home && issue.where && <span className={`block text-sm ${muted}`}>{issue.where}</span>}
          <span className="block text-sm text-slate-800 dark:text-slate-200">{issueLine(issue, day)}</span>
          {status && (
            <span className="block">
              <Status status={issue.status!} label={status} />
            </span>
          )}
          {notes && <span className={`block text-xs ${muted}`}>{notes}</span>}
        </span>
        <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 dark:text-slate-400 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {isShareable(issue) && <ShareIssue issue={issue} placeName={placeName} />}
      {open && (
        <div id={panel} className="mb-3 rounded-lg bg-slate-50 px-3 dark:bg-slate-900/60">
          <div className={`divide-y ${rule}`}>
            {cards.map((r) => (
              <ReportCard key={r.id} report={r}>
                <CommunityActions report={r} citizen={citizen} />
              </ReportCard>
            ))}
          </div>
          {issue.reports > cards.length && (
            <p className={`pb-3 text-xs ${muted}`}>
              The newest {cards.length} of {issue.reports} reports.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** Issues as rows on hairlines; `reports` holds the cards they open to. A link with ?issue=<id> opens that issue. */
export function IssueList({ issues, reports, citizen }: { issues: PublicIssue[]; reports: Map<string, PublicReport>; citizen: Citizen }) {
  // Mounted only in the browser, once the reports have loaded, so the address is there to read.
  const [focus] = useState(() => (typeof window === "undefined" ? null : focusedIssue(window.location.search)));
  return (
    <ul className={`divide-y border-y ${rule}`}>
      {issues.map((i) => (
        <IssueRow key={i.id} issue={i} reports={reports} citizen={citizen} focused={!!focus && (i.id === focus || i.reportIds.includes(focus))} />
      ))}
    </ul>
  );
}
