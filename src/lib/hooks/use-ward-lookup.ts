"use client";

import { useCallback, useEffect, useRef } from "react";
import { useCityId } from "@/lib/hooks/use-city-id";
import { getWardGeoJSON } from "@/lib/data/ward-geo";
import { wardsGeoJsonPathFor } from "@/lib/cities/data-paths";
import { wardNumberOf } from "@/lib/utils/ward-number";

// Module-level cache for turf imports (shared across all hook instances)
let cachedPip: typeof import("@turf/boolean-point-in-polygon").default | null = null;
let cachedHelpers: typeof import("@turf/helpers") | null = null;

/**
 * Hook that returns a stable function to resolve a lat/lng to a ward number
 * via exact point-in-polygon against a city's ward polygons.
 * Uses the shared ward GeoJSON loader (single fetch, cached).
 *
 * The city comes from the route rather than a prop: both callers are detail
 * panels nested several levels below the page, and threading a cityId through
 * them for this alone buys nothing. Calling getWardGeoJSON() bare - which is
 * what this did - silently tested every city's coordinates against CHENNAI's
 * 200 wards, so the answer was null everywhere outside Chennai and, worse,
 * would have been a plausible wrong ward had the boxes overlapped. Outside a
 * /[cityId] route there is no param, and lookups resolve to null.
 */
export function useWardLookup() {
  const cityId = useCityId();
  const wardsUrl = cityId ? wardsGeoJsonPathFor(cityId) : undefined;
  const wardGeoRef = useRef<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    let mounted = true;
    wardGeoRef.current = null;
    if (!wardsUrl) return;
    getWardGeoJSON(wardsUrl).then((geo) => {
      if (mounted) wardGeoRef.current = geo;
    });
    if (!cachedPip) {
      import("@turf/boolean-point-in-polygon").then((m) => { cachedPip = m.default; });
    }
    if (!cachedHelpers) {
      import("@turf/helpers").then((m) => { cachedHelpers = m; });
    }
    return () => { mounted = false; };
  }, [wardsUrl]);

  return useCallback(async (lat: number, lng: number): Promise<number | null> => {
    if (!wardsUrl) return null;
    if (!wardGeoRef.current) {
      wardGeoRef.current = await getWardGeoJSON(wardsUrl);
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
        return wardNumberOf(feature.properties);
      }
    }
    return null;
  }, [wardsUrl]);
}
