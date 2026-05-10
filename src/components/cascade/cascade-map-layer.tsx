"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import {
  CircleSymbolizer,
  LineSymbolizer,
  leafletLayer,
} from "protomaps-leaflet";
import L from "leaflet";

interface CascadeMapLayerProps {
  cityId: string;
}

const NODE_COLOR_BY_POSITION = ["#0ea5e9", "#06b6d4", "#14b8a6", "#10b981"];
const EDGE_COLOR = "#0ea5e9";
// River-outlet arrows use a distinct amber so users can tell at a
// glance which lines are tank-to-tank cascade edges and which are
// "this tank drains into the river" terminations.
const RIVER_OUTLET_COLOR = "#f59e0b";

// Hover hit-test thresholds, in METRES on the ground (not screen
// pixels). Each tank's hit area is the larger of:
//   - MIN_NODE_HIT_RADIUS_M (so small tanks are still grabbable when
//     the cursor is anywhere near their centroid even when zoomed in)
//   - the tank's area-equivalent radius (sqrt(area_ha * 10000 / pi))
//     plus EXTRA_HIT_PADDING_M (so hovering near the visible polygon
//     edge of a large tank like Vandiyur Lake still triggers the
//     tooltip - earlier the fixed 14-pixel-around-centroid threshold
//     missed the edges of any polygon larger than a small pond).
//
// Working in metres rather than pixels means hit areas scale naturally
// with tank size and don't depend on the current zoom level math.
const MIN_NODE_HIT_RADIUS_M = 60;
const EXTRA_HIT_PADDING_M = 30;

interface NodeIndexEntry {
  lat: number;
  lng: number;
  name: string;
  cascadePosition: number;
  degreeIn: number;
  degreeOut: number;
  areaHa: number;
  drainsToRiver: boolean;
  riverOutletDistanceKm: number | null;
}

interface NodesGeoJsonFeature {
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    name?: string;
    cascade_position?: number;
    degree_in?: number;
    degree_out?: number;
    area_ha?: number;
    drains_to_river?: boolean;
    river_outlet_distance_km?: number | null;
  };
}

interface NodesGeoJson {
  type: "FeatureCollection";
  features: NodesGeoJsonFeature[];
}

/**
 * Mounts the cascade reconstruction overlay onto the parent Leaflet
 * map. Two responsibilities:
 *
 *   1. Render the predicted-channel edges + tank nodes from
 *      protomaps-leaflet vector tiles (PMTiles, byte-range fetched).
 *      This is the visual layer.
 *
 *   2. Provide a hover tooltip with per-node info. We intentionally
 *      do NOT use protomaps-leaflet's queryTileFeaturesDebug for this
 *      because (a) it had a `this`-binding gotcha that we hit, and
 *      (b) the existing GeoJSON polygon layer in unified-map.tsx
 *      captures pointer events when the cursor is over a polygon, so
 *      Leaflet-level mousemove handlers stay silent there.
 *
 *      Instead we listen to native DOM mousemove on the map container
 *      (always fires regardless of which Leaflet layer is on top) and
 *      do a brute-force nearest-neighbour query against a small
 *      in-memory index built from the nodes GeoJSON. ~500 nodes, kept
 *      to a single project-and-distance loop per RAF tick - microseconds.
 *
 * Performance contract:
 *   - Component is dynamic-imported by the toggle in
 *     water-bodies-map-client.tsx; bundle weight only paid when user
 *     opts in.
 *   - Tile rendering uses PMTiles byte-range fetches.
 *   - The hover-index GeoJSON is ~150 KB transferred once per session
 *     (lazy, only when cascade is enabled). Acceptable at v0; can be
 *     swapped for a precomputed minified hover-index JSON later if the
 *     budget tightens.
 *   - Hover hit-test runs on RAF ticks, capped at one query per frame.
 */
