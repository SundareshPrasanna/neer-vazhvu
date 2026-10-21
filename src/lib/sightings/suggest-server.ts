import "server-only";

import type { Feature, FeatureCollection, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";

import type { DistrictDirectoryArtifact } from "@/lib/atlas/artifacts";
import { listPublishedAtlasDistricts } from "@/lib/atlas/registry";
import { listBasins, type BasinManifest } from "@/lib/basins";
import { listEnabledPlaces } from "@/lib/cities";
import { corporationsGeoJsonPathFor, wardsGeoJsonPathFor } from "@/lib/cities/data-paths";
import { containing, distanceKm, inBBox, indexPolygons, metresBetween, type BBox, type IndexedPolygon } from "./locate";
import { DISTRICT_REACH_KM, basinUrl, held, load, polygonKind } from "./locate-server";
import { SAME_LAKE_KM, indexBuilder, labelPoint, lakeName, titleCase, wardParts, type EntryInput, type SuggestEntry } from "./suggest";

/**
 * One suggestion index per server instance: named lakes and tanks, wards, gram panchayats, basin towns and major water
 * bodies, from the same static files placement reads (enabled cities, published districts, onboarded basins), and only
 * those a report can be sent from. Only labels, words and one point per place are kept. A file locate-server already
 * holds is read from its cache; any other is fetched, read and let go, so the index never keeps geometry in memory.
 */

type Read<T> = { json: T | null; failed: boolean };

async function read<T>(origin: string, path: string | null): Promise<Read<T>> {
  if (!path) return { json: null, failed: false };
  const url = `${origin}${path}`;
  const shared = await held(url);
  if (shared != null) return { json: shared as T, failed: false };
  const { json, missing } = await load(url);
  return { json: json as T | null, failed: json == null && !missing };
}

const areaOf = (f: Feature): f is Feature<Polygon | MultiPolygon> => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon";
const nameOf = (p: GeoJsonProperties): string | null => (typeof p?.name === "string" && p.name.trim() ? titleCase(p.name.trim()) : null);
const box = (b: { west: number; south: number; east: number; north: number }): BBox => [b.west, b.south, b.east, b.north];

/** Each named polygon of a file, with a point inside it. */
function places(fc: FeatureCollection | null, keep: (p: GeoJsonProperties) => boolean = () => true) {
  return (fc?.features ?? []).flatMap((f) => {
    const name = nameOf(f.properties);
    const pt = name && areaOf(f) && keep(f.properties) ? labelPoint(f.geometry) : null;
    return pt ? [{ name: name!, p: f.properties, lng: pt[0], lat: pt[1] }] : [];
  });
}

const isLake = (p: GeoJsonProperties) => polygonKind(p) === "lake" && !!lakeName(nameOf(p));

/** The place a basin's town or lake sits in, as people name it: the city, else the published district, else the basin. */
function regionAt(lng: number, lat: number, fallback: string): string {
  const city = listEnabledPlaces().find((c) => inBBox(lng, lat, box(c.bbox)));
  return city?.displayName ?? listPublishedAtlasDistricts().find((d) => d.bbox && inBBox(lng, lat, d.bbox))?.name ?? fallback;
}

/** "Erode district: rivers, groundwater and industry" reads as "Erode district". */
const basinShort = (b: BasinManifest) => b.displayName.split(":")[0].trim();

/** What placement covers beyond a city's own wards, held only while the index is built. */
interface Cover {
  districts: { name: string; bbox: BBox; gps: { centroid: [number, number]; bbox: BBox }[] }[];
  basins: { name: string; boundary: IndexedPolygon[] }[];
}

/**
 * placePoint's coverage (locate-server.ts), so a suggestion never leads to "outside the places we cover": the city's own
 * wards or corporation boundaries; a published district's panchayat whose box holds the point or whose centre is within
 * DISTRICT_REACH_KM; a basin boundary; a city with no ward geometry, or a configured corporation box. A city's wards are
 * checked only for that city's own lakes, so a lake one city maps inside another's wards is left out, never let in.
 * Returns the covering place's name for a label, or null when not covered.
 */
function coverOf(c: Cover, lng: number, lat: number, own?: { name: string; areas: IndexedPolygon[] }): string | null {
  if (own && containing(own.areas, lng, lat)) return own.name;
  const gp = (g: Cover["districts"][number]["gps"][number]) => inBBox(lng, lat, g.bbox) || distanceKm(lng, lat, g.centroid) <= DISTRICT_REACH_KM;
  const district = c.districts.find((d) => inBBox(lng, lat, d.bbox) && d.gps.some(gp));
  if (district) return district.name;
  const basin = c.basins.find((b) => containing(b.boundary, lng, lat));
  if (basin) return regionAt(lng, lat, basin.name);
  const city = listEnabledPlaces().find(
    (p) => inBBox(lng, lat, box(p.bbox)) && (!wardsGeoJsonPathFor(p.cityId) || (p.corporations ?? []).some((k) => inBBox(lng, lat, box(k.bbox)))),
  );
  return city?.displayName ?? null;
}

type Built = { items: EntryInput[]; failed: boolean };

/** Files read at once while building: each is parsed, turned into entries and let go. */
const AT_ONCE = 4;

async function inTurn<T>(tasks: (() => Promise<T>)[], failed: T): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: AT_ONCE }, async () => {
      while (next < tasks.length) {
        const i = next++;
        out[i] = await tasks[i]().catch(() => failed);
      }
    }),
  );
  return out;
}

