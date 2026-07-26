"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * "Where does this city's sewage actually go" card.
 *
 * Built for Kolkata and the reason the platform needed it: 910 of Kolkata's
 * 1,400 MLD of sewage - 65% - is treated by the sewage-fed fisheries of the
 * East Kolkata Wetlands, roughly five times what all five of the city's
 * treatment plants manage combined. The EKW lies OUTSIDE KMC, in North and
 * South 24 Parganas. No supply-side surface on this platform can express that:
 * the city's largest piece of water infrastructure is a wetland it does not
 * own, does not pay for, and did not build.
 *
 * That is also why EKW gets a first-class card rather than a map layer. It is
 * not a feature of the landscape, it is the sewage system.
 *
 * Reads `<cityId>-sewage-balance.json`. Generic: any city publishing a
 * generated-vs-treated balance can turn on `dashboard.sewageBalance`.
 */

interface Balance {
  total_generated_mld: number;
  treated_ekw_fisheries_mld: number;
  treated_stps_mld: number;
  existing_stp_count: number;
  total_treatment_capacity_mld: number;
  untreated_or_partial_mld: number;
  untreated_pct_stated: number;
}

interface SewageBalanceFile {
  balance: Balance;
  ekw_share_pct: number;
  ekw_vs_stp_ratio: number;
  upcoming_stps: { capacity_mld: number; lat: number | null }[];
  upcoming_total_mld: number;
  residual_gap_mld: number;
  source: { publisher: string; document: string; url: string; document_date: string };
  notes: string[];
}

function Bar({
  label,
  mld,
  total,
  className,
  sub,
}: {
  label: string;
  mld: number;
  total: number;
  className: string;
  sub?: string;
}) {
  const pct = (mld / total) * 100;
  return (
    <div>
      <div className="flex justify-between items-baseline text-sm mb-1 gap-3">
        <span className="text-slate-700 dark:text-slate-300">{label}</span>
        <span className="whitespace-nowrap">
          <span className="font-semibold">{mld.toLocaleString("en-IN")}</span>
          <span className="text-slate-500 dark:text-slate-400 text-xs"> MLD</span>
          <span className="text-slate-400 dark:text-slate-500 text-xs ml-1.5">
            {pct.toFixed(0)}%
          </span>
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${className}`} style={{ width: `${pct}%` }} />
      </div>
      {sub && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">{sub}</p>
      )}
    </div>
  );
}

export function SewageBalanceCard({ cityId }: { cityId: string }) {
  const [data, setData] = useState<SewageBalanceFile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/data/${cityId}-sewage-balance.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [cityId]);

  if (failed) return null;
  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-28 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </CardContent>
      </Card>
    );
  }

  const b = data.balance;
  const mappable = data.upcoming_stps.filter((s) => s.lat !== null).length;

  return (
    <Card>
      <CardContent className="p-6 sm:p-8 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Where the sewage goes
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
            A wetland is this city&rsquo;s largest sewage treatment plant. The East Kolkata
            Wetlands treat{" "}
            <strong className="text-slate-800 dark:text-slate-100">
              {data.ekw_share_pct}%
            </strong>{" "}
            of Kolkata&rsquo;s sewage in sewage-fed fisheries &mdash;{" "}
            <strong className="text-slate-800 dark:text-slate-100">
              {data.ekw_vs_stp_ratio}x
            </strong>{" "}
            what all {b.existing_stp_count}{" "}of the city&rsquo;s treatment plants manage
            combined. It lies <strong>outside the corporation&rsquo;s boundary</strong>, in
            North and South 24 Parganas.
          </p>
        </div>

        <div className="space-y-4">
          <Bar
            label="Treated by the East Kolkata Wetlands"
            mld={b.treated_ekw_fisheries_mld}
            total={b.total_generated_mld}
            className="bg-emerald-500"
            sub="254 sewage-fed fisheries across 12,500 hectares. Unbuilt, unpaid for, and under real-estate pressure."
          />
          <Bar
            label={`Treated in the ${b.existing_stp_count} sewage treatment plants`}
            mld={b.treated_stps_mld}
            total={b.total_generated_mld}
            className="bg-sky-500"
          />
          <Bar
            label="Untreated or only partially treated"
            mld={b.untreated_or_partial_mld}
            total={b.total_generated_mld}
            className="bg-red-500"
            sub={`${b.untreated_pct_stated}% of everything the city generates, by KMC's own accounting.`}
          />
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 text-sm space-y-2">
          <div className="flex justify-between gap-3">
            <span className="text-slate-600 dark:text-slate-400">Total generated</span>
            <span className="font-semibold">
              {b.total_generated_mld.toLocaleString("en-IN")} MLD
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
            {data.upcoming_stps.length} more plants are planned, adding{" "}
            {data.upcoming_total_mld} MLD ({mappable} with published coordinates). Even if
            every one is built, that still leaves{" "}
            <strong>{data.residual_gap_mld} MLD untreated</strong> &mdash; and it assumes
            the wetlands keep absorbing {b.treated_ekw_fisheries_mld} MLD.
          </p>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Source:{" "}
          <a
            href={data.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 dark:text-sky-400 hover:underline"
          >
            {data.source.publisher}, {data.source.document}
          </a>{" "}
          &mdash; the corporation&rsquo;s own statutory filing under the NGT District
          Environment Plan process.
        </p>
      </CardContent>
    </Card>
  );
}
