import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

import {
  FIXIT_LABELS,
  JOIN_CODE_RE,
  canHost,
  canPlan,
  cleanName,
  cleanText,
  fixitAllowed,
  fixitWhen,
  isGroupKind,
  isoToIstInput,
  istInputToIso,
  newJoinCode,
  normalizeJoinCode,
  reminderDue,
  startsAtProblem,
  type FixitTarget,
} from "./groups";
import { FIXIT_TYPES, REPORT_GROUPS } from "./taxonomy";

const H = 3_600_000;
const NOW = Date.parse("2026-10-18T04:30:00Z"); // 10:00 IST

const report = (subcategory: string | null, over: Partial<FixitTarget> = {}): FixitTarget => ({
  review_status: "approved",
  category: "dumping",
  subcategory,
  case_status: "open",
  ...over,
});

test("join codes: 12 unambiguous characters in three blocks, and typed variants normalise", () => {
  for (let i = 0; i < 200; i++) assert.match(newJoinCode(randomBytes(12)), JOIN_CODE_RE);
  assert.equal(newJoinCode(new Uint8Array(12)), "AAAA-AAAA-AAAA");
  assert.throws(() => newJoinCode(new Uint8Array(8)));
  const code = newJoinCode(randomBytes(12));
  assert.equal(normalizeJoinCode(code.toLowerCase().replace(/-/g, " ")), code);
  assert.equal(normalizeJoinCode(` ${code} `), code);
  assert.equal(normalizeJoinCode("ABCD-EFGH-JKL0"), null, "0 is not in the alphabet");
  assert.equal(normalizeJoinCode("ABCD-EFGH-JKLI"), null, "I is not in the alphabet");
  assert.equal(normalizeJoinCode("ABCD-EFGH"), null);
  assert.equal(normalizeJoinCode(42), null);
  // The stored form fits the column (8 to 40 characters).
  assert.ok(code.length >= 8 && code.length <= 40);
});

test("group names and kinds", () => {
  assert.equal(cleanName("  Anna   University  NSS "), "Anna University NSS");
  assert.equal(cleanName("ab"), null);
  assert.equal(cleanName("123"), null, "needs a letter");
  assert.equal(cleanName("x".repeat(81)), null);
  assert.equal(cleanName("ஏரி குழு"), "ஏரி குழு", "any script");
  assert.ok(isGroupKind("lake_group"));
  assert.ok(!isGroupKind("company"));
  assert.equal(cleanText(undefined, 0, 280), "");
  assert.equal(cleanText("  x ", 3, 160), null);
  assert.equal(cleanText(" Gate 2 ", 3, 160), "Gate 2");
});

test("clean-ups only for litter, floating trash, plastic and ritual waste", () => {
  assert.deepEqual([...FIXIT_TYPES].sort(), ["floating_trash", "garbage_on_bank", "immersion_residue", "plastic_buildup"]);
  assert.equal(FIXIT_LABELS.length, FIXIT_TYPES.size);
  for (const t of FIXIT_TYPES) assert.ok(fixitAllowed(report(t)), t);
  // Never sewage, drains, hazardous, medical or burning waste, dead animals or debris.
  for (const t of ["hazardous_waste", "open_burning", "carcass_waste", "cd_debris"]) assert.ok(!fixitAllowed(report(t)), t);
  for (const g of REPORT_GROUPS.filter((g) => g.key !== "dumping")) for (const t of g.types) assert.ok(!fixitAllowed({ ...report(t.key), category: g.key }), `${g.key}:${t.key}`);
  assert.ok(!fixitAllowed({ ...report(null), category: "other" }));
});

test("clean-ups only on published, open reports", () => {
  assert.ok(fixitAllowed(report("floating_trash", { case_status: "reported" })));
  assert.ok(fixitAllowed(report("floating_trash", { case_status: "authority_done" })));
  for (const s of ["fixed", "closed"] as const) assert.ok(!fixitAllowed(report("floating_trash", { case_status: s })), s);
  assert.ok(!fixitAllowed(report("floating_trash", { case_status: null })));
  for (const s of ["received", "rejected", "needs_info"] as const) assert.ok(!fixitAllowed(report("floating_trash", { review_status: s })), s);
});

