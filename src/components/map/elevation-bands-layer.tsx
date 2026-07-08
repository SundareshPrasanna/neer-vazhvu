"use client";

import { GeoJSON } from "react-leaflet";
import type { FeatureCollection, Feature } from "geojson";
import { ELEVATION_BAND_COLORS } from "./elevation-bands";

/* Render layer for the FABDEM ground-elevation bands. react-leaflet
   touches `window` at import - always bring this in behind
   next/dynamic { ssr: false } (or from a component that already is). */

export function ElevationBandsLayer({ data }: { data: FeatureCollection | null }) {
  if (!data) return null;
  return (
    <GeoJSON
      key="elevation-bands"
      data={data}
      style={(f?: Feature) => ({
        fillColor: ELEVATION_BAND_COLORS[Number(f?.properties?.order ?? 0)] ?? "#94a3b8",
        fillOpacity: 0.45,
        stroke: false,
        interactive: false,
      })}
      interactive={false}
    />
  );
}
