"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { STATUS_LABELS, StatusPill, type BriefStatusKey } from "./atlas-primitives";

/** The light row the server hands over: identity and status, no payload. */
export interface DirectoryRow {
  lgdCode: string;
  name: string;
  blockCode: string;
  blockName: string;
  status: BriefStatusKey;
}

export interface DirectoryBlock {
  code: string;
  name: string;
  count: number;
}

interface AtlasDirectoryExplorerProps {
  rows: DirectoryRow[];
  blocks: DirectoryBlock[];
  /** District route base, so one explorer serves every district. */
  basePath: string;
  /** Lock the explorer to one block (the block page). */
  fixedBlockCode?: string;
  pageSize?: number;
}

function searchText(row: DirectoryRow): string {
  return `${row.name} ${row.lgdCode} ${row.blockName}`.toLocaleLowerCase("en-IN");
}

/**
 * Find a Gram Panchayat: search by name, block or LGD code, narrow by block,
 * and see the brief status per row before opening it. Fed with the light
 * directory rows only; nothing under public/data reaches the browser.
 */
export function AtlasDirectoryExplorer({
  rows,
  blocks,
  basePath,
  fixedBlockCode,
  pageSize = 40,
}: AtlasDirectoryExplorerProps) {
  const [query, setQuery] = useState("");
  const [blockCode, setBlockCode] = useState<string | null>(fixedBlockCode ?? null);
  const [limit, setLimit] = useState(pageSize);

  const normalized = query.trim().toLocaleLowerCase("en-IN");
  const matches = useMemo(() => {
    return rows.filter(
      (row) =>
        (blockCode === null || row.blockCode === blockCode) &&
        (normalized.length === 0 || searchText(row).includes(normalized)),
    );
  }, [rows, blockCode, normalized]);
  const visible = matches.slice(0, limit);
  const remaining = matches.length - visible.length;

  const statusCounts = matches.reduce<Record<BriefStatusKey, number>>(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { reviewed: 0, profile: 0, directory: 0 },
  );

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="atlas-gp-search" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Search by name, block or LGD code
          </label>
          <div className="relative mt-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="atlas-gp-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setLimit(pageSize);
              }}
              placeholder="Poondi or 228400"
              autoComplete="off"
              aria-describedby="atlas-gp-search-status"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>
        </div>
        {!fixedBlockCode ? (
          <div className="sm:w-64">
            <label htmlFor="atlas-gp-block" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Block
            </label>
            <select
              id="atlas-gp-block"
              value={blockCode ?? ""}
              onChange={(event) => {
                setBlockCode(event.target.value || null);
                setLimit(pageSize);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            >
              <option value="">All {blocks.length} blocks</option>
              {blocks.map((block) => (
                <option key={block.code} value={block.code}>
                  {block.name} ({block.count})
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <p id="atlas-gp-search-status" aria-live="polite" className="mt-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
        {matches.length === rows.length
          ? `${rows.length} Gram Panchayats.`
          : `${matches.length} of ${rows.length} Gram Panchayats match.`}{" "}
        {(["reviewed", "profile", "directory"] as BriefStatusKey[])
          .filter((key) => statusCounts[key] > 0)
          .map((key) => `${statusCounts[key]} ${STATUS_LABELS[key].toLowerCase()}`)
          .join(", ")}
        .
      </p>

      {visible.length > 0 ? (
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Gram Panchayat</th>
                <th className="px-3 py-2.5 font-semibold">Block</th>
                <th className="px-3 py-2.5 font-semibold">LGD code</th>
                <th className="px-3 py-2.5 font-semibold">Brief</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.lgdCode} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2">
                    <Link
                      href={`${basePath}/panchayats/${row.lgdCode}`}
                      className="font-medium text-cyan-700 dark:text-cyan-400 hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.blockName}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{row.lgdCode}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          No Gram Panchayat matches. Try part of the English directory name or an LGD code.
        </div>
      )}

      {remaining > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setLimit((current) => current + pageSize)}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Show {Math.min(pageSize, remaining)} more of {remaining}
          </button>
        </div>
      ) : null}
    </div>
  );
}
