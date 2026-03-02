import type { ReservoirSummary, ReservoirName } from "@/types/reservoir";
import type { GroundwaterApiResponse } from "@/types/groundwater";

// ============================================================
// SCENARIOS — switch between these to see different UI states
// ============================================================

export type ScenarioKey = "post_monsoon" | "summer_stress" | "day_zero" | "recovery";

export interface MockScenario {
  label: string;
  description: string;
  reservoirs: ReservoirSummary[];
  recentAvgInflowMcftPerDay: number;
  seasonalAvgInflowMcftPerDay: number;
  comparison2019Storage: number | null;
  historyStyle: "healthy" | "declining" | "crisis" | "recovering";
}

export const SCENARIOS: Record<ScenarioKey, MockScenario> = {
  // Scenario 1: Post-monsoon — reservoirs full, everything green
  post_monsoon: {
    label: "Post-Monsoon (Dec)",
    description: "After northeast monsoon — reservoirs full, healthy groundwater",
    reservoirs: [
      { name: "poondi", displayName: "Poondi", currentStorage: 2845, capacity: 3231, storagePct: 88.1, inflowCusecs: 234, outflowCusecs: 180, rainfallMm: 12 },
      { name: "cholavaram", displayName: "Cholavaram", currentStorage: 756, capacity: 881, storagePct: 85.8, inflowCusecs: 45, outflowCusecs: 30, rainfallMm: 8 },
      { name: "redhills", displayName: "Red Hills (Puzhal)", currentStorage: 2805, capacity: 3300, storagePct: 85.0, inflowCusecs: 178, outflowCusecs: 200, rainfallMm: 10 },
      { name: "chembarambakkam", displayName: "Chembarambakkam", currentStorage: 3100, capacity: 3645, storagePct: 85.0, inflowCusecs: 156, outflowCusecs: 150, rainfallMm: 15 },
    ],
    recentAvgInflowMcftPerDay: 45.0,
    seasonalAvgInflowMcftPerDay: 38.0,
    comparison2019Storage: 4200,
    historyStyle: "healthy",
  },

  // Scenario 2: Summer stress — May/June, reservoirs declining fast
  summer_stress: {
    label: "Summer Stress (May)",
    description: "Peak summer — no rain, reservoirs dropping, groundwater strained",
    reservoirs: [
      { name: "poondi", displayName: "Poondi", currentStorage: 420, capacity: 3231, storagePct: 13.0, inflowCusecs: 0, outflowCusecs: 85, rainfallMm: 0 },
      { name: "cholavaram", displayName: "Cholavaram", currentStorage: 98, capacity: 881, storagePct: 11.1, inflowCusecs: 0, outflowCusecs: 25, rainfallMm: 0 },
      { name: "redhills", displayName: "Red Hills (Puzhal)", currentStorage: 580, capacity: 3300, storagePct: 17.6, inflowCusecs: 0, outflowCusecs: 120, rainfallMm: 0 },
      { name: "chembarambakkam", displayName: "Chembarambakkam", currentStorage: 310, capacity: 3645, storagePct: 8.5, inflowCusecs: 0, outflowCusecs: 100, rainfallMm: 0 },
    ],
    recentAvgInflowMcftPerDay: 0,
    seasonalAvgInflowMcftPerDay: 2.1,
    comparison2019Storage: 890,
    historyStyle: "declining",
  },

  // Scenario 3: Day Zero — 2019 crisis recreation
  day_zero: {
    label: "Day Zero Crisis (Jun 2019)",
    description: "Reservoirs nearly empty — the 2019 water emergency",
    reservoirs: [
      { name: "poondi", displayName: "Poondi", currentStorage: 5, capacity: 3231, storagePct: 0.15, inflowCusecs: 0, outflowCusecs: 0, rainfallMm: 0 },
      { name: "cholavaram", displayName: "Cholavaram", currentStorage: 2, capacity: 881, storagePct: 0.23, inflowCusecs: 0, outflowCusecs: 0, rainfallMm: 0 },
      { name: "redhills", displayName: "Red Hills (Puzhal)", currentStorage: 8, capacity: 3300, storagePct: 0.24, inflowCusecs: 0, outflowCusecs: 0, rainfallMm: 0 },
      { name: "chembarambakkam", displayName: "Chembarambakkam", currentStorage: 4, capacity: 3645, storagePct: 0.11, inflowCusecs: 0, outflowCusecs: 0, rainfallMm: 0 },
    ],
    recentAvgInflowMcftPerDay: 0,
    seasonalAvgInflowMcftPerDay: 0.5,
    comparison2019Storage: 19,
    historyStyle: "crisis",
  },

  // Scenario 4: Recovery — monsoon just started, reservoirs beginning to fill
  recovery: {
    label: "Early Recovery (Oct)",
    description: "First monsoon rains — reservoirs slowly filling, hope returns",
    reservoirs: [
      { name: "poondi", displayName: "Poondi", currentStorage: 890, capacity: 3231, storagePct: 27.5, inflowCusecs: 450, outflowCusecs: 100, rainfallMm: 35 },
      { name: "cholavaram", displayName: "Cholavaram", currentStorage: 210, capacity: 881, storagePct: 23.8, inflowCusecs: 120, outflowCusecs: 40, rainfallMm: 28 },
      { name: "redhills", displayName: "Red Hills (Puzhal)", currentStorage: 1100, capacity: 3300, storagePct: 33.3, inflowCusecs: 380, outflowCusecs: 150, rainfallMm: 42 },
      { name: "chembarambakkam", displayName: "Chembarambakkam", currentStorage: 950, capacity: 3645, storagePct: 26.1, inflowCusecs: 520, outflowCusecs: 120, rainfallMm: 38 },
    ],
    recentAvgInflowMcftPerDay: 95.0,
    seasonalAvgInflowMcftPerDay: 65.0,
    comparison2019Storage: 1500,
    historyStyle: "recovering",
  },
};

