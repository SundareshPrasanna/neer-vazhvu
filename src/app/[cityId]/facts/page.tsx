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
  if (!config) return { title: "Facts | Neer Vazhvu" };
  return {
    title: `${config.displayName} Water Facts | Neer Vazhvu`,
    description: `Journalist-ready quotable stats for ${config.displayName}'s water state - reservoirs, groundwater, water bodies, governance.`,
    alternates: { canonical: `/${cityId}/facts` },
  };
}

interface FactRow {
  id: string;
  tier: 1 | 2 | 3 | 4;
  category: string;
  title: string;
  value: string;
  unit: string;
  interpretation: string;
  data_date: string;
  source_url: string;
  source_label: string;
}

interface FactsFile {
  generated_at: string;
  facts: FactRow[];
}

async function loadFacts(cityId: string): Promise<FactsFile | null> {
  try {
    const text = await fs.readFile(
      path.join(process.cwd(), "public", "data", `facts-${cityId}.json`),
      "utf-8",
    );
    return JSON.parse(text) as FactsFile;
  } catch {
    return null;
  }
}

const TIER_LABEL: Record<FactRow["tier"], string> = {
  1: "Live · this season",
  2: "Recent · last 12 months",
  3: "Historical · documented",
  4: "Heritage · pre-modern",
};

const TIER_TONE: Record<FactRow["tier"], string> = {
  1: "border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20",
  2: "border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/15",
  3: "border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/15",
  4: "border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/30",
};

const CATEGORY_TONE: Record<string, string> = {
  "Reservoirs":     "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200",
  "Groundwater":    "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200",
  "Water bodies":   "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200",
  "Heritage":       "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200",
  "Governance":     "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200",
  "Sewerage":       "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200",
  "Restoration":    "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200",
  "Administration": "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200",
};

function FactCard({ fact }: { fact: FactRow }) {
  const tone = CATEGORY_TONE[fact.category] ?? CATEGORY_TONE["Administration"];
  return (
    <div className={`border rounded-lg p-4 ${TIER_TONE[fact.tier]}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded ${tone}`}>
          {fact.category}
        </span>
        {fact.data_date && (
          <span className="text-[10px] font-mono text-slate-500">{fact.data_date}</span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{fact.title}</h3>
      <div className="flex items-baseline gap-1.5 mt-1.5">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {fact.value}
        </span>
        {fact.unit && (
          <span className="text-sm text-slate-500 dark:text-slate-400">{fact.unit}</span>
        )}
      </div>
      <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
        {fact.interpretation}
      </p>
      {fact.source_url && (
        <a
          href={fact.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
        >
          {fact.source_label} →
        </a>
      )}
    </div>
  );
}

export default async function CityFactsPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  const factsFile = await loadFacts(cityId);
  if (!factsFile) {
    return (
      <FeatureNotYetAvailable
        config={config}
        feature="Water facts"
        scope="city-admin"
        parityVerdict="MEDIUM"
        whatItShowsForChennai="quotable findings derived from reservoirs, groundwater, rivers, water bodies, and demographics - tagged by category, tier, and source for journalists"
        dataGapNote="No curated facts file for this city yet."
        relatedLinks={[
          { href: `/${cityId}`, label: `${config.displayName} home` },
          { href: `/${cityId}/groundwater`, label: "Groundwater stress map" },
        ]}
      />
    );
  }

  const byTier: Record<FactRow["tier"], FactRow[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const f of factsFile.facts) byTier[f.tier].push(f);
  const tierOrder: FactRow["tier"][] = [1, 2, 3, 4];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">{config.displayName} · Facts</Badge>
        <Badge variant="outline" className="text-xs">{factsFile.facts.length} sourced stats</Badge>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {config.displayName} water facts
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-3xl">
          Journalist-ready snapshot of {config.displayName}&apos;s water state.
          Every number dated, sourced, and grouped by data freshness. Click
          any source link to jump to the underlying report or page.
        </p>
      </header>

      {tierOrder.map((tier) => {
        const facts = byTier[tier];
        if (facts.length === 0) return null;
        return (
          <section key={tier} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Tier {tier} · {TIER_LABEL[tier]}
              </h2>
              <span className="text-xs text-slate-400">{facts.length} facts</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {facts.map((f) => <FactCard key={f.id} fact={f} />)}
            </div>
          </section>
        );
      })}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <Link href={`/${cityId}`} className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 transition-colors">
          <div className="text-sm font-semibold">{config.displayName} home</div>
          <div className="text-xs text-slate-500 mt-1">Reservoir narrative + days-of-water-left</div>
        </Link>
        <Link href={`/${cityId}/groundwater`} className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 transition-colors">
          <div className="text-sm font-semibold">Groundwater map</div>
          <div className="text-xs text-slate-500 mt-1">11 CGWB blocks · 194 stations</div>
        </Link>
        <Link href={`/${cityId}/lake-restoration`} className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 transition-colors">
          <div className="text-sm font-semibold">Lake restoration</div>
          <div className="text-xs text-slate-500 mt-1">Lost tanks, flagships, programmes, court anchor</div>
        </Link>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-700">
        <p>
          <span className="font-semibold">Tiers:</span> 1 = live this season
          (changes month-to-month); 2 = recent (last 12 months); 3 = documented
          historical record; 4 = heritage / pre-modern. Generated{" "}
          {factsFile.generated_at}. Replaced with a runtime fact-builder when
          the M3 data layers (CPCB river quality, ward profiles, satellite
          time series) ship.
        </p>
      </div>
    </div>
  );
}
