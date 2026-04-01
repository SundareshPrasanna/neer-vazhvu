"use client";

import { useEffect, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import { getWardGeoJSON } from "@/lib/data/ward-geo";

interface SelectedWardHighlightProps {
  wardNumber: number | null;
  flyTo?: boolean;
}

/**
 * Renders a bold outline around the selected ward on the map.
 * Optionally flies the map to center on the ward.
 */
export function SelectedWardHighlight({ wardNumber, flyTo = false }: SelectedWardHighlightProps) {
  const map = useMap();
  const [wardGeoJSON, setWardGeoJSON] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    getWardGeoJSON().then(setWardGeoJSON).catch(console.error);
  }, []);

  useEffect(() => {
    if (!wardNumber || !wardGeoJSON || !flyTo) return;
    const feature = wardGeoJSON.features.find((f) => {
      const num = Number(f.properties?.ward_number || f.properties?.Ward_No);
      return num === wardNumber;
    });
    if (feature) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const L = require("leaflet");
      const bounds = L.geoJSON(feature).getBounds();
      map.flyToBounds(bounds, { padding: [40, 40], duration: 0.8, maxZoom: 14 });
    }
  }, [wardNumber, wardGeoJSON, flyTo, map]);

  if (!wardNumber || !wardGeoJSON) return null;

  const selectedFeature = wardGeoJSON.features.find((f: Feature) => {
    const num = Number(f.properties?.ward_number || f.properties?.Ward_No);
    return num === wardNumber;
  });

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
