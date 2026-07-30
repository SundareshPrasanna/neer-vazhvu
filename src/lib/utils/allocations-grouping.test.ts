/**
 * Regression for the #216 review finding: after NVDM migration, direct
 * arrangements OMIT authority_id (spec 7.6 - absence is an absent key), while
 * legacy files carry explicit null. Grouping must treat both as direct, or
 * migrated arrangements silently vanish from the rendered ledger (Krishna
 * 1976 and Veeranam did exactly that).
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";

import { forAuthority, isDirect } from "./allocations-grouping";

type Arr = { id: string; authority_id?: string | null };

test("absent and null authority_id both group as direct; every arrangement renders once", () => {
  const arrangements: Arr[] = [
    { id: "krishna-1976" }, // migrated: key absent
    { id: "veeranam" }, // migrated: key absent
    { id: "legacy-direct", authority_id: null }, // legacy explicit null
    { id: "via-board", authority_id: "twad" },
  ];
  const direct = arrangements.filter(isDirect);
  const viaTwad = arrangements.filter((a) => forAuthority(a, "twad"));
  assert.deepEqual(
    direct.map((a) => a.id),
    ["krishna-1976", "veeranam", "legacy-direct"],
  );
  assert.deepEqual(viaTwad.map((a) => a.id), ["via-board"]);
  assert.equal(direct.length + viaTwad.length, arrangements.length);
});
