import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// SKELETON - all numbers below are mock placeholders; M2-M4 will wire live data
// from migration 018 tables (reservoir_daily_v2, flow_station_daily,
// basin_rainfall_daily, mettur_release_signal, delta_infrastructure_assets,
// delta_capex_projects). Do not cite these numbers anywhere.

const MOCK_TODAY = "2026-04-25";
const MOCK_JUNE_12 = new Date("2026-06-12");
const daysUntilJune12 = Math.ceil(
  (MOCK_JUNE_12.getTime() - new Date(MOCK_TODAY).getTime()) /
    (1000 * 60 * 60 * 24),
);

const MOCK_METTUR = {
  storageTmc: 47.2,
  pctFrl: 50.5,
  pctReleaseThreshold: 94,
  inflowCusecs: 1420,
  outflowCusecs: 0,
  levelFt: 105.4,
};

const MOCK_KARNATAKA_DAMS = [
  { code: "krs", name: "KRS", storageTmc: 28.1, pctFrl: 56.8 },
  { code: "kabini", name: "Kabini", storageTmc: 11.4, pctFrl: 58.4 },
  { code: "hemavathy", name: "Hemavathy", storageTmc: 16.2, pctFrl: 43.7 },
  { code: "harangi", name: "Harangi", storageTmc: 6.7, pctFrl: 78.8 },
];
const MOCK_KA_TOTAL = MOCK_KARNATAKA_DAMS.reduce(
  (s, d) => s + d.storageTmc,
  0,
);
const MOCK_KA_NORMAL_FOR_DAY = 78.1;

const MOCK_BILIGUNDLU = {
  ytdTmc: 89.3,
  scheduleYtdTmc: 71.2,
  lastUpdated: "2026-04-22",
  sourceMethod: "manual_admin" as const,
};

type ReleaseSignal = "likely" | "uncertain" | "unlikely";
const MOCK_RELEASE_SIGNAL: ReleaseSignal = "likely";

const MOCK_TIMELINE = [
  { id: "kallanai", name: "Kallanai (Grand Anicut)", builtYear: 150, builder: "Karikala Chola" },
  { id: "lower_anicut", name: "Lower Anicut", builtYear: 1836, builder: "Arthur Cotton" },
  { id: "upper_anicut", name: "Upper Anicut (Mukkombu)", builtYear: 1838, builder: "Arthur Cotton", lastRestoredYear: 2024 },
  { id: "mettur_dam", name: "Mettur Dam", builtYear: 1934, builder: "Madras Presidency PWD" },
  { id: "grand_anicut_canal_main", name: "Grand Anicut Canal", builtYear: 1934, builder: "Madras Presidency PWD", lastRestoredYear: 2021 },
];

const MOCK_CAPEX = [
  { id: "iamwarm", scheme: "TN-IAMWARM", year: 2007, financier: "World Bank", crore: 3550 },
  { id: "adb_vennar", scheme: "ADB Vennar Subbasin", year: 2014, financier: "ADB", crore: 725 },
  { id: "mukkombu_rebuild", scheme: "Mukkombu rebuild", year: 2019, financier: "TN State", crore: 410 },
  { id: "grand_anicut_erm", scheme: "Grand Anicut Canal ERM", year: 2021, financier: "NABARD-AIIB", crore: 2639 },
  { id: "cauvery_subbasin", scheme: "Cauvery sub-basin renovation", year: 2022, financier: "TN State + NABARD", crore: 3607 },
];

