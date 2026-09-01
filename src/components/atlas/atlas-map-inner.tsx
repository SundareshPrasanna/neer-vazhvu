"use client";

import { useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";

import { FitToBounds, pointsBounds } from "@/components/map/fit-to-bounds";
import { MapResizer } from "@/components/map-resizer";
import { useMapTiles } from "@/lib/utils/map-tiles";
import type { AtlasMapPoint } from "./atlas-map";

import "leaflet/dist/leaflet.css";

/**
 * Leaflet over the platform's OSM tiles, framed by FitToBounds on the
 * district's own points. The centre is never a default: an Atlas map with no
 * points renders nothing rather than somebody else's city.
 */
function markerStyle(isDark: boolean) {
  return {
    color: isDark ? "#67e8f9" : "#0e7490",
    fillColor: isDark ? "#0891b2" : "#06b6d4",
    fillOpacity: 0.85,
    opacity: 1,
    weight: 1.5,
  };
}

export function AtlasDistrictMapInner({ points }: { points: AtlasMapPoint[] }) {
  const tiles = useMapTiles();
  const bounds = useMemo(
    () => pointsBounds(points.map((p) => [p.latitude, p.longitude] as [number, number])),
    [points],
  );
  if (points.length === 0 || !bounds) return null;
  const center = bounds.getCenter();
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={9}
      scrollWheelZoom={false}
      className="h-full w-full"
    >
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      <FitToBounds bounds={bounds} padding={[16, 16]} maxZoom={11} />
      <MapResizer />
      {points.map((point) => (
        <CircleMarker
          key={point.id}
          center={[point.latitude, point.longitude]}
          radius={4}
          pathOptions={markerStyle(tiles.isDark)}
        >
          <Tooltip direction="top" offset={[0, -4]}>
            <strong>{point.name}</strong>
            <br />
            <span>{point.blockName} block</span>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

export function AtlasPlaceMapInner({ point }: { point: AtlasMapPoint }) {
  const tiles = useMapTiles();
  const center: [number, number] = [point.latitude, point.longitude];
  return (
    <MapContainer center={center} zoom={13} scrollWheelZoom={false} className="h-full w-full">
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      <MapResizer />
      <CircleMarker center={center} radius={8} pathOptions={markerStyle(tiles.isDark)}>
        <Tooltip permanent direction="top" offset={[0, -8]}>
          <strong>{point.name}</strong>
          <br />
          <span>{point.blockName} block</span>
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
