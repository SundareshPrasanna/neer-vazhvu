/**
 * Generate AI narratives for Neer Vazhvu.
 *
 * Daily:   npx tsx scripts/generate-narratives.ts
 *          Generates a city-level narrative (exits on IST days 1-3).
 *
 * Monthly: npx tsx scripts/generate-narratives.ts --monthly
 *          Generates ward-level narratives (batched) + city narrative.
 *
 * Requires: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
config({ path: resolve(new URL(".", import.meta.url).pathname, "..", ".env.local") });

// ── IST day gating ───────────────────────────────────────────────────────────

const istDay = Number(
  new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", day: "2-digit" })
    .format(new Date())
);

const istDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" })
  .format(new Date()); // YYYY-MM-DD

const isMonthly = process.argv.includes("--monthly");

if (!isMonthly && istDay <= 3) {
  console.log("IST days 1-3: skipping daily narrative (monthly job owns city narrative)");
  process.exit(0);
}

// ── Supabase setup ───────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!ANTHROPIC_KEY) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ── Types ────────────────────────────────────────────────────────────────────

interface WardProfile {
  ward_number: number;
  zone_name: string;
  water_bodies: {
    current_count: number;
    restoration_critical: number;
    restoration_high: number;
  };
  flood: {
    dominant_hazard: string | null;
    hotspot_2015_count: number;
  };
  drainage: { line_count: number };
  sewerage: {
    stp_count: number;
    sps_count: number;
    pumping_main_count: number;
    total_stp_capacity_mld: number;
  };
  rivers: {
    nearest_station_id: string | null;
    nearest_river_id: string | null;
    nearest_km: number | null;
  };
}

interface SourceDates {
  reservoir_date: string | null;
  gw_period: string | null;
  risk_date: string | null;
}

/** Strip markdown code fences (```json ... ```) that models sometimes add */
function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchCityData() {
  // Latest briefing
  const { data: briefing } = await supabase
    .from("daily_briefing")
    .select("*")
    .order("briefing_date", { ascending: false })
    .limit(1);

  // Latest estimate
  const { data: estimate } = await supabase
    .from("water_estimate_daily")
    .select("*")
    .order("date", { ascending: false })
    .limit(1);

  // Risk summary
  const { data: riskRows } = await supabase
    .from("ward_risk_score")
    .select("risk_level")
    .order("computed_date", { ascending: false })
    .limit(200);

  const riskSummary = { low: 0, moderate: 0, high: 0, critical: 0 };
  for (const r of riskRows ?? []) {
    const level = r.risk_level as keyof typeof riskSummary;
    if (level in riskSummary) riskSummary[level]++;
  }

  const sourceDates: SourceDates = {
    reservoir_date: estimate?.[0]?.date ?? null,
    gw_period: null,
    risk_date: null,
  };

  // Latest groundwater period
  const { data: gwLatest } = await supabase
    .from("groundwater_monthly")
    .select("year, month")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(1);

  if (gwLatest?.[0]) {
    sourceDates.gw_period = `${gwLatest[0].year}-${String(gwLatest[0].month).padStart(2, "0")}`;
  }

  // Latest risk date
  const { data: riskLatest } = await supabase
    .from("ward_risk_score")
    .select("computed_date")
    .order("computed_date", { ascending: false })
    .limit(1);

  if (riskLatest?.[0]) {
    sourceDates.risk_date = riskLatest[0].computed_date;
  }

  return {
    briefing: briefing?.[0] ?? null,
    estimate: estimate?.[0] ?? null,
    riskSummary,
    sourceDates,
  };
}

async function fetchWardData(wardNumber: number) {
  // Latest groundwater for this ward (includes ward_name for locality label)
  const { data: gw } = await supabase
    .from("groundwater_monthly")
    .select("depth_m, trend, ward_name")
    .eq("ward_number", wardNumber)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(1);

  // Latest risk score
  const { data: risk } = await supabase
    .from("ward_risk_score")
    .select("risk_score, risk_level, factors")
    .eq("ward_number", wardNumber)
    .order("computed_date", { ascending: false })
    .limit(1);

  return {
    wardName: gw?.[0]?.ward_name ?? null,
    depthM: gw?.[0]?.depth_m ?? null,
    trend: gw?.[0]?.trend ?? "unknown",
    riskScore: risk?.[0]?.risk_score ?? null,
    riskLevel: risk?.[0]?.risk_level ?? "noData",
    factors: risk?.[0]?.factors ?? null,
  };
}

// ── Narrative generation ─────────────────────────────────────────────────────

