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
 * configuration (the same rule as src/lib/cities for cities). Which identity
 * adapter built a district's artifacts (TNRD for Tamil Nadu, the LGD
 * directory elsewhere) is recorded in the served directory, not here.
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
  /** Where a CURRENT irrigation-by-source reading comes from in this state,
   *  named on the page whether or not the artifact is served: the label of
   *  the report that carries it, and the sentence to print when it is not
   *  wired. Copy, not data: the numbers come from irrigation-current.json. */
  irrigationCurrentSource: { label: string; gapNote: string; nextStep: string };
}

const TN_IRRIGATION_SOURCE = {
  label: "Season and Crop Report",
  nextStep: "the Season and Crop Report 2024-25 is published and not yet wired.",
  gapNote:
    "Newer official readings exist at coarser grain and are not wired yet: the annual Season and Crop Report (district totals by source, 2024-25 edition published) and the 2017-18 Minor Irrigation Census (wells and tanks by village).",
};

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
    published: true,
    irrigationCurrentSource: TN_IRRIGATION_SOURCE,
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
    published: true,
    irrigationCurrentSource: TN_IRRIGATION_SOURCE,
  },
  {
    slug: "satara",
    scopeId: "mh-satara",
    stateSlug: "mh",
    stateCode: "MH",
    stateName: "Maharashtra",
    name: "Satara",
    hook: "Koyna country with a dry eastern edge: the same district holds talukas at 20% and talukas at 76% of their groundwater.",
    hasCuratedBriefs: true,
    published: true,
    irrigationCurrentSource: {
      label: "District Socio-Economic Review",
      nextStep:
        "the Satara District Socio-Economic Review's irrigation-by-source table stops at 2015-16 with the wells column not stated, and the Land Use Statistics and Minor Irrigation Census tables are not wired.",
      gapNote:
        "No current reading is wired: the Satara District Socio-Economic Review 2024 prints area irrigated by source only for 2015-16 with the wells column not stated, the national Land Use Statistics tables are reachable only from within India, and the 2017-18 Minor Irrigation Census (wells and tanks by village) is not wired yet.",
    },
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
