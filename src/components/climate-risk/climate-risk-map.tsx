"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { MapResizer } from "@/components/map-resizer";
import type { Layer } from "leaflet";
import type L from "leaflet";
import type { Feature } from "geojson";
import {
  CLIMATE_RISK_COLORS,
  classForSubtheme,
  type ClimateSubtheme,
  type SubBasinProperties,
} from "@/types/climate-risk";
import { useMapTiles } from "@/lib/utils/map-tiles";
import { FitToBounds, geoJsonBounds } from "@/components/map/fit-to-bounds";
import "leaflet/dist/leaflet.css";

interface ClimateRiskMapProps {
  cityId: string;
  center?: [number, number];
  subtheme: ClimateSubtheme;
  onSelect: (props: SubBasinProperties | null) => void;
  hiddenClasses?: Set<string>;
}

const DEFAULT_CENTER: [number, number] = [13.15, 80.05];
const DEFAULT_ZOOM = 9;

export function ClimateRiskMap({
  cityId,
  center,
  subtheme,
  onSelect,
  hiddenClasses,
}: ClimateRiskMapProps) {
  const tiles = useMapTiles();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    fetch(`/geojson/${cityId}-sub-basins-risk.geojson`)
      .then((r) => r.json())
      .then(setGeo)
      .catch(console.error);
  }, [cityId]);

  const style = useCallback(
    (feature: Feature | undefined) => {
      const props = feature?.properties as SubBasinProperties | undefined;
      const cls = props ? classForSubtheme(props, subtheme) : "very_low";
      const color = CLIMATE_RISK_COLORS[cls];
      const isHidden = hiddenClasses?.has(cls) ?? false;
      return {
        fillColor: color,
        fillOpacity: isHidden ? 0.05 : 0.65,
        color: "#475569",
        weight: 1,
        opacity: isHidden ? 0.2 : 0.8,
      };
    },
    [subtheme, hiddenClasses]
  );

  const onEach = useCallback(
    (feature: Feature, layer: Layer) => {
      const props = feature.properties as SubBasinProperties;
      layer.bindTooltip(props.sub_basin, {
        sticky: true,
        className: "leaflet-tooltip-custom",
      });
      layer.on("click", () => onSelect(props));
    },
    [onSelect]
  );

  // Imperatively restyle on subtheme / legend toggle without remounting.
  useEffect(() => {
    layerRef.current?.setStyle(style as L.StyleFunction);
  }, [style]);

  return (
    <MapContainer
      center={center ?? DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      className="h-full w-full z-0"
      zoomControl={true}
      scrollWheelZoom={true}
    >
      <MapResizer />
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      <FitToBounds bounds={geoJsonBounds(geo)} resetKey={`climate:${geo?.features?.length ?? 0}`} maxZoom={11} />
      {geo && (
        <GeoJSON
          ref={(layer) => { layerRef.current = layer; }}
          key={`sub-basins-${tiles.url}`}
          data={geo}
          style={style}
          onEachFeature={onEach}
        />
      )}
    </MapContainer>
  );
}
