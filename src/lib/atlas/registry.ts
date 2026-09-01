/**
 * Atlas district registry - METADATA ONLY.
 *
 * This file is imported by client components (the landing board, the header
 * place switcher), so it must never import district data. The per-district
 * artifacts live under public/data/atlas/<state>/<district>/ and are read by
 * server-only loaders in ./data.ts at build time. Keeping the two apart is
 * what stops 45 MB of Gram Panchayat payloads from reaching the browser.
 *
 * Adding a district is one entry here plus its artifacts: the route tree,
 * directory and brief pages are shared and take the district as
 * configuration (the same rule as src/lib/cities for cities).
 */
export interface AtlasDistrict {
  /** URL slug under /atlas/<state>/, e.g. "thanjavur". */
  slug: string;
  /** NVDM scope id (schemas/nvdm/scopes.json), state-prefixed because
   *  district names collide nationally: "tn-thanjavur". */
  scopeId: string;
  stateSlug: string;
  stateCode: string;
  stateName: string;
  name: string;
  /** One line for the landing card, in the same register as CITY_HOOKS. */
  hook: string;
  /** Basin id + sub-basin key this district sits in, for the basin link
   *  (src/lib/basins). Absent when the district is not inside a mapped basin. */
  basin?: { basinId: string; subBasinKey: string; subBasinName: string };
  /** Curated (human-reviewed) briefs exist only where a reviewer wrote them. */
  hasCuratedBriefs: boolean;
  /** Preview gate, the Surat/Pune pattern: false hides the routes and the
   *  landing card link until a named consumer exists. */
  published: boolean;
}

export const ATLAS_DISTRICTS: AtlasDistrict[] = [
  {
    slug: "thanjavur",
    scopeId: "tn-thanjavur",
    stateSlug: "tn",
    stateCode: "TN",
    stateName: "Tamil Nadu",
    name: "Thanjavur",
    hook: "The rice bowl: 80% of irrigation is canal water released at Mettur, so the district's water year is decided upstream.",
    basin: { basinId: "cauvery-tn", subBasinKey: "116", subBasinName: "Cauvery Delta" },
    hasCuratedBriefs: true,
    published: false,
  },
  {
    slug: "tiruchirappalli",
    scopeId: "tn-tiruchirappalli",
    stateSlug: "tn",
    stateCode: "TN",
    stateName: "Tamil Nadu",
    name: "Tiruchirappalli",
    hook: "Thanjavur's inverse: 60% of irrigation is from wells, so its water security is a groundwater question.",
    basin: { basinId: "cauvery-tn", subBasinKey: "123", subBasinName: "Mettur Reservoir to Noyyal confluence" },
    hasCuratedBriefs: false,
    published: false,
  },
];

export function listAtlasDistricts(): AtlasDistrict[] {
  return ATLAS_DISTRICTS;
}

/** Published districts only. Production behaviour. */
export function listPublishedAtlasDistricts(): AtlasDistrict[] {
  return ATLAS_DISTRICTS.filter((d) => d.published);
}

/** Published districts + any slug listed in NEXT_PUBLIC_PREVIEW_DISTRICTS
 *  (comma separated), the same preview mechanism as
 *  NEXT_PUBLIC_PREVIEW_CITIES in src/lib/cities: unset in production, set in
 *  .env.local or a branch deploy to see a gated district end to end. Every
 *  user-facing surface (landing board, place switcher, route guard) reads
 *  this one function, so a district cannot be linked from one place and 404
 *  in another. */
export function listVisibleAtlasDistricts(): AtlasDistrict[] {
  const published = listPublishedAtlasDistricts();
  const raw = process.env.NEXT_PUBLIC_PREVIEW_DISTRICTS;
  if (!raw) return published;
  const slugs = new Set(
    raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
  const extras = ATLAS_DISTRICTS.filter((d) => !d.published && slugs.has(d.slug));
  return [...published, ...extras];
}

export function isAtlasDistrictVisible(d: AtlasDistrict): boolean {
  return listVisibleAtlasDistricts().some((x) => x.scopeId === d.scopeId);
}

export function findAtlasDistrict(
  stateSlug: string,
  districtSlug: string,
): AtlasDistrict | undefined {
  const s = stateSlug.toLowerCase();
  const d = districtSlug.toLowerCase();
  return ATLAS_DISTRICTS.find((x) => x.stateSlug === s && x.slug === d);
}

export function districtHref(d: AtlasDistrict): string {
  return `/atlas/${d.stateSlug}/${d.slug}`;
}

export function blockHref(d: AtlasDistrict, blockCode: string): string {
  return `${districtHref(d)}/blocks/${blockCode}`;
}

export function panchayatHref(d: AtlasDistrict, lgdCode: string): string {
  return `${districtHref(d)}/panchayats/${lgdCode}`;
}
