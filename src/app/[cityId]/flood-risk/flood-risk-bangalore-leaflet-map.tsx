"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection } from "geojson";
import { useMapTiles } from "@/lib/utils/map-tiles";

interface HotspotProps {
  name?: string;
  description?: string;
  category: "named_flood_prone" | "vulnerable_unnamed" | "named_low_lying";
  category_label: string;
}

interface SwdProps {
  name?: string;
  description?: string;
}

const CATEGORY_FILL: Record<HotspotProps["category"], string> = {
  named_flood_prone: "#dc2626", // red-600
  named_low_lying: "#ea580c", // orange-600
  vulnerable_unnamed: "#facc15", // yellow-400
};

const CATEGORY_RADIUS: Record<HotspotProps["category"], number> = {
  named_flood_prone: 6,
  named_low_lying: 5,
  vulnerable_unnamed: 4,
};

interface LayerToggleState {
  showPrimary: boolean;
  showSecondary: boolean;
  showHotspotsNamedProne: boolean;
  showHotspotsLowLying: boolean;
  showHotspotsVulnerable: boolean;
}

interface MapProps {
  center: [number, number];
  zoom: number;
  layerState: LayerToggleState;
}

export function FloodLeafletMap({ center, zoom, layerState }: MapProps) {
  const tiles = useMapTiles();
  const [hotspots, setHotspots] = useState<FeatureCollection | null>(null);
  const [swdPrimary, setSwdPrimary] = useState<FeatureCollection | null>(null);
  const [swdSecondary, setSwdSecondary] = useState<FeatureCollection | null>(null);

  // Lazy-load each layer the first time its toggle is on.
  useEffect(() => {
    if (hotspots !== null) return;
    if (
      !layerState.showHotspotsNamedProne &&
      !layerState.showHotspotsLowLying &&
      !layerState.showHotspotsVulnerable
    ) {
      return;
    }
    fetch("/data/bangalore-flood-hotspots.geojson")
      .then((r) => r.json())
      .then(setHotspots)
      .catch(() => setHotspots({ type: "FeatureCollection", features: [] }));
  }, [
    hotspots,
    layerState.showHotspotsNamedProne,
    layerState.showHotspotsLowLying,
    layerState.showHotspotsVulnerable,
  ]);

  useEffect(() => {
    if (swdPrimary !== null) return;
    if (!layerState.showPrimary) return;
    fetch("/geojson/bangalore-swd-primary.geojson")
      .then((r) => r.json())
      .then(setSwdPrimary)
      .catch(() => setSwdPrimary({ type: "FeatureCollection", features: [] }));
  }, [swdPrimary, layerState.showPrimary]);

  useEffect(() => {
    if (swdSecondary !== null) return;
    if (!layerState.showSecondary) return;
    fetch("/geojson/bangalore-swd-secondary.geojson")
      .then((r) => r.json())
      .then(setSwdSecondary)
      .catch(() => setSwdSecondary({ type: "FeatureCollection", features: [] }));
  }, [swdSecondary, layerState.showSecondary]);

  // Filter hotspots client-side per category toggle.
  const visibleHotspots = (hotspots?.features ?? []).filter((f) => {
    const cat = (f.properties as HotspotProps | null)?.category;
    if (cat === "named_flood_prone") return layerState.showHotspotsNamedProne;
    if (cat === "named_low_lying") return layerState.showHotspotsLowLying;
    if (cat === "vulnerable_unnamed") return layerState.showHotspotsVulnerable;
    return false;
  });

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        key={tiles.url}
        url={tiles.url}
        attribution={tiles.attribution}
      />

      {layerState.showSecondary && swdSecondary && (
        <GeoJSON
          key="swd-secondary"
          data={swdSecondary}
          style={() => ({
            color: "#3b82f6", // blue-500
            weight: 1.2,
            opacity: 0.55,
          })}
        />
      )}

      {layerState.showPrimary && swdPrimary && (
        <GeoJSON
          key="swd-primary"
          data={swdPrimary}
          style={() => ({
            color: "#1d4ed8", // blue-700
            weight: 2.5,
            opacity: 0.85,
          })}
          onEachFeature={(feat: Feature, layer) => {
            const props = feat.properties as SwdProps | null;
            const label = props?.name || "Primary stormwater drain";
            layer.bindTooltip(label, { sticky: true });
          }}
        />
      )}

      {visibleHotspots.map((f, i) => {
        // Hotspot features in this GeoJSON are always Point geometries
        // (the source KSRSAC KMLs only contain Point placemarks for the
        // hotspot layer). Narrow defensively so a future ingest of
        // MultiPoint / Polygon doesn't crash; skip non-Point features.
        if (f.geometry.type !== "Point") return null;
        const props = f.properties as HotspotProps;
        const [lng, lat] = f.geometry.coordinates as [number, number];
        return (
          <CircleMarker
            key={`${props.category}-${i}`}
            center={[lat, lng]}
            radius={CATEGORY_RADIUS[props.category]}
            pathOptions={{
              color: "#0f172a",
              weight: 1,
              fillColor: CATEGORY_FILL[props.category],
              fillOpacity: 0.85,
            }}
          >
            <Tooltip>
              <strong>{props.name || "(unnamed point)"}</strong>
              <br />
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                {props.category_label}
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
