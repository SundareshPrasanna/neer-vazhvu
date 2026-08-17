"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * A city's live operational flood register: the weekly record of where the
 * corporation actually sent crews.
 *
 * Every number here is read from the artifact, never written into copy. The
 * register refreshes on a schedule (KMC's is weekly, and KMC overwrites the
 * source PDF in place), so a hand-written "66 pockets across 53 wards" is
 * correct for exactly one week and wrong afterwards - which is how it was
 * carried before this component existed, in four separate places that had
 * already drifted apart from the shipped file.
 *
 * Deliberately reads as an operational log, not a flood inventory: it records
 * where machines were SENT, which is a floor on where the city flooded rather
 * than a census of it. The wording below says so.
 */

interface RegisterSummary {
  rows: number;
  distinct_pockets: number;
  wards_touched: number;
  boroughs_touched: number;
  machine_deployments: number;
}

interface RegisterDoc {
  period?: { from: string | null; to: string | null };
  summary?: RegisterSummary;
}

function fmtRange(from?: string | null, to?: string | null): string | null {
  if (!from || !to) return null;
  const d = (s: string) =>
    new Date(s + "T00:00:00Z").toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  return `${d(from)} to ${d(to)}`;
}

export function LiveRegisterCard({
  heading,
  note,
  src,
  sourceLabel,
  sourceHref,
}: {
  heading: string;
  note: string;
  src: string;
  sourceLabel: string;
  sourceHref: string;
}) {
  const [doc, setDoc] = useState<RegisterDoc | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(src)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: RegisterDoc) => live && setDoc(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [src]);

  // No silent empty state: if the register cannot be read, say so rather than
  // rendering a card that looks like a city with nothing to report.
  if (failed) {
    return (
      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          The weekly register could not be loaded. It is published at{" "}
          <a
            href={sourceHref}
            target="_blank"
            rel="noopener"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {sourceLabel}
          </a>
          .
        </p>
      </section>
    );
  }

  const s = doc?.summary;
  const range = fmtRange(doc?.period?.from, doc?.period?.to);

  const stats: { label: string; value: number }[] = s
    ? [
        { label: "waterlogging pockets named", value: s.distinct_pockets },
        { label: "wards touched", value: s.wards_touched },
        { label: "boroughs touched", value: s.boroughs_touched },
        { label: "machine deployments", value: s.machine_deployments },
      ]
    : [];

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{note}</p>
      <Card className="border-sky-200 dark:border-sky-900 bg-sky-50/40 dark:bg-sky-950/20">
        <CardContent className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-sky-700 dark:text-sky-400 font-semibold">
            {range ? `Week of ${range}` : "Latest published week"}
          </div>
          {s ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {stats.map((st) => (
                  <div key={st.label}>
                    <div className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums">
                      {st.value.toLocaleString("en-IN")}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 leading-snug mt-0.5">
                      {st.label}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {s.rows.toLocaleString("en-IN")} rows in one ordinary week. This is an
                operational log of where crews were sent, so read it as a floor on where
                the city flooded rather than a complete inventory. Source:{" "}
                <a
                  href={sourceHref}
                  target="_blank"
                  rel="noopener"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {sourceLabel}
                </a>
                .
              </p>
            </>
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400">Loading the register...</div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