/** Simple seeded PRNG (mulberry32) for deterministic mock data */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate mock storage history based on scenario style */
export function generateMockHistory(
  style: "healthy" | "declining" | "crisis" | "recovering"
): Array<{ date: string; totalStorage: number }> {
  const history: Array<{ date: string; totalStorage: number }> = [];
  // Use a fixed reference date so server and client produce the same output
  const refDate = new Date("2026-03-01T00:00:00");
  const rand = seededRandom(style.length * 7919);

  for (let i = 90; i >= 0; i--) {
    const date = new Date(refDate);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const t = (90 - i) / 90; // 0 to 1 over time

    let storage: number;
    switch (style) {
      case "healthy":
        // High and stable with slight seasonal variation
        storage = 8500 + Math.sin(t * Math.PI * 2) * 800 + (rand() - 0.5) * 300;
        break;
      case "declining":
        // Steadily dropping from ~5000 to ~1400
        storage = 5000 - t * 3600 + (rand() - 0.5) * 200;
        break;
      case "crisis":
        // Already very low, continuing to drop toward zero
        storage = 800 - t * 780 + (rand() - 0.5) * 30;
        break;
      case "recovering":
        // Was low (~1500), rising in last 30 days
        storage = t < 0.66 ? 1500 - t * 500 + (rand() - 0.5) * 200
          : 1000 + (t - 0.66) * 8000 + (rand() - 0.5) * 300;
        break;
    }

    history.push({ date: dateStr, totalStorage: Math.max(10, storage) });
  }

  return history;
}

