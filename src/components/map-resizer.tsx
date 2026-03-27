"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

/**
 * Drop inside a <MapContainer> to auto-invalidate on container resize.
 * Fixes the blank-gap issue when side panels open/close.
 */
export function MapResizer() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    const container = map.getContainer();
    if (container) observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}
