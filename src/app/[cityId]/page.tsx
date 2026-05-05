import { promises as fs } from "fs";
import path from "path";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPlaceConfig } from "@/lib/cities";
import { loadCitySnapshot, type ReservoirReadingV2 } from "./data";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

interface GwrBlockHistoryEntry {
  year: number;
  class: string;
  development_pct: number;
}

interface GwrBlock {
  name: string;
  history: GwrBlockHistoryEntry[];
  latest: { class: string; development_pct: number };
}

interface GwrFile {
  source: string;
  source_url: string;
  fetched_at: string;
  blocks: GwrBlock[];
}

interface GwStationsFile {
  source: string;
  fetched_at: string;
  stations: { name: string; lat: number; lng: number; agency: string; block: string }[];
}

async function loadGwrBlocks(cityId: string): Promise<GwrFile | null> {
  try {
    const text = await fs.readFile(
      path.join(process.cwd(), "public", "data", `gwr-blocks-${cityId}.json`),
      "utf-8",
    );
    return JSON.parse(text) as GwrFile;
  } catch {
    return null;
  }
}

async function loadGwStations(cityId: string): Promise<GwStationsFile | null> {
  try {
    const text = await fs.readFile(
      path.join(process.cwd(), "public", "data", `gw-stations-${cityId}.json`),
      "utf-8",
    );
    return JSON.parse(text) as GwStationsFile;
  } catch {
    return null;
  }
}

const GWR_CLASS_TONE: Record<string, string> = {
  "Over Exploited": "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800",
  "Critical": "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  "Semi Critical": "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  "Safe": "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300 border-green-200 dark:border-green-800",
};

// Re-fetch every 15 minutes (matches /api/reservoir cache TTL).
export const revalidate = 900;

// Madurai-specific reference levels.
// Mullaperiyar: Kerala SDMA caps storage at 142 ft (post-SC 2014 ruling);
// TN-side records preserve 152 ft as historical FRL.
const MULLAPERIYAR_TN_FRL_FT = 152;
const MULLAPERIYAR_KE_CAP_FT = 142;
const MULLAPERIYAR_ALERTS = [
  { ft: 136, label: "Warning", tone: "text-yellow-600 dark:text-yellow-400" },
  { ft: 138, label: "Orange", tone: "text-orange-600 dark:text-orange-400" },
  { ft: 140, label: "Red", tone: "text-red-600 dark:text-red-400" },
  { ft: MULLAPERIYAR_KE_CAP_FT, label: "Kerala FRL", tone: "text-red-700 dark:text-red-300 font-semibold" },
];

const MADURAI_DAILY_DEMAND_MLD = 135;
const MADURAI_VAIGAI_SHARE_MLD = 80;

function pctBarColor(pct: number | null): string {
  if (pct === null) return "bg-slate-300 dark:bg-slate-600";
  if (pct > 60) return "bg-green-500";
  if (pct > 30) return "bg-yellow-500";
  if (pct > 15) return "bg-orange-500";
  return "bg-red-500";
}

function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || isNaN(n)) return "-";
  return n.toFixed(digits);
}

function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return "-";
  return Math.round(n).toLocaleString();
}

