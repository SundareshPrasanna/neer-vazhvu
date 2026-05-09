"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import {
  CircleSymbolizer,
  LineSymbolizer,
  leafletLayer,
} from "protomaps-leaflet";
import type L from "leaflet";

interface CascadeMapLayerProps {
  cityId: string;
}

const NODE_COLOR_BY_POSITION = ["#0ea5e9", "#06b6d4", "#14b8a6", "#10b981"];
const EDGE_COLOR = "#0ea5e9";

/**
 * Mounts the cascade reconstruction PMTiles overlay onto the parent
 * Leaflet map. Edges (predicted channels) and nodes (tanks with their
 * cascade depth + degree) are loaded as separate protomaps-leaflet
 * vector layers.
 *
 * Performance contract:
 *   - This component is dynamic-imported by the toggle in
 *     water-bodies-map-client.tsx, so it does not enter the initial
 *     bundle of /<city>/water-bodies.
 *   - PMTiles use HTTP byte-range requests; the browser only fetches
 *     the tiles in the current viewport at the current zoom, not the
 *     full file.
 *   - Auto-unmount on toggle off cleans up both layers.
 */
export default function CascadeMapLayer({ cityId }: CascadeMapLayerProps) {
  const map = useMap();

  useEffect(() => {
    // Render edges first (under nodes). Width grows with zoom so the
    // cascade structure is legible at district overview AND at street
    // level when investigating a specific tank.
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

    // Render nodes on top, sized by cascade_position (deeper = larger
    // and warmer-coloured to draw the eye to terminal-ish nodes that
    // historically received water from many uppers).
    const nodesLayer = leafletLayer({
      url: `/tiles/cascade/${cityId}-cascade-nodes.pmtiles`,
      paintRules: [
        {
          dataLayer: "cascade_nodes",
          symbolizer: new CircleSymbolizer({
            radius: (z: number, f) => {
              const pos = ((f?.props.cascade_position as number) ?? 1);
              const base = Math.max(2, (z - 9) * 1.2);
              return base + Math.min(6, pos * 0.5);
            },
            fill: (_z: number, f) => {
              const pos = ((f?.props.cascade_position as number) ?? 1);
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

    edgesLayer.addTo(map);
    nodesLayer.addTo(map);

    return () => {
      map.removeLayer(edgesLayer);
      map.removeLayer(nodesLayer);
    };
  }, [map, cityId]);

  return null;
}
