"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { PublicReport } from "@/lib/sightings/types";
import { ReportCard } from "./report-card";
import { link, muted, rule } from "./ui";

/**
 * Citizen reports that landed on this place (and ward, water body or
 * panchayat). Renders nothing until reporting is on and a report exists.
 */
export function PlaceReports({ place, ward, body, panchayat }: { place: string; ward?: string | number | null; body?: string | number | null; panchayat?: string | null }) {
  const [reports, setReports] = useState<PublicReport[]>([]);
  const on = process.env.NEXT_PUBLIC_CITIZEN_REPORTS === "on";

  useEffect(() => {
    if (!on) return;
    const q = new URLSearchParams({ place });
    if (ward != null) q.set("ward", String(ward));
    if (body != null) q.set("body", String(body));
    if (panchayat) q.set("panchayat", panchayat);
    let live = true;
    fetch(`/api/sightings?${q}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => live && setReports(j.data ?? []))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [on, place, ward, body, panchayat]);

  if (reports.length === 0) return null;
  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Reported by residents <span className={`font-normal tabular-nums ${muted}`}>{reports.length}</span>
        </h3>
        <Link href="/for-citizens" className={`text-sm ${link}`}>
          Report something
        </Link>
      </div>
      <div className={`mt-2 divide-y border-y ${rule}`}>
        {reports.map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
      </div>
      <p className={`mt-2 text-xs ${muted}`}>Photographed by residents and checked before publishing.</p>
    </section>
  );
}
