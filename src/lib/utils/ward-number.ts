import type { GeoJsonProperties } from "geojson";

/** A ward-boundary feature's ward number. Ward files name it three ways:
 *  `ward_no` (every city from Madurai on), Chennai's `ward_number`, and
 *  Chennai's legacy `Ward_No`. Null when none is present. */
export function wardNumberOf(props: GeoJsonProperties | undefined): number | null {
  const raw = props?.ward_number ?? props?.Ward_No ?? props?.ward_no;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
