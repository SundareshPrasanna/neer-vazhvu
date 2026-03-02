"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { Layer, LeafletMouseEvent } from "leaflet";
import type { Feature } from "geojson";
import { getGroundwaterColor } from "@/types/groundwater";
import type { GroundwaterWard } from "@/types/groundwater";
import "leaflet/dist/leaflet.css";

interface WardMapProps {
  groundwaterData: Map<number, GroundwaterWard>;
  onWardSelect: (ward: GroundwaterWard | null) => void;
}

export function WardMap({ groundwaterData, onWardSelect }: WardMapProps) {
  const [geoJSON, setGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/geojson/chennai-wards-2022.geojson")
      .then((r) => r.json())
      .then(setGeoJSON)
      .catch(console.error);
  }, []);

  const style = (feature: Feature | undefined) => {
    if (!feature) return {};
    const wardNum = feature.properties?.ward_number || feature.properties?.Ward_No;
    const ward = groundwaterData.get(Number(wardNum));
    return {
      fillColor: getGroundwaterColor(ward?.depthM ?? null),
      weight: 1,
      opacity: 0.7,
      color: "#374151",
      fillOpacity: 0.75,
    };
  };

  const onEachFeature = (feature: Feature, layer: Layer) => {
    const wardNum = feature.properties?.ward_number || feature.properties?.Ward_No;
    const ward = groundwaterData.get(Number(wardNum));

    const name = ward?.wardName || `Ward ${wardNum}`;
    const detail = ward
      ? `<br/><span style="font-size:11px;color:#64748b">Ward ${wardNum}</span><br/>${ward.depthM?.toFixed(1)}m depth`
      : "<br/>No data";
    layer.bindTooltip(
      `<strong>${name}</strong>${detail}`,
      { sticky: true }
    );

    layer.on({
      click: () => {
        onWardSelect(ward || null);
      },
      mouseover: (e: LeafletMouseEvent) => {
        const target = e.target;
        target.setStyle({ weight: 3, color: "#1e40af", fillOpacity: 0.9 });
      },
      mouseout: (e: LeafletMouseEvent) => {
        const target = e.target;
        target.setStyle({ weight: 1, color: "#374151", fillOpacity: 0.75 });
      },
    });
  };

  if (!geoJSON) {
    return (
      <div className="h-full w-full bg-slate-100 flex items-center justify-center">
        <span className="text-slate-500">Loading map...</span>
      </div>
    );
  }

  return (
    <MapContainer
      center={[13.0827, 80.2707]}
      zoom={11}
      className="h-full w-full"
      scrollWheelZoom={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <GeoJSON data={geoJSON} style={style} onEachFeature={onEachFeature} />
    </MapContainer>
  );
}
