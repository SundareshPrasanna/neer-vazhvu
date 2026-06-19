"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n/context";

export interface LostBody {
  name: string;
  status: "Fully lost" | "Severely reduced" | "Partially encroached";
  side: string;
  note: string;
}

export interface LostFile {
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

export interface FlagshipBody {
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

export interface FlagshipFile {
  bodies: FlagshipBody[];
}

export interface ProjectEntry {
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

export interface CourtOrder {
  case: string;
  writ_petition: string;
  court: string;
  date: string;
  directive: string;
  specific_tanks: string[];
  concern: string;
  source: string;
}

export interface ProjectsFile {
  projects: ProjectEntry[];
  court_orders: CourtOrder[];
}

type PriorityLevel = "critical" | "high" | "moderate" | "low";

export interface ScoredBody {
  name: string;
  priority_score: number;
  priority_level: PriorityLevel;
  rationale: string;
}

export interface RestorationPriorityFile {
  generated_at: string;
  algorithm_version: string;
  total_scored: number;
  bodies: ScoredBody[];
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

const PRIORITY_TONE: Record<PriorityLevel, string> = {
  critical: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700",
  high:     "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-700",
  moderate: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700",
  low:      "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700",
};

interface Props {
  cityId: string;
  cityDisplayName: string;
  lostFile: LostFile;
  flagshipFile: FlagshipFile;
  projectsFile: ProjectsFile;
  priorityFile: RestorationPriorityFile | null;
}

export function LakeRestorationContent({
  cityId,
  cityDisplayName,
  lostFile,
  flagshipFile,
  projectsFile,
  priorityFile,
}: Props) {
  const { t } = useLanguage();

  const priorityByName = new Map<string, ScoredBody>();
  for (const b of priorityFile?.bodies ?? []) priorityByName.set(b.name, b);

  const lost = lostFile.lost_bodies;
  const fullyLost = lost.filter((b) => b.status === "Fully lost");
  const reduced = lost.filter((b) => b.status !== "Fully lost");

  const confidenceLabel = (c: FlagshipBody["confidence"]) =>
    c === "V" ? t("lake.confidence_v") : c === "N" ? t("lake.confidence_n") : t("lake.confidence_c");
  const priorityLabel = (p: PriorityLevel) =>
    p === "critical" ? t("lake.priority_critical")
    : p === "high"   ? t("lake.priority_high")
    : p === "moderate" ? t("lake.priority_moderate")
    : t("lake.priority_low");

  // Render the Madurai-specific intro paragraph by interpolating numbers
  // into the bilingual template.
  const introTpl = t("lake.intro_template_madurai");
  const introText = introTpl
    .replace("{fully_lost}", String(lostFile.summary.fully_lost_count))
    .replace("{reduced}", String(lostFile.summary.severely_reduced_count))
    .replace("{area}", String(lostFile.summary.combined_area_lost_sqkm_estimate))
    .replace("{pct}", String(lostFile.summary.share_of_city_estimate_pct))
    .replace("{households}", lostFile.summary.slum_households_on_former_tank_beds_estimate.toLocaleString());

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">{cityDisplayName} - {t("lake.badge_scope")}</Badge>
        <Badge variant="outline" className="text-xs">{t("lake.badge_district")}</Badge>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {cityDisplayName} {t("lake.heading_suffix")}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-3xl">
          {introText}
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent>
          <div className="text-xs uppercase tracking-wider text-slate-500">{t("lake.card_fully_lost")}</div>
          <div className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">{fullyLost.length}</div>
          <div className="text-xs text-slate-500">{t("lake.card_fully_lost_sub")}</div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="text-xs uppercase tracking-wider text-slate-500">{t("lake.card_at_risk")}</div>
          <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-1">{reduced.length}</div>
          <div className="text-xs text-slate-500">{t("lake.card_at_risk_sub")}</div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="text-xs uppercase tracking-wider text-slate-500">{t("lake.card_flagships")}</div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{flagshipFile.bodies.length}</div>
          <div className="text-xs text-slate-500">{t("lake.card_flagships_sub")}</div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="text-xs uppercase tracking-wider text-slate-500">{t("lake.card_programmes")}</div>
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{projectsFile.projects.length}</div>
          <div className="text-xs text-slate-500">{t("lake.card_programmes_sub")}</div>
        </CardContent></Card>
      </div>

      {projectsFile.court_orders.map((order) => (
        <Card key={order.writ_petition} className="border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <Badge variant="outline" className="text-[10px] uppercase">{t("lake.court_order")}</Badge>
              <span className="text-xs text-slate-500">{order.date}</span>
              <span className="text-xs font-mono text-slate-500">{order.writ_petition}</span>
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{order.case}</h2>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              <span className="font-semibold">{order.court}</span> {t("lake.directed_to")}{" "}
              {order.directive}. {t("lake.petition_filed")}{" "}
              <span className="italic">{order.concern}</span> {t("lake.at_word")}{" "}
              {order.specific_tanks.join(", ")}.
            </p>
            <a href={order.source} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
              {t("lake.lawbeat_coverage")} →
            </a>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t("lake.programmes_heading")} {cityDisplayName} - {projectsFile.projects.length}
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
                        {t("lake.partnership_target")}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {p.operator}
                  {p.financier && p.financier !== p.operator && ` - ${t("lake.financier")}: ${p.financier}`}
                  {p.sanctioned_year && ` - ${t("lake.sanctioned")} ${p.sanctioned_year}`}
                  {p.completed_year && ` - ${t("lake.completed")} ${p.completed_year}`}
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

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t("lake.flagship_heading")} - {flagshipFile.bodies.length}
            {priorityFile && (
              <span className="text-[10px] font-normal normal-case text-slate-400 ml-2">
                ({t("lake.flagship_sort_note")} - {priorityFile.algorithm_version})
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
                          {priorityLabel(score.priority_level)} - {score.priority_score}
                        </span>
                      )}
                    </div>
                    {wb.alternate_names && wb.alternate_names.length > 0 && (
                      <div className="text-[10px] text-slate-500 italic mt-0.5">also: {wb.alternate_names.join(", ")}</div>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] font-mono uppercase opacity-70">{confidenceLabel(wb.confidence)}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-1.5 text-[11px]">
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{wb.type.replace(/_/g, " ")}</span>
                  {wb.year_built && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{t("lake.built_label")} {wb.year_built}</span>}
                  {wb.era && !wb.year_built && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{wb.era}</span>}
                  {wb.area_acres && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{wb.area_acres} {t("lake.acres_label")}</span>}
                  {wb.capacity_mcft && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{wb.capacity_mcft} Mcft</span>}
                  {wb.capacity_tmc && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{wb.capacity_tmc} TMC</span>}
                  {wb.biodiversity_heritage_site && <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">{t("lake.bhs_label")}</span>}
                  {wb.ramsar_proposed_date && <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{t("lake.ramsar_proposed")} {wb.ramsar_proposed_date}</span>}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-2">{wb.status}</p>
                {wb.builder && <p className="text-[11px] text-slate-500 mt-1">{t("lake.builder_label")} {wb.builder}{wb.feed && ` - ${t("lake.fed_by")} ${wb.feed}`}</p>}
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
              {t("lake.priority_legend")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t("lake.fully_lost_heading")} - {fullyLost.length}
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
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{b.side} {t("lake.side_label")}</div>
                {b.note && <div className="text-xs text-slate-500 mt-1">{b.note}</div>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t("lake.surviving_heading")} - {reduced.length}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href={`/${cityId}/water-bodies`} className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
          <div className="text-sm font-semibold">{t("lake.cross_water_bodies")}</div>
          <div className="text-xs text-slate-500 mt-1">{t("lake.cross_water_bodies_desc")}</div>
        </Link>
        <Link href={`/${cityId}`} className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
          <div className="text-sm font-semibold">{cityDisplayName} {t("lake.cross_home")}</div>
          <div className="text-xs text-slate-500 mt-1">{t("lake.cross_home_desc")}</div>
        </Link>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-700">
        <p>
          <span className="font-semibold">{t("lake.methodology")}</span>{" "}
          {t("lake.methodology_text")}
        </p>
      </div>
    </div>
  );
}
