"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection } from "geojson";
import { MapResizer } from "@/components/map-resizer";
import { useMapTiles } from "@/lib/utils/map-tiles";
import { FitToBounds, geoJsonBounds } from "@/components/map/fit-to-bounds";
import "leaflet/dist/leaflet.css";

interface WardProfile {
  ward_number: number;
  zone_no: string | null;
  zone_name: string | null;
  centroid: [number, number];
  area_sq_km: number | null;
}

interface MapProps {
  cityId: string;
  mapCenter: [number, number];
  mapZoom: number;
  profiles: WardProfile[];
  selectedWard: number | null;
  onSelectWard: (ward: number) => void;
}

const ZONE_COLOR: Record<string, string> = {
  CENTRAL: "#3b82f6",
  EAST:    "#10b981",
  NORTH:   "#f59e0b",
  SOUTH:   "#a855f7",
  WEST:    "#ef4444",
};

export function MyWardLeafletMap({
  cityId,
  mapCenter,
  mapZoom,
  profiles,
  selectedWard,
  onSelectWard,
}: MapProps) {
  const tiles = useMapTiles();
  const [wards, setWards] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    // Ward delimitation vintage differs by city:
    //   Chennai/Madurai use the 2022 GCC/MMC delimitation
    //   Bangalore uses GBA 2025 (Karnataka Act 36 of 2025, notified Nov 2025)
    const WARDS_VINTAGE: Record<string, string> = {
      chennai: "2022",
      madurai: "2022",
      bangalore: "2025",
    };
    const vintage = WARDS_VINTAGE[cityId] ?? "2022";
    fetch(`/geojson/${cityId}-wards-${vintage}.geojson`)
      .then((r) => {
        if (!r.ok) throw new Error(`Wards geojson HTTP ${r.status}`);
        return r.json();
      })
      .then(setWards)
      .catch(console.error);
  }, [cityId]);

  // Build a quick ward_no -> zone_name lookup from profiles for coloring.
  const zoneByWard = new Map<number, string | null>();
  for (const p of profiles) zoneByWard.set(p.ward_number, p.zone_name);

  const wardStyle = (feature: Feature | undefined) => {
    if (!feature) return {};
    const wardNo = Number(feature.properties?.ward_no ?? feature.properties?.ward_number);
    const zone = zoneByWard.get(wardNo);
    const isSelected = wardNo === selectedWard;
    const fill = zone ? ZONE_COLOR[zone] ?? "#94a3b8" : "#94a3b8";
    return {
      fillColor: fill,
      weight: isSelected ? 3 : 1,
      color: isSelected ? "#0c4a6e" : tiles.stroke,
      opacity: isSelected ? 1 : 0.7,
      fillOpacity: isSelected ? 0.7 : 0.4,
    };
  };

  const onEachWard = (feature: Feature, layer: L.Layer) => {
    const wardNo = Number(feature.properties?.ward_no ?? feature.properties?.ward_number);
    const zone = feature.properties?.zone ?? "";
    if (!isNaN(wardNo)) {
      layer.bindTooltip(`<strong>Ward ${wardNo}</strong><br/><span style="font-size:11px;color:#64748b">${zone}</span>`, {
        sticky: true,
      });
      layer.on({
        click: () => onSelectWard(wardNo),
        mouseover: (e) => {
          (e.target as L.Path).setStyle({ weight: 2.5, fillOpacity: 0.6 });
        },
        mouseout: (e) => {
          const isSel = wardNo === selectedWard;
          (e.target as L.Path).setStyle({
            weight: isSel ? 3 : 1,
            fillOpacity: isSel ? 0.7 : 0.4,
          });
        },
      });
    }
  };

  return (
    <MapContainer center={mapCenter} zoom={mapZoom} className="h-full w-full" scrollWheelZoom={true}>
      <MapResizer />
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      <FitToBounds bounds={geoJsonBounds(wards)} resetKey={`my-ward:${cityId}`} maxZoom={12} />
      {wards && (
        <GeoJSON
          key={`wards-${selectedWard ?? "none"}`}
          data={wards}
          style={wardStyle}
          onEachFeature={onEachWard}
        />
      )}
    </MapContainer>
  );
}
