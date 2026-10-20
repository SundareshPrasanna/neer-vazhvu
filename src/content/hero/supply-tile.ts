import type { CityId } from "@/lib/cities/ids";

/** Supply-tile copy kept in code because it is translated (en/ta): Madurai's,
 *  the city the supply_overview.* strings were written for. A city's
 *  supply-overview `_view_overrides` overrides any field here. Values are i18n
 *  keys or literal strings. */
export const SUPPLY_TILE_COPY: Partial<
  Record<CityId, { subtitle?: string; wtp_label?: string; demand_caption?: string }>
> = {
  madurai: {
    subtitle: "supply_overview.subtitle",
    wtp_label: "supply_overview.wtp_label",
    demand_caption: "supply_overview.demand_gap_caption",
  },
};
