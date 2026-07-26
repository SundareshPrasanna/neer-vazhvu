/**
 * Data-freshness checks - per-city, derived from the city configs.
 *
 * Two modes:
 *
 *   npx tsx scripts/check-data-freshness.ts --validate
 *     Registry-completeness gate, run in CI via `npm run data:check`.
 *     Fails when a registered city has feeds the checker cannot derive
 *     (missing rainfall artifact, unknown reservoir table, dangling
 *     extra-feed entries). This is what makes freshness checks
 *     AUTO-CREATED at city onboarding: the new city's PR cannot pass CI
 *     until its feeds are checkable (or explicitly exempted below).
 *
 *   npx tsx scripts/check-data-freshness.ts --check
 *     The actual staleness sweep, run daily by
 *     .github/workflows/data-freshness.yml after the morning pipelines.
 *     Queries Supabase for reservoir feeds and reads committed artifacts
 *     for file feeds. Writes freshness-report.md and exits 1 when
 *     anything is stale (the workflow turns that into a GitHub issue).
 *
 * Checks are DERIVED, not hand-listed:
 *   - Reservoir feeds: every waterSource with hasPublicFeed !== false,
 *     against reservoir_daily (legacy-v1, Chennai) or reservoir_daily_v2
 *     (everyone else), per source_code for v2.
 *   - Daily provisional rainfall: public/data/rainfall-recent-<city>.json
 *     is REQUIRED for every registered city (generated_at must be fresh).
 *   - Weekly / city-specific artifacts live in EXTRA_FEEDS - the one
 *     place new non-uniform feeds are registered.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { listAllPlaces } from "../src/lib/cities";
import type { PlaceConfig } from "../src/lib/cities/types";

const ROOT = resolve(__dirname, "..");

/* ── Cadence tolerances (days) ─────────────────────────────────────────── */
// Reservoir bulletins skip days (Pravah's OFBiz errors, CMWSSB runner
// blocks are tolerated up to the same threshold the pipeline itself uses).
const RESERVOIR_MAX_AGE_DAYS = 4;
const RAINFALL_MAX_AGE_DAYS = 2;

/**
 * Per-city reservoir tolerance, where 4 days is measurably wrong.
 *
 * Calibrated 2026-07-26 from 120 days of observed gaps rather than assumed
 * cadence - the same mistake that made gee-reservoir-context alarm on a healthy
 * job. Measured breach counts at the CURRENT tolerance of 4:
 *
 *   madurai (TN Agri, CI)        2 in 120d   max gap  9   keep 4
 *   bangalore x4 (KWRIS, launchd) 2 in 120d   max gap  6   keep 4
 *   mumbai x5 (Pravah, launchd)   1 in 120d   max gap  8   keep 4
 *   chennai (CMWSSB, launchd)    10 in 120d   max gap 12   -> 7
 *
 * Chennai's gap distribution over those 120 days:
 *   1x10, 2x5, 3x3, 4x4, 5x3, 6x2, 7, 8, 9, 11, 12
 * At 4 that is an alert every ~12 days, which is the alarm fatigue the
 * ciBlocked work existed to remove. At 7 it is ~4 alerts in 120 days and still
 * catches the 8/9/11/12-day outages.
 *
 * This is NOT a claim that week-old reservoir data is fine. It is a concession
 * to a known-unreliable execution path: CMWSSB runs from the launchd job on one
 * laptop, so sub-week gaps are laptop jitter rather than a broken pipeline. The
 * real fix is getting that feed off the laptop (P0-8), not this number. Re-run
 * the calibration if the execution home changes.
 */
const RESERVOIR_MAX_AGE_OVERRIDES: Record<string, number> = {
  chennai: 7,
};

