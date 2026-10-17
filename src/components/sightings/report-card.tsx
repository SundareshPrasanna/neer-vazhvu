import { AlertTriangle } from "lucide-react";

import { BIS_SOURCE } from "@/lib/sightings/parameters";
import { CASE_LABELS, EVENT_LABELS } from "@/lib/sightings/status";
import type { PublicReport } from "@/lib/sightings/types";
import { muted } from "./ui";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "12 Oct 2026" in India time, from a YYYY-MM-DD date or a full timestamp. */
export const day = (iso: string) => {
  const ymd = iso.length === 10 ? iso : new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${MON[m - 1]} ${y}`;
};

const DOT: Record<string, string> = {
  open: "bg-amber-500",
  reported: "bg-sky-500",
  authority_done: "bg-violet-500",
  fixed: "bg-emerald-500",
  closed: "bg-slate-400",
  checking: "bg-slate-400",
  rejected: "bg-red-500",
};

/** A status as a coloured dot and words: open, reported, fixed, and the reporter's own "being checked". */
export function Status({ status, label }: { status: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">
      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[status] ?? DOT.closed}`} aria-hidden="true" />
      {label ?? CASE_LABELS[status as keyof typeof CASE_LABELS] ?? status}
    </span>
  );
}

/** A resident's own test results against BIS IS 10500. */
export function Readings({ readings, source }: { readings: PublicReport["readings"]; source?: string | null }) {
  return (
    <div className="text-sm">
      <ul className="space-y-1 text-slate-800 dark:text-slate-200">
        {readings.map((r) => (
          <li key={r.text} className="tabular-nums">
            {r.text}
            {r.assessment && (
              <span className="mt-0.5 flex gap-1.5 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {r.assessment}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className={`mt-1.5 text-xs ${muted}`}>
        A home test{source ? ` (${source.toLowerCase()})` : ""}, not a lab result. Limits:{" "}
        <a href={BIS_SOURCE} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          BIS IS 10500
        </a>
        .
      </p>
    </div>
  );
}

/** Said after an update recorded by someone other than the reporter or our reviewer. */
const BY: Partial<Record<string, string>> = { resident: ", by someone nearby", department: ", by the department" };

/** What happened to a report, oldest first, on a thin line. */
export function History({ events }: { events: PublicReport["events"] }) {
  return (
    <ol className="space-y-1.5 border-l border-slate-200 pl-3.5 text-sm dark:border-slate-700">
      {events.map((e, i) => (
        <li key={i} className="relative">
          <span className="absolute top-[0.55rem] -left-[1.0625rem] h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" aria-hidden="true" />
          <span className={`tabular-nums ${muted}`}>{day(e.at)}</span>{" "}
          <span className="text-slate-800 dark:text-slate-200">
            {EVENT_LABELS[e.event] ?? e.event}
            {e.authorityBody && ` (${e.authorityBody})`}
            {BY[e.by] ?? ""}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** One published report: photo, what, where, status and its dated history. */
export function ReportCard({ report, children }: { report: PublicReport; children?: React.ReactNode }) {
  return (
    <article className="flex gap-3 py-3">
      {report.photoUrls[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={report.photoUrls[0]} alt={report.label} className="h-16 w-16 shrink-0 rounded-md object-cover" loading="lazy" />
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="font-semibold leading-snug text-slate-900 dark:text-slate-100">{report.label}</p>
          <p className={`text-sm ${muted}`}>{[report.where, report.placeName, day(report.createdAt)].filter(Boolean).join(", ")}</p>
        </div>
        {report.caseStatus && <Status status={report.caseStatus} />}
        {report.readings.length > 0 && <Readings readings={report.readings} source={report.waterSource} />}
        {report.events.length > 1 && <History events={report.events} />}
        {children}
      </div>
    </article>
  );
}
