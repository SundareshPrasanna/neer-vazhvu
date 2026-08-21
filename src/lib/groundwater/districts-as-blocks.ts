import type { GWBlock, GWBlockClass } from "@/types/groundwater";

/**
 * IN-GRES district-level cities into the GWBlock contract the map consumes.
 *
 * build_ingres_gwr.py emits `districts[]` for states assessed at district level
 * and `blocks[]` only for the drilled ones, and its docstring gives the reason:
 * the block choropleth needs a matching polygon per entry, which "cannot be met
 * by a list of whole districts". That was true until Gurugram got a
 * district-boundary layer - `<city>-gwr-blocks.geojson` with one feature per
 * district - at which point the premise stops holding and the only thing
 * standing between the data and the map is the key it is filed under.
 *
 * Without this, Gurugram rendered six polygons all filled #94a3b8: blockStyle
 * colours from a lookup built off `blocks`, that array was empty, and every
 * feature took the "no data" grey. The values were in the file the whole time.
 *
 * Adapting here rather than in the producer keeps the committed district
 * artifacts byte-identical, and fixes every district-level city at once
 * instead of one build script at a time.
 */
export function districtsAsBlocks(file: { blocks?: GWBlock[]; districts?: DistrictEntry[] }): GWBlock[] {
  if (file.blocks?.length) return file.blocks;
  const districts = file.districts ?? [];
  const toClass = (category: string | undefined): GWBlockClass => {
    switch ((category ?? "").toLowerCase()) {
      case "over_exploited": return "Over Exploited";
      case "critical": return "Critical";
      case "semi_critical": return "Semi Critical";
      default: return "Safe";
    }
  };
  // "2024-2025" -> 2025. The label is kept so the UI can show the source's own
  // vocabulary rather than a year we inferred.
  const endYear = (label: string | undefined): number =>
    Number(String(label ?? "").split("-").pop()) || 0;

  // IN-GRES returns full float precision (194.59587108916962). Every committed
  // blocks[] artifact stores 2dp, and the panel renders the number raw - so
  // without this the detail card printed sixteen decimals and overran the
  // figure beside it.
  const pct = (v: number | null | undefined): number =>
    v == null ? 0 : Math.round(v * 100) / 100;

  return districts
    .flatMap((d) => {
      const latest = d.latest;
      if (!latest) return [];
      return [{
      name: d.district,
      history: (d.history ?? []).map((h) => ({
        year: endYear(h.year),
        year_label: h.year,
        class: toClass(h.category),
        development_pct: pct(h.stage_of_extraction_pct),
        availability_ham: h.total_gw_availability_ham ?? null,
        draft_total_ham: h.extraction_total_ham ?? null,
      })),
      latest: {
        class: toClass(latest.category),
        development_pct: pct(latest.stage_of_extraction_pct),
        availability_ham: latest.total_gw_availability_ham ?? null,
        draft_total_ham: latest.extraction_total_ham ?? null,
      },
      }];
    });
}

export interface DistrictHistoryEntry {
  year?: string;
  category?: string;
  stage_of_extraction_pct?: number | null;
  total_gw_availability_ham?: number | null;
  extraction_total_ham?: number | null;
}
export interface DistrictEntry {
  district: string;
  history?: DistrictHistoryEntry[];
  latest?: DistrictHistoryEntry;
}
