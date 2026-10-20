import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

import { LIMITS } from "./limits";

import {
  FIXIT_LABELS,
  GROUP_DAILY_MESSAGE,
  GROUP_LIMITS,
  JOIN_CODE_RE,
  academicYearStart,
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
  packDate,
  parsePackPeriod,
  presetPeriod,
  reminderDue,
  shapePack,
  shiftDate,
  startsAtProblem,
  tagProblem,
  type FixitTarget,
  type PackReportSource,
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

test("who may add a report to a group afterwards: its sender, a community report, an active group they are in", () => {
  const r = { reporter_key: "me", category: "dumping", review_status: "approved" as const };
  const active = { status: "approved" as const };
  assert.equal(tagProblem(r, "me", active), null);
  assert.equal(tagProblem({ ...r, review_status: "received" }, "me", active), null, "while it is being checked");
  assert.equal(tagProblem(r, "me", "clear"), null, "clearing needs no group");
  assert.equal(tagProblem(r, "someone", active)?.status, 403);
  assert.equal(tagProblem(r, "someone", "clear")?.status, 403);
  assert.equal(tagProblem({ ...r, category: "drinking" }, "me", active)?.status, 409, "never a home report");
  assert.equal(tagProblem({ ...r, review_status: "rejected" }, "me", active)?.status, 409);
  assert.equal(tagProblem({ ...r, review_status: "rejected" }, "me", "clear")?.status, 409);
  for (const g of [null, { status: "pending" as const }, { status: "rejected" as const }]) assert.equal(tagProblem(r, "me", g)?.status, 403, JSON.stringify(g));
});

test("pack dates: shifting, the academic year and presets", () => {
  assert.equal(shiftDate("2026-10-18", { months: -3 }), "2026-07-18");
  assert.equal(shiftDate("2026-05-31", { months: -3 }), "2026-02-28", "a day the month lacks becomes its last");
  assert.equal(shiftDate("2028-05-31", { months: -3 }), "2028-02-29");
  assert.equal(shiftDate("2026-01-15", { months: -3 }), "2025-10-15");
  assert.equal(shiftDate("2028-02-29", { years: -2 }), "2026-02-28");
  assert.equal(shiftDate("2026-03-01", { days: -1 }), "2026-02-28");
  assert.equal(packDate("2026-06-01"), "1 June 2026");
  assert.equal(academicYearStart("2026-10-18"), "2026-06-01");
  assert.equal(academicYearStart("2026-06-01"), "2026-06-01", "1 June itself");
  assert.equal(academicYearStart("2026-05-31"), "2025-06-01");
  assert.equal(academicYearStart("2027-01-10"), "2026-06-01");
  assert.deepEqual(presetPeriod("30d", "2026-10-18"), { from: "2026-09-19", to: "2026-10-18" }, "30 days, today included");
  assert.deepEqual(presetPeriod("3m", "2026-10-18"), { from: "2026-07-18", to: "2026-10-18" });
  assert.deepEqual(presetPeriod("year", "2026-03-02"), { from: "2025-06-01", to: "2026-03-02" });
  assert.deepEqual(presetPeriod("all", "2026-10-18"), { from: "2024-10-18", to: "2026-10-18" });
  for (const k of ["30d", "3m", "year", "all"] as const) {
    const p = presetPeriod(k, "2026-10-18");
    assert.ok(parsePackPeriod(p.from, p.to, NOW).ok, k);
  }
});

test("pack period: India dates, both included; default 3 months; never past today; at most 2 years", () => {
  const ok = (from: string | null, to: string | null) => {
    const r = parsePackPeriod(from, to, NOW);
    assert.ok(r.ok, `${from}..${to}`);
    return r.value;
  };
  const err = (from: string | null, to: string | null) => {
    const r = parsePackPeriod(from, to, NOW);
    assert.ok(!r.ok, `${from}..${to}`);
    return r.error;
  };
  assert.deepEqual(ok(null, null), { from: "2026-07-18", to: "2026-10-18", start: "2026-07-17T18:30:00.000Z", end: "2026-10-18T18:30:00.000Z" });
  assert.deepEqual(ok("", ""), ok(null, null), "empty is missing");
  assert.equal(ok(null, "2026-09-30").from, "2026-06-30");
  assert.equal(ok("2026-06-01", null).to, "2026-10-18");
  assert.equal(ok("2026-06-01", "2027-01-01").to, "2026-10-18", "a later end is today");
  assert.deepEqual(ok("2026-10-18", "2026-10-18"), { from: "2026-10-18", to: "2026-10-18", start: "2026-10-17T18:30:00.000Z", end: "2026-10-18T18:30:00.000Z" });
  assert.equal(ok("2024-10-18", "2026-10-18").from, "2024-10-18", "exactly 2 years");
  assert.match(err("2024-10-17", "2026-10-18"), /2 years/);
  assert.match(err("2026-10-01", "2026-09-01"), /after/);
  assert.match(err("2026-11-01", null), /after/, "a start after today");
  for (const bad of ["2026-02-30", "18-10-2026", "2026-1-5", "yesterday"]) assert.match(err(bad, null), /dates/, bad);
  assert.match(err(null, "2026-13-01"), /dates/);
});

const src = (over: Partial<PackReportSource> = {}): PackReportSource => ({
  reviewStatus: "approved",
  reporterKey: "k1",
  category: "dumping",
  publishedAt: "2026-09-10T06:00:00Z",
  type: "Garbage on the bank",
  caseStatus: "open",
  place: "Velachery Lake, Ward 177, Chennai",
  placeKey: "city:chennai:body:1",
  href: "/chennai/water-bodies?layer=reports",
  photo: "https://x/p1.webp",
  fixedPhoto: null,
  seen: 0,
  thanks: 0,
  ...over,
});

test("pack totals: published community reports in the period only, counts never who", () => {
  const period = parsePackPeriod("2026-09-01", "2026-09-30", NOW);
  assert.ok(period.ok);
  const reports = [
    src({ seen: 3 }),
    src({ reporterKey: "k2", caseStatus: "fixed", fixedPhoto: "https://x/f1.webp", thanks: 2, publishedAt: "2026-09-02T04:00:00Z" }),
    src({ reporterKey: "k2", type: "Floating trash", placeKey: "chennai:ward:12", caseStatus: "reported" }),
    src({ reporterKey: "deleted", type: "Floating trash", placeKey: "chennai:ward:12" }),
    // The first India day starts at 18:30 UTC the day before; the last ends at 18:30 UTC on it.
    src({ reporterKey: "k3", publishedAt: "2026-08-31T18:30:00Z" }),
    src({ reporterKey: "k4", publishedAt: "2026-09-30T18:29:59Z" }),
    // Left out: outside the period, not published, or a home report.
    src({ reporterKey: "x1", publishedAt: "2026-08-31T18:29:59Z" }),
    src({ reporterKey: "x2", publishedAt: "2026-09-30T18:30:00Z" }),
    src({ reporterKey: "x3", reviewStatus: "received" }),
    src({ reporterKey: "x4", reviewStatus: "rejected" }),
    src({ reporterKey: "x5", reviewStatus: "needs_info" }),
    src({ reporterKey: "x6", category: "drinking" }),
  ];
  const cleanups = [
    { status: "done" as const, startsAt: "2026-09-20T01:30:00Z", coming: ["a", "b", "k1"], report: reports[1] },
    { status: "done" as const, startsAt: "2026-09-27T01:30:00Z", coming: ["a", "c"], report: src({ reporterKey: "other-group" }) },
    { status: "planned" as const, startsAt: "2026-09-25T01:30:00Z", coming: ["d"], report: reports[0] },
    { status: "cancelled" as const, startsAt: "2026-09-26T01:30:00Z", coming: ["e"], report: reports[0] },
    { status: "done" as const, startsAt: "2026-10-02T01:30:00Z", coming: ["f"], report: reports[0] },
    { status: "done" as const, startsAt: "2026-09-21T01:30:00Z", coming: ["g"], report: src({ reviewStatus: "rejected" }) },
  ];
  const pack = shapePack({ group: { name: "Anna University NSS unit", kindLabel: "College", placeName: "Chennai" }, period: period.value, now: NOW, members: 40, reports, cleanups });
  const t = pack.totals;
  assert.deepEqual(pack.period, { from: "2026-09-01", to: "2026-09-30" });
  assert.equal(pack.prepared, "2026-10-18");
  assert.equal(t.reports, 6);
  assert.equal(t.places, 2);
  assert.equal(t.senders, 4, "k1 to k4; a deleted account is not counted as a member");
  assert.deepEqual(
    t.byStatus.map((s) => [s.label, s.count]),
    [
      ["Not yet reported", 4],
      ["Reported", 1],
      ["Department says done", 0],
      ["Fixed", 1],
      ["Closed", 0],
    ],
  );
  assert.deepEqual(t.byType, [
    { label: "Garbage on the bank", count: 4 },
    { label: "Floating trash", count: 2 },
  ]);
  assert.equal(t.seen, 3);
  assert.equal(t.thanks, 2);
  assert.equal(t.cleanups, 2, "done, in the period, at a published report");
  assert.equal(t.coming, 4, "different people across the clean-ups: a, b, k1, c");
  assert.equal(t.members, 40);
  // Oldest first, India dates.
  assert.deepEqual(
    pack.reports.map((r) => r.date),
    ["2026-09-01", "2026-09-02", "2026-09-10", "2026-09-10", "2026-09-10", "2026-09-30"],
  );
  assert.deepEqual(pack.cleanups[0], {
    date: "2026-09-20",
    place: "Velachery Lake, Ward 177, Chennai",
    type: "Garbage on the bank",
    coming: 3,
    caseStatus: "fixed",
    status: "Fixed",
    photo: "https://x/p1.webp",
    fixedPhoto: "https://x/f1.webp",
    href: "/chennai/water-bodies?layer=reports",
  });
  // Nothing about who: no tags, and nothing beyond the listed fields.
  const json = JSON.stringify(pack);
  for (const k of ["k1", "k2", "k3", "k4", "deleted", "other-group", "\"a\""]) assert.ok(!json.includes(k), k);
  assert.deepEqual(Object.keys(pack.reports[0]).sort(), ["caseStatus", "date", "href", "photo", "place", "status", "type"]);
});

test("an empty pack still has every status, at zero", () => {
  const period = parsePackPeriod(null, null, NOW);
  assert.ok(period.ok);
  const pack = shapePack({ group: { name: "Lake friends", kindLabel: "Lake group", placeName: null }, period: period.value, now: NOW, members: 1, reports: [], cleanups: [] });
  assert.equal(pack.totals.byStatus.length, 5);
  assert.ok(pack.totals.byStatus.every((s) => s.count === 0));
  assert.deepEqual([pack.reports, pack.cleanups, pack.totals.byType], [[], [], []]);
});

test("one group's daily cap leaves most of the new-account allowance to everyone else", () => {
  assert.ok(GROUP_LIMITS.reportsDaily * 4 <= LIMITS.newSiteDaily);
  assert.match(GROUP_DAILY_MESSAGE, new RegExp(`${GROUP_LIMITS.reportsDaily} reports`));
});
