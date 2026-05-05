import { promises as fs } from "fs";
import path from "path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tryGetPlaceConfig } from "@/lib/cities";
import { FeatureNotYetAvailable } from "@/components/layout/feature-not-yet-available";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Lake Restoration | Neer Vazhvu" };
  return {
    title: `${config.displayName} Lake Restoration | Neer Vazhvu`,
    description: `Lost tanks, flagship water bodies, and restoration programmes for ${config.displayName}.`,
    alternates: { canonical: `/${cityId}/lake-restoration` },
  };
}

interface LostBody {
  name: string;
  status: "Fully lost" | "Severely reduced" | "Partially encroached";
  side: string;
  note: string;
}

interface LostFile {
  summary: {
    fully_lost_count: number;
    severely_reduced_count: number;
    combined_area_lost_sqkm_estimate: number;
    share_of_city_estimate_pct: number;
    slum_households_on_former_tank_beds_estimate: number;
  };
  primary_source: { citation: string; url: string };
  lost_bodies: LostBody[];
}

interface FlagshipBody {
  name: string;
  alternate_names?: string[];
  type: string;
  area_acres?: number;
  capacity_mcft?: number;
  capacity_tmc?: number;
  year_built?: number | null;
  era?: string;
  builder?: string;
  feed?: string;
  status: string;
  cultural_note?: string;
  biodiversity_heritage_site?: boolean;
  ramsar_proposed_date?: string;
  confidence: "V" | "N" | "C";
  sources: string[];
}

interface FlagshipFile {
  bodies: FlagshipBody[];
}

interface ProjectEntry {
  scheme_name: string;
  operator: string;
  scope: string;
  funding_summary?: string;
  amount_cr?: number;
  sanctioned_year?: number;
  completed_year?: number;
  financier?: string;
  status: string;
  partnership_unlock?: boolean;
  sources: string[];
}

interface CourtOrder {
  case: string;
  writ_petition: string;
  court: string;
  date: string;
  directive: string;
  specific_tanks: string[];
  concern: string;
  source: string;
}

interface ProjectsFile {
  projects: ProjectEntry[];
  court_orders: CourtOrder[];
}

type PriorityLevel = "critical" | "high" | "moderate" | "low";

interface ScoredBody {
  name: string;
  priority_score: number;
  priority_level: PriorityLevel;
  rationale: string;
}

interface RestorationPriorityFile {
  generated_at: string;
  algorithm_version: string;
  total_scored: number;
  bodies: ScoredBody[];
}