/* ── Extra file feeds (weekly / city-specific artifacts) ───────────────── */
// Register non-uniform feeds here. `dateFrom` supports a JSON field path
// ("json:generated_at") or a regex over the raw file ("regex:<pattern>",
// first capture group must be YYYY-MM-DD).
interface ExtraFeed {
  id: string;
  cityId: string;
  file: string;
  maxAgeDays: number;
  dateFrom: string;
  note?: string;
}
const EXTRA_FEEDS: ExtraFeed[] = [
  {
    id: "mmr-dam-storage",
    cityId: "mumbai",
    file: "public/data/mmr-dam-storage.json",
    maxAgeDays: 4, // daily Pravah artifact; same tolerance as the DB feed
    dateFrom: "json:_fetched",
    note: "regional corporation cards' source-storage pills",
  },
  {
    id: "bmc-flood-spots",
    cityId: "mumbai",
    file: "public/data/mumbai-flood-hotspots.geojson",
    maxAgeDays: 9, // weekly (Mondays) + 2 days grace
    dateFrom: "regex:fetched (\\d{4}-\\d{2}-\\d{2})",
    note: "BMC DM register, weekly scrape",
  },
  {
    id: "bbmb-dam-storage",
    cityId: "delhi",
    file: "public/data/bbmb-dam-storage.json",
    // Daily BBMB bulletin; same tolerance as the other daily dam artifacts.
    // Delhi's ONLY raw-water feed - every other source is hasPublicFeed:false.
    maxAgeDays: 4,
    dateFrom: "json:_fetched",
    note: "BBMB Bhakra/Pong daily bulletin (launchd; BBMB overwrites daily, no archive)",
  },
  {
    id: "cauvery-ka-scoreboard",
    cityId: "bangalore",
    file: "public/data/basins/cauvery-ka/scoreboard.json",
    // Monthly-ish KWRIS aggregates; refreshed by re-running
    // scripts/ingest_basin_overview.py scripts/basin-sources/cauvery-ka.json
    maxAgeDays: 45,
    dateFrom: "json:asOf",
    note: "Cauvery basin overview sub-basin scoreboard (KWRIS)",
  },
  {
    id: "cauvery-rainfall-deviation",
    cityId: "bangalore",
    file: "public/data/basins/cauvery-ka/scoreboard.json",
    // Self-computed seasonal deviation (scripts/build_basin_rainfall.py,
    // Open-Meteo/ERA5-Land with cached normals - a refresh costs one small
    // request per sample point). Manual re-run for now; the budget nudges
    // a fortnightly refresh during the season. TN piggybacks on the same
    // run (both scoreboards are written together).
    maxAgeDays: 15,
    dateFrom: 'regex:"rainfallDeviationPct":\\s*\\{[^}]*"asOf": "(\\d{4}-\\d{2}-\\d{2})"',
    note: "Cauvery sub-basin rainfall deviation (self-computed, both states)",
  },
];

/* ── Extra TABLE feeds (P5-1: scheduled workflows that write to Supabase) ──
 * Artifacts written straight into Supabase by a cron. Before this list they
 * were the third unwatched class: the edition registry could not see them
 * (no document to diff) and the file-feed path could not either (no committed
 * file). If gee-phase1.yml or the WRIS pipeline step silently stopped, nothing
 * alerted. `cityColumn` is omitted where the table is not city-keyed.
 */
