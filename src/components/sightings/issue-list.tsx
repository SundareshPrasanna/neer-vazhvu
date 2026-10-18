"use client";

import { useId, useState } from "react";
import { ChevronDown, House } from "lucide-react";

import { CARDS_PER_ISSUE, issueLine, issueNotes, issueStatusText } from "@/lib/sightings/issues";
import { isCommunityReport } from "@/lib/sightings/taxonomy";
import type { PublicIssue, PublicReport } from "@/lib/sightings/types";
import { CommunityActions } from "./community-actions";
import { ReportCard, Status, day } from "./report-card";
import { muted, rule } from "./ui";
import type { useCitizen } from "./use-citizen";

type Citizen = ReturnType<typeof useCitizen>;

/** One issue as a row: photo, what, where, dates and counts; a tap opens its reports, each with its own actions. */
function IssueRow({ issue, reports, citizen }: { issue: PublicIssue; reports: Map<string, PublicReport>; citizen: Citizen }) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const home = !isCommunityReport(issue.category);
  const status = issueStatusText(issue, day);
  const notes = issueNotes(issue);
  const cards = issue.reportIds.slice(0, CARDS_PER_ISSUE).flatMap((id) => reports.get(id) ?? []);
  return (
    <li>
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

/** Issues as rows on hairlines; `reports` holds the cards they open to. */
export function IssueList({ issues, reports, citizen }: { issues: PublicIssue[]; reports: Map<string, PublicReport>; citizen: Citizen }) {
  return (
    <ul className={`divide-y border-y ${rule}`}>
      {issues.map((i) => (
        <IssueRow key={i.id} issue={i} reports={reports} citizen={citizen} />
      ))}
    </ul>
  );
}
