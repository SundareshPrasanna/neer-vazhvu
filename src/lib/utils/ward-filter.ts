export interface WardEntry {
  wardNumber: number;
  wardName: string;
  wardNameTa?: string;
  zone: string;
}

export interface LocalityEntry {
  name: string;
  name_ta?: string;
  type: "suburb" | "neighbourhood" | "quarter";
  lat: number;
  lng: number;
  ward_number: number;
  zone_name: string;
  zone_no: string;
}

export interface ZoneEntry {
  zoneName: string;
  zoneNo: string;
  wardCount: number;
}

export type SearchResultKind = "locality" | "ward" | "zone";

export type SearchResult =
  | { kind: "locality"; locality: LocalityEntry }
  | { kind: "ward"; ward: WardEntry }
  | { kind: "zone"; zone: ZoneEntry };

/**
 * Filter and sort wards by query string.
 * Prioritizes: exact ward number > ward number prefix > name match > zone-only match.
 */
export function filterWards(wards: WardEntry[], query: string, limit = 8): WardEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  return wards
    .filter((w) => {
      const name = w.wardName.toLowerCase();
      const nameTa = w.wardNameTa?.toLowerCase() || "";
      const zone = w.zone.toLowerCase();
      const num = String(w.wardNumber);
      return name.includes(q) || nameTa.includes(q) || zone.includes(q) || num.startsWith(q);
    })
    .sort((a, b) => {
      const aNum = String(a.wardNumber) === q ? 0 : String(a.wardNumber).startsWith(q) ? 1 : 9;
      const bNum = String(b.wardNumber) === q ? 0 : String(b.wardNumber).startsWith(q) ? 1 : 9;
      if (aNum !== bNum) return aNum - bNum;
      const aName = a.wardName.toLowerCase().includes(q) ? 0 : 1;
      const bName = b.wardName.toLowerCase().includes(q) ? 0 : 1;
      if (aName !== bName) return aName - bName;
      return a.wardNumber - b.wardNumber;
    })
    .slice(0, limit);
}

/**
 * Filter localities by query string.
 * Prioritizes: name starts with query > name contains query > Tamil name match.
 */
export function filterLocalities(
  localities: LocalityEntry[],
  query: string,
  limit = 5
): LocalityEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  return localities
    .filter((l) => {
      const name = l.name.toLowerCase();
      const nameTa = l.name_ta?.toLowerCase() || "";
      const zone = l.zone_name.toLowerCase();
      return name.includes(q) || nameTa.includes(q) || zone.includes(q);
    })
    .sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      // Exact match first
      if (aName === q && bName !== q) return -1;
      if (bName === q && aName !== q) return 1;
      // Starts-with next
      const aStarts = aName.startsWith(q) ? 0 : 1;
      const bStarts = bName.startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return aName.localeCompare(bName);
    })
    .slice(0, limit);
}

/**
 * Derive unique zones from a list of wards.
 */
export function deriveZones(wards: WardEntry[]): ZoneEntry[] {
  const zoneMap = new Map<string, ZoneEntry>();
  for (const w of wards) {
    const existing = zoneMap.get(w.zone);
    if (existing) {
      existing.wardCount++;
    } else {
      zoneMap.set(w.zone, { zoneName: w.zone, zoneNo: "", wardCount: 1 });
    }
  }
  return [...zoneMap.values()].sort((a, b) => a.zoneName.localeCompare(b.zoneName));
}

/**
 * Filter zones by query string.
 */
export function filterZones(zones: ZoneEntry[], query: string, limit = 3): ZoneEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  return zones
    .filter((z) => z.zoneName.toLowerCase().includes(q))
    .sort((a, b) => {
      const aStarts = a.zoneName.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.zoneName.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.zoneName.localeCompare(b.zoneName);
    })
    .slice(0, limit);
}

/**
 * Combined search across localities, wards, and zones.
 * Returns grouped results in order: localities, wards, zones.
 */
export function searchAll(
  localities: LocalityEntry[],
  wards: WardEntry[],
  zones: ZoneEntry[],
  query: string
): SearchResult[] {
  const results: SearchResult[] = [];
  for (const l of filterLocalities(localities, query, 4)) {
    results.push({ kind: "locality", locality: l });
  }
  for (const w of filterWards(wards, query, 3)) {
    results.push({ kind: "ward", ward: w });
  }
  for (const z of filterZones(zones, query, 2)) {
    results.push({ kind: "zone", zone: z });
  }
  return results;
}
