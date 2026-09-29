"use client";

import { useEffect, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import { getWardGeoJSON } from "@/lib/data/ward-geo";
import { wardNumberOf } from "@/lib/utils/ward-number";

interface SelectedWardHighlightProps {
  wardNumber: number | null;
  flyTo?: boolean;
  /** Path to the city's ward GeoJSON. */
  wardGeoJsonUrl: string | null;
}

/**
 * Renders a bold outline around the selected ward on the map.
 * Optionally flies the map to center on the ward.
 */
export function SelectedWardHighlight({ wardNumber, flyTo = false, wardGeoJsonUrl }: SelectedWardHighlightProps) {
  const map = useMap();
  const [wardGeoJSON, setWardGeoJSON] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    getWardGeoJSON(wardGeoJsonUrl).then(setWardGeoJSON).catch(console.error);
  }, [wardGeoJsonUrl]);

  useEffect(() => {
    if (!wardNumber || !wardGeoJSON || !flyTo) return;
    const feature = wardGeoJSON.features.find((f) => wardNumberOf(f.properties) === wardNumber);
    if (feature) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const L = require("leaflet");
      const bounds = L.geoJSON(feature).getBounds();
      map.flyToBounds(bounds, { padding: [40, 40], duration: 0.8, maxZoom: 14 });
    }
  }, [wardNumber, wardGeoJSON, flyTo, map]);

  if (!wardNumber || !wardGeoJSON) return null;

  const selectedFeature = wardGeoJSON.features.find((f: Feature) => wardNumberOf(f.properties) === wardNumber);

  if (!selectedFeature) return null;

  const collection: FeatureCollection = {
    type: "FeatureCollection",
    features: [selectedFeature],
  };

  return (
    <GeoJSON
      key={`selected-ward-${wardNumber}`}
      data={collection}
      style={{
        color: "#2563eb",
        weight: 4,
        opacity: 1,
        fillOpacity: 0,
        dashArray: undefined,
        interactive: false,
      }}
    />
  );
}