/** Mock groundwater data — adjusts severity based on scenario */
export function generateMockGroundwater(
  style: "healthy" | "declining" | "crisis" | "recovering"
): GroundwaterApiResponse {
  const wards = [];
  // All 200 GCC ward localities across Chennai's 15 zones
  const wardNames = [
    // Zone 1 — Tiruvottiyur (1–13)
    "Tiruvottiyur", "Kathivakkam", "Tiruvottiyur East", "Ernavoor", "Janakipuram",
    "Mill Colony", "Kaladipet", "Theradi", "Tiruvottiyur West", "Wimco Nagar",
    "MH Road", "Tollgate", "Nagammai Nagar",
    // Zone 2 — Manali (14–21)
    "Manali", "Manali New Town", "Mathur MMDA", "Manali West", "Sadayankuppam",
    "Ennore", "Thirumullaivoyal", "Avadi Gate",
    // Zone 3 — Madhavaram (22–32)
    "Madhavaram", "Madhavaram Milk Colony", "Manjambakkam", "Naravarikuppam",
    "Moolakadai", "Erukkancheri", "Periyar Nagar", "MKB Nagar", "Mathur",
    "Kolathur East", "Sembium",
    // Zone 4 — Tondiarpet (33–48)
    "Tondiarpet", "Washermanpet", "Royapuram", "Basin Bridge", "Park Town",
    "Old Washermanpet", "Kasimedu", "Korukkupet", "Stanley", "Seven Wells",
    "Mint", "Mannadi", "Sowcarpet", "Kondithope", "George Town", "Broadway",
    // Zone 5 — Royapuram (49–63)
    "Royapuram North", "Thiruvika Nagar", "RK Nagar", "Otteri", "Perambur",
    "Ayanavaram", "Purasawalkam", "Vepery", "Kellys", "Chetpet",
    "Kilpauk", "Egmore", "Pudupet", "Choolai", "Puliyanthope",
    // Zone 6 — Ambattur (64–82)
    "Ambattur", "Ambattur OT", "Korattur", "Padi", "Mogappair East",
    "Mogappair West", "Nolambur", "Maduravoyal", "Thirumangalam", "Anna Nagar West",
    "Anna Nagar East", "Shenoy Nagar", "Aminjikarai", "Arumbakkam", "Koyambedu",
    "Virugambakkam", "Alwarthirunagar", "Valasaravakkam", "Porur",
    // Zone 7 — Anna Nagar (83–96)
    "Anna Nagar", "Anna Nagar Western Extension", "Thirumangalam East", "CMDA Colony",
    "Villivakkam", "Kolathur", "Agaram", "Retteri", "Villivakkam East",
    "Korattur South", "ICF Colony", "Perambur North", "Jawahar Nagar", "Nammalwarpet",
    // Zone 8 — Teynampet (97–119)
    "Nungambakkam", "T. Nagar", "Kodambakkam", "West Mambalam", "Saidapet",
    "Ashok Nagar", "Vadapalani", "K.K. Nagar East", "K.K. Nagar West", "Teynampet",
    "Thousand Lights", "Royapettah", "Lloyds Road", "Alwarpet", "Gopalapuram",
    "Mylapore", "Mandaveli", "R.A. Puram", "Abhiramapuram", "CIT Colony",
    "Nandanam", "Santhome", "Foreshore Estate",
    // Zone 9 — Kodambakkam (120–134)
    "Kodambakkam West", "Jafferkhanpet", "Ashok Pillar", "Manapakkam", "Ramapuram",
    "Mugalivakkam", "Moulivakkam", "Madanandapuram", "Nesapakkam", "KK Nagar South",
    "Saligramam", "Fairlands", "Choolaimedu", "Nerkundram", "Alapakkam",
    // Zone 10 — Anna Nagar (135–150)
    "Kumaran Nagar", "Poonamallee", "Kundrathur", "Mangadu", "Kovur",
    "Alandur", "Nanganallur", "Adambakkam", "Pallavaram", "Chromepet",
    "Hasthinapuram", "Medavakkam", "Keelkattalai", "Pammal", "Anakaputhur",
    "Sembakkam",
    // Zone 11 — Adyar (151–168)
    "Adyar", "Thiruvanmiyur", "Besant Nagar", "Indira Nagar", "Kotturpuram",
    "Gandhi Nagar (Adyar)", "Ekkatuthangal", "Guindy", "Alandur North",
    "Meenambakkam", "Pallikaranai", "Madipakkam", "Keelkattalai East", "Ullagaram",
    "Puzhuthivakkam", "Nanmangalam", "Perungalathur", "Tambaram",
    // Zone 12 — Perungudi (169–183)
    "Perungudi", "Taramani", "Velachery", "Vijayanagar", "TNHB Colony",
    "Kovilambakkam", "Selaiyur", "Rajakilpakkam", "Sithalapakkam", "Vengaivasal",
    "Narayanapuram", "Jalladianpet", "Madambakkam", "Semmancheri", "Kottivakkam",
    // Zone 13 — Sholinganallur (184–193)
    "Sholinganallur", "Karapakkam", "OMR Thoraipakkam", "Perumbakkam",
    "Okkiampet", "Egattur", "Navallur", "Siruseri", "Kelambakkam", "Padur",
    // Zone 14 — Tondiarpet-Fort (194–197)
    "Fort St George", "Parrys Corner", "Chennai Central", "Pattalam",
    // Zone 15 — Harbour (198–200)
    "Harbour", "Ennore Port", "Royapuram Harbour",
  ];

  // Depth offset based on scenario
  const depthOffset = { healthy: -3, declining: 3, crisis: 8, recovering: 1 }[style];
  const rand = seededRandom(style.length * 1031);

  for (let i = 1; i <= 200; i++) {
    const baseDepth = 3 + (i / 200) * 12 + depthOffset;
    const noise = (rand() - 0.5) * 5;
    const depth = Math.max(0.5, baseDepth + noise);

    const trendWeights = {
      healthy: [0.5, 0.4, 0.1],   // mostly improving/stable
      declining: [0.1, 0.2, 0.7], // mostly declining
      crisis: [0.0, 0.1, 0.9],    // almost all declining
      recovering: [0.4, 0.4, 0.2], // mixed, trending better
    }[style];

    const r = rand();
    const trend = r < trendWeights[0] ? "improving" as const
      : r < trendWeights[0] + trendWeights[1] ? "stable" as const
      : "declining" as const;

    wards.push({
      wardNumber: i,
      wardName: wardNames[i - 1] || `Ward ${i}`,
      zone: `Zone ${Math.ceil(i / 15)}`,
      depthM: parseFloat(depth.toFixed(1)),
      trend,
    });
  }

  const summary = { healthy: 0, moderate: 0, declining: 0, stressed: 0, critical: 0, crisis: 0, noData: 0 };
  for (const w of wards) {
    if (w.depthM <= 3) summary.healthy++;
    else if (w.depthM <= 6) summary.moderate++;
    else if (w.depthM <= 10) summary.declining++;
    else if (w.depthM <= 15) summary.stressed++;
    else if (w.depthM <= 25) summary.critical++;
    else summary.crisis++;
  }

  const cityAverage = parseFloat(
    (wards.reduce((s, w) => s + w.depthM, 0) / wards.length).toFixed(1)
  );

  return {
    period: { year: 2024, month: style === "healthy" ? 12 : style === "crisis" ? 6 : 10 },
    cityAverage,
    wards,
    summary,
  };
}

