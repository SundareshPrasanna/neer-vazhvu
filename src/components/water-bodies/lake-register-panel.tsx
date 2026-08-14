"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Gazetted lake register panel.
 *
 * Renders a city's statutory lake register - the legal boundary status of
 * every gazetted water body, not the OSM polygons the map draws. The two are
 * different populations and the difference is itself the story: Hyderabad's
 * OSM layer carries a few hundred visible polygons while the state gazettes
 * thousands of lakes, most of whose boundaries are not yet legally settled.
 *
 * FTL = Full Tank Level, the gazetted boundary. A lake gets a PRELIMINARY
 * notification, then a FINAL one after objections are heard. Until the final
 * notification issues, the boundary is not legally settled.
 */

type Lake = {
  lake_id: string;
  lake_name: string;
  district: string;
  mandal: string;
  village: string;
  preliminary_notification: string | null;
  final_notification: string | null;
  boundary_legally_final: boolean;
};

type Register = {
  _source: string;
  _source_url: string;
  _fetched: string;
  _licence: string;
  _note: string;
  total_lakes: number;
  final_notified: number;
  pct_final_notified: number;
  awaiting_final_notification: number;
  by_district: { district: string; lakes: number; final_notified: number; pct_final: number }[];
  final_notifications_by_year: Record<string, number>;
  lakes: Lake[];
};

const nf = new Intl.NumberFormat("en-IN");

export function LakeRegisterPanel({ cityId }: { cityId: string }) {
  const [reg, setReg] = useState<Register | null>(null);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState<string>("all");
  const [onlyPending, setOnlyPending] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/data/${cityId}-lake-register.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Register) => live && setReg(d))
      .catch(() => live && setErr(true));
    return () => {
      live = false;
    };
  }, [cityId]);

  const filtered = useMemo(() => {
    if (!reg) return [];
    const needle = q.trim().toLowerCase();
    return reg.lakes.filter((l) => {
      if (district !== "all" && l.district !== district) return false;
      if (onlyPending && l.boundary_legally_final) return false;
      if (!needle) return true;
      return (
        l.lake_name.toLowerCase().includes(needle) ||
        l.village.toLowerCase().includes(needle) ||
        l.mandal.toLowerCase().includes(needle)
      );
    });
  }, [reg, q, district, onlyPending]);

  if (err) {
    return (
      <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
        Lake register could not be loaded.
      </div>
    );
  }
  if (!reg) {
    return (
      <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
        Loading lake register...
      </div>
    );
  }

  const years = Object.entries(reg.final_notifications_by_year).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const maxYear = Math.max(...years.map(([, n]) => n));
  const dormant = years.filter(([y]) => Number(y) >= 2017 && Number(y) <= 2023);
  const dormantTotal = dormant.reduce((s, [, n]) => s + n, 0);
  const recent = years.filter(([y]) => Number(y) >= 2024);
  const recentTotal = recent.reduce((s, [, n]) => s + n, 0);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5">
      {/* Headline */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Gazetted lakes", value: nf.format(reg.total_lakes), sub: "in the register" },
          { label: "Boundary legally final", value: nf.format(reg.final_notified), sub: `${reg.pct_final_notified}% of the register` },
          { label: "Awaiting final notification", value: nf.format(reg.awaiting_final_notification), sub: "boundary not legally settled" },
          { label: "Districts", value: String(reg.by_district.length), sub: "covered by the register" },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">{c.label}</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{c.value}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{c.sub}</div>
          </div>
        ))}
      </section>

      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-4xl">
        {reg._note}
      </p>

      {/* Notification tempo */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          When boundaries were finalised
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
          Final notifications by year. The process was near-dormant between 2017
          and 2023 - {nf.format(dormantTotal)} notifications across those seven
          years - then issued {nf.format(recentTotal)} from 2024 onward. We
          report the tempo; the register does not state a cause.
        </p>
        <div className="mt-3 space-y-1.5">
          {years.map(([y, n]) => (
            <div key={y} className="flex items-center gap-2">
              <div className="w-10 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{y}</div>
              <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-emerald-500/70 rounded-sm"
                  style={{ width: `${(n / maxYear) * 100}%` }}
                />
              </div>
              <div className="w-12 text-right text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
                {nf.format(n)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* District split */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Legal settlement by district
        </h3>
        <table className="w-full text-xs mt-3">
          <thead>
            <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="text-left font-medium py-1">District</th>
              <th className="text-right font-medium py-1">Lakes</th>
              <th className="text-right font-medium py-1">Final</th>
              <th className="text-right font-medium py-1">Share final</th>
            </tr>
          </thead>
          <tbody>
            {[...reg.by_district]
              .sort((a, b) => a.pct_final - b.pct_final)
              .map((d) => (
                <tr key={d.district} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1 text-slate-700 dark:text-slate-300">{d.district}</td>
                  <td className="py-1 text-right tabular-nums text-slate-700 dark:text-slate-300">{nf.format(d.lakes)}</td>
                  <td className="py-1 text-right tabular-nums text-slate-600 dark:text-slate-400">{nf.format(d.final_notified)}</td>
                  <td className={`py-1 text-right tabular-nums font-medium ${d.pct_final < 40 ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-400"}`}>
                    {d.pct_final.toFixed(1)}%
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      {/* Searchable register */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Search the register
        </h3>
        <div className="flex flex-wrap gap-2 mt-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Lake, village or mandal"
            className="flex-1 min-w-[180px] rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
          />
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="all">All districts</option>
            {reg.by_district.map((d) => (
              <option key={d.district} value={d.district}>{d.district}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={onlyPending}
              onChange={(e) => setOnlyPending(e.target.checked)}
            />
            Boundary not final
          </label>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
          {nf.format(filtered.length)} of {nf.format(reg.total_lakes)} lakes
          {filtered.length > 200 ? " - showing first 200" : ""}
        </div>

        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left font-medium py-1">Lake</th>
                <th className="text-left font-medium py-1">Village / Mandal</th>
                <th className="text-left font-medium py-1">District</th>
                <th className="text-left font-medium py-1">Boundary</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((l) => (
                <tr key={l.lake_id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1 text-slate-700 dark:text-slate-300">{l.lake_name || "(unnamed)"}</td>
                  <td className="py-1 text-slate-500 dark:text-slate-400">
                    {[l.village, l.mandal].filter(Boolean).join(" / ")}
                  </td>
                  <td className="py-1 text-slate-500 dark:text-slate-400">{l.district}</td>
                  <td className="py-1">
                    {l.boundary_legally_final ? (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        Final {l.final_notification ? `(${l.final_notification.slice(0, 4)})` : ""}
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">
                        {l.preliminary_notification ? "Preliminary only" : "Not notified"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Source:{" "}
        <a href={reg._source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
          {reg._source}
        </a>{" "}
        - {reg._licence}. Retrieved {reg._fetched}.
      </p>
    </div>
  );
}
