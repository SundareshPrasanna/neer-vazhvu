"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection, LineString, Point } from "geojson";
import { MapResizer } from "@/components/map-resizer";
import { FitToBounds, geoJsonBounds } from "@/components/map/fit-to-bounds";
import { useMapTiles } from "@/lib/utils/map-tiles";
import {
  hotspotColor,
  rateColor,
  type CoastalZoneProperties,
  type CoastalHotspotProperties,
  type CoastalTransectProperties,
  type CoastalSummary,
  type SelectedCoastal,
} from "@/types/coastal";
import "leaflet/dist/leaflet.css";

interface CoastalMapProps {
  selected: SelectedCoastal | null;
  onSelect: (sel: SelectedCoastal | null) => void;
  onSummary?: (s: CoastalSummary) => void;
  /** Increment to zoom the map to the showcase ("Highest erosion") transect. */
  flyToFeaturedSignal?: number;
  mapCenter?: [number, number];
  mapZoom?: number;
}

// Bump ?v when a file is regenerated so browsers don't serve a stale copy.
const ZONES_URL = "/geojson/chennai-coastal-zones.geojson?v=2";
const HOTSPOTS_URL = "/geojson/chennai-coastal-hotspots.geojson?v=1";
const TRANSECTS_URL = "/geojson/chennai-coastal-transects.geojson?v=4";

function toLatLng(coords: number[][]): [number, number][] {
  return coords.map((c) => [c[1], c[0]]);
}

/** Pans/zooms to a transect when the user clicks one (not on load). Uses
 *  setView (the integer-snap zoom animation), not flyTo - flyTo scales the map
 *  through fractional zoom levels, which makes the tile-grid seams flash as
 *  horizontal/vertical lines during the animation. */
function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView(target, Math.max(map.getZoom(), 13), { animate: true });
  }, [target, map]);
  return null;
}

/** Zooms to `target` whenever `signal` increments - lets a parent (e.g. the
 *  summary's "zoom to worst spot" button) trigger a fly without a map click. */