const SIGNAL_COPY: Record<ReleaseSignal, { label: string; tone: string }> = {
  likely: { label: "Release likely", tone: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border-green-200 dark:border-green-800" },
  uncertain: { label: "Release uncertain", tone: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
  unlikely: { label: "Release unlikely", tone: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800" },
};

function pctBarColor(pct: number): string {
  if (pct > 60) return "bg-green-500";
  if (pct > 30) return "bg-yellow-500";
  if (pct > 15) return "bg-orange-500";
  return "bg-red-500";
}

export default function CauveryPage() {
  const signalCopy = SIGNAL_COPY[MOCK_RELEASE_SIGNAL];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* Region pill + preview banner */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">
          Region: Kaveri Delta · TN/KA
        </Badge>
        <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
          PREVIEW · mock data, not yet live
        </Badge>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Kaveri Water Clock
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-3xl">
          Where do we stand right now in the Kaveri water year? Mettur dam,
          Karnataka 4-dam total, CWMA Biligundlu realisation, and basin
          rainfall - on one page, updated daily.
        </p>
      </header>

      {/* Release countdown banner */}
      <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20">
        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-blue-700 dark:text-blue-400 font-semibold">
              Customary kuruvai release
            </div>
            <div className="text-2xl sm:text-3xl font-bold mt-1">
              T-{daysUntilJune12} days to June 12
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Based on the customary date Mettur opens for delta paddy sowing.
            </div>
          </div>
          <div className={`shrink-0 inline-flex items-center px-4 py-2 rounded-lg border font-semibold text-sm ${signalCopy.tone}`}>
            {signalCopy.label}
            <span className="ml-2 text-xs font-normal opacity-70">view inputs</span>
          </div>
        </CardContent>
      </Card>

      {/* Mettur + Karnataka grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mettur card */}
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Mettur (TN)
              </h2>
              <span className="text-xs text-slate-400">{MOCK_TODAY}</span>
            </div>
            <div className="text-3xl font-bold">
              {MOCK_METTUR.storageTmc.toFixed(1)}
              <span className="text-base font-normal text-slate-400 ml-1">TMC</span>
            </div>
            <div className="text-sm text-slate-500">
              {MOCK_METTUR.pctFrl.toFixed(1)}% of FRL ·
              {" "}{MOCK_METTUR.pctReleaseThreshold}% of release threshold
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${pctBarColor(MOCK_METTUR.pctFrl)}`}
                style={{ width: `${Math.min(MOCK_METTUR.pctFrl, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>In <span className="text-green-600 dark:text-green-400 font-medium">{MOCK_METTUR.inflowCusecs.toLocaleString()}</span> cusecs</span>
              <span>Out <span className="text-red-600 dark:text-red-400 font-medium">{MOCK_METTUR.outflowCusecs.toLocaleString()}</span> cusecs</span>
            </div>
            <div className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold">~45% reaches the field.</span>
              {" "}Of every 100 TMC released into the Grand Anicut Canal, ~45 actually arrives at the farm. Rest is lost in conveyance.
              {" "}<span className="text-slate-400">Source: TN WRD</span>
            </div>
          </CardContent>
        </Card>

        {/* Karnataka 4-dam summary */}
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Karnataka 4-dam total
              </h2>
              <span className="text-xs text-slate-400">{MOCK_TODAY}</span>
            </div>
            <div className="text-3xl font-bold">
              {MOCK_KA_TOTAL.toFixed(1)}
              <span className="text-base font-normal text-slate-400 ml-1">TMC</span>
            </div>
            <div className="text-sm text-slate-500">
              vs {MOCK_KA_NORMAL_FOR_DAY.toFixed(1)} TMC normal for this day
              {" "}
              <span className={MOCK_KA_TOTAL > MOCK_KA_NORMAL_FOR_DAY ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                ({MOCK_KA_TOTAL > MOCK_KA_NORMAL_FOR_DAY ? "+" : ""}{(MOCK_KA_TOTAL - MOCK_KA_NORMAL_FOR_DAY).toFixed(1)})
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {MOCK_KARNATAKA_DAMS.map((d) => (
                <div key={d.code} className="text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span className="font-medium">{d.name}</span>
                    <span>{d.storageTmc.toFixed(1)} TMC</span>
                  </div>
                  <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full rounded-full ${pctBarColor(d.pctFrl)}`}
                      style={{ width: `${Math.min(d.pctFrl, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400">
              [cumulative-vs-normal-year chart placeholder · M2 will wire to KSNDMC daily scrape]
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Biligundlu realisation */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Biligundlu realisation YTD
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {MOCK_BILIGUNDLU.sourceMethod === "manual_admin" ? "manual entry" : "auto scrape"}
              </Badge>
              <span className="text-xs text-slate-400">last {MOCK_BILIGUNDLU.lastUpdated}</span>
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <div className="text-3xl font-bold">
              {MOCK_BILIGUNDLU.ytdTmc.toFixed(1)}
              <span className="text-base font-normal text-slate-400 ml-1">TMC</span>
            </div>
            <div className="text-sm text-slate-500">
              vs CWMA YTD schedule {MOCK_BILIGUNDLU.scheduleYtdTmc.toFixed(1)} TMC
              {" "}
              <span className="text-green-600 dark:text-green-400 font-medium">
                (over by {(MOCK_BILIGUNDLU.ytdTmc - MOCK_BILIGUNDLU.scheduleYtdTmc).toFixed(1)})
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            [monthly bar chart placeholder · M4 will source from CWC bulletin scrape + admin form]
          </div>
          <div className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold">~45% reaches the field.</span>
            {" "}Even when Karnataka delivers above schedule, conveyance loss in the 1934 Grand Anicut Canal cuts the actual on-farm volume nearly in half.
          </div>
        </CardContent>
      </Card>

      {/* Basin rainfall */}
      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Cauvery basin rainfall
          </h2>
          <div className="text-xs text-slate-400">
            [SW + NE cumulative vs LPA chart placeholder · M3 will source from IMD daily + CHIRPS GEE backup]
          </div>
        </CardContent>
      </Card>

      {/* Delta timeline (V1 anchor) */}
      <Card>
        <CardContent className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              When was this built?
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Every brick load-bearing the delta was placed before TV came to India. Post-1947 capital is rehabilitation, not new build.
            </p>
          </div>
          <div className="space-y-2">
            {MOCK_TIMELINE.map((asset) => (
              <div key={asset.id} className="flex items-center gap-3 text-sm">
                <div className="w-24 sm:w-32 shrink-0 font-mono text-xs text-slate-500">
                  {asset.builtYear < 1000 ? `${asset.builtYear} CE` : asset.builtYear}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-700 dark:text-slate-300">{asset.name}</div>
                  <div className="text-xs text-slate-500">
                    {asset.builder}
                    {asset.lastRestoredYear && ` · restored ${asset.lastRestoredYear}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
              Post-1947 capital (rehabilitation only)
            </div>
            <div className="space-y-1">
              {MOCK_CAPEX.map((c) => (
                <div key={c.id} className="flex items-center gap-3 text-xs">
                  <div className="w-24 sm:w-32 shrink-0 font-mono text-slate-500">{c.year}</div>
                  <div className="flex-1 text-slate-600 dark:text-slate-400">
                    <span className="font-medium">{c.scheme}</span>
                    <span className="text-slate-500"> · {c.financier} · Rs {c.crore.toLocaleString()} cr</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer notes */}
      <div className="text-xs text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
        <p>
          <span className="font-semibold">Methodology:</span> Mettur from TN WRD daily bulletin; Karnataka 4-dam from KSNDMC; Biligundlu from CWMA monthly schedule + manual entry during distress; basin rainfall from IMD with CHIRPS backup.
        </p>
        <p>
          <span className="font-semibold">Status:</span> Skeleton preview. M2 wires Mettur + KSNDMC ingestion; M3 wires basin rainfall; M4 wires Biligundlu + release signal model; M5 ships embeds and the timeline visual; M6 launches.
        </p>
        <p className="text-slate-400">
          See <code className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">docs/kaveri-water-clock-plan.md</code> for the full plan.
        </p>
      </div>
    </div>
  );
}
