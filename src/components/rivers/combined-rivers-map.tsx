"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker } from "react-leaflet";
import L from "leaflet";
import type { Layer, PathOptions } from "leaflet";
import type { Feature, FeatureCollection } from "geojson";
import type { RiverQualityData, SelectedRiver } from "@/types/river-quality";
import { QUALITY_COLORS } from "@/types/river-quality";
import type { IndustrialPollutionData, PollutionSource } from "@/types/industrial-pollution";
import { SOURCE_TYPE_COLORS } from "@/types/industrial-pollution";
import { useLanguage } from "@/lib/i18n/context";
import { useMapTiles } from "@/lib/utils/map-tiles";
import "leaflet/dist/leaflet.css";

interface CombinedRiversMapProps {
  qualityData: RiverQualityData;
  pollutionData: IndustrialPollutionData;
  selectedRiver: SelectedRiver | null;
  onSelectRiver: (sel: SelectedRiver | null) => void;
  onSelectSource: (source: PollutionSource | null) => void;
}

export function CombinedRiversMap({
  qualityData,
  pollutionData,
  selectedRiver,
  onSelectRiver,
  onSelectSource,
}: CombinedRiversMapProps) {
  const { t, language } = useLanguage();
  const tiles = useMapTiles();
  const [riversGeoJSON, setRiversGeoJSON] = useState<FeatureCollection | null>(null);
  const [zonesGeoJSON, setZonesGeoJSON] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/geojson/chennai-rivers.geojson").then((r) => r.json()),
      fetch("/geojson/chennai-industrial-zones.geojson").then((r) => r.json()),
    ])
      .then(([rivers, zones]: [FeatureCollection, FeatureCollection]) => {
        setRiversGeoJSON(rivers);
        setZonesGeoJSON(zones);
      })
      .catch(console.error);
  }, []);

  const statusMap = new Map(qualityData.rivers.map((r) => [r.id, r.overall_status]));

  const stationsGeoJSON: FeatureCollection = {
    type: "FeatureCollection",
    features: qualityData.rivers.flatMap((river) =>
      river.stations.map((station) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [station.lng, station.lat] },
        properties: {
          river_id: river.id,
          station_id: station.id,
          name: station.name,
          stretch: station.stretch,
          overall_status: river.overall_status,
        },
      }))
    ),
  };

  const sourcesGeoJSON: FeatureCollection = {
    type: "FeatureCollection",
    features: pollutionData.sources.map((source) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [source.lng, source.lat] },
      properties: { id: source.id, name: source.name, name_ta: source.name_ta, type: source.type },
    })),
  };

  const formatStretch = (stretch: string): string => {
    const normalized = stretch.trim().toLowerCase();
    if (normalized === "upper") return t("rivers.upper");
    if (normalized === "middle") return t("rivers.middle");
    if (normalized === "lower") return t("rivers.lower");
    if (normalized === "estuary") return t("rivers.estuary");
    if (normalized === "north chennai") return t("rivers.north_chennai");
    if (normalized === "south chennai") return t("rivers.south_chennai");
    if (normalized === "lower (ennore)" || normalized === "lower ennore") return t("rivers.lower_ennore");
    return stretch;
  };

  // Industrial zone polygons  -  light orange wash, background context
  const zoneStyle = (): PathOptions => ({
    fillColor: "#ea580c",
    fillOpacity: 0.18,
    color: "#ea580c",
    weight: 1.5,
    dashArray: "4, 4",
    opacity: 0.7,
  });

  const onEachZone = (feature: Feature, layer: Layer) => {
    const props = feature.properties as { name?: string };
    layer.bindTooltip(props.name || t("rivers_legend.industrial_zone"), { sticky: true });
  };

  // River polylines  -  quality-coloured, prominent
  const riverStyle = (feature: Feature | undefined): PathOptions => {
    const riverId = feature?.properties?.river_id as string | undefined;
    const status = riverId ? statusMap.get(riverId) : undefined;
    const color = QUALITY_COLORS[status ?? "degraded"];
    return { color, weight: 4, opacity: 0.85 };
  };

  const onEachRiver = (feature: Feature, layer: Layer) => {
    const props = feature.properties as { river_id: string; name: string; name_ta?: string };
    const river = qualityData.rivers.find((r) => r.id === props.river_id);
    const riverLabel = language === "ta" ? (props.name_ta ?? props.name) : props.name;
    layer.bindTooltip(
      `<strong>${riverLabel}</strong><br/><span style="font-size:11px;color:#64748b">${river?.cpcb_class ?? ""}</span>`,
      { sticky: true }
    );
    layer.on({
      click: (e) => {
        onSelectRiver({ riverId: props.river_id, latlng: [e.latlng.lat, e.latlng.lng] });
      },
      mouseover: (e) => {
        (e.target as L.Polyline).setStyle({ weight: 7, opacity: 1 });
      },
      mouseout: (e) => {
        (e.target as L.Polyline).setStyle({ weight: 4, opacity: 0.85 });
      },
    });
  };

  // Monitoring station markers
  const stationPointToLayer = (feature: Feature, latlng: L.LatLng) => {
    const props = feature.properties as { overall_status: string };
    const color =
      QUALITY_COLORS[props.overall_status as keyof typeof QUALITY_COLORS] ?? "#94a3b8";
    return L.circleMarker(latlng, {
      radius: 6,
      fillColor: "white",
      color,
      weight: 2.5,
      fillOpacity: 0.95,
      opacity: 1,
    });
  };

  const onEachStation = (feature: Feature, layer: Layer) => {
    const props = feature.properties as {
      river_id: string;
      station_id: string;
      name: string;
      stretch: string;
    };
    layer.bindTooltip(
      `<strong>${props.name}</strong><br/><span style="font-size:11px;color:#64748b">${formatStretch(props.stretch)}</span>`,
      { sticky: true }
    );
    layer.on({
      click: (e) => {
        onSelectRiver({
          riverId: props.river_id,
          stationId: props.station_id,
          latlng: [e.latlng.lat, e.latlng.lng],
        });
      },
      mouseover: (e) => { (e.target as L.CircleMarker).setStyle({ radius: 9 }); },
      mouseout: (e) => { (e.target as L.CircleMarker).setStyle({ radius: 6 }); },
    });
  };

  // Pollution source markers  -  larger, type-coloured
  const sourcePointToLayer = (feature: Feature, latlng: L.LatLng) => {
    const props = feature.properties as { type: string };
    const color =
      SOURCE_TYPE_COLORS[props.type as keyof typeof SOURCE_TYPE_COLORS] ?? "#64748b";
    return L.circleMarker(latlng, {
      radius: 10,
      fillColor: color,
      color: "white",
      weight: 2,
      fillOpacity: 0.9,
      opacity: 1,
    });
  };

  const onEachSource = (feature: Feature, layer: Layer) => {
    const props = feature.properties as { id: string; name: string; name_ta?: string };
    const sourceLabel = language === "ta" ? (props.name_ta ?? props.name) : props.name;
    layer.bindTooltip(`<strong>${sourceLabel}</strong>`, { sticky: true });
    layer.on({
      click: () => {
        const source = pollutionData.sources.find((s) => s.id === props.id);
        if (source) onSelectSource(source);
      },
      mouseover: (e) => { (e.target as L.CircleMarker).setStyle({ radius: 13 }); },
      mouseout: (e) => { (e.target as L.CircleMarker).setStyle({ radius: 10 }); },
    });
  };

  if (!riversGeoJSON || !zonesGeoJSON) {
    return (
      <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <span className="text-slate-500 dark:text-slate-400">{t("common.loading_map")}</span>
      </div>
    );
  }

  return (
    <MapContainer
      center={[13.05, 80.22]}
      zoom={11}
      className="h-full w-full"
      scrollWheelZoom={true}
    >
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      {/* Render order: zones (bottom) → rivers → stations → sources → highlight (top) */}
      <GeoJSON key="zones" data={zonesGeoJSON} style={zoneStyle} onEachFeature={onEachZone} />
      <GeoJSON key="rivers" data={riversGeoJSON} style={riverStyle} onEachFeature={onEachRiver} />
      <GeoJSON key="stations" data={stationsGeoJSON} pointToLayer={stationPointToLayer} onEachFeature={onEachStation} />
      <GeoJSON key="sources" data={sourcesGeoJSON} pointToLayer={sourcePointToLayer} onEachFeature={onEachSource} />

      {/* Selected station highlight ring */}
      {(() => {
        if (!selectedRiver?.stationId) return null;
        const river = qualityData.rivers.find((r) => r.id === selectedRiver.riverId);
        const station = river?.stations.find((s) => s.id === selectedRiver.stationId);
        if (!station || !river) return null;
        const color = QUALITY_COLORS[river.overall_status];
        return (
          <CircleMarker
            center={[station.lat, station.lng]}
            radius={14}
            pathOptions={{
              fillColor: color,
              color: color,
              weight: 2.5,
              fillOpacity: 0.2,
              opacity: 0.9,
            }}
            interactive={false}
          />
        );
      })()}
    </MapContainer>
  );
}
