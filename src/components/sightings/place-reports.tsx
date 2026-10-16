"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { PublicReport } from "@/lib/sightings/types";
import { ReportCard } from "./report-card";

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
      <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Citizen reports ({reports.length})</h3>
      <div className="space-y-2">
        {reports.map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Photographed by residents and checked before publishing.{" "}
        <Link href="/for-citizens" className="underline underline-offset-2">
          Report something
        </Link>
      </p>
    </section>
  );
}