async function build(origin: string): Promise<{ entries: SuggestEntry[]; complete: boolean }> {
  // Districts and basins first: their panchayats and boundaries are what a city's lake beyond its wards may fall in.
  const districts = await inTurn(
    listPublishedAtlasDistricts().map((d) => async () => {
      const { json, failed } = await read<DistrictDirectoryArtifact>(origin, `/data/atlas/${d.stateSlug}/${d.slug}/directory.json`);
      const gps = (json?.panchayats ?? []).flatMap((p) => (p.boundary ? [{ p, centroid: p.boundary.centroid, bbox: p.boundary.bbox as BBox }] : []));
      // The panchayat's centre: placement credits a point to the panchayat whose box holds it and whose centre is nearest.
      const items = gps.flatMap(({ p, centroid }): EntryInput[] => {
        if (!p.name?.trim()) return [];
        const name = titleCase(p.name.trim());
        const block = p.blockName ? titleCase(p.blockName.trim()) : null;
        const inBlock = block && ![name, d.name].some((n) => n.toLowerCase() === block.toLowerCase()) ? block : null;
        const label = [`${name} panchayat`, inBlock, d.name].filter(Boolean).join(", ");
        return [{ kind: "village", label, name, ctx: ["panchayat", inBlock, d.name], lng: centroid[0], lat: centroid[1] }];
      });
      return { items, failed, name: d.name, bbox: d.bbox ?? null, gps: gps.map(({ centroid, bbox }) => ({ centroid, bbox })) };
    }),
    { items: [], failed: true, name: "", bbox: null, gps: [] },
  );

  const basins = await inTurn(
    listBasins().map((b) => async () => {
      const [boundary, towns, bodies] = await Promise.all(
        ["boundary", "admin-town", "waterbodies-major"].map((f) => read<FeatureCollection>(origin, basinUrl(b, f))),
      );
      const items: EntryInput[] = [
        ...places(bodies.json, isLake).map((x): EntryInput => {
          const local = typeof x.p?.panchayatOrTown === "string" && x.p.panchayatOrTown.trim() ? titleCase(x.p.panchayatOrTown.trim()) : null;
          const region = regionAt(x.lng, x.lat, typeof x.p?.district === "string" ? x.p.district : basinShort(b));
          const at = local && local.toLowerCase() !== x.name.toLowerCase() && local !== region ? local : null;
          const id = x.p?.tankId ?? x.p?.osm_id;
          return { kind: "lake", label: [x.name, at, region].filter(Boolean).join(", "), name: x.name, ctx: [at, region], lng: x.lng, lat: x.lat, id: id != null ? String(id) : null };
        }),
        ...places(towns.json).map((x): EntryInput => {
          const region = regionAt(x.lng, x.lat, basinShort(b));
          return { kind: "town", label: `${x.name}, ${region}`, name: x.name, ctx: [region], lng: x.lng, lat: x.lat };
        }),
      ];
      return { items, failed: boundary.failed || towns.failed || bodies.failed, name: basinShort(b), boundary: indexPolygons(boundary.json) };
    }),
    { items: [], failed: true, name: "", boundary: [] },
  );

  const cover: Cover = {
    districts: districts.flatMap((d) => (d.bbox ? [{ name: d.name, bbox: d.bbox, gps: d.gps }] : [])),
    basins: basins.map(({ name, boundary }) => ({ name, boundary })),
  };

  // A city's wards, then its lakes; a lake whose name the city also gives a lake elsewhere names the ward it lies in.
  const cities = await inTurn<Built>(
    listEnabledPlaces().map((c) => async () => {
      const [wardFile, lakeFile, corpFile] = await Promise.all([
        read<FeatureCollection>(origin, wardsGeoJsonPathFor(c.cityId)),
        read<FeatureCollection>(origin, `/geojson/${c.cityId}-water-bodies-current.geojson`),
        read<FeatureCollection>(origin, corporationsGeoJsonPathFor(c.cityId)),
      ]);
      // Placement looks at a city's wards only for points inside the city's box.
      const inCity = (x: { lng: number; lat: number }) => inBBox(x.lng, x.lat, box(c.bbox));
      const wardIndex = indexPolygons(wardFile.json);
      const own = [...wardIndex, ...indexPolygons(corpFile.json)];
      const wards = wardIndex.flatMap(({ feature }): EntryInput[] => {
        const parts = wardParts(feature.properties, c.displayName);
        const pt = parts && labelPoint(feature.geometry);
        return parts && pt && inCity({ lng: pt[0], lat: pt[1] }) ? [{ kind: "ward", ...parts, lng: pt[0], lat: pt[1] }] : [];
      });
      // A lake is named by the place a report there goes to, as placement names it: Chembarambakkam, mapped by Chennai
      // but outside its wards, reads "Tiruvallur" (a Madurai tank in Dindigul likewise). The city stays searchable.
      const lakes = places(lakeFile.json, isLake).flatMap((x) => {
        const at = coverOf(cover, x.lng, x.lat, inCity(x) ? { name: c.displayName, areas: own } : undefined);
        return at == null ? [] : [{ ...x, at }];
      });
      const byName = new Map<string, typeof lakes>();
      for (const x of lakes) byName.set(x.name, [...(byName.get(x.name) ?? []), x]);
      const elsewhere = (x: (typeof lakes)[number]) =>
        byName.get(x.name)!.some((y) => metresBetween(x.lng, x.lat, y.lng, y.lat) > SAME_LAKE_KM * 1000);
      const items = lakes.map((x): EntryInput => {
        const ward = elsewhere(x) ? containing(wardIndex, x.lng, x.lat)?.properties : null;
        const inWard = ward ? wardParts(ward, c.displayName)?.label.split(", ")[0] : null;
        return {
          kind: "lake",
          label: [x.name, inWard, x.at].filter(Boolean).join(", "),
          name: x.name,
          ctx: x.at === c.displayName ? [x.at] : [x.at, c.displayName],
          lng: x.lng,
          lat: x.lat,
          id: x.p?.osm_id != null ? String(x.p.osm_id) : null,
        };
      });
      return { items: [...items, ...wards], failed: wardFile.failed || lakeFile.failed || corpFile.failed };
    }),
    { items: [], failed: true },
  );

  // A lake in a city's file comes before the same lake in a basin's: it carries the city's id.
  const index = indexBuilder();
  for (const s of cities) for (const x of s.items) index.add(x);
  for (const s of [...districts, ...basins]) for (const x of s.items) if (coverOf(cover, x.lng, x.lat) != null) index.add(x);
  return { entries: index.entries, complete: [...cities, ...districts, ...basins].every((s) => !s.failed) };
}

/** An index missing a file that failed to load is rebuilt, at most this often, while the partial one keeps serving. */
const RETRY_MS = 60_000;
const built = new Map<string, { ready: Promise<SuggestEntry[]>; complete: boolean; at: number }>();

export function suggestIndex(origin: string): Promise<SuggestEntry[]> {
  const had = built.get(origin);
  if (had && (had.complete || Date.now() - had.at < RETRY_MS)) return had.ready;
  const fresh = build(origin).then((r) => {
    built.set(origin, { ready: Promise.resolve(r.entries), complete: r.complete, at: Date.now() });
    return r.entries;
  });
  if (!had) {
    built.set(origin, { ready: fresh, complete: false, at: Date.now() });
    return fresh;
  }
  had.at = Date.now();
  fresh.catch(() => undefined);
  return had.ready;
}
