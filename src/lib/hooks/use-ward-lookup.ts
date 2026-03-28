"use client";

import { useCallback, useEffect, useRef } from "react";
import { getWardGeoJSON } from "@/lib/data/ward-geo";

// Module-level cache for turf imports (shared across all hook instances)
let cachedPip: typeof import("@turf/boolean-point-in-polygon").default | null = null;
let cachedHelpers: typeof import("@turf/helpers") | null = null;

/**
 * Hook that returns a stable function to resolve a lat/lng to a ward number
 * via exact point-in-polygon against the 200 ward polygons.
 * Uses the shared ward GeoJSON loader (single fetch, cached).
 */
export function useWardLookup() {
  const wardGeoRef = useRef<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    let mounted = true;
    getWardGeoJSON().then((geo) => {
      if (mounted) wardGeoRef.current = geo;
    });
    if (!cachedPip) {
      import("@turf/boolean-point-in-polygon").then((m) => { cachedPip = m.default; });
    }
    if (!cachedHelpers) {
      import("@turf/helpers").then((m) => { cachedHelpers = m; });
    }
    return () => { mounted = false; };
  }, []);

  return useCallback(async (lat: number, lng: number): Promise<number | null> => {
    if (!wardGeoRef.current) {
      wardGeoRef.current = await getWardGeoJSON();
    }
    if (!cachedPip) {
      cachedPip = (await import("@turf/boolean-point-in-polygon")).default;
    }
    if (!cachedHelpers) {
      cachedHelpers = await import("@turf/helpers");
    }

    const pt = cachedHelpers.point([lng, lat]);
    for (const feature of wardGeoRef.current.features) {
      if (cachedPip(pt, feature as GeoJSON.Feature<GeoJSON.Polygon>)) {
        const props = feature.properties as Record<string, unknown>;
        return (props.ward_number as number) ?? (props.Ward_No as number) ?? null;
      }
    }
    return null;
  }, []);
}
