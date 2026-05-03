import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadMaduraiSnapshot, type ReservoirReadingV2 } from "./data";

// Re-fetch every 15 minutes (matches /cauvery and /api/reservoir cache TTL).
export const revalidate = 900;

// Mock data is used until live ingestion lands. M1 wires Vaigai + Mullaperiyar
// from tnagriculture.in (Periyar listing); a separate Kerala SDMA scraper
// adds Mullaperiyar's Kerala-side reading. Sothuparai is a known data gap
// (PWD WRD daily memo only, not on TN Agri).

const MOCK_TODAY = "2026-05-03";

const MOCK_VAIGAI: ReservoirReadingV2 = {
  city_id: "madurai",
  source_code: "vaigai",
  date: MOCK_TODAY,
  storage_tmc: 2.1,
  storage_pct_frl: 34.2,
  level_ft: 48.6,
  inflow_cusecs: 220,
  outflow_cusecs: 180,
  source: "mock",
};

const MOCK_MULLAPERIYAR_TN: ReservoirReadingV2 = {
  city_id: "madurai",
  source_code: "mullaperiyar",
  date: MOCK_TODAY,
  storage_tmc: 7.4,
  storage_pct_frl: 47.3,
  level_ft: 134.0,
  inflow_cusecs: 380,
  outflow_cusecs: 410,
  source: "mock",
};

// Mock Kerala-SDMA reading for the same dam (for the dual-source story).
// In Kerala SDMA's data the storage cap is 142 ft (post 2014 SC ruling),
// so the same physical depth shows a different "% of FRL" than the TN side
// where 152 ft is used historically. M1 wires this as a real diff.
const MOCK_MULLAPERIYAR_KE = {
  level_ft: 134.0,
  pct_frl_ke_142: Math.round((134.0 / 142.0) * 1000) / 10,
  source: "mock",
};

const MOCK_SOTHUPARAI: ReservoirReadingV2 = {
  city_id: "madurai",
  source_code: "sothuparai",
  date: MOCK_TODAY,
  storage_tmc: 0.18,
  storage_pct_frl: 41.0,
  level_ft: null,
  inflow_cusecs: null,
  outflow_cusecs: null,
  source: "mock",
};

