import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { IssueEvent, IssueSource } from "./issues";
import {
  countsLine,
  findIssue,
  focusedIssue,
  isShareable,
  issueHref,
  placeLine,
  shareDescription,
  sharePath,
  shareText,
  shareTitle,
} from "./issue-share";
import type { CaseStatus } from "./status";
import type { PublicIssue, PublicReport } from "./types";

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${MON[m - 1]} ${y}`;
};

const issue = (o: Partial<PublicIssue> = {}): PublicIssue => ({
  id: ID,
  category: "dumping",
  subcategory: "garbage_on_bank",
  label: "Garbage on the bank or in the water",
  where: "Ambattur Lake, Ward 82",
  firstOn: "2026-09-01",
  lastSeenOn: "2026-10-12",
  daysOpen: 47,
  resolvedOn: null,
  reports: 3,
  people: 14,
  status: "open",
  photoUrl: null,
  reportIds: [ID],
  groups: [],
  fixitPlanned: false,
  earlierFixes: 0,
  point: [13.1, 80.16],
  placeHref: "/chennai/water-bodies?layer=reports",
  ...o,
});

test("the title names the water body alone, else the ward, panchayat or locality with its place", () => {
  assert.equal(shareTitle(issue(), "Chennai"), "Garbage on the bank or in the water at Ambattur Lake");
  assert.equal(shareTitle(issue({ label: "Drain overflowing", where: "Ward 12" }), "Chennai"), "Drain overflowing at Ward 12, Chennai");
  assert.equal(shareTitle(issue({ where: null }), "Krishnagiri"), "Garbage on the bank or in the water at Krishnagiri");
  assert.equal(shareTitle(issue({ where: null }), null), "Garbage on the bank or in the water");
});

test("the place line for the preview image carries the city once", () => {
  assert.equal(placeLine("Ambattur Lake, Ward 82", "Chennai"), "Ambattur Lake, Ward 82, Chennai");
  assert.equal(placeLine("Hosur, Chennai", "Chennai"), "Hosur, Chennai");
  assert.equal(placeLine(null, "Chennai"), "Chennai");
});

test("the description gives the counts and how long it has been open", () => {
  assert.equal(shareDescription(issue(), day), "14 people have reported or seen it. Open 47 days. On Neer Vazhvu.");
  assert.equal(countsLine(issue({ people: 1, daysOpen: 0 }), day), "1 person has reported it. Open since today.");
  // "Department says done" stands alone: a day count beside it would read as doubt.
  assert.equal(countsLine(issue({ status: "authority_done" }), day), "14 people have reported or seen it. Department says done.");
  assert.equal(countsLine(issue({ status: "fixed", daysOpen: null, resolvedOn: "2026-10-03" }), day), "14 people have reported or seen it. Fixed 3 Oct 2026.");
});

test("the message asks people to add to an open issue, and points to the record of a resolved one", () => {
  assert.equal(
    shareText(issue(), "Chennai", day),
    "Garbage on the bank or in the water at Ambattur Lake: 14 people have reported or seen it. Seen it too? Add to it on Neer Vazhvu.",
  );
  assert.equal(
    shareText(issue({ status: "fixed", daysOpen: null, resolvedOn: "2026-10-03" }), "Chennai", day),
    "Garbage on the bank or in the water at Ambattur Lake: 14 people have reported or seen it. Fixed 3 Oct 2026. See the record on Neer Vazhvu.",
  );
});

test("no em dash or middle dot in anything shared", () => {
  const all = [shareText(issue(), "Chennai", day), shareDescription(issue({ status: "authority_done" }), day), shareTitle(issue({ where: "Ward 3" }), "Pune")];
  for (const s of all) assert.ok(!/[—·]/.test(s), s);
});

test("links: the share path, and the place page with the issue opened", () => {
  assert.equal(sharePath(ID), `/mitra/i/${ID}`);
  assert.equal(issueHref("/chennai/water-bodies?layer=reports", ID), `/chennai/water-bodies?layer=reports&issue=${ID}`);
  assert.equal(issueHref("/atlas/tamil-nadu/krishnagiri", ID), `/atlas/tamil-nadu/krishnagiri?issue=${ID}`);
});

test("a place page opens only a well-formed issue id from its query", () => {
  assert.equal(focusedIssue(`?ward=12&issue=${ID}`), ID);
  assert.equal(focusedIssue("?issue=<script>"), null);
  assert.equal(focusedIssue(""), null);
});

test("home reports are never shared, nor issues with no page to send people to", () => {
  assert.equal(isShareable(issue()), true);
  assert.equal(isShareable(issue({ category: "drinking" })), false);
  assert.equal(isShareable(issue({ placeHref: null })), false);
});

/** A published lake report as the grouping reads it. */
function source(id: string, at: string, status: CaseStatus, events: IssueEvent[] = [], lat = 13.1): IssueSource {
  const report = { id, placeName: "Chennai", where: "Ambattur Lake, Ward 82", label: "Garbage on the bank or in the water", point: [lat, 80.16], placeHref: "/chennai/water-bodies?layer=reports" } as PublicReport;
  return {
    row: { id, created_at: at, updated_at: at, reporter_key: `key-${id}`, place_id: "chennai", ward_id: "82", panchayat_code: null, water_body_id: "ambattur", category: "dumping", subcategory: "garbage_on_bank", case_status: status, lat, lng: 80.16 },
    report,
    events,
    photos: [],
  };
}
const NOW = new Date("2026-10-18T06:30:00Z");
const fixedOn = (at: string): IssueEvent => ({ event: "fixed", created_at: at, actor_role: "reviewer", actor_key: null });

test("a shared link finds the issue holding its report, whichever report in it the link names", () => {
  const a = source("a", "2026-09-01T04:00:00Z", "open");
  const b = source("b", "2026-09-05T04:00:00Z", "open");
  assert.deepEqual(findIssue([a, b], "b", NOW)?.reportIds, ["b", "a"]);
  assert.equal(findIssue([a, b], "a", NOW)?.id, "a");
  assert.equal(findIssue([a, b], "nope", NOW), undefined);
});

test("an issue fixed over 60 days ago still opens from its link, with its counts as of the day it ended", () => {
  const old = source("old", "2026-05-01T04:00:00Z", "fixed", [fixedOn("2026-06-10T05:00:00Z")]);
  // A newer issue at the same spot, opened after the old one was fixed.
  const now = source("new", "2026-09-20T04:00:00Z", "open");
  const found = findIssue([old, now], "old", NOW);
  assert.equal(found?.id, "old");
  assert.equal(found?.status, "fixed");
  assert.equal(found?.resolvedOn, "2026-06-10");
  assert.equal(findIssue([old, now], "new", NOW)?.daysOpen, 28);
});
