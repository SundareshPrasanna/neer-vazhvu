"use client";

import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pin = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:9999px;background:#0e7490;border:3px solid #fff;box-shadow:0 0 0 1px #0e7490"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/** Draggable pin seeded by GPS; Leaflet needs window, so import with ssr:false. */
export default function LocationMap({ lat, lng, onChange }: { lat: number; lng: number; onChange: (lat: number, lng: number) => void }) {
  return (
    <MapContainer center={[lat, lng]} zoom={17} scrollWheelZoom={false} className="h-56 w-full rounded-lg">
      <TileLayer attribution="&copy; OpenStreetMap" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
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
    </MapContainer>
  );
}
