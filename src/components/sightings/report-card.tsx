import { BIS_SOURCE } from "@/lib/sightings/parameters";
import { CASE_LABELS, EVENT_LABELS } from "@/lib/sightings/status";
import type { PublicReport } from "@/lib/sightings/types";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "12 Oct 2026" in India time, from a YYYY-MM-DD date or a full timestamp. */
export const day = (iso: string) => {
  const ymd = iso.length === 10 ? iso : new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${MON[m - 1]} ${y}`;
};

const TONE: Record<string, string> = {
  open: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  reported: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  authority_done: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  fixed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  closed: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

export function StatusChip({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TONE[status] ?? TONE.closed}`}>
      {label ?? CASE_LABELS[status as keyof typeof CASE_LABELS] ?? status}
    </span>
  );
}

/** A resident's own test results against BIS IS 10500. */
export function Readings({ readings, source }: { readings: PublicReport["readings"]; source?: string | null }) {
  return (
    <div className="mt-2 text-sm">
      <ul className="space-y-0.5 text-slate-800 dark:text-slate-200">
        {readings.map((r) => (
          <li key={r.text}>
            {r.text}
            {r.assessment && <span className="text-amber-800 dark:text-amber-300">: {r.assessment}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Tested by the resident{source ? ` (${source.toLowerCase()})` : ""} with their own meter or kit, not a lab. Limits:{" "}
        <a href={BIS_SOURCE} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          BIS IS 10500
        </a>
        .
      </p>
    </div>
  );
}

/** One report: photo, what, where, status and its dated history. */
export function ReportCard({ report, children }: { report: PublicReport; children?: React.ReactNode }) {
  return (
    <article className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex gap-3">
        {report.photoUrls[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={report.photoUrls[0]} alt={report.label} className="h-20 w-20 shrink-0 rounded object-cover" loading="lazy" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-slate-900 dark:text-slate-100">{report.label}</p>
            {report.caseStatus && <StatusChip status={report.caseStatus} />}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {[report.where, report.placeName].filter(Boolean).join(", ")} · {day(report.createdAt)}
          </p>
          {report.handler && <p className="text-xs text-slate-500 dark:text-slate-400">Handled by {report.handler.acronym ?? report.handler.body}</p>}
        </div>
      </div>
      {report.readings.length > 0 && <Readings readings={report.readings} source={report.waterSource} />}
      {report.events.length > 0 && (
        <ol className="mt-2 space-y-0.5 border-l border-slate-200 pl-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
          {report.events.map((e, i) => (
            <li key={i}>
              {day(e.at)}: {EVENT_LABELS[e.event] ?? e.event}
              {e.authorityBody && ` (${e.authorityBody})`}
            </li>
          ))}
        </ol>
      )}
      {children}
    </article>
  );
}
