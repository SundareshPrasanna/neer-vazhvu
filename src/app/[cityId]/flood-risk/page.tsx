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
  if (!config) return { title: "Flood Risk | Neer Vazhvu" };
  return {
    title: `${config.displayName} Flood Risk | Neer Vazhvu`,
    description: `Vaigai dam release thresholds, historical floods, and external monitoring sources for ${config.displayName}.`,
    alternates: { canonical: `/${cityId}/flood-risk` },
  };
}

interface HistoricalEvent {
  year: number;
  trigger: string;
  impact: string;
  source_url: string;
  source_label: string;
}

interface ExternalSource {
  name: string;
  description: string;
  url: string;
  cadence: string;
}

interface FloodConfig {
  /** Headline narrative for the page hero */
  headline: string;
  /** Dam-release threshold story */
  dam_release_threshold_cusecs: number;
  dam_release_note: string;
  historical_events: HistoricalEvent[];
  external_sources: ExternalSource[];
  data_gaps: string[];
}

const FLOOD_CONFIG_BY_CITY: Record<string, FloodConfig> = {
  madurai: {
    headline:
      "Madurai's flood risk is dam-release-driven, not rainfall-driven. The Vaigai's natural catchment is small (2,253 sq km); urban inundation tracks Vaigai-dam outflows on a 12-24 hour lag. There is no public CFM-DSS-equivalent sensor mesh - upstream context comes from CWC and the dam-level scrape.",
    dam_release_threshold_cusecs: 6000,
    dam_release_note:
      "~6,000 cusec releases from Vaigai dam saturate the downtown channel between Albert Victor bridge and Anuppanadi. Below this threshold the Vaigai bed absorbs the flow; above it, low-lying wards (Sellur, Avaniyapuram, Anuppanadi) start flooding.",
    historical_events: [
      {
        year: 2023,
        trigger: "6,000 cusec release from Vaigai dam during NE monsoon",
        impact:
          "Downtown Madurai inundated; Avaniyapuram and Sellur worst-hit; release coincided with peak rainfall in the catchment.",
        source_url:
          "https://www.thehindu.com/news/cities/Madurai/madurai-flooded-after-vaigai-dam-water-release/article67517428.ece",
        source_label: "The Hindu (Nov 2023)",
      },
      {
        year: 2018,
        trigger: "Sustained NE monsoon + Periyar tunnel diversions",
        impact:
          "Significant Vaigai-bed inundation; upstream-tank cascade overflow into peri-urban kanmoi.",
        source_url:
          "https://www.sciencedirect.com/science/article/abs/pii/S0045653521020439",
        source_label: "ScienceDirect (Vaigai flood-frequency analysis)",
      },
    ],
    external_sources: [
      {
        name: "CWC Flood Forecast Dashboard",
        url: "https://cwc.gov.in/ffm_dashboard",
        description:
          "Central Water Commission dam-gauge readings including Vaigai (Andipatti). Live during NE monsoon; the single best public flood signal.",
        cadence: "live",
      },
      {
        name: "CWC Tamil Nadu basin portal",
        url: "https://ffs.tamcnhp.com/",
        description: "Vaigai basin gauging stations, river-stage forecasts.",
        cadence: "live",
      },
      {
        name: "TNSDMA hazard map",
        url: "https://tnsdma.tn.gov.in/app/webroot/tnsdma_map/",
        description: "State-level rainfall + flood-zone overlay (low resolution).",
        cadence: "live",
      },
      {
        name: "Madurai Master Plan 2024-2044",
        url: "https://www.madurailpa.com/assets/pdf/Final%20Madurai%20-%20Vol%201%20-%20Print.pdf",
        description:
          "Land-use plan with flood-prone area mapping. Image-heavy PDF - needs OCR + manual digitisation to extract polygons.",
        cadence: "static (2024-2044 horizon)",
      },
      {
        name: "Smart City Madurai ICCC",
        url: "https://iccc.smartcities.gov.in/icc/city-details/c44058eab38fd0805b98b267e8f831a5",
        description:
          "Integrated Command Control Centre - city water-supply monitoring. Public flood EWS not exposed.",
        cadence: "internal-only",
      },
    ],
    data_gaps: [
      "No CFM-DSS-equivalent sensor mesh (Chennai has ARG/AWS/AWLR/gate sensor network; Madurai does not)",
      "No public flood hazard zone GeoJSON (5/10/25/50/100/200-year return period polygons)",
      "No public 2018/2023 hotspot inventory (RTI-needed from MMC)",
      "Flood inundation depth raster - not modeled publicly for Madurai",
    ],
  },
};

