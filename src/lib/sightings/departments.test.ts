import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  actionsFor,
  actorKey,
  departmentKey,
  departmentMove,
  departmentOf,
  findDepartment,
  historyFor,
  signDepartment,
  summarise,
  verifyDepartmentToken,
  type KeyedEvent,
  type RoutableRow,
} from "./departments";
import { STATE_ROUTING } from "./routing/states";
import type { AuthorityRole } from "./taxonomy";

const SECRET = "s".repeat(32);
const OTHER_SECRET = "t".repeat(40);

const row = (stateCode: string, placeId: string, role: string | null, corporationId: string | null = null): RoutableRow => ({
  authority_role: role,
  state_code: stateCode,
  place_id: placeId,
  place_kind: "city",
  corporation_id: corporationId,
});

/** A state-level body: places with no entry of their own (basins) fall back to it. */
function stateBody(): { stateCode: string; role: AuthorityRole; body: string } {
  for (const [stateCode, s] of Object.entries(STATE_ROUTING))
    for (const [role, a] of Object.entries(s.roles)) if (a) return { stateCode, role: role as AuthorityRole, body: a.body };
  throw new Error("no state-level body in routing");
}

test("a department key is stable, ignores spacing and case, and differs by state and body", () => {
  const k = departmentKey("TN", "Tamil Nadu Pollution Control Board");
  assert.match(k, /^[0-9a-f]{16}$/);
  assert.equal(departmentKey("tn", "  tamil nadu   pollution control board "), k);
  assert.notEqual(departmentKey("KA", "Tamil Nadu Pollution Control Board"), k);
  assert.notEqual(departmentKey("TN", "Tamil Nadu Water Supply and Drainage Board"), k);
});

