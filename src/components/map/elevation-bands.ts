"use client";

import { useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";

/* ── Ground-elevation bands (FABDEM) - data hook + palette ──────────────
   Leaflet-free on purpose: importable from SSR'd client components. The
   render layer (react-leaflet) lives in elevation-bands-layer.tsx and
   must be imported behind next/dynamic { ssr: false }. */

export const ELEVATION_BAND_COLORS: Record<number, string> = {
  0: "#075985", // 0-2 m   sky-800
  1: "#0ea5e9", // 2-5 m   sky-500
  2: "#6ee7b7", // 5-10 m  emerald-300
  3: "#a3e635", // 10-20 m lime-400
  4: "#facc15", // 20-50 m yellow-400
  5: "#d97706", // 50-100  amber-600
  6: "#92400e", // 100+    amber-800
};

export function useElevationBands(cityId: string, enabled: boolean) {
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    // A cheap existence probe on mount (so the toggle can hide itself),
    // full parse only once the user first enables the layer.
    if (available === null) {
      fetch(`/data/elevation-bands-${cityId}.geojson`, { method: "HEAD" })
        .then((r) => !cancelled && setAvailable(r.ok))
        .catch(() => !cancelled && setAvailable(false));
    }
    if (enabled && available && !data) {
      fetch(`/data/elevation-bands-${cityId}.geojson`)
        .then((r) => (r.ok ? (r.json() as Promise<FeatureCollection>) : null))
        .then((d) => !cancelled && d && setData(d))
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [cityId, enabled, available, data]);

  return { data: enabled ? data : null, available: available === true };
}

export interface ElevationLegendEntry {
  band: string;
  color: string;
}

/** Legend entries derived from the loaded bands file - band labels differ
 *  per city (Mumbai 0-2 m ... Bengaluru 700-840 m), so they must come
 *  from the data, never be hardcoded at a call site. */
export function elevationLegendEntries(
  data: import("geojson").FeatureCollection | null,
): ElevationLegendEntry[] {
  if (!data) return [];
  return [...data.features]
    .sort((a, b) => Number(a.properties?.order ?? 0) - Number(b.properties?.order ?? 0))
    .map((f) => ({
      band: String(f.properties?.band ?? ""),
      color: ELEVATION_BAND_COLORS[Number(f.properties?.order ?? 0)] ?? "#94a3b8",
    }));
}