interface ExtraTableFeed {
  id: string;
  cityId: string;
  table: string;
  dateColumn: string;
  cityColumn?: string;
  maxAgeDays: number;
  note?: string;
}
const EXTRA_TABLE_FEEDS: ExtraTableFeed[] = [
  {
    id: "gee-reservoir-context",
    cityId: "chennai",
    table: "reservoir_catchment_context",
    dateColumn: "context_date",
    // No city column - the table is keyed by `reservoir`, and gee-phase1
    // only runs the reservoir-context job for Chennai, so the newest row
    // anywhere is the right signal.
    //
    // 60, not 4. THE CRON CADENCE IS NOT THE DATA CADENCE. gee-phase1 runs
    // this daily, but context_date comes from resolve_chirps_context_date(),
    // which takes the max image date in UCSB-CHG/CHIRPS/DAILY - and CHIRPS
    // final lands one month-end at a time, 16-18 days after that month closes:
    //   2026-06-30 computed 2026-07-16 (16d)   2026-05-31 -> 2026-06-17 (17d)
    //   2026-04-30 -> 2026-05-18 (18d)         2026-02-28 -> 2026-04-03 (34d)
    // So the value advances ~monthly and a 4-day tolerance alarms permanently.
    // 31 (month gap) + ~18 (lag) + grace, with headroom for the 34-day outlier.
    maxAgeDays: 60,
    note: "GEE catchment rainfall-anomaly strip on the Chennai dashboard",
  },
  {
    id: "gee-water-body-summaries",
    cityId: "chennai",
    table: "water_body_satellite_summary",
    dateColumn: "summary_date",
    // Not city-filtered: gee-phase1.yml refreshes every city in one weekly
    // pass, so the newest row anywhere is the right liveness signal.
    maxAgeDays: 12, // weekly (Mondays 06:45 IST) + grace
    note: "GEE water-body extent summaries, all cities (weekly pass)",
  },
  {
    id: "wris-groundwater",
    cityId: "madurai",
    table: "groundwater_wris",
    dateColumn: "reading_date",
    // Tracks the SERIES, not the scrape. `ingested_at` looks like the better
    // "did our job run" signal but is not: it only moves on INSERT, so a run
    // that re-upserts unchanged rows leaves it untouched (verified 2026-07-26).
    //
    // CURRENTLY ALERTING, CORRECTLY: WRIS telemetry for Madurai + Bangalore
    // stops at 2026-06-04. Left alerting on purpose rather than tuned away -
    // an upstream that stopped publishing is a finding. Delhi shows the same
    // pattern (its telemetry stopped 2025-09-20), so this may be systemic to
    // WRIS rather than per-district.
    maxAgeDays: 21,
    note: "India-WRIS station series (daily pipeline step, Madurai + Bangalore)",
  },
];

// Edition-watches (did UPSTREAM publish something new?) do not belong here -
// register them in scripts/source-registry/ (check-upstream-editions.ts).
// The TN Cauvery stretch-WQ watch moved there as `tnpcb-prs-cauvery`.

// Cities allowed to skip a derived check, with the reason on record.
// (Empty today - add `"<cityId>:<feedId>": "reason"` entries only when a
// feed genuinely cannot exist for that city.)
const EXEMPTIONS: Record<string, string> = {};

/* ── Derivation ────────────────────────────────────────────────────────── */
interface Check {
  id: string;
  cityId: string;
  kind: "supabase-reservoir" | "supabase-table" | "file";
  maxAgeDays: number;
  // supabase-table: any table with a date column (GEE outputs, WRIS series)
  dateColumn?: string;
  /** Optional city filter; omit for tables that are not city-keyed. */
  cityColumn?: string;
  // supabase-reservoir uses the two reservoir tables; supabase-table accepts
  // any dated table, so this is widened rather than kept as a union.
  table?: string;
  sourceCode?: string;
  // file
  file?: string;
  dateFrom?: string;
  note?: string;
}