// ============================================================
// PER-WARD GROUNDWATER HISTORY — for trend chart in detail panel
// ============================================================

/** Generate mock monthly depth-to-water history for a single ward */
export function generateMockWardHistory(wardNumber: number): {
  wardNumber: number;
  wardName: string;
  history: Array<{ year: number; month: number; date: string; depthM: number | null }>;
} {
  const rand = seededRandom(wardNumber * 3571);
  const history: Array<{ year: number; month: number; date: string; depthM: number | null }> = [];

  // Base depth varies by ward number (higher wards tend deeper)
  const baseDepth = 3 + (wardNumber / 200) * 10;

  for (let year = 2021; year <= 2024; year++) {
    for (let month = 1; month <= 12; month++) {
      // ~8% chance of missing data
      if (rand() < 0.08) continue;

      // Seasonal pattern: shallower post-monsoon (Dec-Feb), deeper in summer (Apr-Jun)
      const monthAngle = ((month - 1) / 12) * Math.PI * 2;
      const seasonal = Math.sin(monthAngle - Math.PI / 3) * 2;
      const yearTrend = (year - 2021) * (rand() > 0.5 ? 0.3 : -0.2);
      const noise = (rand() - 0.5) * 2;
      const depth = Math.max(0.5, baseDepth + seasonal + yearTrend + noise);

      history.push({
        year,
        month,
        date: `${year}-${String(month).padStart(2, "0")}`,
        depthM: parseFloat(depth.toFixed(1)),
      });
    }
  }

  const wardNames = [
    "Tiruvottiyur", "Kathivakkam", "Tiruvottiyur East", "Ernavoor", "Janakipuram",
    "Mill Colony", "Kaladipet", "Theradi", "Tiruvottiyur West", "Wimco Nagar",
  ];

  return {
    wardNumber,
    wardName: wardNumber <= wardNames.length ? wardNames[wardNumber - 1] : `Ward ${wardNumber}`,
    history,
  };
}