test("a signed link verifies only with its secret, its key and an untouched signature", () => {
  const key = departmentKey("TN", "Body A");
  const token = signDepartment(key, SECRET)!;
  assert.match(token, /^[0-9a-f]{16}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(signDepartment(key, SECRET), token);
  assert.equal(verifyDepartmentToken(token, SECRET), key);
  assert.equal(verifyDepartmentToken(token, OTHER_SECRET), null);

  const [k, sig] = token.split(".");
  const tampered = `${sig.slice(0, -2)}${sig.at(-2) === "A" ? "B" : "A"}${sig.at(-1)}`;
  assert.equal(verifyDepartmentToken(`${k}.${tampered}`, SECRET), null);
  assert.equal(verifyDepartmentToken(`${departmentKey("TN", "Body B")}.${sig}`, SECRET), null, "a signature is bound to its key");
  for (const bad of ["", k, `${token}.x`, `${k.toUpperCase()}.${sig}`, `${k}.${sig}=`, `${k}.`, `.${sig}`, null, undefined, 42])
    assert.equal(verifyDepartmentToken(bad, SECRET), null, String(bad));
});

test("links are off without a secret of at least 32 characters", () => {
  const key = departmentKey("TN", "Body A");
  const token = signDepartment(key, SECRET);
  assert.equal(signDepartment(key, null), null);
  assert.equal(signDepartment(key, "short"), null);
  assert.equal(verifyDepartmentToken(token, "s".repeat(31)), null);
  assert.equal(signDepartment("not-a-key", SECRET), null);

  const saved = process.env.SIGHTINGS_DEPARTMENT_LINK_SECRET;
  try {
    delete process.env.SIGHTINGS_DEPARTMENT_LINK_SECRET;
    assert.equal(signDepartment(key), null);
    assert.equal(verifyDepartmentToken(token), null);
    process.env.SIGHTINGS_DEPARTMENT_LINK_SECRET = SECRET;
    assert.equal(signDepartment(key), token);
    assert.equal(verifyDepartmentToken(token), key);
  } finally {
    if (saved === undefined) delete process.env.SIGHTINGS_DEPARTMENT_LINK_SECRET;
    else process.env.SIGHTINGS_DEPARTMENT_LINK_SECRET = saved;
  }
});

test("every routed body is a department its link can name, and no two bodies share a key", () => {
  const names = new Map<string, string>();
  for (const [stateCode, s] of Object.entries(STATE_ROUTING))
    for (const [placeId, p] of Object.entries(s.places)) {
      const tables: [string | null, typeof p.roles][] = [[null, p.roles], ...Object.entries(p.corporations ?? {})];
      for (const [corp, table] of tables)
        for (const [role, a] of Object.entries(table)) {
          if (!a) continue;
          const d = departmentOf(row(stateCode, placeId, role, corp));
          assert.ok(d, `${stateCode}/${placeId}/${corp ?? "-"}/${role}`);
          assert.equal(d.body, a.body);
          assert.equal(d.key, departmentKey(stateCode, a.body));
          assert.equal(findDepartment(d.key)?.key, d.key);
          const name = `${stateCode}\n${a.body.trim().replace(/\s+/g, " ").toLowerCase()}`;
          assert.equal(names.get(d.key) ?? name, name, `key collision: ${d.key}`);
          names.set(d.key, name);
        }
    }
  assert.ok(names.size > 100);
  assert.equal(findDepartment("0000000000000000"), null);
});

test("the same body across places is one department", () => {
  const { stateCode, role, body } = stateBody();
  const a = departmentOf(row(stateCode, "basin-one", role));
  const b = departmentOf(row(stateCode, "basin-two", role));
  assert.equal(a?.body, body);
  assert.equal(a?.key, b?.key);
  assert.equal(departmentOf(row(stateCode, "basin-one", null)), null, "a report no body handles has no department");
});

test("department marks move the status only where they fit; not ours records only", () => {
  assert.deepEqual(departmentMove("action_taken", "open"), { ok: true, next: "authority_done" });
  assert.deepEqual(departmentMove("action_taken", "authority_done"), { ok: true, next: "authority_done" });
  assert.deepEqual(departmentMove("closed", "reported"), { ok: true, next: "closed" });
  assert.deepEqual(departmentMove("not_ours", "open"), { ok: true, next: null });
  assert.equal(departmentMove("not_ours", "fixed").ok, false);
  assert.equal(departmentMove("closed", "closed").ok, false);
  assert.equal(departmentMove("action_taken", "fixed").ok, false);
  assert.equal(departmentMove("action_taken", null).ok, false);
  assert.deepEqual(actionsFor("open"), ["action_taken", "not_ours", "closed"]);
  assert.deepEqual(actionsFor("closed"), []);
});

test("a department's history is the public one plus its own marks and notes, and nothing about the reporter", () => {
  const key = departmentKey("TN", "Body A");
  const other = departmentKey("TN", "Body B");
  const ev = (event: string, actor_role: KeyedEvent["actor_role"], actor_key: string, reason: string | null = null): KeyedEvent => ({
    sighting_id: "s1",
    created_at: "2026-10-16T20:00:00Z",
    actor_role,
    actor_key,
    event,
    authority_body: "typed by the reporter",
    reference: "REF-123",
    reason,
  });
  const history = historyFor(
    [
      ev("submitted", "reporter", "a".repeat(64)),
      ev("approved", "reviewer", "b".repeat(64), "reviewer reason"),
      ev("reported", "reporter", "a".repeat(64), "reporter reason"),
      ev("not_ours", "department", actorKey(key), "The ward office handles this"),
      ev("not_ours", "department", actorKey(other), "another body's note"),
      ev("action_taken", "department", actorKey(other), "another body's note"),
    ],
    key,
    new Set(["approved", "reported", "action_taken"]),
  );
  assert.deepEqual(
    history.map((e) => [e.event, e.by, e.note]),
    [
      ["approved", "reviewer", null],
      ["reported", "reporter", null],
      ["not_ours", "department", "The ward office handles this"],
      ["action_taken", "department", null],
    ],
  );
  assert.equal(history[0].at, "2026-10-17", "dates are India dates");
  const text = JSON.stringify(history);
  for (const secret of ["REF-123", "typed by the reporter", "a".repeat(64), "reporter reason", "reviewer reason"]) assert.ok(!text.includes(secret), secret);
});

test("department counts: open and all per body, and its own not-ours marks", () => {
  const { stateCode, role, body } = stateBody();
  const key = departmentKey(stateCode, body);
  const r = (id: string, authorityRole: string | null, caseStatus: "open" | "reported" | "closed" | null) => ({
    ...row(stateCode, `basin-${id}`, authorityRole),
    id,
    case_status: caseStatus,
  });
  const summary = summarise(
    [r("1", role, "open"), r("2", role, "reported"), r("3", role, "closed"), r("4", null, null), r("5", role, null)],
    [
      { sighting_id: "1", actor_key: actorKey(key) },
      { sighting_id: "2", actor_key: actorKey("ffffffffffffffff") },
    ],
  );
  assert.equal(summary.length, 1);
  assert.deepEqual({ ...summary[0], acronym: undefined }, { key, body, acronym: undefined, open: 2, all: 3, notOurs: 1 });
});
