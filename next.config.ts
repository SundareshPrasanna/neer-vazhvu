import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    // connect-src data: + worker-src blob: are for the basin atlas PDF export:
    // @react-pdf/renderer fetches its wasm layout engine as a data: URL and
    // renders the document in a blob: worker. Both are self-contained (no
    // network reach), and script-src already concedes 'unsafe-eval', so the
    // marginal exposure is nil - without them the export dies at click time.
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://qlwnafrcfajosvbdswyf.supabase.co https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com; font-src 'self'; connect-src 'self' data: https://qlwnafrcfajosvbdswyf.supabase.co https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com; worker-src 'self' blob:; base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
  },
  {
    key: "Permissions-Policy",
    // geolocation=(self): the basin atlas "Where am I?" control needs it for
    // our own origin. Camera/mic stay fully disabled (unused).
    value: "camera=(), geolocation=(self), microphone=()",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
];

// /embed/* is the ONLY framable namespace: chrome-less atlas pages built for
// partner sites (Paani Earth's Arkavathi and Kabini deep dives). Everything
// else keeps frame-ancestors 'none'. localhost is allowed in dev so embeds are
// testable. CSP host-sources take no trailing slash or path, and each host is
// its own source - www is NOT covered by the apex entry.
// Paani Earth lost edit access to paani.earth and now publishes on
// forrivers.life. The Hostinger staging origin that carried the deep dive in
// between stays listed until they confirm the move is done; drop it then,
// because Hostinger recycles those auto-generated subdomains.
const EMBED_FRAME_ANCESTORS = [
  "'self'",
  "https://forrivers.life",
  "https://www.forrivers.life",
  "https://orchid-wildcat-815854.hostingersite.com",
  ...(process.env.NODE_ENV === "development" ? ["http://localhost:*"] : []),
].join(" ");
const embedHeaders = securityHeaders.map((h) => {
  if (h.key === "Content-Security-Policy") {
    return { key: h.key, value: h.value.replace("frame-ancestors 'none'", `frame-ancestors ${EMBED_FRAME_ANCESTORS}`) };
  }
  if (h.key === "X-Frame-Options") {
    // XFO can't express an allowlist. Browsers that support CSP
    // frame-ancestors (all evergreen) ignore XFO when both are present;
    // SAMEORIGIN is the deny-by-default fallback for legacy browsers.
    return { key: h.key, value: "SAMEORIGIN" };
  }
  return h;
});

const nextConfig: NextConfig = {
  // Several server routes fs.readFile from public/ with DYNAMIC paths
  // (e.g. `public/${dir}/${filename}`), which Next's file tracer can't
  // narrow - so it traces ALL of public/ (~213 MB tracked) into every such
  // serverless function, blowing Vercel's 250 MB uncompressed limit.
  // Exclude the heavyweight client-fetched-only payloads globally, then
  // re-include the specific families each route genuinely reads.
  outputFileTracingExcludes: {
    "*": [
      "./public/data/cascade/**",
      "./public/data/basins/**",
      "./public/geojson/**",
      "./public/tiles/**",
      "./public/images/**",
      "./public/data/rich-bodies/**",
    ],
  },
  outputFileTracingIncludes: {
    // Catchment API reads the per-city cascade files (streams/basin/downstream
    // + catchments geojson) - the single legitimately heavy route.
    // NOTE: keys are globs - [cityId] would parse as a character class and
    // never match, so single-segment wildcards stand in for dynamic params.
    "/api/cascade/**": ["./public/data/cascade/**"],
    // About + dashboard read the small cascade stats/health summaries.
    "*": [
      "./public/data/cascade/*-cascade-stats.json",
      "./public/data/cascade/*-cascades-health.json",
    ],
    // Water-bodies page reads the current-bodies geojson for census matching.
    "/*/water-bodies": ["./public/geojson/*-water-bodies-current.geojson"],
    // Ward-depth interpolation reads the ward polygons.
    "/api/groundwater/wards-interpolated": ["./public/geojson/*-wards-*.geojson"],
    // Rivers page reads the basin inventory (arkavathi PRS surface).
    "/*/rivers": ["./public/data/basins/*/inventory.json"],
    // Embeddable atlas reads the same inventory.
    "/embed/basins/*": ["./public/data/basins/*/inventory.json"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // Must come after the catch-all: for duplicate keys on a matching
      // path, the later rule wins.
      {
        source: "/embed/:path*",
        headers: embedHeaders,
      },
    ];
  },
  async redirects() {
    // Chennai moved from flat URLs to the /chennai namespace (the project
    // landing page now lives at /). 301 every legacy flat Chennai URL to its
    // /chennai equivalent so existing links and search results survive.
    // Query strings (e.g. /water-bodies?ward=, /flood-risk?view=) are
    // preserved automatically. /shoreline is kept explicitly because that
    // link has been shared externally.
    const flatFeatures = [
      "about",
      "cascades",
      "facts",
      "flood-risk",
      "groundwater",
      "origins",
      "rivers",
      "shoreline",
      "water-bodies",
    ];
    return [
      // Legacy lake-restoration -> Chennai water bodies (was -> /water-bodies).
      { source: "/lake-restoration", destination: "/chennai/water-bodies", permanent: true },
      { source: "/lake-restoration/:path*", destination: "/chennai/water-bodies", permanent: true },
      // my-ward has sub-routes (compare / rankings / report).
      { source: "/my-ward", destination: "/chennai/my-ward", permanent: true },
      { source: "/my-ward/:path*", destination: "/chennai/my-ward/:path*", permanent: true },
      // Single-segment flat features.
      ...flatFeatures.flatMap((f) => [
        { source: `/${f}`, destination: `/chennai/${f}`, permanent: true },
        { source: `/${f}/:path*`, destination: `/chennai/${f}/:path*`, permanent: true },
      ]),
    ];
  },
};

export default nextConfig;