test("who may plan: a host of a reviewed group", () => {
  const r = report("plastic_buildup");
  assert.ok(canPlan({ role: "host", status: "approved" }, r));
  assert.ok(!canPlan({ role: "member", status: "approved" }, r));
  assert.ok(!canPlan({ role: "host", status: "pending" }, r));
  assert.ok(!canPlan({ role: "host", status: "rejected" }, r));
  assert.ok(!canPlan(null, r));
  assert.ok(!canPlan({ role: "host", status: "approved" }, report("open_burning")));
  assert.ok(!canHost(undefined));
});

test("start time: between 2 hours and 60 days ahead", () => {
  assert.equal(startsAtProblem(new Date(NOW + 2 * H), NOW), null);
  assert.equal(startsAtProblem(new Date(NOW + 60 * 24 * H), NOW), null);
  assert.match(startsAtProblem(new Date(NOW + 2 * H - 60_000), NOW)!, /2 hours/);
  assert.match(startsAtProblem(new Date(NOW - H), NOW)!, /2 hours/);
  assert.match(startsAtProblem(new Date(NOW + 60 * 24 * H + 60_000), NOW)!, /60 days/);
  assert.match(startsAtProblem(new Date("nonsense"), NOW)!, /Choose/);
});

test("India time in and out", () => {
  assert.equal(istInputToIso("2026-10-25T07:00"), "2026-10-25T01:30:00.000Z");
  assert.equal(istInputToIso("2026-10-25T00:15"), "2026-10-24T18:45:00.000Z");
  assert.equal(istInputToIso("2026-02-31T07:00"), null);
  assert.equal(istInputToIso("2026-10-25T24:00"), null);
  assert.equal(istInputToIso("25/10/2026 7am"), null);
  assert.equal(isoToIstInput(Date.parse("2026-10-25T01:30:00Z")), "2026-10-25T07:00");
  assert.equal(fixitWhen("2026-10-25T01:30:00Z"), "Sunday 25 October, 7:00 am");
  assert.equal(fixitWhen("2026-10-25T12:00:00Z"), "Sunday 25 October, 5:30 pm");
});

test("reminders: once before (within a day), once after (asking hosts for a photo)", () => {
  const f = (startsInHours: number, over: Partial<{ status: "planned" | "done" | "cancelled"; reminded_at: string | null }> = {}) => ({
    status: "planned" as const,
    starts_at: new Date(NOW + startsInHours * H).toISOString(),
    reminded_at: null,
    ...over,
  });
  assert.equal(reminderDue(f(5), NOW), "before");
  assert.equal(reminderDue(f(24), NOW), "before");
  assert.equal(reminderDue(f(25), NOW), null);
  assert.equal(reminderDue(f(5, { reminded_at: new Date(NOW - H).toISOString() }), NOW), null, "already reminded");
  assert.equal(reminderDue(f(5, { status: "cancelled" }), NOW), null);
  // Over (3 h) plus 6 h: ask, once, unless cancelled; never for one long past.
  assert.equal(reminderDue(f(-8), NOW), null);
  assert.equal(reminderDue(f(-9), NOW), "after");
  assert.equal(reminderDue(f(-9, { status: "done" }), NOW), "after");
  assert.equal(reminderDue(f(-9, { status: "cancelled" }), NOW), null);
  assert.equal(reminderDue(f(-9, { reminded_at: new Date(NOW - 10 * H).toISOString() }), NOW), "after", "the reminder before does not count as the ask");
  assert.equal(reminderDue(f(-30, { reminded_at: new Date(NOW - 2 * H).toISOString() }), NOW), null, "asked already");
  assert.equal(reminderDue(f(-24 * 9), NOW), null);
});
