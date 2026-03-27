"use client";

import { useEffect, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Tooltip,
} from "react-leaflet";
import { MapResizer } from "@/components/map-resizer";
import type { Layer } from "leaflet";
import type { Feature } from "geojson";
import {
  HAZARD_COLORS,
  VULNERABILITY_COLORS,
  DRAINAGE_COLORS,
  DRAINAGE_WIDTHS,
} from "@/types/flood-risk";
import type {
  FloodViewMode,
  HazardCategory,
  HazardZoneProperties,
  Hotspot2015Properties,
  DrainageProperties,
  SelectedFloodFeature,
} from "@/types/flood-risk";
import { useLanguage } from "@/lib/i18n/context";
import { useMapTiles } from "@/lib/utils/map-tiles";
import "leaflet/dist/leaflet.css";

interface FloodRiskMapProps {
  viewMode: FloodViewMode;
  historicalEvent: "2015" | "2020";
  onSelect: (feat: SelectedFloodFeature | null) => void;
}

const CHENNAI_CENTER: [number, number] = [13.06, 80.24];
const CHENNAI_ZOOM = 11;

export function FloodRiskMap({
  viewMode,
  historicalEvent,
  onSelect,
}: FloodRiskMapProps) {
  const { t } = useLanguage();
  const tiles = useMapTiles();

  // GeoJSON data state
  const [hazardGeo, setHazardGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [depthGeo, setDepthGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [hotspot2015Geo, setHotspot2015Geo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [hotspot2020Geo, setHotspot2020Geo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [drainageGeo, setDrainageGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [riversGeo, setRiversGeo] = useState<GeoJSON.FeatureCollection | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetch("/geojson/chennai-flood-hazard-zones.geojson")
      .then((r) => r.json())
      .then(setHazardGeo)
      .catch(console.error);

    fetch("/geojson/chennai-flood-inundation-depth.geojson")
      .then((r) => r.json())
      .then(setDepthGeo)
      .catch(console.error);

    fetch("/geojson/chennai-flood-2015-hotspots.geojson")
      .then((r) => r.json())
      .then(setHotspot2015Geo)
      .catch(console.error);

    fetch("/geojson/chennai-flood-2020-hotspots.geojson")
      .then((r) => r.json())
      .then(setHotspot2020Geo)
      .catch(console.error);

    fetch("/geojson/chennai-drainage.geojson")
      .then((r) => r.json())
      .then(setDrainageGeo)
      .catch(console.error);

    fetch("/geojson/chennai-rivers.geojson")
      .then((r) => r.json())
      .then(setRiversGeo)
      .catch(console.error);
  }, []);

  // Hazard zone style
  const hazardStyle = useCallback(
    (feature: Feature | undefined) => {
      const cat = (feature?.properties?.category ?? "low") as HazardCategory;
      const color = HAZARD_COLORS[cat] ?? "#64748b";
      return {
        fillColor: color,
        fillOpacity: 0.45,
        color,
        weight: 0.5,
        opacity: 0.7,
      };
    },
    []
  );

  // Hazard click handler
  const onEachHazard = useCallback(
    (feature: Feature, layer: Layer) => {
      layer.on("click", (e) => {
        const latlng = e.latlng;
        onSelect({
          kind: "hazard",
          props: feature.properties as unknown as HazardZoneProperties,
          latlng: [latlng.lat, latlng.lng],
        });
      });
    },
    [onSelect]
  );

  // Drainage style
  const drainageStyle = useCallback(
    (feature: Feature | undefined) => {
      const type = feature?.properties?.waterway_type ?? "drain";
      return {
        color: DRAINAGE_COLORS[type] ?? "#64748b",
        weight: DRAINAGE_WIDTHS[type] ?? 2,
        opacity: 0.8,
      };
    },
    []
  );

  // Drainage click handler
  const onEachDrainage = useCallback(
    (feature: Feature, layer: Layer) => {
      const props = feature.properties;
      if (props?.name) {
        layer.bindTooltip(props.name, {
          sticky: true,
          className: "leaflet-tooltip-custom",
        });
      }
      layer.on("click", (e) => {
        const latlng = e.latlng;
        onSelect({
          kind: "drainage",
          props: props as unknown as DrainageProperties,
          latlng: [latlng.lat, latlng.lng],
        });
      });
    },
    [onSelect]
  );

  // River style (overlay in drainage mode)
  const riverStyle = useCallback(() => ({
    color: "#06b6d4",
    weight: 3,
    opacity: 0.8,
  }), []);

  const onEachRiver = useCallback(
    (_feature: Feature, layer: Layer) => {
      const name = _feature.properties?.name;
      if (name) {
        layer.bindTooltip(name, {
          sticky: true,
          className: "leaflet-tooltip-custom",
        });
      }
    },
    []
  );

  return (
    <MapContainer
      center={CHENNAI_CENTER}
      zoom={CHENNAI_ZOOM}
      className="h-full w-full z-0"
      zoomControl={true}
      scrollWheelZoom={true}
    >
      <MapResizer />
      <TileLayer url={tiles.url} attribution={tiles.attribution} />

      {/* ── Hazard mode ─────────────────────────── */}
      {viewMode === "hazard" && hazardGeo && (
        <GeoJSON
          key="hazard-zones"
          data={hazardGeo}
          style={hazardStyle}
          onEachFeature={onEachHazard}
        />
      )}

      {/* ── Historical mode ─────────────────────── */}
      {viewMode === "historical" && historicalEvent === "2015" && (
        <>
          {/* 2015 hotspot points */}
          {hotspot2015Geo?.features.map((f, i) => {
            const p = f.properties as unknown as Hotspot2015Properties;
            const color = VULNERABILITY_COLORS[p.vulnerability] ?? "#f97316";
            return (
              <CircleMarker
                key={`h15-${i}`}
                center={[p.latitude, p.longitude]}
                radius={6}
                pathOptions={{ fillColor: color, fillOpacity: 0.8, color: "#fff", weight: 1.5 }}
                eventHandlers={{
                  click: () =>
                    onSelect({
                      kind: "hotspot2015",
                      props: p,
                      latlng: [p.latitude, p.longitude],
                    }),
                }}
              >
                <Tooltip>{p.location}</Tooltip>
              </CircleMarker>
            );
          })}
          {/* 2015 depth points */}
          {depthGeo?.features.map((f, i) => {
            const p = f.properties as { DEPTH: number; F_REMARKS: string; F_LATITUDE: number; F_LONGITUDE: number };
            const radius = Math.max(4, Math.min(14, p.DEPTH / 4));
            return (
              <CircleMarker
                key={`d-${i}`}
                center={[p.F_LATITUDE, p.F_LONGITUDE]}
                radius={radius}
                pathOptions={{ fillColor: "#3b82f6", fillOpacity: 0.6, color: "#1d4ed8", weight: 1.5 }}
                eventHandlers={{
                  click: () =>
                    onSelect({
                      kind: "depth",
                      props: p,
                      latlng: [p.F_LATITUDE, p.F_LONGITUDE],
                    }),
                }}
              >
                <Tooltip>{p.DEPTH} ft - {t("flood.legend_depth")}</Tooltip>
              </CircleMarker>
            );
          })}
        </>
      )}

      {viewMode === "historical" && historicalEvent === "2020" && (
        <>
          {hotspot2020Geo?.features.map((f, i) => {
            const p = f.properties as { name: string; latitude: number; longitude: number };
            return (
              <CircleMarker
                key={`h20-${i}`}
                center={[p.latitude, p.longitude]}
                radius={7}
                pathOptions={{ fillColor: "#dc2626", fillOpacity: 0.8, color: "#fff", weight: 1.5 }}
                eventHandlers={{
                  click: () =>
                    onSelect({
                      kind: "hotspot2020",
                      props: p,
                      latlng: [p.latitude, p.longitude],
                    }),
                }}
              >
                <Tooltip>{p.name}</Tooltip>
              </CircleMarker>
            );
          })}
        </>
      )}

      {/* ── Drainage mode ───────────────────────── */}
      {viewMode === "drainage" && (
        <>
          {/* Rivers overlay */}
          {riversGeo && (
            <GeoJSON
              key="rivers-overlay"
              data={riversGeo}
              style={riverStyle}
              onEachFeature={onEachRiver}
            />
          )}
          {/* Drainage network */}
          {drainageGeo && (
            <GeoJSON
              key="drainage-network"
              data={drainageGeo}
              style={drainageStyle}
              onEachFeature={onEachDrainage}
            />
          )}
        </>
      )}
    </MapContainer>
  );
}
