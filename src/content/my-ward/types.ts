import type { TranslationEntry } from "@/lib/i18n/translations";

/** The source lines under each My Ward card. A city renders only the lines it
 *  records; a missing line renders nothing, never another city's source. */
export interface WardSourceCopy {
  /** Live monthly well readings (groundwater card). */
  gw?: TranslationEntry;
  /** CGWB block assessment + nearest Year Book well (groundwater card). */
  gwYearbook?: TranslationEntry;
  /** No Year Book well within 5 km of the ward. "{map}" becomes a link to
   *  the city's groundwater page, labelled with its name. */
  gwNoWell?: TranslationEntry;
  flood?: TranslationEntry;
  infra?: TranslationEntry;
  river?: TranslationEntry;
  /** Where the ward's lost water bodies were identified. */
  lostNote?: TranslationEntry;
  /** The ward table (no-geometry cities): where zone, seat, population and
   *  zone office come from. */
  table?: TranslationEntry;
}

export interface QuickAction {
  /** Translation key for the prominent label */
  labelKey: string;
  /** Sub-label below the action (operator/agency name, plain text) */
  subLabel: string;
  href: string;
  /** Pick the icon shape: "complaint" (warning) or "portal" (cube) */
  icon: "complaint" | "portal";
}

export interface Helpline {
  labelKey: string;
  value: string | null;
  href: string;
}

/** The ward actions card: the city's own complaint portals and helplines.
 *  Primary-sourced numbers only; a city without an entry gets no card. */
export interface WardActions {
  quickActions: QuickAction[];
  helplines: Helpline[];
}

/** src/cities/<id>/my-ward.ts */
export interface CityMyWardContent {
  sources?: WardSourceCopy;
  actions?: WardActions;
}
