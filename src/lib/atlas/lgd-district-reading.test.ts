import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { LGD_FIXTURE_DISTRICTS, buildFixtureAggregate, buildFixtureReading, fixturePath } from "./test-support";

/** Every string in the reading, however nested. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => strings(v, out));
  return out;
}

for (const fixture of LGD_FIXTURE_DISTRICTS) {
  const present = existsSync(fixturePath(fixture.slug, "directory.json"));

  test(`${fixture.slug}: the reading speaks the state's own vocabulary`, { skip: !present && "fixture not cut yet" }, () => {
    const reading = buildFixtureReading(fixture.slug);
    assert.equal(reading.groundwater.unitLabel, "taluka");
    const all = strings(reading);
    assert.ok(all.some((s) => /taluka/.test(s)), "the taluka is named");
    assert.ok(!all.some((s) => /\btaluks?\b/.test(s)), `no Tamil Nadu unit name leaks: ${all.filter((s) => /\btaluks?\b/.test(s))[0] ?? ""}`);
    assert.ok(!all.some((s) => /TNGIS|Mettur|TNRD|Season and Crop/.test(s)), "no Tamil Nadu source or basin leaks");
    assert.ok(all.some((s) => /District Socio-Economic Review/.test(s)), "the state's own irrigation gap is named");
    assert.ok(reading.vintages.some((row) => /LGD edition/.test(row.describes)), "the identity vintage is the LGD edition");
    assert.ok(reading.vintages.some((row) => /register's own membership/.test(row.note)), "the projection says how the taluka reached the Panchayat");
    assert.equal(reading.mettur, null);
  });

  test(`${fixture.slug}: the aggregate's vintages name DataMeet, not TNGIS`, { skip: !present && "fixture not cut yet" }, () => {
    const aggregate = buildFixtureAggregate(fixture.slug, "2026-09-01");
    const boundaries = aggregate.vintages.find((row) => row.label === "Boundaries");
    assert.ok(boundaries && /DataMeet/.test(boundaries.note) && boundaries.represents === "2001");
    const identity = aggregate.vintages.find((row) => row.label === "Panchayat list and codes");
    assert.ok(identity && /Local Government Directory/.test(identity.note) && identity.historical === false);
    assert.ok(!aggregate.vintages.some((row) => /TNGIS|TNRD/.test(row.note)));
  });
}
