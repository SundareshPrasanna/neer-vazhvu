import type { ReservoirSummary, ReservoirName } from "@/types/reservoir";
import type { GroundwaterApiResponse, RiskApiResponse, WardRiskData, RiskLevel } from "@/types/groundwater";

// ============================================================
// SCENARIOS  -  switch between these to see different UI states
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
  // Scenario 1: Post-monsoon  -  reservoirs full, everything green
  post_monsoon: {
    label: "Post-Monsoon (Dec)",
    description: "After northeast monsoon  -  reservoirs full, healthy groundwater",
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

  // Scenario 2: Summer stress  -  May/June, reservoirs declining fast
  summer_stress: {
    label: "Summer Stress (May)",
    description: "Peak summer  -  no rain, reservoirs dropping, groundwater strained",
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

  // Scenario 3: Day Zero  -  2019 crisis recreation
  day_zero: {
    label: "Day Zero Crisis (Jun 2019)",
    description: "Reservoirs nearly empty  -  the 2019 water emergency",
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

  // Scenario 4: Recovery  -  monsoon just started, reservoirs beginning to fill
  recovery: {
    label: "Early Recovery (Oct)",
    description: "First monsoon rains  -  reservoirs slowly filling, hope returns",
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
): Array<{ date: string; totalStorage: number; totalInflow: number; totalOutflow: number }> {
  const history: Array<{ date: string; totalStorage: number; totalInflow: number; totalOutflow: number }> = [];
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

    // Inflow: seasonal monsoon pattern (~4x per-reservoir scale for combined view)
    const monsoonFactor = Math.max(0, Math.sin((t - 0.7) * Math.PI * 2));
    let inflow: number;
    switch (style) {
      case "healthy":   inflow = monsoonFactor * 1500 + rand() * 100; break;
      case "declining":  inflow = monsoonFactor * 600 + rand() * 30; break;
      case "crisis":     inflow = rand() * 15; break;
      case "recovering": inflow = t > 0.7 ? monsoonFactor * 1800 + rand() * 150 : rand() * 25; break;
    }

    // Outflow: relatively steady, varies by scenario
    const baseOutflow = style === "crisis" ? 30 : style === "declining" ? 250 : 400;
    const outflow = baseOutflow + (rand() - 0.5) * 60;

    history.push({
      date: dateStr,
      totalStorage: Math.max(10, storage),
      totalInflow: Math.max(0, Math.round(inflow)),
      totalOutflow: Math.max(0, Math.round(outflow)),
    });
  }

  return history;
}

/** Mock groundwater data  -  adjusts severity based on scenario */
export function generateMockGroundwater(
  style: "healthy" | "declining" | "crisis" | "recovering"
): GroundwaterApiResponse {
  const wards = [];
  // Canonical GCC 2022 ward locality names (all 200 wards, sourced from chennaicentral.in)
  const wardNames = [
    // Zone I - THIRUVOTTIYUR (1-14)
    "Kathivakkam", "Ennore", "Ernavoor", "Ajax", "Tiruvottiyur",
    "Kaladipet", "Rajakadai", "Kodungaiyur (West)", "Kodungaiyur (East)",
    "Dr. Radhakrishnan Nagar (North)", "Cheriyan Nagar (North)", "Jeeva Nagar (North)",
    "Cheriyan Nagar (South)", "Jeeva Nagar (South)",
    // Zone II - MANALI (15-21)
    "Edyanchavadi", "Kadapakkam", "Theeyambakkam", "Manali", "Mathur",
    "Sanjeevirayanpet", "Grace Garden",
    // Zone III - MADHAVARAM (22-33)
    "Kavankarai", "Puzhal", "Puthagram", "Kathirvedu", "Lakshmipuram",
    "Assisi Nagar", "Chinnasekkadu", "Madhavaram", "Ma-Po-Si Nagar",
    "Royapuram", "Singarathottam", "Narayanappa Thottam",
    // Zone IV - TONDIARPET (34-48)
    "Korukkupet", "Mottai Thottam", "Kumarasamy Nagar (South)",
    "Dr. Radhakrishnan Nagar (South)", "Kumarasamy Nagar (North)",
    "Vijayaragavalu Nagar (West)", "Tondiarpet", "Old Washermenpet",
    "Meenakshiammanpet", "Kondithope", "Sevenwells (North)", "Amman Koil",
    "Muthialpet", "Vallalseethakathi Nagar", "Kachaleeswarar Nagar",
    // Zone V - ROYAPURAM (49-63)
    "Sevenwells (South)", "Sowcarpet", "Basin Bridge", "Vyasarpet (South)",
    "Vyasarpet (North)", "Perambur (North)", "Perambur (East)", "Elango Nagar",
    "Perambur (South)", "Thiru-Vi-Ka Nagar", "Wadia Nagar",
    "Dr. Sathyavanimuthu Nagar", "Pulianthope", "Dr. Besant Nagar", "Pedhunayakanpet",
    // Zone VI - THIRU-VI-KA NAGAR (64-78)
    "Perumal Koil Thottam", "Thattankulam", "Choolai", "Poonga Nagar",
    "Elephant Gate", "Edapalayam", "Agaram (North)", "Sembiam", "Siruvalloor",
    "Nagammai Ammaiyar Nagar", "Agaram (South)", "Vidhudalai Gurusami Nagar",
    "Ayanavaram", "Nagammaiammaiyar Nagar (South)", "Panneer Selvam Nagar",
    // Zone VII - AMBATTUR (79-93)
    "Maraimalai Adigal Nagar", "Maraimalai Adigal Nagar (South)", "Purasawalkam",
    "Kolathur", "Villiwakkam (North)", "Villiwakkam (South)", "Virugambakkam (North)",
    "Anna Nagar (West)", "Anna Nagar (Central)", "Anna Nagar (East)", "Shenoy Nagar",
    "Kilpauk (North)", "Gangadeeswarar Koil", "Kilpauk (South)", "Amanjikarai (North)",
    // Zone VIII - ANNA NAGAR (94-108)
    "Amanjikarai (Central)", "Amanjikarai (West)", "Periyar Nagar (North)",
    "Periyar Nagar (West)", "Nungambakkam", "Adikesavapuram", "Nehru Nagar",
    "Chintadripet", "Komaleeswaranpet", "Balasubramanya Nagar", "Thiruvotteeswaranpet",
    "Natesan Nagar", "Chepauk", "Zambazaar", "Umaru Pulavar Nagar",
    // Zone IX - TEYNAMPET (109-126)
    "Triplicane", "Marina", "Krishnampet", "Bharathi Nagar", "Azad Nagar (North)",
    "Bharathidasan Nagar", "Azad Nagar (South)", "Vivekananda Puram",
    "Ajnugam Ammaiyar Nagar", "Kosappet", "Pattalam", "Anbazhagan Nagar",
    "Perumalpet", "Kannappar Nagar", "Pattalam", "Chetpet", "Egmore", "Pudupet",
    // Zone X - KODAMBAKKAM (127-142)
    "Ko-Su-Mani Nagar", "Nakeerar Nagar", "Thousand Lights", "Azhagiri Nagar",
    "Amir Mahal", "Royapettah", "Teynampet", "Sathyamurthy Nagar",
    "Alwarpet (North)", "Alwarpet (South)", "Vadapalani (West)", "Vadapalani (East)",
    "Kalaivanar Nagar", "Navalar Nedunchezian Nagar (West)",
    "Navalar Nedunchezian Nagar (East)", "Ashok Nagar",
    // Zone XI - VALASARAVAKKAM (143-155)
    "M.G.R. Nagar", "Kamaraj Nagar (North)", "Kamaraj Nagar (South)",
    "Thyagaraya Nagar", "Rajaji Nagar", "Virugambakkam (South)", "Saligramam",
    "Kodambakkam (North)", "Kodambakkam (South)", "Saidapet",
    "Kumaran Nagar (North)", "Kumaran Nagar (South)", "Saidapet (West)",
    // Zone XII - ALANDUR (156-167)
    "Kalaingar Karunanidhi Nagar", "V.O.C. Nagar", "G.D. Naidu Nagar (East)",
    "G.D. Naidu Nagar (West)", "Guindy (West)", "Guindy (East)", "Beemannapettai",
    "Thiruvalluvar Nagar", "Madavaperumal Puram", "Karaneeswarpuram", "Santhome", "Mylapore",
    // Zone XIII - ADYAR (168-182)
    "Taramani", "Ullagaram", "Avvai Nagar (South)", "Raja Annamalai Puram",
    "Avvai Nagar (North)", "Adyar (West)", "Adyar (East)", "Velachery",
    "Thiruvanmiyur (West)", "Thiruvanmiyur (East)", "Besant Nagar", "Urur",
    "Adampakkam", "Velachery (West)", "Gandhi Salai",
    // Zone XIV - PERUNGUDI (183-191)
    "Puzhuthivakkam", "Kottivakkam", "Pallikaranai", "Palavakkam", "Madipakkam",
    "Jaladianpet", "Neelangarai", "Thoraipakkam", "Injambakkam",
    // Zone XV - SHOLINGANALLUR (192-200)
    "Karapakkam", "Sholinganallur", "Uthandi", "Semmancheri", "Navalur",
    "Siruseri", "Kelambakkam", "Sithalapakkam", "Medavakkam",
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
// PER-WARD GROUNDWATER HISTORY  -  for trend chart in detail panel
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
    "Kathivakkam", "Ennore", "Ernavoor", "Ajax", "Tiruvottiyur",
    "Kaladipet", "Rajakadai", "Kodungaiyur (West)", "Kodungaiyur (East)",
    "Dr. Radhakrishnan Nagar (North)",
  ];

  return {
    wardNumber,
    wardName: wardNumber <= wardNames.length ? wardNames[wardNumber - 1] : `Ward ${wardNumber}`,
    history,
  };
}

// ============================================================
// PER-RESERVOIR HISTORY  -  for drilldown view
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
// HISTORICAL YEAR COMPARISON  -  overlay past years on trend chart
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
    case 2023: // Flood year  -  very high storage
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

/** Mock ward risk scores  -  realistic distribution: 40% low, 35% moderate, 15% high, 10% critical */
export function generateMockRiskScores(): RiskApiResponse {
  const rand = seededRandom(8317);
  const wards: WardRiskData[] = [];

  for (let wardNumber = 1; wardNumber <= 200; wardNumber++) {
    const r = rand();
    let riskScore: number;
    let riskLevel: RiskLevel;

    if (r < 0.40) {
      riskScore = rand() * 25;
      riskLevel = 'low';
    } else if (r < 0.75) {
      riskScore = 26 + rand() * 24;
      riskLevel = 'moderate';
    } else if (r < 0.90) {
      riskScore = 51 + rand() * 24;
      riskLevel = 'high';
    } else {
      riskScore = 76 + rand() * 24;
      riskLevel = 'critical';
    }

    // Components proportional to total, with ±20% variation per component
    const v = () => 0.8 + rand() * 0.4;
    const gw = Math.min(40, riskScore * 0.40 * v());
    const trend = Math.min(30, riskScore * 0.30 * v());
    const reservoir = Math.min(20, riskScore * 0.20 * v());
    const seasonal = Math.min(10, riskScore * 0.10 * v());

    wards.push({
      wardNumber,
      riskScore: parseFloat(riskScore.toFixed(2)),
      riskLevel,
      groundwaterComponent: parseFloat(gw.toFixed(2)),
      trendComponent: parseFloat(trend.toFixed(2)),
      reservoirComponent: parseFloat(reservoir.toFixed(2)),
      seasonalComponent: parseFloat(seasonal.toFixed(2)),
    });
  }

  return { computedDate: '2026-03-01', wards };
}