export default async function CityFloodRiskPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  const cfg = FLOOD_CONFIG_BY_CITY[cityId];
  if (!cfg) {
    return (
      <FeatureNotYetAvailable
        config={config}
        feature="Flood risk"
        scope="basin-system"
        parityVerdict="HARD"
        whatItShowsForChennai="modeled flood hazard zones (5/10/25/50/100/200-year), 2015 + 2020 hotspots, drainage + sewerage overlays"
        dataGapNote="No flood-config data for this city yet."
        relatedLinks={[
          { href: `/${cityId}`, label: `${config.displayName} home` },
          { href: `/${cityId}/groundwater`, label: "Groundwater stress map" },
        ]}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">{config.displayName} · Flood risk</Badge>
        <Badge variant="outline" className="text-xs">Vaigai system scope</Badge>
        <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
          No public hazard map - external monitoring only
        </Badge>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {config.displayName} flood risk
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-3xl">
          {cfg.headline}
        </p>
      </header>

      {/* Dam release threshold - the headline insight */}
      <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20">
        <CardContent className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-blue-700 dark:text-blue-400 font-semibold">
            Dam-release threshold for downtown inundation
          </div>
          <div className="text-3xl sm:text-4xl font-bold tracking-tight">
            ~{cfg.dam_release_threshold_cusecs.toLocaleString()}
            <span className="text-base font-normal text-slate-400 ml-1">cusecs</span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {cfg.dam_release_note}
          </p>
        </CardContent>
      </Card>

      {/* Historical events */}
      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Recent flood events · {cfg.historical_events.length}
          </h2>
          <div className="space-y-3">
            {cfg.historical_events.map((e) => (
              <div key={`${e.year}-${e.trigger.slice(0, 20)}`} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100">{e.year}</span>
                  <span className="text-xs text-slate-500">{e.trigger}</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">{e.impact}</p>
                <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline inline-block mt-2">
                  {e.source_label} →
                </a>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* External monitoring sources */}
      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            External monitoring sources · {cfg.external_sources.length}
          </h2>
          <p className="text-xs text-slate-500">
            We don&apos;t republish these; tracking dam-gauge live state lives elsewhere.
            These are the operational portals to use during a flood event.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cfg.external_sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block border border-slate-200 dark:border-slate-700 rounded-lg p-3 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{s.name}</span>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">{s.cadence}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{s.description}</p>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Honest data gaps */}
      <Card>
        <CardContent className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            What we don&apos;t have for {config.displayName}
          </h2>
          <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-300 space-y-1">
            {cfg.data_gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
          <p className="text-xs text-slate-500 italic mt-2">
            Chennai&apos;s /flood-risk page renders modeled hazard zones, 2015/2020 hotspots,
            drainage and sewerage overlays - none of which exist publicly for Madurai. This
            page surfaces what&apos;s actually available rather than papering over the gap
            with synthetic data.
          </p>
        </CardContent>
      </Card>

      {/* Cross-links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href={`/${cityId}`} className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 transition-colors">
          <div className="text-sm font-semibold">{config.displayName} home</div>
          <div className="text-xs text-slate-500 mt-1">Vaigai dam current storage + Mullaperiyar tracker</div>
        </Link>
        <Link href={`/${cityId}/rivers`} className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 transition-colors">
          <div className="text-sm font-semibold">Vaigai river system</div>
          <div className="text-xs text-slate-500 mt-1">5 rivers in scope · click for upstream/downstream context</div>
        </Link>
        <Link href={`/${cityId}/water-bodies`} className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 transition-colors">
          <div className="text-sm font-semibold">Water bodies map</div>
          <div className="text-xs text-slate-500 mt-1">Tank cascades that buffer (or amplify) inundation</div>
        </Link>
      </div>
    </div>
  );
}
