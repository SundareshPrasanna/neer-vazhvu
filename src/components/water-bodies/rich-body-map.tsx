"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  ImageOverlay,
  GeoJSON,
  LayersControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection } from "geojson";
import { Maximize2 } from "lucide-react";
import "leaflet/dist/leaflet.css";
import type { RichBodyEntry } from "@/lib/water-bodies/rich-body-registry";

interface ChipManifest {
  chip_bbox_wsen: [number, number, number, number];
  chips: Array<{
    year: number;
    available: boolean;
    url?: string;
    sensor?: string;
    scene_count?: number;
  }>;
  tints?: {
    water_loss?: { url: string; lost_area_ha_at_30m?: number };
    built_gain?: { url: string; new_built_area_ha_at_10m?: number };
  };
  era_map?: Record<string, string>;
}

interface RichBodyMapProps {
  body: RichBodyEntry;
  /** Selected year - controlled by parent slider (T13). Defaults to latest available. */
  year?: number;
  onManifestLoaded?: (m: ChipManifest) => void;
}

/**
 * Reset-view button - bottom-left of the map (Leaflet attribution sits
 * bottom-right, layers control top-right, zoom controls top-left, so
 * bottom-left is the only corner not already claimed).
 */
function ResetViewButton({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  return (
    <div className="leaflet-bottom leaflet-left" style={{ marginBottom: 10, marginLeft: 10, pointerEvents: "auto" }}>
      <div className="leaflet-control">
        <button
          onClick={() => map.fitBounds(bounds)}
          title="Reset view to default zoom and centre"
          aria-label="Reset view"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-md shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Reset view</span>
        </button>
      </div>
    </div>
  );
}

export function RichBodyMap({ body, year, onManifestLoaded }: RichBodyMapProps) {
  const [manifest, setManifest] = useState<ChipManifest | null>(null);
  const [polygon, setPolygon] = useState<FeatureCollection | null>(null);
  const [buffer, setBuffer] = useState<FeatureCollection | null>(null);

  // Fetch manifest + polygons in parallel
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(body.imagery_manifest_path).then((r) => r.json()),
      fetch(body.polygon_path).then((r) => r.json()),
      body.buffer_path
        ? fetch(body.buffer_path).then((r) => r.json())
        : Promise.resolve(null),
    ]).then(([m, p, b]) => {
      if (cancelled) return;
      setManifest(m);
      setPolygon(p);
      if (b) setBuffer(b);
      onManifestLoaded?.(m);
    });
    return () => {
      cancelled = true;
    };
    // onManifestLoaded intentionally excluded; we only want to refetch on body change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body.id]);

  // Available years (chips that succeeded)
  const availableYears = useMemo(
    () => (manifest?.chips ?? []).filter((c) => c.available).map((c) => c.year),
    [manifest]
  );

  // Pick the year to render: parent's choice if available, else the latest
  const renderYear = useMemo(() => {
    if (!availableYears.length) return null;
    if (year != null && availableYears.includes(year)) return year;
    return availableYears[availableYears.length - 1];
  }, [year, availableYears]);

  const renderChip = useMemo(() => {
    if (renderYear == null || !manifest) return null;
    return manifest.chips.find((c) => c.year === renderYear) ?? null;
  }, [renderYear, manifest]);

  // Convert chip_bbox_wsen [W, S, E, N] -> Leaflet bounds [[S, W], [N, E]]
  const bounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    if (!manifest) return null;
    const [w, s, e, n] = manifest.chip_bbox_wsen;
    return [
      [s, w],
      [n, e],
    ];
  }, [manifest]);

  // Initial fit-bounds (chip bbox + 5% pad). The user can pan and zoom
  // freely from here - we deliberately do NOT set maxBounds so the
  // experience feels exploratory rather than caged. A Reset button
  // (rendered inside the map below) restores this initial view.
  const initialBounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    if (!bounds) return null;
    const [[s, w], [n, e]] = bounds as [[number, number], [number, number]];
    const padLat = (n - s) * 0.05;
    const padLon = (e - w) * 0.05;
    return [
      [s - padLat, w - padLon],
      [n + padLat, e + padLon],
    ];
  }, [bounds]);

  if (!manifest || !bounds || !initialBounds || !polygon) {
    return (
      <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <span className="text-sm text-slate-500 dark:text-slate-400">Loading map…</span>
      </div>
    );
  }

  return (
    <MapContainer
      bounds={initialBounds}
      minZoom={9}
      maxZoom={18}
      scrollWheelZoom
      zoomControl
      className="w-full h-full"
      attributionControl
    >
      <ResetViewButton bounds={initialBounds} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
      />

      <LayersControl position="topright" collapsed={false}>
        {/* Backdrop satellite chip for the selected year */}
        {renderChip?.url && (
          <LayersControl.Overlay name={`Satellite ${renderYear}`} checked>
            <ImageOverlay
              key={renderChip.url}
              url={renderChip.url}
              bounds={bounds}
              opacity={1.0}
              zIndex={400}
            />
          </LayersControl.Overlay>
        )}

        {/* Cumulative tints */}
        {manifest.tints?.water_loss?.url && (
          <LayersControl.Overlay name="Water lost (1990-2021)" checked>
            <ImageOverlay
              url={manifest.tints.water_loss.url}
              bounds={bounds}
              opacity={0.85}
              zIndex={410}
            />
          </LayersControl.Overlay>
        )}
        {manifest.tints?.built_gain?.url && (
          <LayersControl.Overlay name="New built (2016-2025)" checked>
            <ImageOverlay
              url={manifest.tints.built_gain.url}
              bounds={bounds}
              opacity={0.7}
              zIndex={420}
            />
          </LayersControl.Overlay>
        )}

        {/* Legal buffer (1 km NGT) - rendered below the gazette outline */}
        {buffer && (
          <LayersControl.Overlay name="NGT 1 km buffer" checked>
            <GeoJSON
              data={buffer as FeatureCollection}
              style={{
                color: "#f59e0b",
                weight: 2,
                opacity: 0.9,
                dashArray: "6 4",
                fillOpacity: 0,
              }}
            />
          </LayersControl.Overlay>
        )}

        {/* Gazetted Ramsar - always the anchor; rendered last so it is on top */}
        <LayersControl.Overlay name="Ramsar boundary (gazetted)" checked>
          <GeoJSON
            data={polygon as FeatureCollection}
            style={{
              color: "#10b981",
              weight: 3,
              opacity: 1,
              fillOpacity: 0,
            }}
          />
        </LayersControl.Overlay>
      </LayersControl>
    </MapContainer>
  );
}
