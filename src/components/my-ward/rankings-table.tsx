"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  WardRankingRow,
  WardRankingsBundle,
} from "@/lib/ward-rankings/load-rankings";
import type { Grade } from "@/lib/utils/ward-rankings";
import { cn } from "@/lib/utils";

interface RankingsTableProps {
  bundle: WardRankingsBundle;
  cityDisplayName: string;
  /** URL prefix for ward-detail navigation. "" for Chennai legacy
   *  (ward links go to "/my-ward?ward=N"); "/<cityId>" for multi-city. */
  wardDetailPathPrefix: string;
}

type SortKey = "rank" | "wardNumber" | "wardName" | "zone" | "grade" | string;
type SortDir = "asc" | "desc";

const GRADE_ORDER: Record<Grade, number> = { A: 1, B: 2, C: 3, D: 4, F: 5 };

const GRADE_BADGE: Record<Grade, string> = {
  A: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  B: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
  C: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  D: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  F: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const ALL_GRADES: Grade[] = ["A", "B", "C", "D", "F"];

export function RankingsTable({
  bundle,
  cityDisplayName,
  wardDetailPathPrefix,
}: RankingsTableProps) {
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<Grade | null>(null);
  const [zoneFilter, setZoneFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const metricColumns = bundle.rows[0]?.metricColumns ?? [];

  const filteredAndSorted = useMemo(() => {
    let rows = bundle.rows;
    if (gradeFilter) rows = rows.filter((r) => r.grade === gradeFilter);
    if (zoneFilter) rows = rows.filter((r) => r.zone === zoneFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          String(r.wardNumber).includes(q) ||
          r.wardName.toLowerCase().includes(q) ||
          r.zone.toLowerCase().includes(q),
      );
    }
    return [...rows].sort((a, b) => compareRows(a, b, sortKey, sortDir));
  }, [bundle.rows, gradeFilter, zoneFilter, search, sortKey, sortDir]);

  const onSortClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Sensible default direction per column: rank/wardNumber asc, all others desc.
      setSortDir(key === "rank" || key === "wardNumber" ? "asc" : "asc");
    }
  };

  const headlineFCount = bundle.gradeCounts.F;
  const visibleCount = filteredAndSorted.length;
  const totalCount = bundle.rows.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          {cityDisplayName} ward rankings
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {totalCount} wards ranked by composite water-stress score.{" "}
          {headlineFCount > 0 && (
            <>
              <span className="font-semibold text-red-700 dark:text-red-400">
                {headlineFCount} F-grade
              </span>{" "}
              wards need urgent attention.
            </>
          )}{" "}
          Click any ward to open its full profile.
        </p>
      </header>

      {/* Filter bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold mr-1">
            Grade
          </span>
          <FilterChip
            active={gradeFilter === null}
            onClick={() => setGradeFilter(null)}
          >
            All <span className="ml-1 tabular-nums opacity-70">{totalCount}</span>
          </FilterChip>
          {ALL_GRADES.map((g) => {
            const count = bundle.gradeCounts[g];
            if (count === 0) return null;
            return (
              <FilterChip
                key={g}
                active={gradeFilter === g}
                onClick={() => setGradeFilter(gradeFilter === g ? null : g)}
              >
                <span
                  className={cn(
                    "inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle",
                    GRADE_BADGE[g].split(" ").filter((c) => c.startsWith("bg-")).join(" "),
                  )}
                />
                {g}
                <span className="ml-1 tabular-nums opacity-70">{count}</span>
              </FilterChip>
            );
          })}
        </div>
        {bundle.zones.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold mr-1">
              Zone
            </span>
            <FilterChip
              active={zoneFilter === null}
              onClick={() => setZoneFilter(null)}
            >
              All
            </FilterChip>
            {bundle.zones.map((z) => (
              <FilterChip
                key={z}
                active={zoneFilter === z}
                onClick={() => setZoneFilter(zoneFilter === z ? null : z)}
              >
                {z}
              </FilterChip>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ward number, name, or zone..."
            className="flex-1 min-w-[220px] max-w-md px-3 py-2 text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Showing {visibleCount} of {totalCount}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <SortHeader
                label="Rank"
                colKey="rank"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={onSortClick}
              />
              <SortHeader
                label="Ward"
                colKey="wardNumber"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={onSortClick}
              />
              <SortHeader
                label="Zone"
                colKey="zone"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={onSortClick}
              />
              <SortHeader
                label="Grade"
                colKey="grade"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={onSortClick}
              />
              <SortHeader
                label="Composite"
                colKey="compositeScore"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={onSortClick}
              />
              {metricColumns.map((m) => (
                <SortHeader
                  key={m.key}
                  label={m.label}
                  colKey={`metric:${m.key}`}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={onSortClick}
                />
              ))}
              <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredAndSorted.length === 0 && (
              <tr>
                <td
                  colSpan={6 + metricColumns.length}
                  className="px-3 py-10 text-center text-slate-500 dark:text-slate-400"
                >
                  No wards match the current filters.
                </td>
              </tr>
            )}
            {filteredAndSorted.map((row) => {
              const wardHref = `${wardDetailPathPrefix}/my-ward?ward=${row.wardNumber}`;
              return (
                <tr
                  key={row.wardNumber}
                  className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                >
                  <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-300">
                    #{row.rank}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={wardHref}
                      className="font-medium text-slate-900 dark:text-slate-100 hover:underline"
                    >
                      {row.wardName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    {row.zone || "-"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold",
                        GRADE_BADGE[row.grade],
                      )}
                    >
                      {row.grade}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-300">
                    {row.compositeScore.toFixed(1)}
                  </td>
                  {row.metricColumns.map((m) => (
                    <td
                      key={m.key}
                      className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-400"
                    >
                      {m.display}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Link
                      href={wardHref}
                      className="text-blue-600 dark:text-blue-400 hover:underline text-xs whitespace-nowrap"
                    >
                      Open &rarr;
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        {bundle.sourceLabel}.
      </p>
    </div>
  );
}

function compareRows(
  a: WardRankingRow,
  b: WardRankingRow,
  key: SortKey,
  dir: SortDir,
): number {
  const mult = dir === "asc" ? 1 : -1;
  if (key === "rank") return mult * (a.rank - b.rank);
  if (key === "wardNumber") return mult * (a.wardNumber - b.wardNumber);
  if (key === "wardName") return mult * a.wardName.localeCompare(b.wardName);
  if (key === "zone") return mult * a.zone.localeCompare(b.zone);
  if (key === "grade")
    return mult * (GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade]);
  if (key === "compositeScore")
    return mult * (a.compositeScore - b.compositeScore);
  if (key.startsWith("metric:")) {
    const metricKey = key.slice("metric:".length);
    const av = a.metricColumns.find((m) => m.key === metricKey)?.numeric;
    const bv = b.metricColumns.find((m) => m.key === metricKey)?.numeric;
    // null values sort to the bottom regardless of direction.
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    return mult * (av - bv);
  }
  return 0;
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-xs px-3 py-1.5 rounded-full border transition-colors",
        active
          ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-200"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
      )}
    >
      {children}
    </button>
  );
}

function SortHeader({
  label,
  colKey,
  sortKey,
  sortDir,
  onClick,
}: {
  label: string;
  colKey: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  const active = sortKey === colKey;
  return (
    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">
      <button
        onClick={() => onClick(colKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100",
          active && "text-slate-900 dark:text-slate-100",
        )}
      >
        {label}
        <span className="opacity-60 text-[10px]">
          {active ? (sortDir === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
  );
}
