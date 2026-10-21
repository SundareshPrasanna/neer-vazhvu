"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";

import { HOME_WINDOW_DAYS, ISSUE_RADIUS_M } from "@/lib/sightings/issues";
import type { PublicIssue, PublicReport } from "@/lib/sightings/types";
import { CommunityActions } from "./community-actions";
import { IssueList } from "./issue-list";
import { ReportCard } from "./report-card";
import { appLink, muted, rule } from "./ui";
import { useCitizen } from "./use-citizen";

type Loaded = { reports: PublicReport[]; issues: PublicIssue[]; issueReports: PublicReport[] };
const EMPTY: Loaded = { reports: [], issues: [], issueReports: [] };

/** Good news has no status, so it is never an issue; it keeps a list of its own. */
const GOOD_NEWS = "recovery";

const Cards = ({ reports, citizen }: { reports: PublicReport[]; citizen: ReturnType<typeof useCitizen> }) => (
  <div className={`divide-y border-y ${rule}`}>
    {reports.map((r) => (
      <ReportCard key={r.id} report={r}>
        <CommunityActions report={r} citizen={citizen} />
      </ReportCard>
    ))}
  </div>
);

/**
 * The issues at this place (and ward, water body or panchayat): reports of one thing at one spot counted together,
 * open ones first, then those fixed lately; good news and the remaining reports after. Renders nothing until reporting is on.
 */
export function PlaceReports({ place, ward, body, panchayat }: { place: string; ward?: string | number | null; body?: string | number | null; panchayat?: string | null }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const on = process.env.NEXT_PUBLIC_CITIZEN_REPORTS === "on";
  const citizen = useCitizen();
  const q = new URLSearchParams({ place });
  if (ward != null) q.set("ward", String(ward));
  if (body != null) q.set("body", String(body));
  if (panchayat) q.set("panchayat", panchayat);
  const query = q.toString();

  useEffect(() => {
    if (!on) return;
    let live = true;
    fetch(`/api/sightings?${query}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((j: { data?: PublicReport[]; issues?: PublicIssue[]; issueReports?: PublicReport[] }) =>
        live && setLoaded({ reports: j.data ?? [], issues: j.issues ?? [], issueReports: j.issueReports ?? [] }),
      )
      .catch(() => live && setLoaded(EMPTY));
    return () => {
      live = false;
    };
  }, [on, query]);

  if (!on || !loaded) return null;
  const { reports, issues, issueReports } = loaded;
  // The report page opens its map at this place.
  const report = (
    <Link href={`/mitra?${query}`} className={`inline-flex shrink-0 items-center gap-1.5 text-sm ${appLink}`}>
      <Camera className="h-4 w-4" aria-hidden="true" />
      {reports.length ? "Report something" : "Seen something here? Report it"}
    </Link>
  );
  if (reports.length === 0) return <div className="mt-6">{report}</div>;

  const byId = new Map([...reports, ...issueReports].map((r) => [r.id, r]));
  const open = issues.filter((i) => !i.resolvedOn);
  const lately = issues.filter((i) => i.resolvedOn);
  const inIssues = new Set(issues.flatMap((i) => i.reportIds));
  const left = reports.filter((r) => !inIssues.has(r.id));
  const goodNews = left.filter((r) => r.category === GOOD_NEWS);
  const more = left.filter((r) => r.category !== GOOD_NEWS);
  const subhead = `mt-5 mb-1.5 text-sm font-medium ${muted}`;

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Issues here {open.length > 0 && <span className={`font-normal tabular-nums ${muted}`}>{open.length}</span>}
        </h3>
        {report}
      </div>
      {open.length > 0 ? (
        <div className="mt-2">
          <IssueList issues={open} reports={byId} citizen={citizen} />
        </div>
      ) : (
        <p className={`mt-2 text-sm ${muted}`}>No open issues here now.</p>
      )}
      {lately.length > 0 && (
        <>
          <h4 className={subhead}>Fixed lately</h4>
          <IssueList issues={lately} reports={byId} citizen={citizen} />
        </>
      )}
      {goodNews.length > 0 && (
        <>
          <h4 className={subhead}>Good news</h4>
          <Cards reports={goodNews} citizen={citizen} />
        </>
      )}
      {more.length > 0 && (
        <details className="mt-5">
          <summary className={`cursor-pointer list-none text-sm focus-visible:outline-2 focus-visible:outline-cyan-500 [&::-webkit-details-marker]:hidden ${appLink}`}>
            More reports here <span className="tabular-nums">({more.length})</span>
          </summary>
          <div className="mt-1.5">
            <Cards reports={more} citizen={citizen} />
          </div>
        </details>
      )}
      <p className={`mt-3 text-xs ${muted}`}>
        Photographed by residents and checked before publishing. Updates come from residents and, where noted, the department; a fixed photo is checked before
        it counts. Reports of the same kind within {ISSUE_RADIUS_M} m of each other count as one issue until it is fixed; tap water and water tests are
        counted by ward or panchayat over the last {HOME_WINDOW_DAYS} days.
      </p>
    </section>
  );
}
