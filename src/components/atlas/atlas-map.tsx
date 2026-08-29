"use client";

import dynamic from "next/dynamic";

export interface AtlasMapPoint {
  id: string;
  name: string;
  blockName: string;
  latitude: number;
  longitude: number;
  href?: string;
}

function MapLoading() {
  return (
    <div
      role="status"
      className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-800 text-sm text-slate-500 dark:text-slate-400"
    >
      Loading map
    </div>
  );
}

const DistrictMap = dynamic(() => import("./atlas-map-inner").then((m) => m.AtlasDistrictMapInner), {
  ssr: false,
  loading: MapLoading,
});

const PlaceMap = dynamic(() => import("./atlas-map-inner").then((m) => m.AtlasPlaceMapInner), {
  ssr: false,
  loading: MapLoading,
});

/** Every mapped Panchayat as a point, framed to the district's own extent. */
export function AtlasDistrictMap({ points }: { points: AtlasMapPoint[] }) {
  return (
    <div className="h-[22rem] sm:h-[28rem] w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <DistrictMap points={points} />
    </div>
  );
}

export function AtlasPlaceMap({ point }: { point: AtlasMapPoint }) {
  return (
    <div className="h-64 sm:h-72 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <PlaceMap point={point} />
    </div>
  );
}
