"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Tooltip,
} from "react-leaflet";
import { MapResizer } from "@/components/map-resizer";
import type { Layer } from "leaflet";
import L from "leaflet";
import type { Feature } from "geojson";
import {
  HAZARD_COLORS,
  VULNERABILITY_COLORS,
  DRAINAGE_COLORS,
  DRAINAGE_WIDTHS,
  SEWERAGE_COLORS,
} from "@/types/flood-risk";
import type {
  FloodViewMode,
  HazardCategory,
  HazardZoneProperties,
  Hotspot2015Properties,
  DrainageProperties,
  STPProperties,
  SPSProperties,
  PumpingMainProperties,
  SelectedFloodFeature,
} from "@/types/flood-risk";
import { useLanguage } from "@/lib/i18n/context";
import { useMapTiles } from "@/lib/utils/map-tiles";
import { getWardGeoJSON } from "@/lib/data/ward-geo";
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

  // Canvas renderer with tolerance for easier clicking on thin lines
  const canvasRenderer = useMemo(() => L.canvas({ tolerance: 10 }), []);

  // GeoJSON data state
  const [hazardGeo, setHazardGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [depthGeo, setDepthGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [hotspot2015Geo, setHotspot2015Geo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [hotspot2020Geo, setHotspot2020Geo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [drainageGeo, setDrainageGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [riversGeo, setRiversGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [wardsGeo, setWardsGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [sewerageGeo, setSewerageGeo] = useState<GeoJSON.FeatureCollection | null>(null);

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

    getWardGeoJSON()
      .then(setWardsGeo)
      .catch(console.error);

    fetch("/geojson/chennai-sewerage.geojson")
      .then((r) => r.json())
      .then(setSewerageGeo)
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

  // Hazard click + hover handler
  const onEachHazard = useCallback(
    (feature: Feature, layer: Layer) => {
      const cat = (feature.properties?.category ?? "low") as HazardCategory;
      const label = t(`flood.${cat}`);
      layer.bindTooltip(label, {
        sticky: true,
        className: "leaflet-tooltip-custom",
      });
      layer.on("click", (e) => {
        const latlng = e.latlng;
        onSelect({
          kind: "hazard",
          props: feature.properties as unknown as HazardZoneProperties,
          latlng: [latlng.lat, latlng.lng],
        });
      });
    },
    [onSelect, t]
  );

  // Drainage style
  const drainageStyle = useCallback(
    (feature: Feature | undefined) => {
      const type = feature?.properties?.drain_type ?? "SWD";
      return {
        color: DRAINAGE_COLORS[type] ?? "#3b82f6",
        weight: DRAINAGE_WIDTHS[type] ?? 2,
        opacity: 0.85,
      };
    },
    []
  );

  // Drainage click handler
  const onEachDrainage = useCallback(
    (feature: Feature, layer: Layer) => {
      const props = feature.properties;
      const label = props?.street || props?.location || props?.drain_type || "";
      if (label) {
        layer.bindTooltip(label, {
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

  // Ward boundary style - thin dashed outlines for area context
  const wardStyle = useCallback(() => ({
    color: tiles.stroke,
    weight: 1.5,
    opacity: 0.5,
    fillOpacity: 0,
    dashArray: "4 4",
  }), [tiles.stroke]);

  const onEachWard = useCallback(
    (feature: Feature, layer: Layer) => {
      const props = feature.properties;
      const zoneName = props?.Zone_Name ?? "";
      const wardNo = props?.Ward_No ?? "";
      if (zoneName) {
        layer.bindTooltip(`${zoneName} - Ward ${wardNo}`, {
          sticky: true,
          className: "leaflet-tooltip-custom",
        });
      }
    },
    []
  );

  // Sewerage - filter features by layer type
  const sewerageMains = useMemo(() => {
    if (!sewerageGeo) return null;
    return {
      type: "FeatureCollection" as const,
      features: sewerageGeo.features.filter((f) => f.properties?.layer === "pumping_main"),
    };
  }, [sewerageGeo]);

  const sewerageSPS = useMemo(() => {
    if (!sewerageGeo) return null;
    return {
      type: "FeatureCollection" as const,
      features: sewerageGeo.features.filter((f) => f.properties?.layer === "sps"),
    };
  }, [sewerageGeo]);

  const sewerageSTP = useMemo(() => {
    if (!sewerageGeo) return null;
    return {
      type: "FeatureCollection" as const,
      features: sewerageGeo.features.filter((f) => f.properties?.layer === "stp"),
    };
  }, [sewerageGeo]);

  // Pumping main style
  const pumpingMainStyle = useCallback(() => ({
    color: SEWERAGE_COLORS.pumping_main,
    weight: 2.5,
    opacity: 0.8,
  }), []);

  const onEachPumpingMain = useCallback(
    (feature: Feature, layer: Layer) => {
      const p = feature.properties;
      const label = [p?.origin, p?.destination].filter(Boolean).join(" -> ");
      if (label) {
        layer.bindTooltip(label, { sticky: true, className: "leaflet-tooltip-custom" });
      }
      layer.on("click", (e) => {
        onSelect({
          kind: "pumping_main",
          props: p as unknown as PumpingMainProperties,
          latlng: [e.latlng.lat, e.latlng.lng],
        });
      });
    },
    [onSelect]
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
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />

      {/* ── Ward boundaries (all modes) ───────── */}
      {wardsGeo && (
        <GeoJSON
          key={`ward-boundaries-${tiles.url}`}
          data={wardsGeo}
          style={wardStyle}
          onEachFeature={onEachWard}
        />
      )}

      {/* ── Hazard mode ─────────────────────────── */}
      {viewMode === "hazard" && hazardGeo && (
        <GeoJSON
          key={`hazard-zones-${tiles.url}`}
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
                radius={4}
                pathOptions={{ fillColor: color, fillOpacity: 0.8, color: "#fff", weight: 1 }}
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
            const radius = Math.max(3, Math.min(8, p.DEPTH / 6));
            return (
              <CircleMarker
                key={`d-${i}`}
                center={[p.F_LATITUDE, p.F_LONGITUDE]}
                radius={radius}
                pathOptions={{ fillColor: "#3b82f6", fillOpacity: 0.6, color: "#1d4ed8", weight: 1 }}
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
                radius={5}
                pathOptions={{ fillColor: "#dc2626", fillOpacity: 0.8, color: "#fff", weight: 1 }}
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
              key={`rivers-overlay-${tiles.url}`}
              data={riversGeo}
              style={riverStyle}
              onEachFeature={onEachRiver}
            />
          )}
          {/* Drainage network - canvas renderer for 10px click tolerance */}
          {drainageGeo && (
            <GeoJSON
              key={`drainage-network-${tiles.url}`}
              data={drainageGeo}
              style={drainageStyle}
              onEachFeature={onEachDrainage}
              {...{ renderer: canvasRenderer } as Record<string, unknown>}
            />
          )}
        </>
      )}

      {/* ── Sewerage mode ─────────────────────────── */}
      {viewMode === "sewerage" && (
        <>
          {/* Rivers overlay for context */}
          {riversGeo && (
            <GeoJSON
              key={`rivers-sewer-${tiles.url}`}
              data={riversGeo}
              style={riverStyle}
              onEachFeature={onEachRiver}
            />
          )}
          {/* Pumping mains (lines) - canvas renderer for 10px click tolerance */}
          {sewerageMains && (
            <GeoJSON
              key={`pumping-mains-${tiles.url}`}
              data={sewerageMains}
              style={pumpingMainStyle}
              onEachFeature={onEachPumpingMain}
              {...{ renderer: canvasRenderer } as Record<string, unknown>}
            />
          )}
          {/* Pumping stations (points) */}
          {sewerageSPS?.features.map((f, i) => {
            const p = f.properties as unknown as SPSProperties;
            const coords = (f.geometry as GeoJSON.Point).coordinates;
            return (
              <CircleMarker
                key={`sps-${i}`}
                center={[coords[1], coords[0]]}
                radius={3}
                pathOptions={{
                  fillColor: SEWERAGE_COLORS.sps,
                  fillOpacity: 0.85,
                  color: "#fff",
                  weight: 1,
                }}
                eventHandlers={{
                  click: () =>
                    onSelect({
                      kind: "sps",
                      props: p,
                      latlng: [coords[1], coords[0]],
                    }),
                }}
              >
                <Tooltip>{p.name}</Tooltip>
              </CircleMarker>
            );
          })}
          {/* Treatment plants (larger markers) */}
          {sewerageSTP?.features.map((f, i) => {
            const p = f.properties as unknown as STPProperties;
            const coords = (f.geometry as GeoJSON.Point).coordinates;
            return (
              <CircleMarker
                key={`stp-${i}`}
                center={[coords[1], coords[0]]}
                radius={8}
                pathOptions={{
                  fillColor: SEWERAGE_COLORS.stp,
                  fillOpacity: 0.9,
                  color: "#fff",
                  weight: 1.5,
                }}
                eventHandlers={{
                  click: () =>
                    onSelect({
                      kind: "stp",
                      props: p,
                      latlng: [coords[1], coords[0]],
                    }),
                }}
              >
                <Tooltip>
                  {p.name}
                  {p.capacity_mld ? ` (${p.capacity_mld} MLD)` : ""}
                </Tooltip>
              </CircleMarker>
            );
          })}
        </>
      )}
    </MapContainer>
  );
}