function deriveChecks(places: PlaceConfig[]): { checks: Check[]; problems: string[] } {
  const checks: Check[] = [];
  const problems: string[] = [];

  for (const place of places) {
    const cityId = place.cityId;

    // 1. Reservoir feeds - one check per feed-backed source.
    const feedSources = (place.waterSources ?? []).filter(
      (s) => s.hasPublicFeed !== false,
    );
    const table =
      place.reservoirDataSource === "legacy-v1"
        ? "reservoir_daily"
        : "reservoir_daily_v2";
    if (feedSources.length > 0) {
      if (table === "reservoir_daily") {
        // Legacy table has no source_code column - one city-level check.
        checks.push({
          id: `${cityId}:reservoir`,
          cityId,
          kind: "supabase-reservoir",
          table,
          maxAgeDays: RESERVOIR_MAX_AGE_OVERRIDES[cityId] ?? RESERVOIR_MAX_AGE_DAYS,
          note: `${feedSources.length} reservoirs, legacy table`,
        });
      } else {
        for (const s of feedSources) {
          const key = `${cityId}:reservoir:${s.sourceCode}`;
          if (EXEMPTIONS[key]) continue;
          checks.push({
            id: key,
            cityId,
            kind: "supabase-reservoir",
            table,
            sourceCode: s.sourceCode,
            maxAgeDays: RESERVOIR_MAX_AGE_OVERRIDES[cityId] ?? RESERVOIR_MAX_AGE_DAYS,
            note: s.displayName,
          });
        }
      }
    }

    // 2. Daily provisional rainfall - required for every registered city.
    const rainfallKey = `${cityId}:rainfall-recent`;
    const rainfallFile = `public/data/rainfall-recent-${cityId}.json`;
    if (!EXEMPTIONS[rainfallKey]) {
      if (!existsSync(resolve(ROOT, rainfallFile))) {
        problems.push(
          `${cityId}: missing ${rainfallFile} - wire the city into ` +
            `fetch_recent_rainfall.py + rainfall-recent-refresh.yml, or add an ` +
            `EXEMPTIONS entry ("${rainfallKey}") with the reason.`,
        );
      } else {
        checks.push({
          id: rainfallKey,
          cityId,
          kind: "file",
          file: rainfallFile,
          dateFrom: "json:generated_at",
          maxAgeDays: RAINFALL_MAX_AGE_DAYS,
          note: "Open-Meteo provisional daily fill",
        });
      }
    }
  }

  // 3. Extra feeds.
  const cityIds = new Set(places.map((p) => p.cityId));
  for (const t of EXTRA_TABLE_FEEDS) {
    if (!cityIds.has(t.cityId)) {
      problems.push(`extra table feed ${t.id}: unknown cityId ${t.cityId}`);
      continue;
    }
    checks.push({ ...t, kind: "supabase-table" });
  }
  for (const f of EXTRA_FEEDS) {
    if (!cityIds.has(f.cityId)) {
      problems.push(`extra feed ${f.id}: unknown cityId ${f.cityId}`);
      continue;
    }
    if (!existsSync(resolve(ROOT, f.file))) {
      problems.push(`extra feed ${f.id}: file not found: ${f.file}`);
      continue;
    }
    checks.push({ ...f, kind: "file" });
  }

  return { checks, problems };
}

/* ── Date extraction for file feeds ────────────────────────────────────── */
function extractFileDate(check: Check): string | null {
  const raw = readFileSync(resolve(ROOT, check.file!), "utf-8");
  const spec = check.dateFrom!;
  if (spec.startsWith("json:")) {
    const field = spec.slice(5);
    const v = JSON.parse(raw)[field];
    return typeof v === "string" ? v.slice(0, 10) : null;
  }
  if (spec.startsWith("regex:")) {
    const m = raw.match(new RegExp(spec.slice(6)));
    return m?.[1] ?? null;
  }
  return null;
}

/* ── Supabase (plain REST, no client dep) ──────────────────────────────── */
function loadEnv(): { url: string; key: string } {
  let url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  let key =
    process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if ((!url || !key) && existsSync(resolve(ROOT, ".env.local"))) {
    for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf-8").split("\n")) {
      const i = line.indexOf("=");
      if (i < 0 || line.startsWith("#")) continue;
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      if (!url && (k === "SUPABASE_URL" || k === "NEXT_PUBLIC_SUPABASE_URL")) url = v;
      if (!key && (k === "SUPABASE_SERVICE_KEY" || k === "NEXT_PUBLIC_SUPABASE_ANON_KEY"))
        key = v;
    }
  }
  if (!url || !key) {
    console.error("Supabase env missing (SUPABASE_URL / SUPABASE_SERVICE_KEY).");
    process.exit(2);
  }
  return { url, key };
}

/**
 * Latest date in any dated Supabase table. This is the P5-1 half of the
 * checker: several artifacts are written by scheduled workflows straight into
 * Supabase (GEE satellite summaries, reservoir catchment context, WRIS
 * groundwater), so neither the file-feed path below nor the edition registry
 * could see them. If one of those workflows silently stops, nothing alerted.
 */
