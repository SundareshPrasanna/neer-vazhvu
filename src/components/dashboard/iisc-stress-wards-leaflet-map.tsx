"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip } from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import "leaflet/dist/leaflet.css";
import type * as L from "leaflet";
import { useMapTiles } from "@/lib/utils/map-tiles";
import { FitToBounds, pointsBounds } from "@/components/map/fit-to-bounds";

interface StressWard {
  bbmp_ward_no: number;
  bbmp_ward_name: string;
  centroid_lat: number;
  centroid_lng: number;
  gba_ward_no: number | null;
  gba_ward_name: string | null;
  gba_corporation: string | null;
}

interface Props {
  wards: StressWard[];
}

interface GbaWardProps {
  ward_no?: number;
  ward_name?: string;
  corporation?: string;
}

const CORP_FILL: Record<string, string> = {
  North:   "#3b82f6",  // blue-500
  South:   "#10b981",  // emerald-500
  East:    "#f59e0b",  // amber-500
  West:    "#f43f5e",  // rose-500
  Central: "#8b5cf6",  // violet-500
};

export function IIScStressWardsLeafletMap({ wards }: Props) {
  const tiles = useMapTiles();
  const [gbaWards, setGbaWards] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/geojson/bangalore-wards-2025.geojson")
      .then((r) => r.json() as Promise<FeatureCollection>)
      .then(setGbaWards)
      .catch(() => setGbaWards({ type: "FeatureCollection", features: [] }));
  }, []);

  // Set: GBA ward_no -> count of IISc stress centroids inside it. Used
  // for the choropleth fill so wards containing one or more BBMP
  // stress-ward centroids read as red, with darker red for wards
  // containing multiple.
  const gbaStressCount: Map<number, number> = new Map();
  for (const w of wards) {
    if (w.gba_ward_no != null) {
      gbaStressCount.set(w.gba_ward_no, (gbaStressCount.get(w.gba_ward_no) ?? 0) + 1);
    }
  }

  return (
    <div className="h-[420px] w-full rounded-md overflow-hidden border border-slate-200 dark:border-slate-700">
      <MapContainer
        center={[12.97, 77.58]}
        zoom={11}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          key={tiles.url}
          url={tiles.url}
          attribution={tiles.attribution}
        />
        <FitToBounds
          bounds={pointsBounds(
            wards.map((w) => [w.centroid_lat, w.centroid_lng] as [number, number]),
          )}
          resetKey="iisc-stress-wards"
          maxZoom={12}
        />
        {gbaWards && (
          <GeoJSON
            key="gba-wards-interactive"
            data={gbaWards}
            style={(feat: Feature | undefined) => {
              const wardNo = (feat?.properties as GbaWardProps | undefined)?.ward_no;
              const stressCount = wardNo != null ? (gbaStressCount.get(wardNo) ?? 0) : 0;
              const fillColor =
                stressCount >= 2 ? "#dc2626" : stressCount === 1 ? "#fca5a5" : "transparent";
              const fillOpacity = stressCount > 0 ? 0.45 : 0;
              return {
                color: tiles.strokeLight,
                weight: 0.6,
                opacity: 0.6,
                fillColor,
                fillOpacity,
              };
            }}
            onEachFeature={(feat: Feature, layer: L.Layer) => {
              const p = feat.properties as GbaWardProps | null;
              if (!p) return;
              const wardNo = p.ward_no;
              const stressCount = wardNo != null ? (gbaStressCount.get(wardNo) ?? 0) : 0;
              const stressLabel =
                stressCount === 0
                  ? "Not on IISc stress list"
                  : stressCount === 1
                    ? "Contains 1 IISc-stressed BBMP ward"
                    : `Contains ${stressCount} IISc-stressed BBMP wards`;
              layer.bindTooltip(
                `<strong>${p.ward_name ?? "Unnamed ward"}</strong>` +
                  `<br/><span style="font-size:11px;color:#64748b">GBA ward ${p.ward_no ?? "?"} · ${p.corporation ?? "?"}</span>` +
                  `<br/><span style="font-size:11px;color:${stressCount > 0 ? "#b91c1c" : "#64748b"}">${stressLabel}</span>`,
                { sticky: true },
              );
            }}
          />
        )}
        {wards.map((w) => {
          const fill = CORP_FILL[w.gba_corporation ?? ""] ?? "#dc2626";
          return (
            <CircleMarker
              key={`${w.bbmp_ward_no}-${w.bbmp_ward_name}`}
              center={[w.centroid_lat, w.centroid_lng]}
              radius={6}
              pathOptions={{
                color: "#0f172a",
                weight: 1,
                fillColor: fill,
                fillOpacity: 0.95,
              }}
              bubblingMouseEvents={false}
            >
              <Tooltip sticky>
                <strong>{w.bbmp_ward_name}</strong>
                <br />
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  BBMP ward {w.bbmp_ward_no}
                  {w.gba_ward_no != null && ` · GBA ward ${w.gba_ward_no}`}
                  {w.gba_corporation && ` · ${w.gba_corporation}`}
                </span>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
