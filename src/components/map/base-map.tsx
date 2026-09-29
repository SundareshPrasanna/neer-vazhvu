"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, useMap, type MapContainerProps } from "react-leaflet";
import { useMapTiles } from "@/lib/utils/map-tiles";

/** Re-measure the map when its container resizes (side panels opening, closing). */
export function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

/** A Leaflet map with the theme's base tiles and MapResizer; layers go in as children. */
export function BaseMap({ className = "h-full w-full", children, ...props }: MapContainerProps) {
  const tiles = useMapTiles();
  return (
    <MapContainer className={className} {...props}>
      <MapResizer />
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      {children}
    </MapContainer>
  );
}
