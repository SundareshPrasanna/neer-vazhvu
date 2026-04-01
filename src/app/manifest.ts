import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Neer Vazhvu - Chennai Water Intelligence",
    short_name: "Neer Vazhvu",
    description:
      "Open-source platform tracking Chennai's reservoirs, groundwater, river health, flood risk, drainage, and 1,787 water bodies across 200 wards.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0ea5e9",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
