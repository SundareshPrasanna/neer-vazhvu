import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { FeatureCollection } from "geojson";

import { containing, indexPolygons, nearest } from "./locate";
import { PARAMETERS, assess, getParameter } from "./parameters";
import { resolveAuthority } from "./routing";
import { NATIONAL_CHANNELS } from "./routing/national";
import { STATE_ROUTING } from "./routing/states";
import type { Authority } from "./routing/types";
import { nextCaseStatus } from "./status";
import { AUTHORITY_ROLES, OTHER_KEY, REPORT_GROUPS, isPrivateCategory, isValidReport, roleFor, takesReadings } from "./taxonomy";
import { parseSubmit } from "./validate";

test("report types are unique and every role is a known role", () => {
  const keys = new Set<string>();
  for (const g of REPORT_GROUPS) {
    assert.ok(!keys.has(g.key) && g.key !== OTHER_KEY, g.key);
    keys.add(g.key);
    const types = new Set(g.types.map((t) => t.key));
    assert.equal(types.size, g.types.length, `${g.key}: duplicate type`);
    for (const t of g.types) {
      const role = roleFor(g.key, t.key);
      assert.ok(role === null || AUTHORITY_ROLES.includes(role), `${g.key}/${t.key}`);
    }
  }
});

test("a report names a type of its group; other names none", () => {
  assert.ok(isValidReport("sewage", "effluent_discharge"));
  assert.ok(!isValidReport("sewage", "algae"));
  assert.ok(!isValidReport("sewage", null));
  assert.ok(isValidReport(OTHER_KEY, null));
  assert.ok(!isValidReport(OTHER_KEY, "algae"));
  assert.equal(roleFor("sewage", "effluent_discharge"), "pollution_control");
  assert.equal(roleFor("sewage", "manhole_overflow"), "sewerage");
  assert.equal(roleFor("drinking", "borewell_quality"), null);
  assert.ok(isPrivateCategory("drinking") && !isPrivateCategory("dumping"));
});

test("status moves only along allowed paths", () => {
  assert.equal(nextCaseStatus("reported", "open"), "reported");
  assert.equal(nextCaseStatus("still_there", "authority_done"), "reported");
  assert.equal(nextCaseStatus("fixed", "closed"), null);
  assert.equal(nextCaseStatus("reopened", "fixed"), "open");
  assert.equal(nextCaseStatus("reported", null), null);
});

test("a point lands in the polygon that contains it, and ranks centroids by distance", () => {
  const square = (x: number, id: string) => ({
    type: "Feature" as const,
    properties: { id },
    geometry: { type: "Polygon" as const, coordinates: [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]] },
  });
  const index = indexPolygons({ type: "FeatureCollection", features: [square(0, "a"), square(2, "b")] } as FeatureCollection);
  assert.equal(containing(index, 2.5, 0.5)?.properties?.id, "b");
  assert.equal(containing(index, 1.5, 0.5), null);
  const gp = nearest([{ id: 1, centroid: [80, 13] as [number, number] }, { id: 2, centroid: [80.1, 13] as [number, number] }], 80.08, 13);
  assert.equal(gp?.id, 2);
});

test("routing layers: corporation, then place, then state; national channels by place kind", () => {
  const r = resolveAuthority("storm_drainage", { stateCode: "KA", placeId: "bangalore", placeKind: "city", corporationId: "north" });
  assert.equal(r.layer, "corporation");
  assert.ok(r.national.some((c) => c.label.startsWith("Swachhata")));
  const rural = resolveAuthority("solid_waste", { stateCode: "TN", placeId: "tn-thanjavur", placeKind: "district" });
  assert.equal(rural.layer, "place");
  assert.ok(!rural.national.some((c) => c.label.startsWith("Swachhata")), "Swachhata is urban only");
  assert.equal(resolveAuthority("sewerage", { stateCode: "ZZ", placeId: "nowhere", placeKind: "city" }).authority, null);
});

test("every routing link is https, mailto or a phone, and every body cites an https source", () => {
  const authorities: [string, Authority][] = [];
  for (const [code, s] of Object.entries(STATE_ROUTING)) {
    assert.equal(s.stateCode, code);
    for (const [role, a] of Object.entries(s.roles)) authorities.push([`${code}.${role}`, a!]);
    for (const [pid, p] of Object.entries(s.places)) {
      for (const [role, a] of Object.entries(p.roles)) authorities.push([`${pid}.${role}`, a!]);
      for (const [cid, t] of Object.entries(p.corporations ?? {})) {
        for (const [role, a] of Object.entries(t)) authorities.push([`${pid}/${cid}.${role}`, a!]);
      }
    }
  }
  assert.ok(authorities.length > 0);
  const channels = [...authorities.flatMap(([w, a]) => a.channels.map((c) => [w, c] as const)), ...NATIONAL_CHANNELS.map((c) => ["national", c] as const)];
  for (const [where, a] of authorities) assert.match(a.source, /^https:\/\//, `${where}: source`);
  for (const [where, c] of channels) {
    assert.ok(c.url || c.phone, `${where}: ${c.label} has no url or phone`);
    if (c.url) assert.match(c.url, /^(https:\/\/|mailto:)/, `${where}: ${c.url}`);
  }
});

test("water-test results read against BIS IS 10500:2012 as amended in 2015", () => {
  const p = (k: string) => getParameter(k)!;
  assert.equal(assess(p("tds"), 400), null);
  assert.match(assess(p("tds"), 640)!, /acceptable limit of 500, within the 2,000/);
  assert.match(assess(p("fluoride"), 1.6)!, /limit of 1.5 even where/);
  assert.equal(assess(p("iron"), 0.8), null, "Amendment 1 (2015): iron acceptable 1.0");
  assert.match(assess(p("arsenic"), 0.02)!, /BIS limit of 0.01$/, "Amendment 1 (2015): arsenic no relaxation");
  assert.match(assess(p("ph"), 9)!, /outside/);
  assert.match(assess(p("chlorine"), 0.1)!, /below/);
  assert.ok(assess(p("bacteria"), 1) && assess(p("bacteria"), 0) === null);
  assert.equal(new Set(PARAMETERS.map((x) => x.key)).size, PARAMETERS.length);
});

test("a water test needs at least one in-range result and its source", () => {
  assert.ok(takesReadings("drinking", "water_test") && roleFor("drinking", "water_test") === null);
  const form = (extra: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ lat: "13.0", lng: "80.2", category: "drinking", subcategory: "water_test", ...extra })) f.append(k, v);
    f.append("photos", new File([new Uint8Array(20)], "meter.jpg", { type: "image/jpeg" }));
    return f;
  };
  assert.equal(parseSubmit(form({ waterSource: "borewell" })).ok, false);
  assert.equal(parseSubmit(form({ "reading.tds": "640" })).ok, false, "source required");
  assert.equal(parseSubmit(form({ "reading.tds": "99999", waterSource: "borewell" })).ok, false);
  const ok = parseSubmit(form({ "reading.tds": "640", "reading.fluoride": "1.2", waterSource: "borewell" }));
  assert.ok(ok.ok && ok.value.readings?.tds === 640 && ok.value.readings?.fluoride === 1.2 && ok.value.waterSource === "borewell");
});
