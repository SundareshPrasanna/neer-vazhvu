import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Each department's private status link; the page also says noindex.
      disallow: "/department/",
    },
    sitemap: "https://neervazhvu.org/sitemap.xml",
  };
}
