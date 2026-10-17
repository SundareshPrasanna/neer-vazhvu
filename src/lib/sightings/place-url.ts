/**
 * Where a published report can be seen: the public page of the place it was bound to, with the
 * map's citizen-reports layer switched on where that page has one. Pure: reads the place registries only.
 */
import { districtHref, listAtlasDistricts, panchayatHref } from "@/lib/atlas/registry";
import { basinsForCity, tryGetBasinManifest } from "@/lib/basins";
import { basinEmbedHref } from "@/lib/basins/paths";
import { tryGetPlaceConfig } from "@/lib/cities";
import { isFeatureSupportedForCity } from "@/lib/cities/routing";
import { isPrivateCategory } from "./taxonomy";
import type { SightingRow } from "./types";

export type PlaceFields = Pick<
  SightingRow,
  "place_kind" | "place_id" | "ward_id" | "water_body_id" | "water_body_name" | "panchayat_code" | "panchayat_name" | "category"
>;

export interface PlaceLink {
  href: string;
  label: string;
}

/** The query that opens a map with its citizen-reports layer on. */
const REPORTS_LAYER = "layer=reports";

/**
 * The page a report shows on, or null where no public page lists or maps it. Cities: a water body's
 * map, else the ward page, else the city's water-bodies map. Districts: the GP page, else the district
 * page. Basins: the basin's own page (its atlas). Tap water and water tests have no public point, so
 * they never go to a map: only to the ward, GP, district or basin list.
 */
/** A watershed is named with its river ("Arkavathi watershed, Cauvery"); a river's own states are not named. */
function basinLabel(b: NonNullable<ReturnType<typeof tryGetBasinManifest>>): string {
  const river = (name: string) => name.replace(/\s*\(.*\)$/, "").replace(/ Basin$/, "");
  const parent = b.parentBasinId ? tryGetBasinManifest(b.parentBasinId) : null;
  return parent ? `${river(b.displayName)} watershed, ${river(parent.displayName)}` : b.displayName.replace(/ Basin\b/, " river basin");
}

export function placeUrl(p: PlaceFields): PlaceLink | null {
  const mapped = !isPrivateCategory(p.category);

  if (p.place_kind === "city") {
    const city = tryGetPlaceConfig(p.place_id);
    if (!city) return null;
    const has = (route: string) => isFeatureSupportedForCity(`/${route}`, city.cityId);
    const map = `/${city.cityId}/water-bodies?${REPORTS_LAYER}`;
    if (mapped && p.water_body_id && has("water-bodies")) {
      return { href: map, label: p.water_body_name ? `${p.water_body_name}, ${city.displayName}` : city.displayName };
    }
    if (p.ward_id && has("my-ward")) {
      return { href: `/${city.cityId}/my-ward?ward=${encodeURIComponent(p.ward_id)}`, label: `Ward ${p.ward_id}, ${city.displayName}` };
    }
    return mapped && has("water-bodies") ? { href: map, label: city.displayName } : null;
  }

  if (p.place_kind === "district") {
    const d = listAtlasDistricts().find((x) => x.scopeId === p.place_id);
    if (!d) return null;
    const district = `${d.name} district`;
    return p.panchayat_code
      ? { href: panchayatHref(d, p.panchayat_code), label: p.panchayat_name ? `${p.panchayat_name}, ${district}` : district }
      : { href: districtHref(d), label: district };
  }

  // A sub-basin overview (the whole Cauvery) has neither the report list nor the map layer.
  const basin = tryGetBasinManifest(p.place_id);
  if (!basin || basin.overviewMode) return null;
  // The deep dive on a city's rivers page when one hosts this basin (it opens from ?basin=); else the basin's own page.
  const host = basin.cityIds.find((c) => c !== "chennai" && basinsForCity(c)[0]?.basinId === basin.basinId);
  const page = host ? `/${host}/rivers?basin=${basin.basinId}` : basinEmbedHref(basin.basinId);
  const join = page.includes("?") ? "&" : "?";
  return {
    href: mapped ? `${page}${join}${REPORTS_LAYER}` : page,
    label: basinLabel(basin),
  };
}