async function latestTableDate(
  env: { url: string; key: string },
  check: Check,
): Promise<string | null> {
  const filter = check.cityColumn ? `&${check.cityColumn}=eq.${check.cityId}` : "";
  const params = `select=${check.dateColumn}&order=${check.dateColumn}.desc&limit=1${filter}`;
  const res = await fetch(`${env.url}/rest/v1/${check.table}?${params}`, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
  });
  if (!res.ok) throw new Error(`supabase ${res.status} for ${check.id}`);
  const rows = (await res.json()) as Record<string, string>[];
  const v = rows[0]?.[check.dateColumn!];
  return v ? v.slice(0, 10) : null;
}

async function latestReservoirDate(
  env: { url: string; key: string },
  check: Check,
): Promise<string | null> {
  const params =
    check.table === "reservoir_daily"
      ? `select=date&order=date.desc&limit=1`
      : `select=date&city_id=eq.${check.cityId}&source_code=eq.${check.sourceCode}&order=date.desc&limit=1`;
  const res = await fetch(`${env.url}/rest/v1/${check.table}?${params}`, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
  });
  if (!res.ok) throw new Error(`supabase ${res.status} for ${check.id}`);
  const rows = (await res.json()) as { date: string }[];
  return rows[0]?.date ?? null;
}

/* ── Main ──────────────────────────────────────────────────────────────── */
function ageDays(dateStr: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(dateStr + "T00:00:00Z").getTime()) / 86_400_000);
}

async function main() {
  const mode = process.argv.includes("--check")
    ? "check"
    : process.argv.includes("--validate")
      ? "validate"
      : null;
  if (!mode) {
    console.error("Usage: check-data-freshness.ts --validate | --check");
    process.exit(2);
  }

  const places = listAllPlaces();
  const { checks, problems } = deriveChecks(places);

  if (mode === "validate") {
    console.log(`Freshness registry: ${checks.length} checks derived across ${places.length} cities.`);
    for (const p of problems) console.error(`  FAIL: ${p}`);
    if (problems.length) {
      console.error(
        "\nOnboarding a new city? Every registered city must have checkable feeds - " +
          "see the header of scripts/check-data-freshness.ts.",
      );
      process.exit(1);
    }
    console.log("All cities have checkable feeds.");
    return;
  }

  // --check
  if (problems.length) {
    // A broken registry is itself a staleness alert - report, don't hide.
    console.error("Registry problems (fix via --validate):");
    for (const p of problems) console.error(`  ${p}`);
  }

  const env = loadEnv();
  const now = new Date();
  type Row = { check: Check; last: string | null; age: number | null; stale: boolean; error?: string };
  const rows: Row[] = [];

  for (const check of checks) {
    try {
      const last =
        check.kind === "file"
          ? extractFileDate(check)
          : check.kind === "supabase-table"
            ? await latestTableDate(env, check)
            : await latestReservoirDate(env, check);
      if (!last) {
        rows.push({ check, last: null, age: null, stale: true, error: "no date found" });
        continue;
      }
      const age = ageDays(last, now);
      rows.push({ check, last, age, stale: age > check.maxAgeDays });
    } catch (e) {
      rows.push({ check, last: null, age: null, stale: true, error: String(e).slice(0, 120) });
    }
  }

  const stale = rows.filter((r) => r.stale);
  const lines: string[] = [];
  lines.push(`## Data freshness - ${now.toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(
    stale.length === 0
      ? `All ${rows.length} feeds fresh.`
      : `**${stale.length} of ${rows.length} feeds stale.**`,
  );
  lines.push("");
  lines.push("| feed | city | last data | age (d) | max | status |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of rows.sort((a, b) => Number(b.stale) - Number(a.stale))) {
    lines.push(
      `| ${r.check.id} | ${r.check.cityId} | ${r.last ?? "-"} | ${r.age ?? "-"} | ` +
        `${r.check.maxAgeDays} | ${r.stale ? `STALE${r.error ? ` (${r.error})` : ""}` : "ok"} |`,
    );
  }
  if (problems.length) {
    lines.push("");
    lines.push("Registry problems:");
    for (const p of problems) lines.push(`- ${p}`);
  }

  const report = lines.join("\n");
  writeFileSync(resolve(ROOT, "freshness-report.md"), report);
  console.log(report);
  if (stale.length || problems.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
