"use client";

import dynamic from "next/dynamic";
import type { FeatureCollection, MultiPolygon } from "geojson";

export interface AtlasMapPoint {
  id: string;
  name: string;
  blockName: string;
  latitude: number;
  longitude: number;
  href?: string;
}

/** Served Panchayat polygons (LGD-built districts). Drawn under the markers
 *  and, on a place map, used as the frame. */
export type AtlasMapPolygons = FeatureCollection<MultiPolygon, { lgdCode: string; name: string }>;

/** Small secondary markers on a place map: the water bodies a register
 *  records for the Panchayat, where their coordinates may be served. */
export interface AtlasMapMarker {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
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
export function AtlasDistrictMap({ points, polygons }: { points: AtlasMapPoint[]; polygons?: AtlasMapPolygons }) {
  return (
    <div className="h-[22rem] sm:h-[28rem] w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <DistrictMap points={points} polygons={polygons} />
    </div>
  );
}

export function AtlasPlaceMap({
  point,
  polygons,
  markers,
}: {
  point: AtlasMapPoint;
  polygons?: AtlasMapPolygons;
  markers?: AtlasMapMarker[];
}) {
  return (
    <div className="h-64 sm:h-72 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <PlaceMap point={point} polygons={polygons} markers={markers} />
    </div>
  );
}