async function loadJson<T>(filename: string): Promise<T | null> {
  try {
    const text = await fs.readFile(path.join(process.cwd(), "public", "data", filename), "utf-8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const STATUS_TONE: Record<LostBody["status"], string> = {
  "Fully lost":           "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  "Severely reduced":     "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  "Partially encroached": "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
};

const CONFIDENCE_TONE: Record<FlagshipBody["confidence"], string> = {
  V: "border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20",
  N: "border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20",
  C: "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900",
};

const CONFIDENCE_LABEL: Record<FlagshipBody["confidence"], string> = {
  V: "verified",
  N: "single source",
  C: "claim only",
};

const PRIORITY_TONE: Record<PriorityLevel, string> = {
  critical: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700",
  high:     "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-700",
  moderate: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700",
  low:      "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700",
};

export default async function CityLakeRestorationPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  const [lostFile, flagshipFile, projectsFile, priorityFile] = await Promise.all([
    loadJson<LostFile>(`water-bodies-lost-${cityId}.json`),
    loadJson<FlagshipFile>(`water-bodies-flagship-${cityId}.json`),
    loadJson<ProjectsFile>(`restoration-projects-${cityId}.json`),
    loadJson<RestorationPriorityFile>(`restoration-priority-${cityId}.json`),
  ]);

  // Index the priority scores by name so we can render badges + sort the
  // flagship grid by descending priority. Fallback: if the priority file
  // hasn't been computed yet, the grid renders unordered without badges.
  const priorityByName = new Map<string, ScoredBody>();
  for (const b of priorityFile?.bodies ?? []) priorityByName.set(b.name, b);

  if (!lostFile || !flagshipFile || !projectsFile) {
    return (
      <FeatureNotYetAvailable
        config={config}
        feature="Lake Restoration"
        scope="district-admin"
        parityVerdict="MEDIUM"
        whatItShowsForChennai="restoration priority scoring across 1,700+ water bodies + lost-tank inventory + active programme tracking"
        dataGapNote="No curated lake-restoration data files for this city yet."
        relatedLinks={[
          { href: `/${cityId}`, label: `${config.displayName} home` },
          { href: `/${cityId}/water-bodies`, label: "Water bodies map" },
        ]}
      />
    );
  }

  const lost = lostFile.lost_bodies;
  const fullyLost = lost.filter((b) => b.status === "Fully lost");
  const reduced = lost.filter((b) => b.status !== "Fully lost");

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">{config.displayName} · Lake restoration</Badge>
        <Badge variant="outline" className="text-xs">District scope</Badge>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {config.displayName} lake restoration
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-3xl">
          {lostFile.summary.fully_lost_count} historic urban tanks have been
          fully built over - including the District Court complex (on Sengulam
          tank) and Madurai Corporation offices (on Tallakulam tank). Another
          {" "}{lostFile.summary.severely_reduced_count} surviving tanks are
          severely reduced or encroached. Combined area lost: ~{lostFile.summary.combined_area_lost_sqkm_estimate} sq km
          ({lostFile.summary.share_of_city_estimate_pct}% of the city).
          {" "}{lostFile.summary.slum_households_on_former_tank_beds_estimate.toLocaleString()}+
          slum households now live on former tank beds.
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent>
          <div className="text-xs uppercase tracking-wider text-slate-500">Fully lost</div>
          <div className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">{fullyLost.length}</div>
          <div className="text-xs text-slate-500">historic urban tanks</div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="text-xs uppercase tracking-wider text-slate-500">At risk</div>
          <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-1">{reduced.length}</div>
          <div className="text-xs text-slate-500">severely reduced or encroached</div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="text-xs uppercase tracking-wider text-slate-500">Flagships</div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{flagshipFile.bodies.length}</div>
          <div className="text-xs text-slate-500">named tanks documented</div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="text-xs uppercase tracking-wider text-slate-500">Programmes</div>
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{projectsFile.projects.length}</div>
          <div className="text-xs text-slate-500">active or completed</div>
        </CardContent></Card>
      </div>

      {projectsFile.court_orders.map((order) => (
        <Card key={order.writ_petition} className="border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <Badge variant="outline" className="text-[10px] uppercase">Court order</Badge>
              <span className="text-xs text-slate-500">{order.date}</span>
              <span className="text-xs font-mono text-slate-500">{order.writ_petition}</span>
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{order.case}</h2>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              <span className="font-semibold">{order.court}</span> directed the
              TN Government to {order.directive}. Petition filed over{" "}
              <span className="italic">{order.concern}</span> at{" "}
              {order.specific_tanks.join(" and ")}.
            </p>
            <a href={order.source} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
              LawBeat coverage →
            </a>
          </CardContent>
        </Card>
      ))}

      {/* Restoration programmes */}
      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Restoration programmes touching {config.displayName} · {projectsFile.projects.length}
          </h2>
          <div className="space-y-3">
            {projectsFile.projects.map((p) => (
              <div
                key={p.scheme_name}
                className={`border rounded-lg p-3 ${
                  p.partnership_unlock
                    ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{p.scheme_name}</span>
                  <div className="flex items-center gap-2">
                    {p.amount_cr && <span className="text-xs font-mono text-slate-500">Rs {p.amount_cr.toLocaleString()} cr</span>}
                    <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                    {p.partnership_unlock && (
                      <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                        partnership target
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {p.operator}
                  {p.financier && p.financier !== p.operator && ` · financier: ${p.financier}`}
                  {p.sanctioned_year && ` · sanctioned ${p.sanctioned_year}`}
                  {p.completed_year && ` · completed ${p.completed_year}`}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1.5">{p.scope}</p>
                {p.funding_summary && (
                  <p className="text-[11px] text-slate-500 mt-1 italic">{p.funding_summary}</p>
                )}
                {p.sources.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {p.sources.map((src, i) => (
                      <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[200px]">
                        source {i + 1} →
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Flagship tanks grid */}
      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Flagship water bodies · {flagshipFile.bodies.length}
            {priorityFile && (
              <span className="text-[10px] font-normal normal-case text-slate-400 ml-2">
                (sorted by restoration priority - {priorityFile.algorithm_version})
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...flagshipFile.bodies]
              .sort((a, b) => {
                const sa = priorityByName.get(a.name)?.priority_score ?? -1;
                const sb = priorityByName.get(b.name)?.priority_score ?? -1;
                return sb - sa;
              })
              .map((wb) => {
                const score = priorityByName.get(wb.name);
                return (
              <div key={wb.name} className={`border rounded-lg p-3 ${CONFIDENCE_TONE[wb.confidence]}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{wb.name}</span>
                      {score && (
                        <span
                          className={`shrink-0 text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border ${PRIORITY_TONE[score.priority_level]}`}
                          title={score.rationale}
                        >
                          {score.priority_level} · {score.priority_score}
                        </span>
                      )}
                    </div>
                    {wb.alternate_names && wb.alternate_names.length > 0 && (
                      <div className="text-[10px] text-slate-500 italic mt-0.5">also: {wb.alternate_names.join(", ")}</div>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] font-mono uppercase opacity-70">{CONFIDENCE_LABEL[wb.confidence]}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-1.5 text-[11px]">
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{wb.type.replace(/_/g, " ")}</span>
                  {wb.year_built && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">built {wb.year_built}</span>}
                  {wb.era && !wb.year_built && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{wb.era}</span>}
                  {wb.area_acres && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{wb.area_acres} acres</span>}
                  {wb.capacity_mcft && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{wb.capacity_mcft} Mcft</span>}
                  {wb.capacity_tmc && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{wb.capacity_tmc} TMC</span>}
                  {wb.biodiversity_heritage_site && <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">Biodiversity Heritage Site</span>}
                  {wb.ramsar_proposed_date && <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">Ramsar proposed {wb.ramsar_proposed_date}</span>}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-2">{wb.status}</p>
                {wb.builder && <p className="text-[11px] text-slate-500 mt-1">builder: {wb.builder}{wb.feed && ` · fed by ${wb.feed}`}</p>}
                {wb.cultural_note && <p className="text-[11px] text-slate-500 italic mt-1">{wb.cultural_note}</p>}
                {wb.sources.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {wb.sources.map((src, i) => (
                      <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[140px]">source {i + 1} →</a>
                    ))}
                  </div>
                )}
              </div>
                );
              })}
          </div>
          {priorityFile && (
            <p className="text-[11px] text-slate-500 italic pt-2 border-t border-slate-200 dark:border-slate-700">
              Priority badge: status severity (drying/lost &gt; severely reduced &gt; encroached &gt; restored) +
              cultural bonus (BHS / Ramsar / HC PIL / heritage) + size bucket, scaled by source confidence.
              Hover the badge for the per-tank rationale. Algorithm: <code className="font-mono">{priorityFile.algorithm_version}</code>.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Lost tanks */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Fully lost tanks · {fullyLost.length}
            </h2>
            <span className="text-xs text-slate-400">source: {lostFile.primary_source.citation}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {fullyLost.map((b) => (
              <div key={b.name} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm text-slate-900 dark:text-slate-100">{b.name}</span>
                  <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_TONE[b.status]}`}>{b.status}</span>
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{b.side} side</div>
                {b.note && <div className="text-xs text-slate-500 mt-1">{b.note}</div>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* At-risk surviving tanks */}
      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Surviving but at risk · {reduced.length}
          </h2>
          <div className="space-y-2">
            {reduced.map((b) => (
              <div key={b.name} className="flex items-start gap-3 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_TONE[b.status]}`}>{b.status}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-900 dark:text-slate-100">{b.name}</div>
                  {b.note && <div className="text-xs text-slate-500 mt-1">{b.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cross-links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href={`/${cityId}/water-bodies`} className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
          <div className="text-sm font-semibold">Water bodies map</div>
          <div className="text-xs text-slate-500 mt-1">Interactive Leaflet map of {config.displayName}&apos;s water bodies</div>
        </Link>
        <Link href={`/${cityId}`} className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
          <div className="text-sm font-semibold">{config.displayName} home</div>
          <div className="text-xs text-slate-500 mt-1">Reservoirs, days-of-water-left, Mullaperiyar tracker</div>
        </Link>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-700">
        <p>
          <span className="font-semibold">Methodology:</span> Lost-tank list curated from
          Vencatesan&apos;s academic inventory of dying urban {config.displayName} tanks.
          Flagship cards hand-sourced from Wikipedia, INTACH, India Water Portal, Columbia
          GSAPP&apos;s Water Urbanism studio, IAS Gateway, and news reports - confidence
          flagged per row. Restoration programmes from MMC, TN PWD, Smart City, World Bank,
          and DHAN Vayalagam public materials.
        </p>
      </div>
    </div>
  );
}
