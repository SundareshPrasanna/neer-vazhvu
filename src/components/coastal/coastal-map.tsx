"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection, LineString, Point } from "geojson";
import { MapResizer } from "@/components/map-resizer";
import { FitToBounds, geoJsonBounds } from "@/components/map/fit-to-bounds";
import { useMapTiles } from "@/lib/utils/map-tiles";
import {
  TREND_COLORS,
  hotspotColor,
  rateColor,
  type CoastalZoneProperties,
  type CoastalHotspotProperties,
  type CoastalTransectProperties,
  type CoastalViewMode,
  type CoastalSummary,
  type SelectedCoastal,
} from "@/types/coastal";
import "leaflet/dist/leaflet.css";

interface CoastalMapProps {
  mode: CoastalViewMode;
  selected: SelectedCoastal | null;
  onSelect: (sel: SelectedCoastal | null) => void;
  onSummary?: (s: CoastalSummary) => void;
  mapCenter?: [number, number];
  mapZoom?: number;
}

const ZONES_URL = "/geojson/chennai-coastal-zones.geojson";
const HOTSPOTS_URL = "/geojson/chennai-coastal-hotspots.geojson";
const TRANSECTS_URL = "/geojson/chennai-coastal-transects.geojson";

function toLatLng(coords: number[][]): [number, number][] {
  return coords.map((c) => [c[1], c[0]]);
}

