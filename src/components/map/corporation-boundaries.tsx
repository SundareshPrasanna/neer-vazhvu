"use client";

/**
 * Faint, non-interactive admin layer drawing a region's municipal-corporation
 * boundaries (with acronym labels) as map context. For the MMR this is the 9
 * corporations; it makes /<region>/water-bodies (and any other map it's added
 * to) read as a metro rather than a single city.
 *
 * Reusable + additive: renders nothing for places without a corporations
 * GeoJSON (every `city` place), so adding it to a shared map is a no-op for
 * Chennai/Madurai/Bangalore. Non-interactive (pointerEvents: none, interactive:
 * false) so it never steals clicks from the layers beneath it.
 *
 * The boundary outlines are always shown; the acronym labels are zoom-gated
 * (the MMR's corporations cluster tightly, so permanent labels collide at the
 * regional default zoom). Labels appear once zoomed into the metro.
 */

import { useEffect, useState } from "react";
import { GeoJSON, Pane, useMap } from "react-leaflet";
import type { FeatureCollection } from "geojson";
import { useMapTiles } from "@/lib/utils/map-tiles";
import { corporationsGeoJsonPathFor } from "@/lib/cities/wards-vintage";

const LABEL_MIN_ZOOM = 11;

export function CorporationBoundaries({ cityId }: { cityId: string }) {
  const map = useMap();
  const tiles = useMapTiles();
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [showLabels, setShowLabels] = useState(map.getZoom() >= LABEL_MIN_ZOOM);
  const url = corporationsGeoJsonPathFor(cityId);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<FeatureCollection>) : null))
      .then((d) => {
        if (!cancelled) setGeo(d);
      })
      .catch(() => {
        if (!cancelled) setGeo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const onZoom = () => setShowLabels(map.getZoom() >= LABEL_MIN_ZOOM);
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map]);

  if (!geo) return null;

  return (
    <Pane name="corporation-boundaries" style={{ zIndex: 350, pointerEvents: "none" }}>
      <GeoJSON
        // re-key on theme + label visibility so onEachFeature re-binds.
        key={`corp-${tiles.isDark ? "d" : "l"}-${showLabels ? "lbl" : "no"}`}
        data={geo}
        interactive={false}
        style={{
          color: tiles.strokeLight,
          weight: 1.5,
          dashArray: "5 4",
          fill: false,
          opacity: 0.75,
        }}
        onEachFeature={(feature, layer) => {
          if (!showLabels) return;
          const p = feature.properties as { acronym?: string } | null;
          if (p?.acronym) {
            layer.bindTooltip(p.acronym, {
              permanent: true,
              direction: "center",
              className: "corp-boundary-label",
              opacity: 0.9,
            });
          }
        }}
      />
    </Pane>
  );
}
