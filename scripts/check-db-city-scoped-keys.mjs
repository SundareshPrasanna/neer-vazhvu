import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const migration026 = readFileSync(
  join(root, "supabase/migrations/026_multi_city_city_id.sql"),
  "utf8",
);
const migration035 = readFileSync(
  join(root, "supabase/migrations/035_m0_city_scoped_keys.sql"),
  "utf8",
);
const riverLevelScript = readFileSync(
  join(root, "neer-vazhvu-api/scripts/scrape_wris_river_level_madurai.py"),
  "utf8",
);
const rainfallScript = readFileSync(
  join(root, "neer-vazhvu-api/scripts/scrape_wris_rainfall_madurai.py"),
  "utf8",
);

const expectedIndexes = [
  "weather_daily_city_date_uidx",
  "water_estimate_daily_city_date_uidx",
  "daily_briefing_city_briefing_date_uidx",
  "groundwater_monthly_city_ward_year_month_uidx",
  "ward_risk_score_city_ward_computed_date_uidx",
  "ward_narrative_city_ward_narrative_date_uidx",
  "groundwater_wris_city_station_reading_date_uidx",
  "wris_river_level_city_station_reading_date_uidx",
  "wris_rainfall_city_station_reading_date_uidx",
  "water_bodies_census_city_census_code_uidx",
  "reservoir_catchment_context_city_reservoir_date_window_uidx",
  "water_body_satellite_summary_city_target_date_uidx",
];

const failures = [];

function maduraiDistrictList(sql) {
  const match = sql.match(
    /WHEN\s+lower\(btrim\(d\)\)\s+IN\s+\(([^)]*)\)\s+THEN\s+'madurai'/i,
  );
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map(([, district]) => district.toLowerCase());
}

if (/ALTER\s+TABLE\s+groundwater_wris_latest\s+ADD\s+COLUMN/i.test(migration026)) {
  failures.push(
    "026 must not ALTER groundwater_wris_latest; it is a view and should be recreated.",
  );
}

if (!/DISTINCT\s+ON\s*\(\s*city_id\s*,\s*station_code\s*\)/i.test(migration026)) {
  failures.push("026 groundwater_wris_latest view must be city-aware.");
}

const migration026MaduraiDistricts = maduraiDistrictList(migration026);
const migration035MaduraiDistricts = maduraiDistrictList(migration035);
for (const district of ["madurai", "theni", "dindigul", "virudhunagar"]) {
  if (!migration026MaduraiDistricts.includes(district)) {
    failures.push(`026 must map ${district} district strings to madurai.`);
  }
  if (!migration035MaduraiDistricts.includes(district)) {
    failures.push(`035 must map ${district} district strings to madurai.`);
  }
}

for (const indexName of expectedIndexes) {
  const pattern = new RegExp(
    `CREATE\\s+UNIQUE\\s+INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+${indexName}\\b`,
    "i",
  );
  if (!pattern.test(migration035)) {
    failures.push(`035 is missing city-aware unique index ${indexName}.`);
  }
}

if (!/DROP\s+VIEW\s+IF\s+EXISTS\s+groundwater_wris_latest/i.test(migration035)) {
  failures.push("035 must recreate groundwater_wris_latest.");
}

if (!/LEFT\s+JOIN\s+recent\s+r\s+USING\s*\(\s*city_id\s*,\s*station_code\s*\)/i.test(migration035)) {
  failures.push("035 groundwater_wris_latest must join recent readings by city and station.");
}

if (/DROP\s+CONSTRAINT/i.test(migration035)) {
  failures.push("035 must not drop old constraints; writer cutover happens later.");
}

if (!/"city_id":\s*"madurai"/.test(riverLevelScript)) {
  failures.push("Madurai WRIS river-level script must stamp city_id='madurai'.");
}

if (!/"city_id":\s*"madurai"/.test(rainfallScript)) {
  failures.push("Madurai WRIS rainfall script must stamp city_id='madurai'.");
}

// Fixture-driven district-mapping check (review 2026-07-30: the suffixed-only
// Delhi alias list let real WRIS values like 'SOUTH' and 'NORTH EAST' fall
// through to chennai). Keep DELHI_ALIASES in sync with 035's CASE - the sync
// itself is asserted below.
const DELHI_ALIASES = [
  "delhi", "new delhi", "shahdara",
  "central", "north", "south", "east", "west",
  "north east", "north west", "south east", "south west",
  "central delhi", "north delhi", "south delhi", "east delhi", "west delhi",
  "north east delhi", "north west delhi", "south east delhi", "south west delhi",
];
for (const alias of DELHI_ALIASES) {
  if (!migration035.includes(`'${alias}'`)) {
    failures.push(`035 CASE is missing Delhi district alias '${alias}' (guard list out of sync).`);
  }
}
const delhiFixture = JSON.parse(
  readFileSync(join(root, "public/data/delhi-cgwb-stations.json"), "utf8"),
);
// Per-well districts only: these model the values that reach the DB's
// district column. The artifact's top-level `district` is a descriptive
// label ("Delhi NCT (all 11 districts)"), not row data.
const fixtureDistricts = new Set(
  (delhiFixture.wells ?? [])
    .map((w) => w.district)
    .filter((d) => typeof d === "string"),
);
if (fixtureDistricts.size === 0) {
  failures.push("Delhi fixture has no per-well districts - guard cannot verify the mapping.");
}
for (const d of fixtureDistricts) {
  if (!DELHI_ALIASES.includes(d.trim().toLowerCase())) {
    failures.push(
      `Delhi fixture district '${d}' would fall through to chennai in 035's mapping.`,
    );
  }
}

if (failures.length > 0) {
  console.error("DB city-scoped key check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("DB city-scoped key check passed.");