export function CoastalMap({
  mode,
  selected,
  onSelect,
  onSummary,
  mapCenter = [13.18, 80.32],
  mapZoom = 10,
}: CoastalMapProps) {
  const tiles = useMapTiles();
  const [zones, setZones] = useState<FeatureCollection | null>(null);
  const [hotspots, setHotspots] = useState<FeatureCollection | null>(null);
  const [transects, setTransects] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(ZONES_URL).then((r) => (r.ok ? r.json() : null)),
      fetch(HOTSPOTS_URL).then((r) => (r.ok ? r.json() : null)),
      fetch(TRANSECTS_URL).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([z, h, t]: [FeatureCollection | null, FeatureCollection | null, FeatureCollection | null]) => {
        setZones(z);
        setHotspots(h);
        setTransects(t);
        if (t && onSummary) {
          const props = t.features.map((f) => f.properties as unknown as CoastalTransectProperties);
          const eroding = props.filter((p) => p.trend === "erosion");
          const withSplit = eroding.filter((p) => p.early_rate_m_yr != null && p.recent_rate_m_yr != null);
          const accel = withSplit.filter((p) => (p.recent_rate_m_yr as number) - (p.early_rate_m_yr as number) < -1);
          onSummary({
            total: props.length,
            eroding: eroding.length,
            erodingWithSplit: withSplit.length,
            acceleratingErosion: accel.length,
            period: props[0]?.period ?? "1990-2026",
          });
        }
      })
      .catch(console.error);
  // onSummary is a stable setter from the parent; exclude to fetch once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!zones) {
    return (
      <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <span className="text-slate-500 dark:text-slate-400">Loading map…</span>
      </div>
    );
  }

  const selectedZoneId =
    selected?.kind === "zone" ? selected.props.zone_id : undefined;
  const selectedHotspotName =
    selected?.kind === "hotspot" ? selected.props.name : undefined;

  return (
    <MapContainer center={mapCenter} zoom={mapZoom} className="h-full w-full" scrollWheelZoom>
      <MapResizer />
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      <FitToBounds bounds={geoJsonBounds(zones)} resetKey="coastal-zones" maxZoom={11} />

      {/* Zone segments. Interactive + trend-coloured in "zones" mode; thin
          neutral context lines under the transect dots in "transects" mode. */}
      {zones.features.map((f) => {
        const props = f.properties as unknown as CoastalZoneProperties;
        const positions = toLatLng((f.geometry as LineString).coordinates);
        const isSel = props.zone_id === selectedZoneId;
        if (mode === "transects") {
          return (
            <Polyline
              key={`zonectx-${props.zone_id}`}
              positions={positions}
              pathOptions={{ color: tiles.isDark ? "#475569" : "#cbd5e1", weight: 2, opacity: 0.6 }}
              interactive={false}
            />
          );
        }
        const color = TREND_COLORS[props.dominant_trend];
        return (
          <Polyline
            key={`zone-${props.zone_id}`}
            positions={positions}
            pathOptions={{
              color,
              weight: isSel ? 9 : 6,
              opacity: isSel ? 1 : 0.8,
            }}
            eventHandlers={{
              click: () => onSelect({ kind: "zone", props }),
              mouseover: (e) => (e.target as L.Polyline).setStyle({ weight: 9, opacity: 1 }),
              mouseout: (e) =>
                (e.target as L.Polyline).setStyle({ weight: isSel ? 9 : 6, opacity: isSel ? 1 : 0.8 }),
            }}
          >
            <Tooltip sticky>
              <strong>Zone {props.zone_id}</strong> · {props.zone_name}
              <br />
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                {props.dominant_trend} · mean erosion {props.mean_erosion_m_yr} m/yr
              </span>
            </Tooltip>
          </Polyline>
        );
      })}

      {/* Computed transects (our own MNDWI/GEE measurement), coloured by rate */}
      {mode === "transects" &&
        transects?.features.map((f) => {
          const props = f.properties as unknown as CoastalTransectProperties;
          const [lng, lat] = (f.geometry as Point).coordinates;
          const isSel =
            selected?.kind === "transect" && selected.props.transect_id === props.transect_id;
          return (
            <CircleMarker
              key={`t-${props.transect_id}`}
              center={[lat, lng]}
              radius={isSel ? 7 : 4}
              pathOptions={{
                fillColor: rateColor(props.rate_m_yr),
                color: tiles.isDark ? "#0f172a" : "#ffffff",
                weight: isSel ? 2 : 0.8,
                fillOpacity: 0.9,
                opacity: 1,
              }}
              eventHandlers={{
                click: () => onSelect({ kind: "transect", props }),
                mouseover: (e) => (e.target as L.CircleMarker).setStyle({ radius: 7 }),
                mouseout: (e) => (e.target as L.CircleMarker).setStyle({ radius: isSel ? 7 : 4 }),
              }}
            >
              <Tooltip sticky>
                <strong>Transect {props.transect_id}</strong> · Zone {props.zone_id}
                <br />
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  {props.rate_m_yr > 0 ? "+" : ""}
                  {props.rate_m_yr} m/yr · {props.trend}
                </span>
              </Tooltip>
            </CircleMarker>
          );
        })}

      {/* Named hotspots (zones mode only), sized by magnitude, coloured by sign */}
      {mode === "zones" &&
        hotspots?.features.map((f) => {
        const props = f.properties as unknown as CoastalHotspotProperties;
        const [lng, lat] = (f.geometry as Point).coordinates;
        const isSel = props.name === selectedHotspotName;
        const mag = Math.abs(props.rate_m_yr);
        const radius = mag >= 30 ? 12 : mag >= 15 ? 10 : 7;
        const color = hotspotColor(props.rate_m_yr);
        return (
          <CircleMarker
            key={`hotspot-${props.name}`}
            center={[lat, lng]}
            radius={isSel ? radius + 3 : radius}
            pathOptions={{
              fillColor: color,
              color: tiles.isDark ? "#0f172a" : "#ffffff",
              weight: 2,
              fillOpacity: 0.9,
              opacity: 1,
            }}
            eventHandlers={{
              click: () => onSelect({ kind: "hotspot", props }),
              mouseover: (e) => (e.target as L.CircleMarker).setStyle({ radius: radius + 3 }),
              mouseout: (e) => (e.target as L.CircleMarker).setStyle({ radius: isSel ? radius + 3 : radius }),
            }}
          >
            <Tooltip sticky>
              <strong>{props.name}</strong>
              <br />
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                {props.rate_m_yr > 0 ? "+" : ""}
                {props.rate_m_yr} m/yr · {props.trend}
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
