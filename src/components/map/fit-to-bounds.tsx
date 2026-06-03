"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

type LatLng = [number, number];

interface FitToBoundsProps {
  /**
   * Bounds to fit. `null` is a sentinel meaning "data not ready yet, do
   * nothing" (so the MapContainer's static center+zoom remains until the
   * data layer finishes loading).
   */
  bounds: L.LatLngBoundsExpression | null;
  /**
   * Refire the fit whenever this key changes (e.g. when viewMode flips
   * between "exploitation" and "risk"). Keep stable between refires to
   * preserve user pan/zoom.
   */
  resetKey?: string | number;
  /** Padding in pixels added around the fitted bounds. */
  padding?: [number, number];
  /** Cap the zoom-in level so dense compact data doesn't over-zoom. */
  maxZoom?: number;
}

/**
 * Drop inside <MapContainer> to make the map fit a computed bounds box on
 * mount + whenever `resetKey` changes. Designed for choropleths whose
 * extent varies by view mode (Bangalore's 369-ward risk layer covers a
 * far wider footprint than the compact GWR-block exploitation layer, so
 * a single static `zoom` prop frames one well and the other badly).
 */
export function FitToBounds({
  bounds,
  resetKey,
  padding = [20, 20],
  maxZoom = 13,
}: FitToBoundsProps) {
  const map = useMap();
  const lastFitKey = useRef<string | number | null>(null);

  useEffect(() => {
    if (!bounds) return;
    if (lastFitKey.current === (resetKey ?? "__init__")) return;
    lastFitKey.current = resetKey ?? "__init__";
    try {
      map.fitBounds(bounds, { padding, maxZoom });
    } catch {
      // L.fitBounds can throw if the bounds collapsed to a single point
      // with NaN values; swallow to keep the rest of the map alive.
    }
  }, [bounds, resetKey, padding, maxZoom, map]);

  return null;
}

/**
 * Build a Leaflet LatLngBounds from a GeoJSON FeatureCollection. Returns
 * `null` when the FC is empty / not yet loaded so the caller can pass
 * straight through to <FitToBounds bounds={...} />.
 */
export function geoJsonBounds(
  fc: GeoJSON.FeatureCollection | null | undefined,
): L.LatLngBounds | null {
  if (!fc || !fc.features?.length) return null;
  try {
    const layer = L.geoJSON(fc);
    const b = layer.getBounds();
    return b.isValid() ? b : null;
  } catch {
    return null;
  }
}

/**
 * Build bounds from a flat list of [lat, lng] pairs. Filters out
 * NaN/Infinity entries (which would silently produce an invalid bounds).
 */
export function pointsBounds(points: LatLng[] | null | undefined): L.LatLngBounds | null {
  if (!points || points.length === 0) return null;
  const valid = points.filter(
    ([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng),
  );
  if (valid.length === 0) return null;
  const b = L.latLngBounds(valid.map(([lat, lng]) => L.latLng(lat, lng)));
  return b.isValid() ? b : null;
}
