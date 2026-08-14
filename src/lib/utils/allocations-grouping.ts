/**
 * Arrangement grouping predicates for the allocations ledger - extracted so
 * the component and its regression test exercise the SAME code (#216 review:
 * a test that mirrors inline logic pins nothing).
 *
 * NVDM spec 7.6: direct/owner-operated arrangements OMIT authority_id
 * (absence is an absent key); legacy files may carry explicit null. Both
 * must group as direct or migrated arrangements vanish from the ledger.
 */
export interface GroupableArrangement {
  authority_id?: string | null;
}

/** Direct/owner-operated: no intermediating authority (absent OR null). */
export function isDirect(a: GroupableArrangement): boolean {
  return a.authority_id == null;
}

/** Belongs to the given authority's group. */
export function forAuthority(a: GroupableArrangement, authorityId: string): boolean {
  return a.authority_id === authorityId;
}
