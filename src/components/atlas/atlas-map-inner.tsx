"use client";

import { useMemo } from "react";
import { CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import L from "leaflet";

import { FitToBounds, pointsBounds } from "@/components/map/fit-to-bounds";
import { MapResizer } from "@/components/map-resizer";
import { useMapTiles } from "@/lib/utils/map-tiles";
import type { AtlasMapPoint, AtlasMapPolygons } from "./atlas-map";

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

/** Panchayat outlines: thin, low fill, so the markers and the tiles read. */
function polygonStyle(isDark: boolean) {
  return {
    color: isDark ? "#22d3ee" : "#0e7490",
    weight: 1,
    opacity: 0.8,
    fillColor: isDark ? "#06b6d4" : "#67e8f9",
    fillOpacity: 0.12,
  };
}

function polygonsBounds(polygons: AtlasMapPolygons | undefined): L.LatLngBounds | null {
  if (!polygons || polygons.features.length === 0) return null;
  const bounds = L.geoJSON(polygons as never).getBounds();
  return bounds.isValid() ? bounds : null;
}

function PolygonLayer({ polygons, isDark }: { polygons: AtlasMapPolygons | undefined; isDark: boolean }) {
  if (!polygons || polygons.features.length === 0) return null;
  return (
    <GeoJSON
      key={`${polygons.features.length}-${isDark}`}
      data={polygons as never}
      style={() => polygonStyle(isDark)}
      onEachFeature={(feature, layer) => {
        const name = (feature.properties as { name?: string } | null)?.name;
        if (name) layer.bindTooltip(name, { sticky: true });
      }}
    />
  );
}

export function AtlasDistrictMapInner({
  points,
  polygons,
}: {
  points: AtlasMapPoint[];
  polygons?: AtlasMapPolygons;
}) {
  const tiles = useMapTiles();
  const bounds = useMemo(
    () =>
      polygonsBounds(polygons) ??
      pointsBounds(points.map((p) => [p.latitude, p.longitude] as [number, number])),
    [points, polygons],
  );
  if ((points.length === 0 && !polygons?.features.length) || !bounds) return null;
  const center = bounds.getCenter();
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={9}
      scrollWheelZoom={false}
      className="h-full w-full"
    >
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      <FitToBounds bounds={bounds} padding={[16, 16]} maxZoom={polygons?.features.length ? 13 : 11} />
      <MapResizer />
      <PolygonLayer polygons={polygons} isDark={tiles.isDark} />
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

export function AtlasPlaceMapInner({ point, polygons }: { point: AtlasMapPoint; polygons?: AtlasMapPolygons }) {
  const tiles = useMapTiles();
  const center: [number, number] = [point.latitude, point.longitude];
  const bounds = useMemo(() => polygonsBounds(polygons), [polygons]);
  return (
    <MapContainer center={center} zoom={13} scrollWheelZoom={false} className="h-full w-full">
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      {bounds ? <FitToBounds bounds={bounds} padding={[12, 12]} maxZoom={14} /> : null}
      <MapResizer />
      <PolygonLayer polygons={polygons} isDark={tiles.isDark} />
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
