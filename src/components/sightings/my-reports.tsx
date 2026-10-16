"use client";

import { useEffect, useState } from "react";
import { Camera, Check, ChevronDown, Clock, Download as DownloadIcon, ImageIcon } from "lucide-react";

import { nextCaseStatus, type CaseEvent } from "@/lib/sightings/status";
import type { OwnReport } from "@/lib/sightings/types";
import { ActionButton, useFlash } from "./action-feedback";
import { HandlerCard, NationalOnly } from "./handler-card";
import { History, Readings, Status, day } from "./report-card";
import { btn, enter, field, fileFocus, link, muted, rule, serif } from "./ui";
import { shrinkPhoto } from "./use-citizen";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const ACTIONS: { event: CaseEvent; label: string }[] = [
  { event: "reported", label: "I reported it" },
  { event: "authority_done", label: "They marked it done" },
  { event: "fixed", label: "It is fixed" },
  { event: "still_there", label: "Still there" },
];

/** Said beside the status once a change is saved. */
const SAVED: Record<CaseEvent, string> = {
  reported: "Saved",
  authority_done: "Saved",
  fixed: "Saved. Your photo is waiting for review",
  still_there: "Saved",
  closed: "Closed",
  reopened: "Reopened",
};

function Update({ report, authFetch, onSaved }: { report: OwnReport; authFetch: Fetch; onSaved: (text: string) => void }) {
  const [open, setOpen] = useState<CaseEvent | null>(null);
  const [pending, setPending] = useState<CaseEvent | null>(null);
  const [body, setBody] = useState(report.handler?.body ?? "");
  const [reference, setReference] = useState("");
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo]);

  const send = async (event: CaseEvent) => {
    setPending(event);
    setError(null);
    const fd = new FormData();
    fd.append("event", event);
    if (event === "reported") {
      fd.append("authorityBody", body);
      if (reference.trim()) fd.append("reference", reference.trim());
    }
    if (event === "fixed" && photo) fd.append("photos", photo.file);
    const res = await authFetch(`/api/sightings/${report.id}/events`, { method: "POST", body: fd }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setPending(null);
    if (!res?.ok) return setError(json.error ?? "Could not save. Please try again.");
    setOpen(null);
    onSaved(SAVED[event]);
  };

  const allowed = ACTIONS.filter((a) => nextCaseStatus(a.event, report.caseStatus));
  if (allowed.length === 0) return null;
  const panel = `space-y-4 rounded-xl bg-slate-50 p-4 sm:p-5 dark:bg-slate-900 ${enter}`;
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">What has happened since?</p>
      <div className="flex flex-wrap gap-2">
        {allowed.map((a) => (
          <ActionButton
            key={a.event}
            label={a.label}
            busyLabel="Saving…"
            busy={pending === a.event && !open}
            disabled={pending != null}
            pressed={a.event === "reported" || a.event === "fixed" ? open === a.event : undefined}
            onClick={() => (a.event === "authority_done" || a.event === "still_there" ? send(a.event) : setOpen(open === a.event ? null : a.event))}
            className={btn("secondary", "md")}
          />
        ))}
      </div>
      {open === "reported" && (
        <div className={panel}>
          <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
            Reported to
            <input value={body} onChange={(e) => setBody(e.target.value.slice(0, 160))} className={`${field} mt-1.5`} />
          </label>
          <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
            Reference or complaint number <span className={`font-normal ${muted}`}>Only you and our reviewer see it</span>
            <input value={reference} onChange={(e) => setReference(e.target.value.slice(0, 80))} className={`${field} mt-1.5`} />
          </label>
          <div className="flex gap-2">
            <ActionButton label="Save" busyLabel="Saving…" busy={pending === "reported"} disabled={!body.trim()} onClick={() => send("reported")} className={btn("primary", "md")} />
            <button type="button" onClick={() => setOpen(null)} className={btn("quiet", "md")}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {open === "fixed" && (
        <div className={panel}>
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">A photo of the same spot, now</p>
            <p className={`text-sm ${muted}`}>Once checked, it is published beside your first photo.</p>
          </div>
          <div className="flex items-center gap-3">
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.url} alt="The spot now" className="h-20 w-20 rounded-lg object-cover" />
            )}
            <label className={`${btn("secondary", "md")} ${fileFocus}`}>
              <Camera className="h-4 w-4" aria-hidden="true" />
              {photo ? "Change photo" : "Add the photo"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const file = await shrinkPhoto(f);
                  setPhoto({ file, url: URL.createObjectURL(file) });
                }}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <ActionButton label="Save" busyLabel="Saving…" busy={pending === "fixed"} disabled={!photo} onClick={() => send("fixed")} className={btn("primary", "md")} />
            <button type="button" onClick={() => setOpen(null)} className={btn("quiet", "md")}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

const ACTIVE = new Set(["open", "reported", "authority_done"]);
const STALE_DAYS = 14;
const checking = (r: OwnReport) => r.reviewStatus === "received" || r.reviewStatus === "needs_info";

/** An open report whose last update is over two weeks old asks the reporter to check it again. */
const needsUpdate = (r: OwnReport) =>
  r.reviewStatus === "approved" &&
  ACTIVE.has(r.caseStatus ?? "") &&
  Date.now() - new Date(r.events.at(-1)?.at ?? r.createdAt).getTime() > STALE_DAYS * 86_400_000;

function Row({ report: r, authFetch, saved, onSaved }: { report: OwnReport; authFetch: Fetch; saved: string | null; onSaved: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const approved = r.reviewStatus === "approved";
  const routed = r.caseStatus === "open" && (r.handler || r.nationalChannels.length > 0);
  const hasMore = approved || r.events.length > 1 || r.readings.length > 0;
  const panel = `report-${r.id}`;
  return (
    <li className="py-5">
      <div className="flex gap-4">
        {r.photoUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.photoUrls[0]} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover sm:h-24 sm:w-24" loading="lazy" />
        ) : (
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400 sm:h-24 sm:w-24 dark:bg-slate-800">
            <ImageIcon className="h-6 w-6" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold leading-snug text-slate-900 dark:text-slate-100">{r.label}</p>
              <p className={`mt-0.5 text-sm ${muted}`}>
                {[r.where, r.placeName].filter(Boolean).join(", ")} · {day(r.createdAt)}
              </p>
            </div>
            {hasMore && (
              <button type="button" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)} className={`${btn("quiet", "sm")} -mr-3 shrink-0`}>
                <span className="hidden sm:inline">{approved ? "Update" : "Details"}</span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                <span className="sr-only sm:hidden">{approved ? "Update" : "Details"}</span>
              </button>
            )}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {checking(r) ? (
              <Status status="checking" label="Being checked" />
            ) : r.reviewStatus === "rejected" ? (
              <Status status="rejected" label="Not published" />
            ) : (
              r.caseStatus && <Status status={r.caseStatus} />
            )}
            {saved ? (
              <span role="status" className={`inline-flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400 ${enter}`}>
                <Check className="h-4 w-4" aria-hidden="true" />
                {saved}
              </span>
            ) : (
              needsUpdate(r) && <span className="text-sm text-amber-800 dark:text-amber-300">No update for two weeks</span>
            )}
          </p>
          {r.reviewStatus === "rejected" && r.rejectReason && <p className={`mt-1 text-sm ${muted}`}>{r.rejectReason}</p>}
        </div>
      </div>
      {open && (
        <div id={panel} className={`mt-5 space-y-7 sm:pl-28 ${enter}`}>
          {r.readings.length > 0 && <Readings readings={r.readings} source={r.waterSource} />}
          {approved && (
            <Update
              report={r}
              authFetch={authFetch}
              onSaved={(text) => {
                setOpen(false);
                onSaved(text);
              }}
            />
          )}
          {routed && (r.handler ? <HandlerCard handler={r.handler} national={r.nationalChannels} /> : <NationalOnly national={r.nationalChannels} />)}
          {r.references.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">Your references</p>
              <ul className={`space-y-1 text-sm ${muted}`}>
                {r.references.map((x, i) => (
                  <li key={i} className="tabular-nums">
                    {day(x.at)}: {x.authorityBody} ref. {x.reference}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.events.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">History</p>
              <History events={r.events} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Everything the reporter has sent, as a file they keep. */
function Download({ reports }: { reports: OwnReport[] }) {
  const save = (kind: "csv" | "json") => {
    const rows = reports.map((r) => ({
      id: r.id,
      sent: r.createdAt,
      type: r.label,
      place: r.placeName,
      where: r.where ?? "",
      lat: r.lat,
      lng: r.lng,
      review: r.reviewStatus,
      status: r.caseStatus ?? "",
      waterSource: r.waterSource ?? "",
      readings: r.readings.map((x) => x.text).join("; "),
      references: r.references.map((x) => `${x.authorityBody ?? ""} ${x.reference}`.trim()).join("; "),
      events: r.events.map((e) => `${e.at.slice(0, 10)} ${e.event}`).join("; "),
    }));
    const body =
      kind === "json"
        ? JSON.stringify(rows, null, 2)
        : [Object.keys(rows[0] ?? { id: "" }).join(","), ...rows.map((row) => Object.values(row).map((v) => csvCell(String(v))).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: kind === "json" ? "application/json" : "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-neer-vazhvu-reports.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <p className={`flex items-center gap-2 text-sm ${muted}`}>
      <DownloadIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Download your reports:{" "}
        <button type="button" onClick={() => save("csv")} className={link}>
          CSV
        </button>{" "}
        ·{" "}
        <button type="button" onClick={() => save("json")} className={link}>
          JSON
        </button>
      </span>
    </p>
  );
}

/** The reporter's own reports: what needs their update first, each with its status and what they can do next. */
export function MyReports({ reports, authFetch, onChange, onNew }: { reports: OwnReport[] | null; authFetch: Fetch; onChange: () => void; onNew: () => void }) {
  const [saved, flash] = useFlash<{ id: string; text: string }>();
  if (!reports) return <div className="h-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />;
  if (reports.length === 0) {
    return (
      <div className="max-w-md space-y-4 py-4">
        <h2 className={`${serif} text-3xl`}>Nothing sent yet</h2>
        <p className={muted}>Your reports will show here, with what happened to each one.</p>
        <button type="button" onClick={onNew} className={btn("primary")}>
          <Camera className="h-4 w-4" aria-hidden="true" />
          Make a report
        </button>
      </div>
    );
  }
  const due = reports.filter(needsUpdate).length;
  const figures: [number, string][] = [
    [reports.filter(checking).length, "Being checked"],
    [reports.filter((r) => ACTIVE.has(r.caseStatus ?? "")).length, "Open"],
    [reports.filter((r) => r.caseStatus === "fixed").length, "Fixed"],
  ];
  // Stable: needs-your-update first, otherwise newest first as sent.
  const sorted = [...reports].sort((a, b) => Number(needsUpdate(b)) - Number(needsUpdate(a)));
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-16">
      <aside className="space-y-5 lg:order-last lg:sticky lg:top-24 lg:self-start">
        <dl className={`grid grid-cols-3 gap-4 lg:grid-cols-1 lg:gap-0 lg:divide-y lg:border-y ${rule}`}>
          {figures.map(([n, label]) => (
            <div key={label} className="flex flex-col-reverse lg:flex-row lg:items-baseline lg:justify-between lg:py-3">
              <dt className={`text-sm ${muted}`}>{label}</dt>
              <dd className={`${serif} text-3xl tabular-nums lg:text-2xl`}>{n}</dd>
            </div>
          ))}
        </dl>
        {due > 0 && (
          <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {due === 1 ? "One report needs" : `${due} reports need`} your update: is it still there, or fixed?
          </p>
        )}
        <div className="hidden lg:block">
          <Download reports={reports} />
        </div>
      </aside>
      <div>
        <ul className={`divide-y border-y ${rule}`}>
          {sorted.map((r) => (
            <Row
              key={r.id}
              report={r}
              authFetch={authFetch}
              saved={saved?.id === r.id ? saved.text : null}
              onSaved={(text) => {
                flash({ id: r.id, text });
                onChange();
              }}
            />
          ))}
        </ul>
        <div className="mt-6 lg:hidden">
          <Download reports={reports} />
        </div>
      </div>
    </div>
  );
}
