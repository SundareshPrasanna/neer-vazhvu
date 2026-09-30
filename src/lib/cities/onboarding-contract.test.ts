/**
 * The onboarding contract: what a city must declare before its routes can
 * render its own content rather than a blank, a "coming soon", or another
 * city's facts. The type system enforces most of it (CityId, required config
 * fields, the hero union); this covers the rules that span config and content.
 * A failure names the city and what it is missing.
 */
import { strict as assert } from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { scopeCountry, scopeIds, scopeKind } from "../scopes";
import { CITY_IDS, tryGetPlaceConfig, type PlaceConfig } from "./index";
import { riversVariant } from "./data-paths";
import { RIVERS_CONTENT } from "../../content/rivers";
import { FLOOD_CONTENT } from "../../content/flood";
import { STORY_TAGLINES } from "../../content/story-taglines";

const places: PlaceConfig[] = CITY_IDS.map((id) => {
  const config = tryGetPlaceConfig(id);
  assert.ok(config, `${id}: in CITY_IDS but not in the registry`);
  return config;
});

test("every registered city is keyed by its own id", () => {
  for (const [i, place] of places.entries()) assert.equal(place.cityId, CITY_IDS[i]);
});

test("every city ships a dashboard and an About page", () => {
  for (const p of places) {
    assert.ok(p.routes.includes(""), `${p.cityId}: routes lacks the dashboard ("")`);
    assert.ok(p.routes.includes("about"), `${p.cityId}: routes lacks "about"`);
  }
});

test("every city has its own landing hook and footer sources", () => {
  for (const p of places) {
    assert.ok(p.landing.hook.trim(), `${p.cityId}: empty landing.hook`);
    assert.ok(p.footerSources.length > 0, `${p.cityId}: no footerSources`);
    for (const s of p.footerSources) assert.match(s.href, /^https:\/\//, `${p.cityId}: footer source ${s.label}`);
  }
});

test("a rivers route has curated river content (or its own variant)", () => {
  for (const p of places.filter((p) => p.routes.includes("rivers"))) {
    assert.ok(
      riversVariant(p.cityId) || RIVERS_CONTENT[p.cityId]?.riverInfo,
      `${p.cityId}: "rivers" is in routes but src/content/rivers has no riverInfo for it`,
    );
  }
});

test("a flood-risk route has a renderer: the interactive variant, a flood map or a flood config", () => {
  for (const p of places.filter((p) => p.routes.includes("flood-risk"))) {
    const content = FLOOD_CONTENT[p.cityId];
    assert.ok(
      p.flood?.variant === "interactive" || content?.map || content?.config,
      `${p.cityId}: "flood-risk" is in routes but it has no variant and no src/content/flood map or config`,
    );
  }
});

test("a my-ward route has ward geometry", () => {
  for (const p of places.filter((p) => p.routes.includes("my-ward"))) {
    assert.ok(p.wardsVintage, `${p.cityId}: "my-ward" is in routes but wardsVintage is null`);
  }
});

test("an Origins route has a tagline", () => {
  for (const p of places.filter((p) => p.routes.includes("origins"))) {
    assert.ok(STORY_TAGLINES[p.cityId]?.trim(), `${p.cityId}: no STORY_TAGLINES entry`);
  }
});

test("a days-left hero has the city's own demand figure", () => {
  for (const p of places.filter((p) => p.heroMode === "days-left")) {
    assert.ok(p.defaultConsumptionMld != null, `${p.cityId}: days-left hero without defaultConsumptionMld`);
  }
});

// One place registry: schemas/nvdm/scopes.json names every place; configs and the seeded cities table must agree with it.
test("the scope registry, the city configs and the seeded cities table agree", () => {
  const scoped = scopeIds("city", "region");
  const dir = join(process.cwd(), "supabase", "migrations");
  const sql = readdirSync(dir).sort().map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
  // Seeded = inserted and not since deleted, in migration order (051 retires the Kaveri Delta row 018 seeded).
  const seeded = new Set<string>();
  for (const [, added, removed] of sql.matchAll(/INSERT INTO cities \([^)]*\)\s*VALUES\s*\(\s*'([^']+)'|DELETE FROM cities WHERE city_id = '([^']+)'/g)) {
    if (added) seeded.add(added);
    else seeded.delete(removed);
  }
  assert.deepEqual([...CITY_IDS].sort(), [...scoped].sort(), "CITY_IDS and the city/region scopes differ");
  for (const p of places) {
    assert.equal(scopeKind(p.cityId), p.placeKind ?? "city", `${p.cityId}: placeKind disagrees with schemas/nvdm/scopes.json`);
    assert.ok(scopeCountry(p.cityId), `${p.cityId}: no single country through administrative-parent`);
    assert.ok(seeded.has(p.cityId), `${p.cityId}: no cities row seeded in supabase/migrations`);
  }
  for (const id of seeded) {
    assert.ok(scoped.includes(id), `${id}: seeded in supabase/migrations but not a city or region scope`);
  }
});
