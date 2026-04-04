export interface WardEntry {
  wardNumber: number;
  wardName: string;
  wardNameTa?: string;
  zone: string;
}

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
