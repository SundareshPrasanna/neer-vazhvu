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

interface HotspotMarker {
  id: string;
  lat: number;
  lng: number;
  name: string | null;
  category: HotspotProps["category"];
  category_label: string;
}

export function FloodLeafletMap({ center, zoom, layerState }: MapProps) {
  const tiles = useMapTiles();
  // Pre-flatten hotspot features into a plain marker array on fetch.
  // Earlier attempt rendered <CircleMarker> directly from a typed
  // FeatureCollection but the markers never showed up on screen even
  // though the SSR HTML + fetched data were both correct. The
  // /bangalore/rivers page renders CircleMarkers off a plain typed
  // array without issue, so we mirror that shape here.
  const [hotspots, setHotspots] = useState<HotspotMarker[] | null>(null);
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
      .then((r) => r.json() as Promise<FeatureCollection>)
      .then((fc) => {
        const out: HotspotMarker[] = [];
        for (let i = 0; i < (fc.features ?? []).length; i++) {
          const f = fc.features[i];
          if (!f?.geometry || f.geometry.type !== "Point") continue;
          const coords = f.geometry.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) continue;
          const lng = Number(coords[0]);
          const lat = Number(coords[1]);
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
          const props = (f.properties ?? {}) as Partial<HotspotProps>;
          if (
            props.category !== "named_flood_prone" &&
            props.category !== "named_low_lying" &&
            props.category !== "vulnerable_unnamed"
          ) {
            continue;
          }
          out.push({
            id: `${props.category}-${i}`,
            lat,
            lng,
            name: props.name ?? null,
            category: props.category,
            category_label: props.category_label ?? "",
          });
        }
        setHotspots(out);
      })
      .catch(() => setHotspots([]));
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

  // Filter pre-flattened hotspots per category toggle.
  const visibleHotspots = (hotspots ?? []).filter((m) => {
    if (m.category === "named_flood_prone") return layerState.showHotspotsNamedProne;
    if (m.category === "named_low_lying") return layerState.showHotspotsLowLying;
    if (m.category === "vulnerable_unnamed") return layerState.showHotspotsVulnerable;
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

      {visibleHotspots.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.lat, m.lng]}
          radius={CATEGORY_RADIUS[m.category]}
          pathOptions={{
            color: "#0f172a",
            weight: 1,
            fillColor: CATEGORY_FILL[m.category],
            fillOpacity: 0.85,
          }}
        >
          <Tooltip>
            <strong>{m.name || "(unnamed point)"}</strong>
            <br />
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              {m.category_label}
            </span>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
