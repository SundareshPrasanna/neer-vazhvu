"use client";

import { useState } from "react";

import { nextCaseStatus, type CaseEvent } from "@/lib/sightings/status";
import type { OwnReport } from "@/lib/sightings/types";
import { HandlerCard } from "./handler-card";
import { ReportCard, StatusChip, day } from "./report-card";
import { shrinkPhoto } from "./use-citizen";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const REVIEW_LABEL: Record<string, string> = { received: "Received, being checked", needs_info: "Received, being checked", rejected: "Not published" };

const ACTIONS: { event: CaseEvent; label: string }[] = [
  { event: "reported", label: "I reported it" },
  { event: "authority_done", label: "They marked it done" },
  { event: "fixed", label: "It is fixed" },
  { event: "still_there", label: "Still there" },
];

function Update({ report, authFetch, onDone }: { report: OwnReport; authFetch: Fetch; onDone: () => void }) {
  const [open, setOpen] = useState<CaseEvent | null>(null);
  const [body, setBody] = useState(report.handler?.body ?? "");
  const [reference, setReference] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (event: CaseEvent) => {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("event", event);
    if (event === "reported") {
      fd.append("authorityBody", body);
      if (reference.trim()) fd.append("reference", reference.trim());
    }
    if (event === "fixed" && photo) fd.append("photos", photo);
    const res = await authFetch(`/api/sightings/${report.id}/events`, { method: "POST", body: fd }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) return setError(json.error ?? "Could not save. Please try again.");
    setOpen(null);
    onDone();
  };

  const allowed = ACTIONS.filter((a) => nextCaseStatus(a.event, report.caseStatus));
  const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-900";
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {allowed.map((a) => (
          <button
            key={a.event}
            type="button"
            onClick={() => (a.event === "authority_done" || a.event === "still_there" ? send(a.event) : setOpen(a.event))}
            disabled={busy}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:border-slate-500 dark:border-slate-600 dark:text-slate-300"
          >
            {a.label}
          </button>
        ))}
      </div>
      {open === "reported" && (
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
          <label className="block text-xs text-slate-600 dark:text-slate-400">
            Reported to
            <input value={body} onChange={(e) => setBody(e.target.value.slice(0, 160))} className={field} />
          </label>
          <label className="mt-2 block text-xs text-slate-600 dark:text-slate-400">
            Reference or complaint number (only you and our reviewer see it)
            <input value={reference} onChange={(e) => setReference(e.target.value.slice(0, 80))} className={field} />
          </label>
          <button type="button" disabled={busy || !body.trim()} onClick={() => send("reported")} className="mt-2 rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
            Save
          </button>
        </div>
      )}
      {open === "fixed" && (
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
          <label className="block text-xs text-slate-600 dark:text-slate-400">
            A photo of the same spot, now
            <input type="file" accept="image/*" capture="environment" onChange={async (e) => setPhoto(e.target.files?.[0] ? await shrinkPhoto(e.target.files[0]) : null)} className="mt-1 block text-sm" />
          </label>
          <button type="button" disabled={busy || !photo} onClick={() => send("fixed")} className="mt-2 rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
            Save
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}

/** The reporter's own reports, with the updates they can make. */
export function MyReports({ reports, authFetch, onChange }: { reports: OwnReport[]; authFetch: Fetch; onChange: () => void }) {
  if (reports.length === 0) return <p className="text-sm text-slate-600 dark:text-slate-400">No reports yet.</p>;
  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <ReportCard key={r.id} report={r}>
          {r.reviewStatus !== "approved" && (
            <div className="mt-2">
              <StatusChip status={r.reviewStatus === "rejected" ? "closed" : "open"} label={REVIEW_LABEL[r.reviewStatus]} />
              {r.rejectReason && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{r.rejectReason}</p>}
            </div>
          )}
          {r.references.length > 0 && (
            <ul className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              {r.references.map((x, i) => (
                <li key={i}>
                  {day(x.at)}: {x.authorityBody} ref. {x.reference}
                </li>
              ))}
            </ul>
          )}
          {r.reviewStatus === "approved" && (
            <>
              {r.handler && r.caseStatus === "open" && (
                <div className="mt-3">
                  <HandlerCard handler={r.handler} national={r.nationalChannels} />
                </div>
              )}
              <Update report={r} authFetch={authFetch} onDone={onChange} />
            </>
          )}
        </ReportCard>
      ))}
    </div>
  );
}
