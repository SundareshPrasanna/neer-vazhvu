/** Curated narrative for one river on a city's rivers page, keyed by the
 *  river_id in the city's rivers geojson. */export interface RiverInfo {
  display_name: string;
  length_km_geom: number;
  description: string;
  upstream_terminus: string;
  downstream_terminus: string;
  feeds: string;
  status: string;
  cpcb_nwmp_stations: string[];
  /** Polyline colour as a hex string (Leaflet takes CSS colours, not classes). */
  color: string;
  // Optional Tamil overrides. When the user has language=ta and the
  // override is present, the *_ta version replaces its English sibling
  // at render time. Falls back to English string if the override is
  // omitted, so single-language cities (Chennai) need no schema change.
  display_name_ta?: string;
  description_ta?: string;
  upstream_terminus_ta?: string;
  downstream_terminus_ta?: string;
  feeds_ta?: string;
  status_ta?: string;
  cpcb_nwmp_stations_ta?: string[];
  /** Native-script name shown under the English name. Display-only, like the
   *  ta name line - full per-language field overrides come with each city's
   *  translation pass. One optional field per script rather than a single
   *  `display_name_native`, so a city can carry more than one. */
  display_name_hi?: string;
  /** Native-script name shown under the English name (Telugu cities).
   *  Display-only, same contract as display_name_hi - full te field
   *  overrides come with Hyderabad's translation pass. */
  display_name_te?: string;
  display_name_bn?: string;
  /** Native-script name shown under the English name (Marathi cities). */
  display_name_mr?: string;
}

export interface RiversHeader {
  scopeLabel: string;
  showStats?: boolean;
  atlasCtaLabel?: string;
  /** The basin above this city's rivers, offered as a header entry point. */
  overviewBasinId?: string;
}

/** Everything city-specific on /[cityId]/rivers. */
export interface CityRiversContent {
  metaDescription?: string;
  header?: RiversHeader;
  /** Initial map framing; the map re-fits to the rivers once they load. */
  map?: { center?: [number, number]; zoom?: number };
  /** Absent for a city whose rivers page uses its own variant (Chennai). */
  riverInfo?: Record<string, RiverInfo>;
}