async function generateCityNarrative(
  cityData: Awaited<ReturnType<typeof fetchCityData>>
): Promise<{ headline_en: string; headline_ta: string; body_en: string; body_ta: string }> {
  const b = cityData.briefing;
  const e = cityData.estimate;
  const r = cityData.riskSummary;

  // Format days remaining as years if large
  function formatDaysLeft(days: number | null | undefined): string {
    if (days == null) return "N/A";
    if (days >= 365) return `${(days / 365).toFixed(1)} years (~${days} days)`;
    return `${days} days`;
  }

  const context = `
Chennai Water Intelligence - ${istDateStr}

RESERVOIR STATUS:
- Storage: ${e?.storage_pct ?? "N/A"}% of total capacity
- Supply remaining (moderate scenario): ${formatDaysLeft(e?.days_left_moderate)}
- Supply remaining (pessimistic): ${formatDaysLeft(e?.days_left_pessimistic)}
- Average inflow: ${e?.avg_inflow_mcft_day ?? "N/A"} mcft/day

ALERTS:
${JSON.stringify(b?.alerts ?? [])}

WARD RISK DISTRIBUTION:
- Low: ${r.low}, Moderate: ${r.moderate}, High: ${r.high}, Critical: ${r.critical}

DATA FRESHNESS:
- Reservoir data: ${cityData.sourceDates.reservoir_date ?? "N/A"}
- Groundwater period: ${cityData.sourceDates.gw_period ?? "N/A"}
- Risk scores: ${cityData.sourceDates.risk_date ?? "N/A"}
`.trim();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are an AI analyst for Chennai's water intelligence dashboard (Neer Vazhvu). Write a concise daily narrative that connects the dots across reservoir levels, groundwater stress, and ward-level risks.

RULES:
- Write in a journalistic, factual tone. No speculation.
- Use hyphens, not em-dashes.
- English headline: 1-2 sentences summarizing the key takeaway.
- English body: 3-5 bullet points (each starting with "- "). Each bullet is one clear insight. Connect data points causally where possible.
- Tamil: Translate your English output naturally. Use standard Tamil vocabulary. Body bullets should also start with "- ".
- Focus on what matters TODAY. What changed? What should people watch?
- Do not repeat raw numbers without context. Express large day counts (>365) in years (e.g. "nearly 3 years"), never as raw days like "999 days".

DATA:
${context}

Respond in this exact JSON format (no markdown, no code blocks):
{"headline_en": "...", "headline_ta": "...", "body_en": "- bullet1\n- bullet2\n- bullet3", "body_ta": "- bullet1\n- bullet2\n- bullet3"}`,
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  const text = stripCodeFences(raw);
  try {
    return JSON.parse(text);
  } catch {
    console.error("Failed to parse city narrative response:", text.slice(0, 200));
    throw new Error("Invalid JSON from Claude API");
  }
}

async function generateWardNarratives(
  profiles: WardProfile[],
  batchSize = 5
): Promise<Map<number, { headline_en: string; headline_ta: string; body_en: string; body_ta: string; key_facts: string[] }>> {
  const results = new Map<number, { headline_en: string; headline_ta: string; body_en: string; body_ta: string; key_facts: string[] }>();

  // Process in batches
  for (let i = 0; i < profiles.length; i += batchSize) {
    const batch = profiles.slice(i, i + batchSize);
    console.log(`  Generating ward narratives: batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(profiles.length / batchSize)}`);

    // Fetch live data for each ward in the batch
    const wardDataPromises = batch.map(async (profile) => {
      const live = await fetchWardData(profile.ward_number);
      return { profile, live };
    });
    const batchData = await Promise.all(wardDataPromises);

    // Build context for the batch
    const wardContexts = batchData.map(({ profile: p, live }) => {
      const label = live.wardName ?? p.zone_name;
      return `
