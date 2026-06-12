"use client";

import dynamic from "next/dynamic";

// Leaflet needs the DOM; load the atlas client-side only.
const CatchmentAtlas = dynamic(
  () => import("./catchment-atlas").then((m) => m.CatchmentAtlas),
  {
    ssr: false,
    loading: () => (
      <div className="h-[calc(100vh-64px)] w-full flex items-center justify-center text-sm text-slate-500">
        Loading catchment atlas…
      </div>
    ),
  },
);

export function CatchmentAtlasClient(props: {
  cityId: string;
  cityDisplayName: string;
  center: [number, number];
  zoom?: number;
}) {
  return <CatchmentAtlas {...props} />;
}
