"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, LayersControl } from "react-leaflet";
import L from "leaflet";
import type { Layer } from "leaflet";
import type { Feature } from "geojson";
import type {
  CurrentWaterBodyProperties,
  LostWaterBodyProperties,
  SelectedWaterBody,
} from "@/types/water-bodies";
import { STATUS_COLORS } from "@/types/water-bodies";
import { useLanguage } from "@/lib/i18n/context";
import "leaflet/dist/leaflet.css";

interface WaterBodiesMapProps {
  onSelect: (body: SelectedWaterBody | null) => void;
}

export function WaterBodiesMap({ onSelect }: WaterBodiesMapProps) {
  const { t, language } = useLanguage();
  const [currentGeoJSON, setCurrentGeoJSON] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [lostGeoJSON, setLostGeoJSON] =
    useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/geojson/chennai-water-bodies-current.geojson")
      .then((r) => r.json())
      .then(setCurrentGeoJSON)
      .catch(console.error);

    fetch("/geojson/chennai-water-bodies-lost.geojson")
      .then((r) => r.json())
      .then(setLostGeoJSON)
      .catch(console.error);
  }, []);

  const currentStyle = () => ({
    fillColor: "#3b82f6",
    color: "#1d4ed8",
    weight: 1.5,
    fillOpacity: 0.45,
    opacity: 0.8,
  });

  const lostStyle = (feature: Feature | undefined) => {
    const status = feature?.properties?.status as
      | keyof typeof STATUS_COLORS
      | undefined;
    const color = status ? STATUS_COLORS[status] : "#dc2626";
    return {
      fillColor: color,
      color,
      weight: 2,
      fillOpacity: 0.35,
      opacity: 0.85,
      dashArray: "6, 4",
    };
  };

  const onEachCurrent = (feature: Feature, layer: Layer) => {
    const props = feature.properties as CurrentWaterBodyProperties;
    const name =
      language === "ta"
        ? (props.name_ta?.trim() || `${t("wb_panel.water_body")} #${props.osm_id}`)
        : (props.name || t("wb_panel.unnamed"));
    const areaText = props.area_ha
      ? `${props.area_ha.toLocaleString()} ha`
      : t("wb_panel.unknown");
    const normalizedType = (props.water_type || "water").toLowerCase();
    const typeLabel = t(`wb_type.${normalizedType}`);
    const type = typeLabel.startsWith("wb_type.") ? props.water_type || t("wb_panel.water_body") : typeLabel;

    layer.bindTooltip(
      `<strong>${name}</strong><br/><span style="font-size:11px;color:#64748b">${type} · ${areaText}</span>`,
      { sticky: true }
    );

    layer.on({
      click: (e) => {
        const latlng: [number, number] = [
          e.latlng.lat,
          e.latlng.lng,
        ];
        onSelect({ kind: "current", props, latlng });
      },
      mouseover: (e) => {
        (e.target as L.Path).setStyle({ fillOpacity: 0.7, weight: 2.5 });
      },
      mouseout: (e) => {
        (e.target as L.Path).setStyle({ fillOpacity: 0.45, weight: 1.5 });
      },
    });
  };

  const onEachLost = (feature: Feature, layer: Layer) => {
    const props = feature.properties as LostWaterBodyProperties;
    const name =
      language === "ta"
        ? (props.name_ta?.trim() || t("wb_panel.water_body"))
        : props.name;
    const statusLabel =
      props.status === "fully_lost"
        ? t("wb_panel.fully_lost")
        : props.status === "severely_reduced"
        ? t("wb_panel.severely_reduced")
        : t("wb_panel.partially_encroached");

    layer.bindTooltip(
      `<strong>${name}</strong><br/><span style="font-size:11px;color:#64748b">${statusLabel} · ${t("wb_map.was_area")} ${props.historical_area_ha} ha</span>`,
      { sticky: true }
    );

    layer.on({
      click: (e) => {
        const latlng: [number, number] = [
          e.latlng.lat,
          e.latlng.lng,
        ];
        onSelect({ kind: "lost", props, latlng });
      },
      mouseover: (e) => {
        (e.target as L.Path).setStyle({ fillOpacity: 0.6, weight: 3 });
      },
      mouseout: (e) => {
        (e.target as L.Path).setStyle({ fillOpacity: 0.35, weight: 2 });
      },
    });
  };

  const pointToLayer = (feature: Feature, latlng: L.LatLng) => {
    const props = feature.properties as LostWaterBodyProperties;
    const status = props.status as keyof typeof STATUS_COLORS;
    const color = STATUS_COLORS[status] || "#dc2626";
    return L.circle(latlng, {
      radius: props.approx_radius_m,
      fillColor: color,
      color,
      weight: 2,
      fillOpacity: 0.35,
      opacity: 0.85,
      dashArray: "6, 4",
    });
  };

  if (!currentGeoJSON && !lostGeoJSON) {
    return (
      <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <span className="text-slate-500 dark:text-slate-400">{t("common.loading_map")}</span>
      </div>
    );
  }

  return (
    <MapContainer
      center={[13.0827, 80.2707]}
      zoom={11}
      className="h-full w-full"
      scrollWheelZoom={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <LayersControl position="topright">
        {currentGeoJSON && (
          <LayersControl.Overlay name={t("wb_map.existing_layer")} checked>
            <GeoJSON
              data={currentGeoJSON}
              style={currentStyle}
              onEachFeature={onEachCurrent}
            />
          </LayersControl.Overlay>
        )}
        {lostGeoJSON && (
          <LayersControl.Overlay name={t("wb_map.lost_layer")} checked>
            <GeoJSON
              data={lostGeoJSON}
              pointToLayer={pointToLayer}
              style={lostStyle}
              onEachFeature={onEachLost}
            />
          </LayersControl.Overlay>
        )}
      </LayersControl>
    </MapContainer>
  );
}