// ============================================================
// PER-RESERVOIR HISTORY — for drilldown view
// ============================================================

/** Reservoir capacity for scaling per-reservoir mock data */
const RESERVOIR_CAPACITY: Record<string, number> = {
  poondi: 3231,
  cholavaram: 881,
  redhills: 3300,
  chembarambakkam: 3645,
};

export interface ReservoirDailyRecord {
  date: string;
  storage: number;
  inflow: number;
  outflow: number;
  rainfall: number;
}

/** Generate 365 days of per-reservoir history */
export function generateReservoirHistory(
  reservoirName: ReservoirName,
  style: "healthy" | "declining" | "crisis" | "recovering"
): ReservoirDailyRecord[] {
  const capacity = RESERVOIR_CAPACITY[reservoirName] || 3000;
  const rand = seededRandom(reservoirName.length * 4217 + style.length * 131);
  const refDate = new Date("2026-03-01T00:00:00");
  const records: ReservoirDailyRecord[] = [];

  for (let i = 365; i >= 0; i--) {
    const date = new Date(refDate);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const dayOfYear = 365 - i;
    const t = dayOfYear / 365; // 0 to 1 over the year

    // Seasonal pattern: monsoon fills (Oct-Dec), summer depletes (Mar-Jun)
    const monsoonPeak = Math.max(0, Math.sin((t - 0.65) * Math.PI * 2)) * 0.3;
    const summerDip = Math.max(0, Math.sin((t - 0.15) * Math.PI * 2)) * 0.2;

    let storagePct: number;
    switch (style) {
      case "healthy":
        storagePct = 0.55 + monsoonPeak - summerDip * 0.5 + (rand() - 0.5) * 0.08;
        break;
      case "declining":
        storagePct = 0.60 - t * 0.50 + monsoonPeak * 0.3 + (rand() - 0.5) * 0.05;
        break;
      case "crisis":
        storagePct = 0.25 - t * 0.24 + (rand() - 0.5) * 0.02;
        break;
      case "recovering":
        storagePct = t < 0.7
          ? 0.15 - t * 0.05 + (rand() - 0.5) * 0.03
          : 0.10 + (t - 0.7) * 2.0 + (rand() - 0.5) * 0.05;
        break;
    }
    storagePct = Math.max(0.005, Math.min(0.98, storagePct));

    // Inflow: higher during monsoon, near zero in summer
    const monsoonFactor = Math.max(0, Math.sin((t - 0.7) * Math.PI * 2));
    let inflow: number;
    switch (style) {
      case "healthy":
        inflow = monsoonFactor * 500 * (capacity / 3000) + rand() * 30;
        break;
      case "declining":
        inflow = monsoonFactor * 200 * (capacity / 3000) + rand() * 10;
        break;
      case "crisis":
        inflow = rand() * 5;
        break;
      case "recovering":
        inflow = t > 0.7 ? monsoonFactor * 600 * (capacity / 3000) + rand() * 50 : rand() * 8;
        break;
    }

    // Outflow: relatively steady, drops during crisis
    const baseOutflow = style === "crisis" ? 10 : style === "declining" ? 80 : 120;
    const outflow = baseOutflow * (capacity / 3000) + (rand() - 0.5) * 20;

    // Rainfall: correlated with inflow
    const rainfall = monsoonFactor * 30 + rand() * 5;

    records.push({
      date: dateStr,
      storage: Math.round(storagePct * capacity),
      inflow: Math.max(0, Math.round(inflow)),
      outflow: Math.max(0, Math.round(outflow)),
      rainfall: parseFloat(Math.max(0, rainfall).toFixed(1)),
    });
  }

  return records;
}

