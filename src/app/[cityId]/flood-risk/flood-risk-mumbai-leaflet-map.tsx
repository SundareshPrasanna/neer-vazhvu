"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { FeatureCollection, Feature } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import { useMapTiles } from "@/lib/utils/map-tiles";
import { FitToBounds, pointsBounds } from "@/components/map/fit-to-bounds";

// Mumbai flood-hotspot categories (public/data/mumbai-flood-hotspots.geojson -
// BMC's official Disaster Management flood-spot register).
interface HotspotProps {
  name?: string;
  category: "chronic_spot" | "subway" | "flooding_spot";
  category_label: string;
  ward?: string;
  location?: string;
}

const CATEGORY_FILL: Record<HotspotProps["category"], string> = {
  chronic_spot: "#dc2626", // red-600
  subway: "#2563eb", // blue-600
  flooding_spot: "#ea580c", // orange-600
};

const CATEGORY_RADIUS: Record<HotspotProps["category"], number> = {
  chronic_spot: 6,
  subway: 6,
  flooding_spot: 6,
};

// 26 July 2005 deluge reference points
// (public/geojson/mumbai-flood-2005-hotspots.geojson).
interface Deluge2005Props {
  name?: string;
  depth_label?: string;
  note?: string;
}

interface LayerToggleState {
  showChronic: boolean;
  showSubway: boolean;
  showFlooding: boolean;
  show2005: boolean;
  showDrainage: boolean;
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
  ward: string | null;
  location: string | null;
}

interface DelugeMarker {
  id: string;
  lat: number;
  lng: number;
  name: string | null;
  depth_label: string | null;
  note: string | null;
}

/** Flatten a Point FeatureCollection into a typed marker array (rendering
 *  <CircleMarker> off the FC directly fails to paint; see Bangalore map). */
function flattenPoints<T>(
  fc: FeatureCollection,
  mk: (props: Record<string, unknown>, lat: number, lng: number, i: number) => T | null,
): T[] {
  const out: T[] = [];
  for (let i = 0; i < (fc.features ?? []).length; i++) {
    const f = fc.features[i];
    if (!f?.geometry || f.geometry.type !== "Point") continue;
    const coords = f.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const m = mk((f.properties ?? {}) as Record<string, unknown>, lat, lng, i);
    if (m) out.push(m);
  }
  return out;
}

const DRAINAGE_STYLE: PathOptions = {
  color: "#0284c7", // sky-600
  weight: 1.2,
  opacity: 0.55,
};

function onEachDrain(feature: Feature, layer: Layer) {
  const name = (feature.properties as { name?: string } | null)?.name;
  if (name) layer.bindTooltip(name, { sticky: true });
}

