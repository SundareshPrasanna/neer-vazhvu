import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://qlwnafrcfajosvbdswyf.supabase.co https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com; font-src 'self'; connect-src 'self' https://qlwnafrcfajosvbdswyf.supabase.co https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com; base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
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

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
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
