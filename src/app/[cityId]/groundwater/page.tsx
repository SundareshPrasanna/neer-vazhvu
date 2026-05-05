import { promises as fs } from "fs";
import path from "path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tryGetPlaceConfig } from "@/lib/cities";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Groundwater | Neer Vazhvu" };
  return {
    title: `${config.displayName} Groundwater | Neer Vazhvu`,
    description: `CGWB Dynamic Groundwater Resource Assessment for ${config.displayName} - block-level stress classification and CGWB station coverage.`,
  };
}

interface GwrHistory {
  year: number;
  class: string;
  development_pct: number;
  availability_ham: number | null;
  draft_total_ham: number | null;
}

interface GwrBlock {
  name: string;
  history: GwrHistory[];
  latest: { class: string; development_pct: number; availability_ham: number | null; draft_total_ham: number | null };
}

interface GwrFile {
  source: string;
  source_url: string;
  fetched_at: string;
  years: number[];
  blocks: GwrBlock[];
}

interface GwStation {
  name: string;
  lat: number;
  lng: number;
  agency: string;
  block: string;
  station_code: string;
  data_types: string;
}

interface GwStationsFile {
  source: string;
  fetched_at: string;
  stations: GwStation[];
}

async function loadJson<T>(filename: string): Promise<T | null> {
  try {
    const text = await fs.readFile(path.join(process.cwd(), "public", "data", filename), "utf-8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const CLASS_TONE: Record<string, string> = {
  "Over Exploited": "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800",
  "Critical": "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  "Semi Critical": "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  "Safe": "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300 border-green-200 dark:border-green-800",
};

const CLASS_RANK: Record<string, number> = {
  "Safe": 0,
  "Semi Critical": 1,
  "Semi-Critical": 1,
  "Critical": 2,
  "Over Exploited": 3,
};

export default async function CityGroundwaterPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  const [gwrFile, gwStationsFile] = await Promise.all([
    loadJson<GwrFile>(`gwr-blocks-${cityId}.json`),
    loadJson<GwStationsFile>(`gw-stations-${cityId}.json`),
  ]);

  // Filter to blocks with a 2024 reading (the headline year). Older sub-blocks
  // (pre-2017 era) get merged historically and only the consolidated 2024
  // blocks form the current map.
  const latestYear = gwrFile ? Math.max(...gwrFile.years) : null;
  const currentBlocks = gwrFile && latestYear
    ? gwrFile.blocks.filter((b) => b.history.some((h) => h.year === latestYear))
    : [];
  const sortedBlocks = [...currentBlocks].sort(
    (a, b) => b.latest.development_pct - a.latest.development_pct,
  );

  const stations = gwStationsFile?.stations ?? [];
  const agencyCounts = stations.reduce<Record<string, number>>((acc, s) => {
    acc[s.agency] = (acc[s.agency] || 0) + 1;
    return acc;
  }, {});
  const blockCoverage = stations.reduce<Record<string, number>>((acc, s) => {
    if (s.block) acc[s.block] = (acc[s.block] || 0) + 1;
    return acc;
  }, {});

  const overExploited = sortedBlocks.filter((b) => b.latest.class === "Over Exploited");
  const critical = sortedBlocks.filter((b) => b.latest.class === "Critical");
  const semi = sortedBlocks.filter((b) => b.latest.class === "Semi Critical");

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {config.displayName} · Groundwater
        </Badge>
        {gwrFile && (
          <Badge variant="outline" className="text-xs">
            CGWB GWR{latestYear} · {sortedBlocks.length} blocks
          </Badge>
        )}
        {stations.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {stations.length} CGWB stations
          </Badge>
        )}
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {config.displayName} groundwater
        </h1>
        {gwrFile && sortedBlocks.length > 0 && (
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-3xl">
            {(() => {
              const phrases: string[] = [];
              if (overExploited.length) phrases.push(
                `${overExploited[0].name} is over-exploited at ${overExploited[0].latest.development_pct}% draft-to-availability`,
              );
              if (critical.length) phrases.push(`${critical[0].name} is critical at ${critical[0].latest.development_pct}%`);
              if (semi.length) phrases.push(`${semi.length} blocks semi-critical`);
              if (phrases.length === 0) {
                return `All ${sortedBlocks.length} blocks are within safe development thresholds.`;
              }
              return phrases.join("; ") + ".";
            })()}
          </p>
        )}
      </header>

      {!gwrFile && (
        <Card>
          <CardContent className="space-y-2">
            <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
              Not yet available for {config.displayName}
            </Badge>
            <p className="text-sm text-slate-500">
              CGWB block-level groundwater data has not yet been fetched for
              this city. Run <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">scripts/fetch-wris-groundwater-{cityId}.ts</code>{" "}
              (or the place-aware variant when M4 lands it) to populate
              <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded ml-1">public/data/gwr-blocks-{cityId}.json</code>.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Block stress grid */}
      {gwrFile && sortedBlocks.length > 0 && (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Block stress · CGWB GWR{latestYear}
              </h2>
              <span className="text-xs text-slate-400">
                fetched {new Date(gwrFile.fetched_at).toISOString().slice(0, 10)}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {sortedBlocks.map((b) => {
                const tone = CLASS_TONE[b.latest.class] ?? CLASS_TONE.Safe;
                const stationCount = blockCoverage[b.name] ?? 0;
                return (
                  <div
                    key={b.name}
                    className={`p-3 rounded border ${tone}`}
                    title={`${b.name}: ${b.latest.class} (${b.latest.development_pct}% development)`}
                  >
                    <div className="font-medium text-sm truncate">{b.name}</div>
                    <div className="font-mono text-xs opacity-90 mt-0.5">
                      {b.latest.development_pct.toFixed(1)}%
                    </div>
                    <div className="text-[10px] opacity-75 mt-0.5">{b.latest.class}</div>
                    {stationCount > 0 && (
                      <div className="text-[10px] opacity-60 mt-1">
                        {stationCount} {stationCount === 1 ? "station" : "stations"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500">
              Class is CGWB&apos;s annual Dynamic Groundwater Resource Assessment ratio
              of total annual draft to net annual availability: Safe (≤70%),
              Semi Critical (70-90%), Critical (90-100%), Over Exploited (&gt;100%).
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trend strip - top stressed blocks across years */}
      {gwrFile && sortedBlocks.length > 0 && (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Trend · most stressed blocks ({gwrFile.years[0]}-{latestYear})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                    <th className="pb-2 font-medium">Block</th>
                    {gwrFile.years.map((y) => (
                      <th key={y} className="pb-2 font-medium font-mono text-center">{y}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-300">
                  {sortedBlocks.slice(0, 8).map((b) => (
                    <tr key={b.name} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5 font-medium pr-2">{b.name}</td>
                      {gwrFile.years.map((y) => {
                        const h = b.history.find((x) => x.year === y);
                        if (!h) {
                          return <td key={y} className="py-1.5 text-center text-slate-300 dark:text-slate-600">-</td>;
                        }
                        const tone = CLASS_TONE[h.class] ?? CLASS_TONE.Safe;
                        return (
                          <td key={y} className="py-1.5 text-center">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded font-mono text-[10px] border ${tone}`}
                              title={`${h.class} (${h.development_pct}%)`}
                            >
                              {h.development_pct.toFixed(0)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
              Numbers are draft-to-availability percentage. Color reflects CGWB
              category. Sub-blocks pre-2017 are aggregated to the 2024 block
              boundary using the worst classification across child blocks.
            </p>
          </CardContent>
        </Card>
      )}

      {/* CGWB station coverage */}
      {stations.length > 0 && (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                CGWB station coverage
              </h2>
              <span className="text-xs text-slate-400">
                {stations.length} stations · {Object.keys(blockCoverage).length} blocks covered
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(agencyCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([agency, count]) => (
                  <div
                    key={agency}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-3"
                  >
                    <div className="text-xs text-slate-500">{agency}</div>
                    <div className="text-2xl font-bold mt-0.5">{count}</div>
                    <div className="text-[10px] text-slate-400">
                      {Math.round((count / stations.length) * 100)}% of stations
                    </div>
                  </div>
                ))}
            </div>
            <div className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500">
              India-WRIS aggregates monitoring stations across CGWB (national),
              State Ground Water departments, and TN-NHP. Each agency operates
              its own protocol; the data feeds back to the WRIS API on
              different cadences (CGWB seasonal, telemetric DWLR daily).
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ward-level groundwater - empty state for Madurai */}
      {cityId === "madurai" && (
        <Card>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Ward-level groundwater
              </h2>
              <Badge variant="outline" className="text-[10px]">
                gap · CMWSSB-unique
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              Chennai has a 200-piezometer monthly ward-level network operated by
              CMWSSB - the first Indian city with one. Madurai Municipal
              Corporation does not have an equivalent. The closest substitute
              is spatial interpolation from the {stations.length} CGWB
              district stations onto a ward grid; that&apos;s deferred to a
              future commit because the uncertainty needs to be made explicit
              in the UI before we publish interpolated values.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
        <p>
          <span className="font-semibold">Methodology:</span> CGWB Dynamic
          Groundwater Resource Assessment annual reports
          {gwrFile && ` (${gwrFile.years.join(", ")})`}. Block aggregations
          across years use the worst class among historical sub-blocks; total
          draft and availability sum across sub-blocks. Source: India-WRIS
          GWR{latestYear}_CGWB MapServer; station locations from
          GroundwaterLevel_Stations MapServer.
        </p>
      </div>
    </div>
  );
}

// Suppress unused-warning - CLASS_RANK reserved for future sort-by-stress UI.
void CLASS_RANK;