export function FloodMumbaiLeafletMap({ center, zoom, layerState }: MapProps) {
  const tiles = useMapTiles();
  const [hotspots, setHotspots] = useState<HotspotMarker[] | null>(null);
  const [deluge, setDeluge] = useState<DelugeMarker[] | null>(null);
  const [drainage, setDrainage] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    if (hotspots !== null) return;
    fetch("/data/mumbai-flood-hotspots.geojson")
      .then((r) => r.json() as Promise<FeatureCollection>)
      .then((fc) =>
        setHotspots(
          flattenPoints(fc, (p, lat, lng, i) => {
            const props = p as Partial<HotspotProps>;
            if (
              props.category !== "chronic_spot" &&
              props.category !== "subway" &&
              props.category !== "flooding_spot"
            ) {
              return null;
            }
            return {
              id: `${props.category}-${i}`,
              lat,
              lng,
              name: props.name ?? null,
              category: props.category,
              category_label: props.category_label ?? "",
              ward: props.ward ?? null,
              location: props.location ?? null,
            };
          }),
        ),
      )
      .catch(() => setHotspots([]));
  }, [hotspots]);

  useEffect(() => {
    if (!layerState.show2005 || deluge !== null) return;
    fetch("/geojson/mumbai-flood-2005-hotspots.geojson")
      .then((r) => (r.ok ? (r.json() as Promise<FeatureCollection>) : null))
      .then((fc) =>
        setDeluge(
          fc
            ? flattenPoints(fc, (p, lat, lng, i) => {
                const props = p as Partial<Deluge2005Props>;
                return {
                  id: `d05-${i}`,
                  lat,
                  lng,
                  name: props.name ?? null,
                  depth_label: props.depth_label ?? null,
                  note: props.note ?? null,
                };
              })
            : [],
        ),
      )
      .catch(() => setDeluge([]));
  }, [layerState.show2005, deluge]);

  // The drainage layer is ~380 KB, so load it only when first toggled on.
  useEffect(() => {
    if (!layerState.showDrainage || drainage !== null) return;
    fetch("/geojson/mumbai-drainage.geojson")
      .then((r) => (r.ok ? (r.json() as Promise<FeatureCollection>) : null))
      .then((fc) => setDrainage(fc ?? { type: "FeatureCollection", features: [] }))
      .catch(() => setDrainage({ type: "FeatureCollection", features: [] }));
  }, [layerState.showDrainage, drainage]);

  const visibleHotspots = (hotspots ?? []).filter((m) =>
    m.category === "chronic_spot"
      ? layerState.showChronic
      : m.category === "subway"
        ? layerState.showSubway
        : layerState.showFlooding,
  );
  const visibleDeluge = layerState.show2005 ? (deluge ?? []) : [];

  const boundPoints = [
    ...visibleHotspots.map((m) => [m.lat, m.lng] as [number, number]),
    ...visibleDeluge.map((m) => [m.lat, m.lng] as [number, number]),
  ];

  return (
    <MapContainer center={center} zoom={zoom} className="h-full w-full" scrollWheelZoom>
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      <FitToBounds
        bounds={boundPoints.length > 0 ? pointsBounds(boundPoints) : null}
        resetKey={`hot:${visibleHotspots.length}:${visibleDeluge.length}`}
        maxZoom={12}
      />
      {layerState.showDrainage && drainage && (
        <GeoJSON data={drainage} style={DRAINAGE_STYLE} onEachFeature={onEachDrain} />
      )}
      {visibleDeluge.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.lat, m.lng]}
          radius={7}
          pathOptions={{
            color: "#78350f",
            weight: 1,
            fillColor: "#f59e0b", // amber-500
            fillOpacity: 0.8,
          }}
        >
          <Tooltip>
            <strong>{m.name || "(unnamed)"}</strong>
            {m.depth_label && (
              <>
                <br />
                <span style={{ fontSize: "11px" }}>26/7/2005: {m.depth_label}</span>
              </>
            )}
            {m.note && (
              <>
                <br />
                <span style={{ fontSize: "11px", color: "#64748b" }}>{m.note}</span>
              </>
            )}
          </Tooltip>
          {/* Tooltips are hover-only; on phones a tap must open something. */}
          <Popup>
            <strong>{m.name || "(unnamed)"}</strong>
            {m.depth_label && (
              <>
                <br />
                <span style={{ fontSize: "11px" }}>26/7/2005: {m.depth_label}</span>
              </>
            )}
            {m.note && (
              <>
                <br />
                <span style={{ fontSize: "11px", color: "#64748b" }}>{m.note}</span>
              </>
            )}
          </Popup>
        </CircleMarker>
      ))}
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
            {m.ward && <span style={{ fontSize: "11px" }}> · Ward {m.ward}</span>}
            <br />
            <span style={{ fontSize: "11px", color: "#64748b" }}>{m.category_label}</span>
            {m.location && (
              <>
                <br />
                <span style={{ fontSize: "11px", color: "#64748b" }}>{m.location}</span>
              </>
            )}
          </Tooltip>
          <Popup>
            <strong>{m.name || "(unnamed point)"}</strong>
            {m.ward && <span style={{ fontSize: "11px" }}> · Ward {m.ward}</span>}
            <br />
            <span style={{ fontSize: "11px", color: "#64748b" }}>{m.category_label}</span>
            {m.location && (
              <>
                <br />
                <span style={{ fontSize: "11px", color: "#64748b" }}>{m.location}</span>
              </>
            )}
            <br />
            <span style={{ fontSize: "10px", color: "#94a3b8", fontStyle: "italic" }}>
              BMC publishes this spot inventory, not per-spot flood dates - event
              history is a named gap we are pursuing.
            </span>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
