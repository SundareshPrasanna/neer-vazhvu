/** Polygon types that may carry the nearest river's name when they have none. */
const RIVER_TYPES = new Set(["river", "riverbank", "canal", "stream"]);

/** An OpenStreetMap id: a number, or Pune's "way/123". Ranking-table rows arrive with a blank
 *  osm_type, so the id's shape decides. */
export const isOsmId = (id: unknown) =>
  typeof id === "number" || (typeof id === "string" && /^(node|way|relation)\/\d+$/.test(id));

/** A survey id written "<source>:<code>" (Nagpur's "mrsac:505..."): [, source, code]. */
export const sourceCode = (id: unknown) => (typeof id === "string" ? /^([a-z]+):(\S+)$/.exec(id) : null);

/** An unnamed river-typed polygon, which may take the nearest river's name: a pond or tank beside
 *  a river is not that river. Pune's layer keeps OSM's `water` tag; bodies with no osm_id would
 *  share one key in the map's lookup. */
export const takesRiverName = (p: { name?: string; osm_id?: unknown; water_type?: string; water?: string }) =>
  !p.name && p.osm_id != null && RIVER_TYPES.has((p.water_type || p.water || "").toLowerCase());