export default function CascadeMapLayer({ cityId }: CascadeMapLayerProps) {
  const map = useMap();
  const nodeIndexRef = useRef<NodeIndexEntry[]>([]);

  useEffect(() => {
    // ---- Visual layer (protomaps-leaflet PMTiles) ----
    const edgesLayer = leafletLayer({
      url: `/tiles/cascade/${cityId}-cascade-edges.pmtiles`,
      paintRules: [
        {
          dataLayer: "cascade_edges",
          symbolizer: new LineSymbolizer({
            color: EDGE_COLOR,
            width: (z: number) => Math.max(1, (z - 9) * 0.6),
            opacity: 0.7,
          }),
        },
      ],
    }) as unknown as L.Layer;

    const nodesLayer = leafletLayer({
      url: `/tiles/cascade/${cityId}-cascade-nodes.pmtiles`,
      paintRules: [
        {
          dataLayer: "cascade_nodes",
          symbolizer: new CircleSymbolizer({
            radius: (z: number, f) => {
              const pos = (f?.props.cascade_position as number) ?? 1;
              const base = Math.max(2, (z - 9) * 1.2);
              return base + Math.min(6, pos * 0.5);
            },
            fill: (_z: number, f) => {
              const pos = (f?.props.cascade_position as number) ?? 1;
              const idx = Math.min(
                NODE_COLOR_BY_POSITION.length - 1,
                Math.floor(pos / 3),
              );
              return NODE_COLOR_BY_POSITION[idx];
            },
            stroke: "#ffffff",
            width: 1,
            opacity: 0.95,
          }),
        },
      ],
    }) as unknown as L.Layer;

    // River-outlet arrows: tanks that drain INTO the river (sink edges).
    // Distinct amber colour so users can tell these apart from the
    // sky-blue tank-to-tank edges. Slightly wider so the secondary
    // semantic ("this is where the cascade actually terminates") reads
    // at district-overview zooms.
    const riverOutletsLayer = leafletLayer({
      url: `/tiles/cascade/${cityId}-cascade-river-outlets.pmtiles`,
      paintRules: [
        {
          dataLayer: "cascade_river_outlets",
          symbolizer: new LineSymbolizer({
            color: RIVER_OUTLET_COLOR,
            width: (z: number) => Math.max(1.2, (z - 9) * 0.8),
            opacity: 0.85,
          }),
        },
      ],
    }) as unknown as L.Layer;

    edgesLayer.addTo(map);
    riverOutletsLayer.addTo(map);
    nodesLayer.addTo(map);

    // ---- Hover index (lazy GeoJSON fetch) ----
    let cancelled = false;
    fetch(`/data/cascade/${cityId}-cascade-nodes.geojson`)
      .then((r) => r.json() as Promise<NodesGeoJson>)
      .then((payload) => {
        if (cancelled) return;
        nodeIndexRef.current = payload.features.map((f) => ({
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          name: f.properties.name ?? "",
          cascadePosition: f.properties.cascade_position ?? 1,
          degreeIn: f.properties.degree_in ?? 0,
          degreeOut: f.properties.degree_out ?? 0,
          areaHa: f.properties.area_ha ?? 0,
          drainsToRiver: f.properties.drains_to_river ?? false,
          riverOutletDistanceKm: f.properties.river_outlet_distance_km ?? null,
        }));
      })
      .catch(() => {
        // Tooltips degrade gracefully: visual layer still renders.
      });

    // ---- Hover tooltip ----
    const isTouchOnly =
      typeof window !== "undefined" &&
      window.matchMedia?.("(hover: none)").matches;
    let cleanupHover: (() => void) | undefined;

    if (!isTouchOnly) {
      const tooltip = L.tooltip({
        // Anchor below cursor so this doesn't fight the polygon-bound
        // tooltips Leaflet renders above the cursor over water bodies.
        // The `cascade-tooltip` class lets us colour it distinctly so
        // users can tell which layer the info is from.
        direction: "bottom",
        offset: [0, 14],
        opacity: 0.97,
        sticky: true,
        className: "cascade-tooltip",
      });
      let tooltipOpen = false;
      let pendingFrame: number | null = null;

      const formatNodeTooltip = (entry: NodeIndexEntry): string => {
        const name = entry.name || "(unnamed tank)";
        const sinkLine =
          entry.drainsToRiver && entry.riverOutletDistanceKm !== null
            ? `<br/><span style="font-size:11px;color:#b45309">` +
              `drains to river (${entry.riverOutletDistanceKm.toFixed(2)} km)</span>`
            : "";
        return (
          `<strong>${name}</strong>` +
          `<br/><span style="font-size:11px;color:#475569">` +
          `cascade depth ${entry.cascadePosition} · ` +
          `${entry.degreeIn} in · ${entry.degreeOut} out · ` +
          `${entry.areaHa.toLocaleString()} ha</span>` +
          sinkLine
        );
      };

      // DOM-level mousemove fires regardless of which Leaflet vector
      // layer is on top (polygons can capture Leaflet's own
      // `mousemove` event but not the native DOM one on the container).
      const container = map.getContainer();

      const runHitTest = (clientX: number, clientY: number) => {
        const nodes = nodeIndexRef.current;
        if (nodes.length === 0) return;
        const rect = container.getBoundingClientRect();
        const cursorPoint = L.point(clientX - rect.left, clientY - rect.top);
        const cursorLatLng = map.containerPointToLatLng(cursorPoint);

        // Pick the tank whose hit radius the cursor is inside, with the
        // smallest cursor-to-centroid distance breaking ties (so when
        // hit areas overlap, the tank you're nearer to wins). Working
        // in metres lets the hit area scale with the polygon size:
        // hovering anywhere within Vandiyur Lake's footprint (~850 m
        // from centroid) triggers it; small tanks still fall back to
        // the 60 m floor.
        let bestEntry: NodeIndexEntry | null = null;
        let bestDistM = Number.POSITIVE_INFINITY;
        for (const entry of nodes) {
          const distM = cursorLatLng.distanceTo([entry.lat, entry.lng]);
          const tankRadiusM =
            entry.areaHa > 0
              ? Math.sqrt((entry.areaHa * 10000) / Math.PI)
              : 0;
          const hitRadiusM = Math.max(
            MIN_NODE_HIT_RADIUS_M,
            tankRadiusM + EXTRA_HIT_PADDING_M,
          );
          if (distM < hitRadiusM && distM < bestDistM) {
            bestDistM = distM;
            bestEntry = entry;
          }
        }

        if (bestEntry) {
          tooltip
            .setLatLng([bestEntry.lat, bestEntry.lng])
            .setContent(formatNodeTooltip(bestEntry));
          if (!tooltipOpen) {
            tooltip.addTo(map);
            tooltipOpen = true;
          }
        } else if (tooltipOpen) {
          tooltip.remove();
          tooltipOpen = false;
        }
      };

      const handleDomMouseMove = (ev: MouseEvent) => {
        if (pendingFrame !== null) return;
        const { clientX, clientY } = ev;
        pendingFrame = window.requestAnimationFrame(() => {
          pendingFrame = null;
          runHitTest(clientX, clientY);
        });
      };

      const handleDomMouseLeave = () => {
        if (tooltipOpen) {
          tooltip.remove();
          tooltipOpen = false;
        }
      };

      container.addEventListener("mousemove", handleDomMouseMove, {
        passive: true,
      });
      container.addEventListener("mouseleave", handleDomMouseLeave);

      cleanupHover = () => {
        if (pendingFrame !== null) window.cancelAnimationFrame(pendingFrame);
        container.removeEventListener("mousemove", handleDomMouseMove);
        container.removeEventListener("mouseleave", handleDomMouseLeave);
        if (tooltipOpen) tooltip.remove();
      };
    }

    return () => {
      cancelled = true;
      cleanupHover?.();
      map.removeLayer(edgesLayer);
      map.removeLayer(nodesLayer);
      map.removeLayer(riverOutletsLayer);
      nodeIndexRef.current = [];
    };
  }, [map, cityId]);

  return null;
}
