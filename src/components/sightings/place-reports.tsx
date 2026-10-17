"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";

import type { PublicReport } from "@/lib/sightings/types";
import { ReportCard } from "./report-card";
import { link, muted, rule } from "./ui";

/**
 * Citizen reports that landed on this place (and ward, water body or
 * panchayat), with a way to report one here. Renders nothing until reporting is on.
 */
export function PlaceReports({ place, ward, body, panchayat }: { place: string; ward?: string | number | null; body?: string | number | null; panchayat?: string | null }) {
  const [reports, setReports] = useState<PublicReport[] | null>(null);
  const on = process.env.NEXT_PUBLIC_CITIZEN_REPORTS === "on";
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
          <ReportCard key={r.id} report={r} />
        ))}
      </div>
      <p className={`mt-2 text-xs ${muted}`}>
        Photographed by residents and checked before publishing. Status updates come from the resident who reported it.
      </p>
    </section>
  );
}
