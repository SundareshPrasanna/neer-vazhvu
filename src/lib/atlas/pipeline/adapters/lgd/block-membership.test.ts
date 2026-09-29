import assert from "node:assert/strict";
import test from "node:test";

import { assertMembershipCoversPanchayats, validateBlockMembership } from "./block-membership";
import { membershipFixture } from "../../test-support";

test("a well-formed membership validates", () => {
  assert.deepEqual(validateBlockMembership(membershipFixture()), []);
});

test("block codes must be numeric, members must name a listed block, and every block needs a member", () => {
  const errors = validateBlockMembership(
    membershipFixture({
      blocks: [
        { code: "B091000", name: "Kollengode" },
        { code: "1003", name: "Empty" },
      ],
    }),
  );
  assert.ok(errors.some((error) => error.includes("must be numeric")));
  assert.ok(errors.some((error) => error.includes("is not a listed block")));
  assert.ok(errors.some((error) => error.includes("1003 has no member")));
});

test("a verified membership names who verified it", () => {
  const errors = validateBlockMembership(
    membershipFixture({ review: { status: "verified", stagedAt: "2026-09-29", verifiedAt: null, verifiedBy: null } }),
  );
  assert.ok(errors.some((error) => error.includes("verifiedBy")));
});

test("the membership must list exactly the register's Panchayats", () => {
  assert.doesNotThrow(() => assertMembershipCoversPanchayats(membershipFixture(), ["220001", "220002"]));
  assert.throws(
    () => assertMembershipCoversPanchayats(membershipFixture(), ["220001", "220003"]),
    /not in the membership: 220003; not in the register: 220002/,
  );
});
