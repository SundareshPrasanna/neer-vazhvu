"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, LayersControl } from "react-leaflet";
import L from "leaflet";
import type { Layer, PathOptions } from "leaflet";
import type { Feature, FeatureCollection } from "geojson";
import type { RiverQualityData, SelectedRiver } from "@/types/river-quality";
import { QUALITY_COLORS } from "@/types/river-quality";
import "leaflet/dist/leaflet.css";

interface RiversMapProps {
  qualityData: RiverQualityData;
  onSelect: (sel: SelectedRiver | null) => void;
}

export function RiversMap({ qualityData, onSelect }: RiversMapProps) {
  const [riversGeoJSON, setRiversGeoJSON] =
    useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/geojson/chennai-rivers.geojson")
      .then((r) => r.json())
      .then(setRiversGeoJSON)
      .catch(console.error);
  }, []);

  // Build a lookup from river_id → overall_status for styling polylines
  const statusMap = new Map(
    qualityData.rivers.map((r) => [r.id, r.overall_status])
  );

  // Build station points GeoJSON from quality data
  const stationsGeoJSON: FeatureCollection = {
    type: "FeatureCollection",
    features: qualityData.rivers.flatMap((river) =>
      river.stations.map((station) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [station.lng, station.lat],
        },
        properties: {
          river_id: river.id,
          station_id: station.id,
          name: station.name,
          stretch: station.stretch,
          river_name: river.name,
          overall_status: river.overall_status,
        },
      }))
    ),
  };

  const riverStyle = (feature: Feature | undefined): PathOptions => {
    const riverId = feature?.properties?.river_id as string | undefined;
    const status = riverId ? statusMap.get(riverId) : undefined;
    const color = QUALITY_COLORS[status ?? "degraded"];
    return { color, weight: 4, opacity: 0.85 };
  };

  const onEachRiver = (feature: Feature, layer: Layer) => {
    const props = feature.properties as {
      river_id: string;
      name: string;
      name_ta: string;
    };
    const riverId = props.river_id;
    const river = qualityData.rivers.find((r) => r.id === riverId);

    layer.bindTooltip(
      `<strong>${props.name}</strong><br/><span style="font-size:11px;color:#64748b">${river?.cpcb_class ?? ""}</span>`,
      { sticky: true }
    );

    layer.on({
      click: (e) => {
        const latlng: [number, number] = [e.latlng.lat, e.latlng.lng];
        onSelect({ riverId, latlng });
      },
      mouseover: (e) => {
        (e.target as L.Polyline).setStyle({ weight: 7, opacity: 1 });
      },
      mouseout: (e) => {
        (e.target as L.Polyline).setStyle({ weight: 4, opacity: 0.85 });
      },
    });
  };

  const stationPointToLayer = (feature: Feature, latlng: L.LatLng) => {
    const props = feature.properties as {
      overall_status: string;
    };
    const color =
      QUALITY_COLORS[
        props.overall_status as keyof typeof QUALITY_COLORS
      ] ?? "#94a3b8";
    return L.circleMarker(latlng, {
      radius: 7,
      fillColor: "white",
      color,
      weight: 2.5,
      fillOpacity: 0.95,
      opacity: 1,
    });
  };

  const onEachStation = (feature: Feature, layer: Layer) => {
    const props = feature.properties as {
      river_id: string;
      station_id: string;
      name: string;
      stretch: string;
    };

    layer.bindTooltip(
      `<strong>${props.name}</strong><br/><span style="font-size:11px;color:#64748b">${props.stretch}</span>`,
      { sticky: true }
    );

    layer.on({
      click: (e) => {
        const latlng: [number, number] = [e.latlng.lat, e.latlng.lng];
        onSelect({
          riverId: props.river_id,
          stationId: props.station_id,
          latlng,
        });
      },
      mouseover: (e) => {
        (e.target as L.CircleMarker).setStyle({ radius: 9 });
      },
      mouseout: (e) => {
        (e.target as L.CircleMarker).setStyle({ radius: 7 });
      },
    });
  };

  if (!riversGeoJSON) {
    return (
      <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <span className="text-slate-500 dark:text-slate-400">Loading map...</span>
      </div>
    );
  }

  return (
    <MapContainer
      center={[13.05, 80.22]}
      zoom={11}
      className="h-full w-full"
      scrollWheelZoom={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <LayersControl position="topright">
        <LayersControl.Overlay name="River paths" checked>
          <GeoJSON
            data={riversGeoJSON}
            style={riverStyle}
            onEachFeature={onEachRiver}
          />
        </LayersControl.Overlay>
        <LayersControl.Overlay name="Monitoring stations" checked>
          <GeoJSON
            data={stationsGeoJSON}
            pointToLayer={stationPointToLayer}
            onEachFeature={onEachStation}
          />
        </LayersControl.Overlay>
      </LayersControl>
    </MapContainer>
  );
}
