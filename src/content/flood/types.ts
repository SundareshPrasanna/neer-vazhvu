import type { ReactElement } from "react";
import type { DrainageLayerSpec } from "@/components/flood/drainage-network-map";
import type { TranslationEntry } from "@/lib/i18n/translations";

/** English is the accessibility floor; other languages are optional and
 *  fall back to English at render time (Madurai carries ta, Delhi will
 *  carry hi after its translation pass). */
export interface BilingualText {
  en: string;
  ta?: string;
  hi?: string;
}

export interface HistoricalEvent {
  year: number;
  trigger: BilingualText;
  impact: BilingualText;
  /** Optional citation. Some flood events are well-attested but the
   *  original news article has been removed from the publisher's site
   *  - we'd rather drop the dead link than fabricate one. When absent,
   *  the event card hides the citation footer entirely. */
  source_url?: string;
  source_label?: string;
}

export interface ExternalSource {
  name: string;
  description: BilingualText;
  url: string;
  cadence: string;
}

export interface FloodConfig {
  headline: BilingualText;
  /** Scope badge text (e.g. "Vaigai system scope", "Yamuna basin scope").
   *  Config-driven so no city's system name leaks into another city's page. */
  scope_label?: BilingualText;
  /** Dam/barrage-release threshold, for cities whose flooding is
   *  release-driven (Madurai's Vaigai, Delhi's Hathnikund). OPTIONAL: not
   *  every flood geography has one. Hyderabad's flooding is rainfall plus
   *  blocked storm-water drains, and Mumbai's is rainfall plus high tide -
   *  requiring this field is what pushed Mumbai into its own component
   *  rather than the shared narrative stack. Omit both and the threshold
   *  card simply does not render. */
  dam_release_threshold_cusecs?: number;
  dam_release_note?: BilingualText;
  /** The headline trigger for cities with no dam. Generic on purpose: the
   *  value + unit + note shape fits any threshold a city actually has
   *  (mm/hour of rainfall for Kolkata, and whatever the next city carries).
   *  Hyderabad is the case that shows why this stays optional rather than
   *  becoming the universal replacement: it has no dam release AND no
   *  published drainage design capacity, so it renders neither card. */
  primary_trigger?: {
    value: number;
    unit: BilingualText;
    label: BilingualText;
    note: BilingualText;
  };
  historical_events: HistoricalEvent[];
  /** Optional storm-water drainage map for narrative cities that HOLD network
   *  geometry but have none of the modelled hazard/hotspot layers the
   *  interactive variant defaults to. Omit -> no map renders. */
  drainage_map?: {
    heading: BilingualText;
    note: BilingualText;
    zoom?: number;
    layers: DrainageLayerSpec[];
  };
  /** Optional live operational register: a city that publishes, week by week,
   *  where it actually sent crews. Counts are read from the artifact at render
   *  rather than written into copy, because the artifact refreshes on a
   *  schedule and hand-written counts would be wrong within the week. */
  live_register?: {
    heading: BilingualText;
    note: BilingualText;
    /** Artifact under public/ carrying `period` and `summary`. */
    src: string;
    sourceLabel: string;
    sourceHref: string;
  };
  external_sources: ExternalSource[];
  data_gaps: BilingualText[];
  /** Cross-link card copy overrides. The flood.cross_link_* i18n defaults
   *  carry Madurai's specifics (Vaigai dam / Vaigai river system); a second
   *  narrative city overrides them here instead of leaking them. */
  cross_links?: {
    home_desc?: BilingualText;
    rivers_label?: BilingualText;
    rivers_desc?: BilingualText;
    water_bodies_desc?: BilingualText;
  };
}

/** Copy on the map page: English in place, or the city's translations. "{city}"
 *  becomes the display name; `link` fills its "{slot}". */
export type FloodText = string | (TranslationEntry & { link?: { slot: string; href: string; label: string } });
/** Copy that carries emphasis or inline source links is JSX. It crosses the
 *  server/client boundary inside an array, so a fragment needs a key. */
export type FloodRich = FloodText | ReactElement;

/** A layer-panel row: one checkbox, drawn with Tailwind classes written out in full
 *  so the stylesheet keeps them. */
export interface FloodMapRow {
  label: FloodText;
  swatch: string;
  accent: string;
  /** Checked on first load. */
  on?: boolean;
  /** Categorised point layers: this row shows features whose `categoryProp` equals it. */
  value?: string;
  fillColor?: string;
  radius?: number;
}

/** One GeoJSON file on the map, fetched the first time one of its rows is checked. */
export interface FloodMapLayer {
  url: string;
  kind: "line" | "point";
  rows: FloodMapRow[];
  /** Starts a ruled-off group in the layer panel. */
  divider?: boolean;
  /** Leaflet style; point rows may override fillColor and radius. */
  style: { color: string; weight: number; opacity?: number; fillColor?: string; fillOpacity?: number; radius?: number };
  /** Point layers: property holding each feature's category (features in no row are dropped). */
  categoryProp?: string;
  /** Hover label: this property, else `nameFallback`; a line without either has none. */
  nameProp?: string;
  nameFallback?: string;
  /** Point labels: same-line suffix, then 11 px lines (`always` prints an empty value). */
  suffix?: { prop: string; prefix: string };
  lines?: { prop: string; prefix?: string; muted?: boolean; always?: boolean }[];
  /** Point layers: the label also opens on tap, with this note under it. */
  popup?: boolean;
  popupNote?: string;
  /** Line layers: frame the map on this layer when no points are showing. */
  fit?: boolean;
}

/** A full-height map with a layer panel and a text sidebar, for a city whose flood
 *  record is a set of mapped registers rather than a modelled hazard surface. */
export interface FloodMapSpec {
  center: [number, number];
  zoom: number;
  /** Context bar above the map. */
  scope: FloodText;
  summary: FloodText;
  layersTitle: FloodText;
  /** The layer panel starts closed on phones, where it would cover the map. */
  collapsible?: boolean;
  /** In panel order; the top row draws on top, lines under points. */
  layers: FloodMapLayer[];
  /** Caption under the ground-elevation legend. */
  elevationNote: string;
  sidebar: {
    heading: FloodText;
    intro: FloodRich;
    shows: { heading: FloodText; items: FloodRich[] };
    gaps: { heading: FloodText; items: FloodRich[] };
    /** Show the official flood-line sheets (flood-lines-<city>.json) after the gaps. */
    floodLines?: boolean;
    sources: { heading: FloodText; separator: string; items: { href: string; label: string; note: FloodText }[] };
    /** Small print: an optional headed list of layer sources, then paragraphs. */
    footer: { heading?: FloodText; items?: FloodRich[]; paras: FloodRich[] };
  };
}

/** Everything city-specific on /[cityId]/flood-risk: a narrative `config`, or a `map`. */
export interface CityFloodContent {
  metaDescription?: string;
  config?: FloodConfig;
  map?: FloodMapSpec;
}