function FlyOnSignal({ signal, target }: { signal: number; target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (signal > 0 && target) map.setView(target, Math.max(map.getZoom(), 13), { animate: true });
    // Fire only when the signal changes, not on target/map identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);
  return null;
}

/**
 * Single shoreline-change view. The rate-coloured transects (our own
 * measurement) are the primary layer; the study's six zones are drawn as faint
 * neutral context bands, and its named hotspots are labelled annotations that
 * validate the same map. No mode toggle - the study corroborates, it isn't a
 * separate destination.
 */
export function CoastalMap({
  selected,
  onSelect,
  onSummary,
  mapCenter = [13.15, 80.32],
  mapZoom = 11,
  flyToFeaturedSignal = 0,
}: CoastalMapProps) {
  const tiles = useMapTiles();
  const [zones, setZones] = useState<FeatureCollection | null>(null);
  const [hotspots, setHotspots] = useState<FeatureCollection | null>(null);
  const [transects, setTransects] = useState<FeatureCollection | null>(null);
  // featuredLatLng = the showcase (highest credible erosion), persistently
  // marked. flyTarget = wherever the user last clicked, to zoom in (not on load).
  const [featuredLatLng, setFeaturedLatLng] = useState<[number, number] | null>(null);
  const [featuredProps, setFeaturedProps] = useState<CoastalTransectProperties | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

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
        if (t) {
          // Stats + the pre-selected example are computed over high-confidence
          // transects only, so noisy creek-mouth/lagoon artifacts never lead.
          const all = t.features.map((f) => f.properties as unknown as CoastalTransectProperties);
          const hi = all.filter((p) => p.confidence === "high");
          const eroding = hi.filter((p) => p.trend === "erosion");
          const accreting = hi.filter((p) => p.trend === "accretion");
          const stable = hi.filter((p) => p.trend === "stable");
          const withSplit = eroding.filter((p) => p.early_rate_m_yr != null && p.recent_rate_m_yr != null);
          const accel = withSplit.filter((p) => (p.recent_rate_m_yr as number) - (p.early_rate_m_yr as number) < -1);
          const featured =
            all.find((p) => p.showcase) ??
            (hi.length ? hi.reduce((m, p) => (p.rate_m_yr < m.rate_m_yr ? p : m)) : null);
          if (featured) {
            const f = t.features.find(
              (ft) => (ft.properties as unknown as CoastalTransectProperties).transect_id === featured.transect_id,
            );
            if (f) {
              const [lng, lat] = (f.geometry as Point).coordinates;
              setFeaturedLatLng([lat, lng]);
              setFeaturedProps(featured);
            }
          }
          onSummary?.({
            total: all.length,
            highConf: hi.length,
            eroding: eroding.length,
            accreting: accreting.length,
            stable: stable.length,
            erodingWithSplit: withSplit.length,
            acceleratingErosion: accel.length,
            period: all[0]?.period ?? "1990-2026",
            featured,
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

  const selectedZoneId = selected?.kind === "zone" ? selected.props.zone_id : undefined;
  const selectedHotspotName = selected?.kind === "hotspot" ? selected.props.name : undefined;
  const selectedTransectId = selected?.kind === "transect" ? selected.props.transect_id : undefined;

  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      className="h-full w-full"
      scrollWheelZoom
      preferCanvas
    >
      <MapResizer />
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      {/* Default load frames the entire coastline; clicks zoom in via FlyTo. */}
      <FitToBounds bounds={geoJsonBounds(zones)} resetKey="coastal-full" maxZoom={12} />
      <FlyTo target={flyTarget} />
      <FlyOnSignal signal={flyToFeaturedSignal} target={featuredLatLng} />

      {/* Study zones: faint neutral context bands, clickable for the study's
          per-zone figures. Highlighted when selected. */}
      {zones.features.map((f) => {
        const props = f.properties as unknown as CoastalZoneProperties;
        const positions = toLatLng((f.geometry as LineString).coordinates);
        const isSel = props.zone_id === selectedZoneId;
        return (
          <Polyline
            key={`zone-${props.zone_id}`}
            positions={positions}
            pathOptions={{
              color: isSel ? "#0ea5e9" : tiles.isDark ? "#475569" : "#cbd5e1",
              weight: isSel ? 7 : 3,
              opacity: isSel ? 0.9 : 0.55,
            }}
            eventHandlers={{
              click: () => onSelect({ kind: "zone", props }),
              mouseover: (e) => (e.target as L.Polyline).setStyle({ weight: 6, opacity: 0.85 }),
              mouseout: (e) =>
                (e.target as L.Polyline).setStyle({ weight: isSel ? 7 : 3, opacity: isSel ? 0.9 : 0.55 }),
            }}
          >
            <Tooltip sticky>
              <strong>Zone {props.zone_id}</strong> - {props.zone_name}
              <br />
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                {props.mean_erosion_m_yr != null
                  ? `study: ${props.dominant_trend} - mean erosion ${props.mean_erosion_m_yr} m/yr`
                  : "beyond the study - our measurement only"}
              </span>
            </Tooltip>
          </Polyline>
        );
      })}

      {/* Primary layer: our transect measurements, coloured by rate. Low-
          confidence transects (ambiguous shoreline near inlets/lagoon) are
          dimmed + smaller so they don't mislead, but stay clickable. */}
      {transects?.features.map((f) => {
        const props = f.properties as unknown as CoastalTransectProperties;
        const [lng, lat] = (f.geometry as Point).coordinates;
        const isSel = props.transect_id === selectedTransectId;
        const lowConf = props.confidence === "low";
        const baseR = lowConf ? 2.5 : 4;
        return (
          <CircleMarker
            key={`t-${props.transect_id}`}
            center={[lat, lng]}
            radius={isSel ? 7 : baseR}
            pathOptions={{
              fillColor: rateColor(props.rate_m_yr),
              color: tiles.isDark ? "#0f172a" : "#ffffff",
              weight: isSel ? 2 : 0.8,
              fillOpacity: lowConf ? 0.3 : 0.9,
              opacity: lowConf ? 0.4 : 1,
            }}
            eventHandlers={{
              click: () => {
                onSelect({ kind: "transect", props });
                setFlyTarget([lat, lng]);
              },
              mouseover: (e) => (e.target as L.CircleMarker).setStyle({ radius: 7 }),
              mouseout: (e) => (e.target as L.CircleMarker).setStyle({ radius: isSel ? 7 : baseR }),
            }}
          >
            <Tooltip sticky>
              <strong>Transect {props.transect_id}</strong> - Zone {props.zone_id}
              <br />
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                {props.rate_m_yr > 0 ? "+" : ""}
                {props.rate_m_yr} m/yr - {props.trend}
                {lowConf ? " - low confidence" : ""}
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}

      {/* Bold highlight ring on the selected transect, so it's findable even at
          full-coast zoom. */}
      {selected?.kind === "transect" &&
        transects?.features
          .filter((f) => (f.properties as unknown as CoastalTransectProperties).transect_id === selectedTransectId)
          .map((f) => {
            const p = f.properties as unknown as CoastalTransectProperties;
            const [lng, lat] = (f.geometry as Point).coordinates;
            return (
              <CircleMarker
                key="sel-ring"
                center={[lat, lng]}
                radius={13}
                interactive={false}
                pathOptions={{ color: rateColor(p.rate_m_yr), weight: 3, fillOpacity: 0, opacity: 1 }}
              />
            );
          })}

      {/* Persistent "Highest erosion" marker on the showcase transect. Clicking
          it selects that transect (and zooms), so it's always re-selectable
          even after clicking away. */}
      {featuredLatLng && featuredProps && (
        <CircleMarker
          center={featuredLatLng}
          radius={9}
          eventHandlers={{
            click: () => {
              onSelect({ kind: "transect", props: featuredProps });
              setFlyTarget(featuredLatLng);
            },
          }}
          pathOptions={{ color: "#7f1d1d", weight: 2.5, fillColor: "#dc2626", fillOpacity: 0.85, opacity: 1 }}
        >
          <Tooltip direction="left" offset={[-8, 0]} permanent>
            <strong style={{ color: "#b91c1c" }}>Highest erosion</strong>
          </Tooltip>
        </CircleMarker>
      )}

      {/* Study hotspots: quiet hollow rings that annotate the map. The study's
          figure is revealed on hover/click, so it validates without shouting
          over our own transect measurement. */}
      {hotspots?.features.map((f) => {
        const props = f.properties as unknown as CoastalHotspotProperties;
        const [lng, lat] = (f.geometry as Point).coordinates;
        const isSel = props.name === selectedHotspotName;
        const color = hotspotColor(props.rate_m_yr);
        return (
          <CircleMarker
            key={`hotspot-${props.name}`}
            center={[lat, lng]}
            radius={isSel ? 9 : 6}
            pathOptions={{
              fillColor: color,
              color,
              weight: 1.5,
              fillOpacity: isSel ? 0.5 : 0.15,
              opacity: 0.8,
            }}
            eventHandlers={{
              click: () => {
                onSelect({ kind: "hotspot", props });
                setFlyTarget([lat, lng]);
              },
              mouseover: (e) => (e.target as L.CircleMarker).setStyle({ fillOpacity: 0.5, radius: 9 }),
              mouseout: (e) =>
                (e.target as L.CircleMarker).setStyle({ fillOpacity: isSel ? 0.5 : 0.15, radius: isSel ? 9 : 6 }),
            }}
          >
            <Tooltip direction="right" offset={[8, 0]}>
              <strong>{props.name}</strong>
              <br />
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                study: {props.rate_m_yr > 0 ? "+" : ""}
                {props.rate_m_yr} m/yr
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
