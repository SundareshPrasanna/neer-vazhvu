"use client";

import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useMapTiles } from "@/lib/utils/map-tiles";

const pin = L.divIcon({
  className: "",
  html: '<div style="width:22px;height:22px;border-radius:9999px;background:#0e7490;border:3px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.45)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const INDIA: [number, number] = [22.5, 79];

/** A tap moves the pin; the first tap on the country view also zooms to street level. */
function TapToPlace({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    click: (e) => {
      onChange(e.latlng.lat, e.latlng.lng);
      if (map.getZoom() < 14) map.setView(e.latlng, 16);
    },
  });
  return null;
}

/** Draggable pin seeded by the photo or GPS; with neither, a country view to tap. Leaflet needs window, so import with ssr:false. */
export default function LocationMap({ lat, lng, onChange }: { lat: number | null; lng: number | null; onChange: (lat: number, lng: number) => void }) {
  // The site's own tiles: theme-aware, and allowed by the CSP's img-src.
  const tiles = useMapTiles();
  const placed = lat != null && lng != null;
  return (
    <MapContainer center={placed ? [lat, lng] : INDIA} zoom={placed ? 17 : 5} scrollWheelZoom={false} className="h-full w-full">
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      {placed && (
        <Marker
          position={[lat, lng]}
          draggable
          icon={pin}
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              onChange(ll.lat, ll.lng);
            },
          }}
        />
      )}
      <TapToPlace onChange={onChange} />
    </MapContainer>
  );
}
