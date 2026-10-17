"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, Check } from "lucide-react";

import { OPEN_STATUSES } from "@/lib/sightings/status";
import type { PublicReport } from "@/lib/sightings/types";
import { ReportCard } from "./report-card";
import { btn, fileFocus, link, muted, rule } from "./ui";
import { shrinkPhoto, useCitizen } from "./use-citizen";

/** Anyone who has seen the spot lately can keep the record honest: still there, or gone (with a photo, checked first). */
export function SeenLately({ report, citizen }: { report: PublicReport; citizen: ReturnType<typeof useCitizen> }) {
  const [state, setState] = useState<"idle" | "busy" | "still" | "gone">("idle");
  const [error, setError] = useState<string | null>(null);
  if (!report.caseStatus || !OPEN_STATUSES.has(report.caseStatus)) return null;

  // Signed out: sign in, then come back to this page.
  const signedOut = () => {
    if (citizen.session) return false;
    try {
      sessionStorage.setItem("nv-return", window.location.pathname + window.location.search + window.location.hash);
    } catch {
      // Storage blocked: sign-in lands on the report page instead.
    }
    citizen.signIn();
    return true;
  };
  const send = async (event: "still_there" | "fixed", file?: File) => {
    setState("busy");
    setError(null);
    const fd = new FormData();
    fd.append("event", event);
    if (file) fd.append("photos", file);
    const res = await citizen.authFetch(`/api/sightings/${report.id}/events`, { method: "POST", body: fd }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setState("idle");
      return setError(json.error ?? "Could not save. Please try again.");
    }
    setState(event === "still_there" ? "still" : "gone");
  };

  if (state === "still" || state === "gone") {
    return (
      <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
        <Check className="h-4 w-4" aria-hidden="true" />
        {state === "still" ? "Thanks. Noted as still there." : "Thanks. Your photo is checked before the report changes."}
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-sm ${muted}`}>Seen it lately?</span>
        <button type="button" disabled={state === "busy"} onClick={() => !signedOut() && send("still_there")} className={btn("secondary", "sm")}>
          Still there
        </button>
        <label className={`${btn("secondary", "sm")} ${fileFocus}`} onClick={(e) => signedOut() && e.preventDefault()}>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={state === "busy"}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) await send("fixed", await shrinkPhoto(f));
            }}
          />
          <Camera className="h-4 w-4" aria-hidden="true" />
          It&rsquo;s gone
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Citizen reports that landed on this place (and ward, water body or
 * panchayat), with a way to report one here. Renders nothing until reporting is on.
 */
export function PlaceReports({ place, ward, body, panchayat }: { place: string; ward?: string | number | null; body?: string | number | null; panchayat?: string | null }) {
  const [reports, setReports] = useState<PublicReport[] | null>(null);
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
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => live && setReports(j.data ?? []))
      .catch(() => live && setReports([]));
    return () => {
      live = false;
    };
  }, [on, query]);

  if (!on || !reports) return null;
  // The report page opens its map at this place.
  const report = (
    <Link href={`/for-citizens?${query}`} className={`inline-flex items-center gap-1.5 text-sm ${link}`}>
      <Camera className="h-4 w-4" aria-hidden="true" />
      {reports.length ? "Report something" : "Seen something here? Report it"}
    </Link>
  );
  if (reports.length === 0) return <div className="mt-6">{report}</div>;
  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Reported by residents <span className={`font-normal tabular-nums ${muted}`}>{reports.length}</span>
        </h3>
        {report}
      </div>
      <div className={`mt-2 divide-y border-y ${rule}`}>
        {reports.map((r) => (
          <ReportCard key={r.id} report={r}>
            <SeenLately report={r} citizen={citizen} />
          </ReportCard>
        ))}
      </div>
      <p className={`mt-2 text-xs ${muted}`}>
        Photographed by residents and checked before publishing. Updates come from residents and, where noted, the department; a fixed photo is checked before it counts.
      </p>
    </section>
  );
}
