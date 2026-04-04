import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://qlwnafrcfajosvbdswyf.supabase.co https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com; font-src 'self'; connect-src 'self' https://qlwnafrcfajosvbdswyf.supabase.co https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com; base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=()",
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
    return [
      {
        source: "/lake-restoration",
        destination: "/water-bodies",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