WARD ${p.ward_number} (${label}):
- Groundwater: ${live.depthM != null ? `${live.depthM}m depth, ${live.trend}` : "no data"}
- Risk: ${live.riskLevel} (score: ${live.riskScore ?? "N/A"})
- Water bodies: ${p.water_bodies.current_count} (${p.water_bodies.restoration_critical} critical restoration)
- Flood: dominant hazard ${p.flood.dominant_hazard ?? "none"}, ${p.flood.hotspot_2015_count} 2015 hotspots
- Drainage: ${p.drainage.line_count} lines
- Sewerage: ${p.sewerage.stp_count} STPs (${p.sewerage.total_stp_capacity_mld} MLD), ${p.sewerage.sps_count} pumping stations
- Nearest river: ${p.rivers.nearest_river_id ?? "none"} (${p.rivers.nearest_km ?? "N/A"} km)`.trim();
    });

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are an AI analyst for Chennai's water intelligence dashboard. Generate brief ward narratives that highlight the most notable water-related facts for each ward.

RULES:
- Each ward gets a headline (1 sentence) and body (2-3 sentences).
- Use hyphens, not em-dashes.
- Connect infrastructure to risk: e.g., "Limited drainage in a high-flood-risk zone..."
- Include 2-3 key facts as a list.
- Tamil translations should be natural, not literal.
- Be factual and concise.

WARDS:
${wardContexts.join("\n\n")}

Respond in this exact JSON format (no markdown):
[{"ward": <number>, "headline_en": "...", "headline_ta": "...", "body_en": "...", "body_ta": "...", "key_facts": ["fact1", "fact2"]}]`,
        },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const text = stripCodeFences(raw);
    try {
      const parsed = JSON.parse(text) as Array<{
        ward: number;
        headline_en: string;
        headline_ta: string;
        body_en: string;
        body_ta: string;
        key_facts: string[];
      }>;
      for (const item of parsed) {
        results.set(item.ward, {
          headline_en: item.headline_en,
          headline_ta: item.headline_ta,
          body_en: item.body_en,
          body_ta: item.body_ta,
          key_facts: item.key_facts,
        });
      }
    } catch {
      console.error(`Failed to parse ward batch response (wards ${batch[0].ward_number}-${batch[batch.length - 1].ward_number}):`, text.slice(0, 200));
    }
  }

  return results;
}

// ── Write to Supabase ────────────────────────────────────────────────────────

async function writeCityNarrative(
  narrative: { headline_en: string; headline_ta: string; body_en: string; body_ta: string },
  sourceDates: SourceDates,
  model: string
) {
  // Find the latest briefing row (may not be today if the pipeline hasn't run yet)
  const { data: latest } = await supabase
    .from("daily_briefing")
    .select("briefing_date")
    .order("briefing_date", { ascending: false })
    .limit(1);

  const targetDate = latest?.[0]?.briefing_date ?? istDateStr;

  const { error } = await supabase
    .from("daily_briefing")
    .update({
      ai_headline_en: narrative.headline_en,
      ai_headline_ta: narrative.headline_ta,
      ai_body_en: narrative.body_en,
      ai_body_ta: narrative.body_ta,
      ai_source_dates: sourceDates,
      ai_model: model,
    })
    .eq("briefing_date", targetDate);

  if (error) {
    console.error("Failed to write city narrative:", error.message);
  } else {
    console.log(`City narrative written for ${targetDate}`);
  }
}

async function writeWardNarratives(
  narratives: Map<number, { headline_en: string; headline_ta: string; body_en: string; body_ta: string; key_facts: string[] }>,
  sourceDates: SourceDates,
  model: string
) {
  const rows = Array.from(narratives.entries()).map(([wardNumber, n]) => ({
    ward_number: wardNumber,
    narrative_date: istDateStr,
    headline_en: n.headline_en,
    headline_ta: n.headline_ta,
    body_en: n.body_en,
    body_ta: n.body_ta,
    source_dates: sourceDates,
    key_facts: n.key_facts,
    model,
  }));

  // Upsert in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase
      .from("ward_narrative")
      .upsert(batch, { onConflict: "ward_number,narrative_date" });

    if (error) {
      console.error(`Failed to write ward narratives batch ${i / 50 + 1}:`, error.message);
    }
  }

  console.log(`${rows.length} ward narratives written for ${istDateStr}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const root = resolve(new URL(".", import.meta.url).pathname, "..");

  // Always generate city narrative
  console.log("Fetching city data...");
  const cityData = await fetchCityData();

  console.log("Generating city narrative...");
  const cityNarrative = await generateCityNarrative(cityData);
  await writeCityNarrative(cityNarrative, cityData.sourceDates, "claude-sonnet-4-20250514");

  // Monthly: also generate ward narratives
  if (isMonthly) {
    console.log("Loading ward profiles...");
    const profiles = JSON.parse(
      readFileSync(resolve(root, "public/data/ward-profiles.json"), "utf8")
    ) as WardProfile[];

    console.log(`Generating narratives for ${profiles.length} wards...`);
    const wardNarratives = await generateWardNarratives(profiles);
    await writeWardNarratives(wardNarratives, cityData.sourceDates, "claude-haiku-4-5-20251001");
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
