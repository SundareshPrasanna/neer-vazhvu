import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
