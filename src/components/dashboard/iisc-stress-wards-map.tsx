"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useLanguage } from "@/lib/i18n/context";

function tFmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

const IIScStressWardsLeafletMap = dynamic(
  () =>
    import("./iisc-stress-wards-leaflet-map").then(
      (m) => m.IIScStressWardsLeafletMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm text-slate-500">
        Loading map…
      </div>
    ),
  },
);

interface StressWard {
  bbmp_ward_no: number;
  bbmp_ward_name: string;
  centroid_lat: number;
  centroid_lng: number;
  gba_ward_no: number | null;
  gba_ward_name: string | null;
  gba_corporation: string | null;
}

interface StressData {
  _source: {
    label: string;
    submitted_by: string;
    submitted_date: string;
    projection_target: string;
    url: string;
    extracted: string;
  };
  _note: string;
  ward_count: number;
  wards: StressWard[];
}

const CORP_TONE: Record<string, string> = {
  North:   "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  South:   "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  East:    "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  West:    "bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  Central: "bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300 border-violet-200 dark:border-violet-800",
};

export function IIScStressWardsMap() {
  const { t } = useLanguage();
  const [data, setData] = useState<StressData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/data/bangalore-iisc-stress-wards-2025.json")
      .then((r) => (r.ok ? (r.json() as Promise<StressData>) : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error || !data) {
    return error ? (
      <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-200">
        {t("iisc_map.error")}
      </div>
    ) : null;
  }

  // Group by corporation for the chip list.
  const grouped: Record<string, StressWard[]> = {};
  for (const w of data.wards) {
    const c = w.gba_corporation || "Unmapped";
    if (!grouped[c]) grouped[c] = [];
    grouped[c].push(w);
  }
  const corpOrder = ["West", "North", "Central", "South", "East"].filter(
    (c) => grouped[c],
  );

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
          {t("iisc_map.heading")}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {tFmt(t("iisc_map.intro"), {
            date: data._source.submitted_date,
            target: data._source.projection_target,
          })}{" "}
          <a
            href={data._source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline text-[11px]"
          >
            ({t("rivers.source")})
          </a>
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          {t("iisc_map.predicted")}
        </p>
      </div>

      <div className="relative">
        <IIScStressWardsLeafletMap wards={data.wards} />
        <div className="absolute bottom-3 left-3 z-[500] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-md shadow-md p-2 text-[11px] space-y-1.5 max-w-[260px]">
          <div className="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide text-[10px]">
            {t("iisc_map.legend_title")}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-red-600 opacity-50 border border-red-700" />
            <span className="text-slate-600 dark:text-slate-400">{t("iisc_map.legend.two_plus")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-red-300 opacity-50 border border-red-400" />
            <span className="text-slate-600 dark:text-slate-400">{t("iisc_map.legend.one")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 border border-slate-400" />
            <span className="text-slate-600 dark:text-slate-400">{t("iisc_map.legend.hover_name")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 border border-slate-900" />
            <span className="text-slate-600 dark:text-slate-400">{t("iisc_map.legend.bbmp_centroid")}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
          {t("iisc_map.group_heading")}
        </h3>
        <div className="space-y-3">
          {corpOrder.map((corp) => (
            <div key={corp}>
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {corp} ({grouped[corp].length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {grouped[corp].map((w) => (
                  <span
                    key={`${w.bbmp_ward_no}-${w.bbmp_ward_name}`}
                    className={`text-[11px] px-1.5 py-0.5 rounded border ${CORP_TONE[corp] ?? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}
                    title={`BBMP ${w.bbmp_ward_no} · GBA ${w.gba_ward_no ?? "?"} (${w.gba_corporation ?? "—"})`}
                  >
                    {w.bbmp_ward_name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