// Mullaperiyar alert protocol (Kerala SDMA, post-SC 2014 ruling).
const MULLAPERIYAR_ALERTS = [
  { ft: 136, label: "Warning", tone: "text-yellow-600 dark:text-yellow-400" },
  { ft: 138, label: "Orange", tone: "text-orange-600 dark:text-orange-400" },
  { ft: 140, label: "Red", tone: "text-red-600 dark:text-red-400" },
  { ft: 142, label: "FRL", tone: "text-red-700 dark:text-red-300 font-semibold" },
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

function fmtNum(n: number | null, digits = 1): string {
  if (n === null || isNaN(n)) return "-";
  return n.toFixed(digits);
}

function fmtInt(n: number | null): string {
  if (n === null || isNaN(n)) return "-";
  return Math.round(n).toLocaleString();
}

export default async function MaduraiPage() {
  const snapshot = await loadMaduraiSnapshot();

  const vaigai = snapshot.vaigai ?? MOCK_VAIGAI;
  const mullaperiyar = snapshot.mullaperiyar ?? MOCK_MULLAPERIYAR_TN;
  const sothuparai = snapshot.sothuparai ?? MOCK_SOTHUPARAI;
  const reservoirIsLive = snapshot.reservoirIsLive;
  const dataDate = snapshot.asOf ?? MOCK_TODAY;

  // Days-of-water-left from Vaigai live storage at the city's share of supply.
  // Vaigai serves Madurai plus a much larger irrigation command. We model only
  // the city's drinking-water share (~80 MLD of 135 MLD total demand).
  // 1 Mcft ~ 28.3168 ML. Live storage in Mcft = (storage_tmc * 1000).
  const vaigaiMcft = vaigai.storage_tmc !== null ? vaigai.storage_tmc * 1000 : null;
  const vaigaiMl = vaigaiMcft !== null ? vaigaiMcft * 28.3168 : null;
  const daysOfCityShare =
    vaigaiMl !== null ? Math.round(vaigaiMl / MADURAI_VAIGAI_SHARE_MLD) : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* Place pill + preview banner */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">
          City: Madurai · TN
        </Badge>
        <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
          PREVIEW · M0 skeleton, mock data
        </Badge>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Madurai Water Clock
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-3xl">
          Where does Madurai stand right now? Vaigai dam, Mullaperiyar (the
          1886-leased Kerala-side source that supplies most of Vaigai's inflow),
          and Sothuparai - one page, updated daily.
        </p>
      </header>

      {/* Days-of-water-left for the city (Vaigai share only) */}
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

      {/* Vaigai + Mullaperiyar grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Vaigai card */}
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Vaigai (TN, Theni district)
              </h2>
              <span className="text-xs text-slate-400">
                {dataDate}
                {!reservoirIsLive && <span className="ml-1 text-amber-600">(mock)</span>}
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
              {" "}Vaigai's natural catchment is 2,253 sq km but its drinking-water yield
              depends on the Periyar tunnel. Rainfall over the Vaigai basin alone
              underrepresents available water.
            </div>
          </CardContent>
        </Card>

        {/* Mullaperiyar card with TN/Kerala dual reading */}
        <Card className="border-amber-200 dark:border-amber-900">
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Mullaperiyar (Kerala, TN-operated)
              </h2>
              <span className="text-xs text-slate-400">
                {dataDate}
                {!reservoirIsLive && <span className="ml-1 text-amber-600">(mock)</span>}
              </span>
            </div>
            <div className="text-3xl font-bold">
              {fmtNum(mullaperiyar.level_ft)}
              <span className="text-base font-normal text-slate-400 ml-1">ft</span>
            </div>
            <div className="text-sm text-slate-500">
              TN reading: {fmtNum(mullaperiyar.storage_pct_frl)}% of 152 ft
              {" "}· Kerala reading: {fmtNum(MOCK_MULLAPERIYAR_KE.pct_frl_ke_142)}% of 142 ft
            </div>
            <div className="grid grid-cols-4 gap-1 mt-2 text-[10px]">
              {MULLAPERIYAR_ALERTS.map((a) => {
                const reached = mullaperiyar.level_ft !== null && mullaperiyar.level_ft >= a.ft;
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
              {" "}Periyar Lake Lease Indenture between the Maharaja of Travancore
              and the Secretary of State for India. Kerala caps storage at
              142 ft per Supreme Court 2014; TN-side records preserve 152 ft FRL.
              Both readings are tracked here.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sothuparai mini card */}
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
              <span className="text-xs text-amber-600">mock</span>
              <span className="text-xs text-slate-400">{dataDate}</span>
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <div className="text-2xl font-bold">
              {fmtNum(sothuparai.storage_tmc, 2)}
              <span className="text-base font-normal text-slate-400 ml-1">TMC</span>
            </div>
            <div className="text-sm text-slate-500">
              {fmtNum(sothuparai.storage_pct_frl)}% of FRL
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Sothuparai dam (Periyakulam taluk, Varaha river) feeds the Vaigai
            command. Not on tnagriculture.in - we cannot scrape it. M1 ships
            Vaigai + Mullaperiyar; Sothuparai stays mock until a PWD memo
            scraper or RTI dump becomes feasible.
          </div>
        </CardContent>
      </Card>

      {/* Basin rainfall placeholder (M2) */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Vaigai basin rainfall
            </h2>
            <span className="text-xs text-amber-600">M2</span>
          </div>
          <div className="text-xs text-slate-500">
            Vaigai basin spans 7,009 sq km across Theni / Dindigul / Madurai /
            Sivagangai / Ramanathapuram. Long-period average for Vaigai-only
            isn't a clean published number; M2 computes 1991-2020 climatology
            from imdlib over the India-WRIS basin polygon and pairs it with
            OpenMeteo daily rainfall area-averaged across the basin. Mullaperiyar
            catchment (~624 sq km, Kerala side) is tracked separately to capture
            the trans-basin tunnel contribution.
          </div>
        </CardContent>
      </Card>

      {/* Footer notes */}
      <div className="text-xs text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
        <p>
          <span className="font-semibold">Methodology (planned):</span> Vaigai
          and Mullaperiyar TN-side reading from TN Agri ARS bulletin via
          tnagriculture.in (same scraper as Mettur for Cauvery); Mullaperiyar
          Kerala-side reading from Kerala SDMA daily dam-level page; Vaigai
          basin rainfall from OpenMeteo (ERA5-Land) area-averaged across the
          India-WRIS Vaigai polygon.
        </p>
        <p>
          <span className="font-semibold">Status:</span> M0 skeleton only.
          M1 wires reservoir scrapes (Vaigai + Mullaperiyar); M2 wires basin
          rainfall + groundwater + IMD; M3 wires Vaigai river quality, water
          bodies, and the temple-tank satellite series; M4 decouples Chennai
          hardcoding and ships AI narratives for Madurai.
        </p>
        <p className="text-slate-400">
          See <code className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">memory/madurai_parity_research.md</code> for the full data inventory.
        </p>
      </div>
    </div>
  );
}