// ============================================================
// HISTORICAL YEAR COMPARISON — overlay past years on trend chart
// ============================================================

export interface HistoricalYearData {
  year: number;
  label: string;
  data: Array<{ dayOfYear: number; date: string; totalStorage: number }>;
}

/** Available years for comparison */
export const COMPARISON_YEARS = [
  { year: 2019, label: "2019 (Day Zero)" },
  { year: 2020, label: "2020" },
  { year: 2021, label: "2021" },
  { year: 2022, label: "2022" },
  { year: 2023, label: "2023 (Floods)" },
  { year: 2024, label: "2024" },
  { year: 2025, label: "2025" },
];

/** Generate a full year (365 days) of combined storage data for a historical year */
export function generateHistoricalYear(year: number): HistoricalYearData {
  const rand = seededRandom(year * 6577);
  const totalCapacity = 11057; // sum of 4 reservoirs
  const data: HistoricalYearData["data"] = [];

  // Each year has a different "personality" based on real Chennai water history
  let baseLevel: number;
  let monsoonStrength: number;
  let summerDrain: number;

  switch (year) {
    case 2019: // Day Zero crisis
      baseLevel = 0.20;
      monsoonStrength = 0.15;
      summerDrain = 0.35;
      break;
    case 2020: // Post-crisis recovery, decent monsoon
      baseLevel = 0.45;
      monsoonStrength = 0.40;
      summerDrain = 0.20;
      break;
    case 2021: // Moderate year
      baseLevel = 0.50;
      monsoonStrength = 0.35;
      summerDrain = 0.25;
      break;
    case 2022: // Good monsoon year
      baseLevel = 0.55;
      monsoonStrength = 0.45;
      summerDrain = 0.20;
      break;
    case 2023: // Flood year — very high storage
      baseLevel = 0.60;
      monsoonStrength = 0.55;
      summerDrain = 0.15;
      break;
    case 2024: // Decent year
      baseLevel = 0.50;
      monsoonStrength = 0.40;
      summerDrain = 0.22;
      break;
    case 2025: // Current-ish year
      baseLevel = 0.52;
      monsoonStrength = 0.38;
      summerDrain = 0.20;
      break;
    default:
      baseLevel = 0.45;
      monsoonStrength = 0.35;
      summerDrain = 0.22;
  }

  for (let d = 0; d < 365; d++) {
    const t = d / 365;
    // Monsoon fills Oct-Dec (t ≈ 0.75-1.0), summer depletes Mar-Jun (t ≈ 0.15-0.45)
    const monsoonFill = Math.max(0, Math.sin((t - 0.65) * Math.PI * 2)) * monsoonStrength;
    const summerLoss = Math.max(0, Math.sin((t - 0.15) * Math.PI * 2)) * summerDrain;
    const storagePct = Math.max(0.01, Math.min(0.98,
      baseLevel + monsoonFill - summerLoss + (rand() - 0.5) * 0.04
    ));

    const dateObj = new Date(year, 0, d + 1);
    const dateStr = dateObj.toISOString().split("T")[0];

    data.push({
      dayOfYear: d,
      date: dateStr,
      totalStorage: Math.round(storagePct * totalCapacity),
    });
  }

  const yearLabel = COMPARISON_YEARS.find(y => y.year === year)?.label || `${year}`;
  return { year, label: yearLabel, data };
}
