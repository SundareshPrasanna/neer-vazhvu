import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Neer Vazhvu - Tamil Nadu Water Intelligence",
    short_name: "Neer Vazhvu",
    description:
      "Open-source platform tracking reservoirs, groundwater, river health, flood risk, drainage, and water bodies across Tamil Nadu cities - starting with Chennai and Madurai.",
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
