"use client";

import { useCallback, useEffect, useRef } from "react";
import { getWardGeoJSON } from "@/lib/data/ward-geo";

/**
 * Hook that returns a function to resolve a lat/lng to a ward number
 * via exact point-in-polygon against the 200 ward polygons.
 * Uses the shared ward GeoJSON loader (single fetch, cached).
 */
export function useWardLookup() {
  const wardGeoRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const pipRef = useRef<typeof import("@turf/boolean-point-in-polygon").default | null>(null);
  const helpersRef = useRef<typeof import("@turf/helpers") | null>(null);

  useEffect(() => {
    // Eagerly load ward GeoJSON + turf modules
    getWardGeoJSON().then((geo) => {
      wardGeoRef.current = geo;
    });
    import("@turf/boolean-point-in-polygon").then((m) => {
      pipRef.current = m.default;
    });
    import("@turf/helpers").then((m) => {
      helpersRef.current = m;
    });
  }, []);

  const lookup = useCallback(async (lat: number, lng: number): Promise<number | null> => {
    // Ensure data is loaded
    if (!wardGeoRef.current) {
      wardGeoRef.current = await getWardGeoJSON();
    }
    if (!pipRef.current) {
      const m = await import("@turf/boolean-point-in-polygon");
      pipRef.current = m.default;
    }
    if (!helpersRef.current) {
      helpersRef.current = await import("@turf/helpers");
    }

    const pt = helpersRef.current.point([lng, lat]);
    for (const feature of wardGeoRef.current.features) {
      if (pipRef.current(pt, feature as GeoJSON.Feature<GeoJSON.Polygon>)) {
        const props = feature.properties as Record<string, unknown>;
        return (props.ward_number as number) ?? (props.Ward_No as number) ?? null;
      }
    }
    return null;
  }, []);

  return lookup;
}