export default async function CityHomePage({ params }: PageProps) {
  const { cityId } = await params;
  // The layout has already validated cityId and redirected /chennai; we can
  // safely look up the config here.
  const config = getPlaceConfig(cityId);
  const snapshot = await loadCitySnapshot(config);
  const dataDate = snapshot.asOf;
  const reservoirIsLive = snapshot.reservoirIsLive;

  // Madurai-specific data + narrative panels.
  // TODO(M4 follow-up): each feature page (groundwater, flood-risk, etc.)
  // gets its own /[cityId]/<feature>/page.tsx. This top-level page is the
  // city's "home" - reservoir hero + days-of-water-left + groundwater preview.
  // For now Madurai is the only city with a fleshed-out home; other cities
  // see a generic reservoir grid until their narrative is built.
  const isMadurai = cityId === "madurai";

  const [gwrFile, gwStationsFile] = isMadurai
    ? await Promise.all([loadGwrBlocks(cityId), loadGwStations(cityId)])
    : [null, null];

  const vaigai = snapshot.readingsBySource["vaigai"] ?? null;
  const mullaperiyar = snapshot.readingsBySource["mullaperiyar"] ?? null;
  const sothuparai = snapshot.readingsBySource["sothuparai"] ?? null;

  // Days-of-water-left for Madurai (Vaigai-share only). Other cities reuse
  // their own homepage logic; this is intentionally Madurai-scoped.
  const vaigaiMcft = vaigai?.storage_tmc != null ? vaigai.storage_tmc * 1000 : null;
  const vaigaiMl = vaigaiMcft !== null ? vaigaiMcft * 28.3168 : null;
  const daysOfCityShare =
    vaigaiMl !== null ? Math.round(vaigaiMl / MADURAI_VAIGAI_SHARE_MLD) : null;

  // Mullaperiyar dual-reference percentages.
  const mpLevelFt = mullaperiyar?.level_ft ?? null;
  const mpPctTn = mpLevelFt !== null ? Math.round((mpLevelFt / MULLAPERIYAR_TN_FRL_FT) * 1000) / 10 : null;
  const mpPctKe = mpLevelFt !== null ? Math.round((mpLevelFt / MULLAPERIYAR_KE_CAP_FT) * 1000) / 10 : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">
          City: {config.displayName} · {config.stateCode}
        </Badge>
        {!reservoirIsLive && (
          <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
            PREVIEW · waiting for first daily ingestion
          </Badge>
        )}
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {config.displayName} Water Clock
        </h1>
        {isMadurai && (
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-3xl">
            Where does Madurai stand right now? Vaigai dam, Mullaperiyar (the
            1886-leased Kerala-side source that supplies most of Vaigai&apos;s
            inflow), and Sothuparai - one page, updated daily.
          </p>
        )}
      </header>

      {/* Madurai: days-of-water-left from Vaigai live storage */}
      {isMadurai && (
        <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20">
          <CardContent className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-blue-700 dark:text-blue-400 font-semibold">
              Days of city drinking water (Vaigai share only)
            </div>
            <div className="text-2xl sm:text-3xl font-bold">
              {daysOfCityShare !== null ? `~${daysOfCityShare} days` : "-"}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              At the Vaigai-supplied share of {MADURAI_VAIGAI_SHARE_MLD} MLD
              (city total demand ~{MADURAI_DAILY_DEMAND_MLD} MLD per CMA Master
              Plan, vol II). Excludes evaporation losses, irrigation releases,
              and groundwater contribution to the remainder.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vaigai + Mullaperiyar grid (Madurai) */}
      {isMadurai && vaigai && mullaperiyar && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Vaigai card */}
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Vaigai (TN, Theni district)
                </h2>
                <span className="text-xs text-slate-400">
                  {dataDate ?? "no data yet"}
                </span>
              </div>
              <div className="text-3xl font-bold">
                {fmtNum(vaigai.storage_tmc, 2)}
                <span className="text-base font-normal text-slate-400 ml-1">TMC</span>
              </div>
              <div className="text-sm text-slate-500">
                {fmtNum(vaigai.storage_pct_frl)}% of FRL
                {vaigai.level_ft !== null && (
                  <> · {fmtNum(vaigai.level_ft)} ft of 71 ft</>
                )}
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${pctBarColor(vaigai.storage_pct_frl)}`}
                  style={{ width: `${Math.min(vaigai.storage_pct_frl ?? 0, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>In <span className="text-green-600 dark:text-green-400 font-medium">{fmtInt(vaigai.inflow_cusecs)}</span> cusecs</span>
                <span>Out <span className="text-red-600 dark:text-red-400 font-medium">{fmtInt(vaigai.outflow_cusecs)}</span> cusecs</span>
              </div>
              <div className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold">~80% of inflow comes from Mullaperiyar.</span>
                {" "}Vaigai&apos;s natural catchment is 2,253 sq km but its
                drinking-water yield depends on the Periyar tunnel. Rainfall
                over the Vaigai basin alone underrepresents available water.
              </div>
            </CardContent>
          </Card>

          {/* Mullaperiyar card: one reading, two reference levels */}
          <Card className="border-amber-200 dark:border-amber-900">
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Mullaperiyar (Kerala, TN-operated)
                </h2>
                <span className="text-xs text-slate-400">
                  {dataDate ?? "no data yet"}
                </span>
              </div>
              <div className="text-3xl font-bold">
                {fmtNum(mpLevelFt)}
                <span className="text-base font-normal text-slate-400 ml-1">ft</span>
              </div>
              <div className="text-sm text-slate-500">
                {fmtNum(mpPctTn)}% of TN historical FRL ({MULLAPERIYAR_TN_FRL_FT} ft)
                {" "}· {fmtNum(mpPctKe)}% of Kerala SC-cap ({MULLAPERIYAR_KE_CAP_FT} ft)
              </div>
              <div className="grid grid-cols-4 gap-1 mt-2 text-[10px]">
                {MULLAPERIYAR_ALERTS.map((a) => {
                  const reached = mpLevelFt !== null && mpLevelFt >= a.ft;
                  return (
                    <div
                      key={a.ft}
                      className={`px-2 py-1 rounded text-center border ${
                        reached
                          ? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                          : "border-slate-200 dark:border-slate-800 opacity-60"
                      }`}
                    >
                      <div className={a.tone}>{a.label}</div>
                      <div className="text-slate-500 font-mono">{a.ft} ft</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold">1886 lease deed, 999 years, Rs 5/acre.</span>
                {" "}Periyar Lake Lease Indenture between the Maharaja of
                Travancore and the Secretary of State for India. Kerala caps
                storage at {MULLAPERIYAR_KE_CAP_FT} ft per Supreme Court 2014;
                TN-side records preserve {MULLAPERIYAR_TN_FRL_FT} ft FRL.
                Reading is published by TN only (the dam is TN-operated);
                Kerala SDMA does not publish Mullaperiyar in its KSEB or IRR
                tables.
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sothuparai mini card (Madurai) */}
      {isMadurai && (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Sothuparai (Theni, Vaigai tributary)
              </h2>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  data gap · PWD memo only
                </Badge>
                {!sothuparai && <span className="text-xs text-amber-600">no data</span>}
                <span className="text-xs text-slate-400">{dataDate ?? "-"}</span>
              </div>
            </div>
            {sothuparai ? (
              <div className="flex items-baseline gap-3">
                <div className="text-2xl font-bold">
                  {fmtNum(sothuparai.storage_tmc, 2)}
                  <span className="text-base font-normal text-slate-400 ml-1">TMC</span>
                </div>
                <div className="text-sm text-slate-500">
                  {fmtNum(sothuparai.storage_pct_frl)}% of FRL
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No reading available.</div>
            )}
            <div className="text-xs text-slate-500">
              Sothuparai dam (Periyakulam taluk, Varaha river) feeds the Vaigai
              command. Not on tnagriculture.in - we cannot scrape it.
              Sothuparai stays empty until a PWD memo scraper or RTI dump
              becomes feasible.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Groundwater - CGWB GWR2024 block assessments */}
      {isMadurai && gwrFile && (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Groundwater stress · CGWB GWR2024
              </h2>
              <span className="text-xs text-slate-400">
                {gwStationsFile && `${gwStationsFile.stations.length} stations · `}
                {gwrFile.blocks.length} blocks · {new Date(gwrFile.fetched_at).toISOString().slice(0, 10)}
              </span>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {(() => {
                const overExploited = gwrFile.blocks.filter((b) => b.latest.class === "Over Exploited");
                const critical = gwrFile.blocks.filter((b) => b.latest.class === "Critical");
                const semi = gwrFile.blocks.filter((b) => b.latest.class === "Semi Critical");
                if (overExploited.length === 0 && critical.length === 0) {
                  return `${semi.length} of ${gwrFile.blocks.length} blocks are semi-critical; the rest are safe.`;
                }
                const phrases: string[] = [];
                if (overExploited.length) phrases.push(`${overExploited[0].name} is over-exploited at ${overExploited[0].latest.development_pct}% draft-to-availability`);
                if (critical.length) phrases.push(`${critical[0].name} is critical at ${critical[0].latest.development_pct}%`);
                if (semi.length) phrases.push(`${semi.length} blocks semi-critical`);
                return phrases.join("; ") + ".";
              })()}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-2">
              {gwrFile.blocks.map((b) => {
                const tone = GWR_CLASS_TONE[b.latest.class] ?? GWR_CLASS_TONE.Safe;
                return (
                  <div
                    key={b.name}
                    className={`text-xs px-2 py-1.5 rounded border ${tone}`}
                    title={`${b.name}: ${b.latest.class} (${b.latest.development_pct}% development)`}
                  >
                    <div className="font-medium truncate">{b.name}</div>
                    <div className="font-mono text-[10px] opacity-75">
                      {b.latest.development_pct.toFixed(0)}% · {b.latest.class}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500">
              Class is CGWB&apos;s annual Dynamic Groundwater Resource Assessment
              ratio of total annual draft to net annual availability: Safe
              (≤70%), Semi Critical (70-90%), Critical (90-100%), Over
              Exploited (&gt;100%). Source: India-WRIS GWR2024_CGWB MapServer,
              fetched {new Date(gwrFile.fetched_at).toISOString().slice(0, 10)}.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generic reservoir grid for cities without a custom narrative yet */}
      {!isMadurai && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {config.waterSources.map((source) => {
            const reading = snapshot.readingsBySource[source.sourceCode];
            return (
              <Card key={source.sourceCode}>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {source.displayName}
                    </h2>
                    <span className="text-xs text-slate-400">
                      {reading?.date ?? "no data yet"}
                    </span>
                  </div>
                  <div className="text-3xl font-bold">
                    {fmtNum(reading?.storage_tmc, 2)}
                    <span className="text-base font-normal text-slate-400 ml-1">TMC</span>
                  </div>
                  <div className="text-sm text-slate-500">
                    {fmtNum(reading?.storage_pct_frl)}% of FRL
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pctBarColor(reading?.storage_pct_frl ?? null)}`}
                      style={{ width: `${Math.min(reading?.storage_pct_frl ?? 0, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer notes */}
      <div className="text-xs text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
        <p>
          <span className="font-semibold">Methodology:</span> Reservoir levels
          for {config.displayName} from {config.primaryAuthority.acronym} via
          our multi-city scraper (TN Agri ARS for TN places, CMWSSB for Chennai).
          More feature pages (groundwater, flood risk, water bodies, rivers)
          are being decoupled to be place-aware - each will land at
          /{cityId}/&lt;feature&gt; as it ships.
        </p>
      </div>
    </div>
  );
}
