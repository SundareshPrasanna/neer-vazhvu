"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import { MapResizer } from "@/components/map-resizer";
import L from "leaflet";
import type { Layer, PathOptions } from "leaflet";
import type { Feature, FeatureCollection } from "geojson";
import type { RiverId, RiverQualityData, SelectedRiver } from "@/types/river-quality";
import { QUALITY_COLORS, isRiverId } from "@/types/river-quality";
import type { IndustrialPollutionData, PollutionSource } from "@/types/industrial-pollution";
import { SOURCE_TYPE_COLORS } from "@/types/industrial-pollution";
import { useLanguage } from "@/lib/i18n/context";
import { useMapTiles } from "@/lib/utils/map-tiles";
import "leaflet/dist/leaflet.css";

/** Flies the map to a given center when it changes */
function FlyToCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 14, { duration: 1 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1]]);
  return null;
}

export interface SewageInlet {
  id: string;
  name: string;
  lat: number;
  lng: number;
  flow_cum_day: number;
  waterway: string;
  stretch: string;
}

export interface SewageInletData {
  source: string;
  source_url: string;
  data_year: number;
  note: string;
  total_inlets: number;
  total_flow_cum_day: number;
  inlets: SewageInlet[];
}

interface CombinedRiversMapProps {
  qualityData: RiverQualityData;
  pollutionData: IndustrialPollutionData;
  sewageInletData: SewageInletData | null;
  selectedRiver: SelectedRiver | null;
  onSelectRiver: (sel: SelectedRiver | null) => void;
  onSelectSource: (source: PollutionSource | null) => void;
  focusCenter?: [number, number];
  hiddenCategories?: Set<string>;
}

export function CombinedRiversMap({
  qualityData,
  pollutionData,
  sewageInletData,
  selectedRiver,
  onSelectRiver,
  onSelectSource,
  focusCenter,
  hiddenCategories,
}: CombinedRiversMapProps) {
  const { t, language } = useLanguage();
  const tiles = useMapTiles();
  const [riversGeoJSON, setRiversGeoJSON] = useState<FeatureCollection | null>(null);
  const [zonesGeoJSON, setZonesGeoJSON] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/geojson/chennai-rivers.geojson?v=6").then((r) => r.json()),
      fetch("/geojson/chennai-industrial-zones.geojson").then((r) => r.json()),
    ])
      .then(([rivers, zones]: [FeatureCollection, FeatureCollection]) => {
        setRiversGeoJSON(rivers);
        setZonesGeoJSON(zones);
      })
      .catch(console.error);
  }, []);

  const riverMetaMap = useMemo(
    () => new Map(qualityData.rivers.map((river) => [river.id, river])),
    [qualityData.rivers]
  );

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

  const inletsGeoJSON: FeatureCollection | null = sewageInletData ? {
    type: "FeatureCollection",
    features: sewageInletData.inlets.map((inlet) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [inlet.lng, inlet.lat] },
      properties: { id: inlet.id, name: inlet.name, flow: inlet.flow_cum_day, waterway: inlet.waterway, stretch: inlet.stretch },
    })),
  } : null;

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
    opacity: tiles.url.includes("dark") ? 0.5 : 0.7,
  });

  const onEachZone = (feature: Feature, layer: Layer) => {
    const props = feature.properties as { name?: string };
    layer.bindTooltip(props.name || t("rivers_legend.industrial_zone"), { sticky: true });
  };

  // Extract river polylines from GeoJSON for direct Polyline rendering
  // (react-leaflet's GeoJSON component has rendering issues with long LineStrings)
  const riverPolylines = useMemo(() => {
    if (!riversGeoJSON) return [];
    return riversGeoJSON.features.flatMap((feature) => {
      const props = feature.properties as { river_id: string; name: string; name_ta?: string };
      if (!isRiverId(props.river_id)) return [];
      const river_id: RiverId = props.river_id;
      const status = riverMetaMap.get(river_id)?.overall_status;
      const color = QUALITY_COLORS[status ?? "degraded"];

      let segments: [number, number][][] = [];
      if (feature.geometry.type === "LineString") {
        const coords = (feature.geometry as { coordinates: number[][] }).coordinates;
        const latLngs = coords.map((c) => [c[1], c[0]] as [number, number]);
        // Split long LineStrings into overlapping chunks of ~80 points
        // to work around Leaflet's viewport clipping bug with long paths
        const CHUNK = 80;
        if (latLngs.length > CHUNK) {
          for (let i = 0; i < latLngs.length - 1; i += CHUNK - 1) {
            segments.push(latLngs.slice(i, i + CHUNK));
          }
        } else {
          segments = [latLngs];
        }
      } else if (feature.geometry.type === "MultiLineString") {
        const multiCoords = (feature.geometry as { coordinates: number[][][] }).coordinates;
        segments = multiCoords.map((seg) => seg.map((c) => [c[1], c[0]] as [number, number]));
      }

      return [{ river_id, name: props.name, name_ta: props.name_ta, color, segments }];
    });
  }, [riverMetaMap, riversGeoJSON]);

  // Compute highlighted stretch polyline for the selected station
  const stretchHighlight = useMemo((): [number, number][] | null => {
    if (!selectedRiver?.stationId || !riversGeoJSON) return null;

    const river = riverMetaMap.get(selectedRiver.riverId);
    if (!river || river.stations.length < 2) return null;

    // Find the river's GeoJSON feature
    const feature = riversGeoJSON.features.find(
      (f) => (f.properties as { river_id?: string }).river_id === selectedRiver.riverId
    );
    if (!feature) return null;

    // Extract full polyline as [lat, lng][]
    let coords: [number, number][] = [];
    if (feature.geometry.type === "LineString") {
      coords = ((feature.geometry as { coordinates: number[][] }).coordinates).map(
        (c) => [c[1], c[0]] as [number, number]
      );
    } else if (feature.geometry.type === "MultiLineString") {
      coords = ((feature.geometry as { coordinates: number[][][] }).coordinates)
        .flat()
        .map((c) => [c[1], c[0]] as [number, number]);
    }
    if (coords.length < 2) return null;

    // Find nearest polyline vertex index for a lat/lng
    const findNearest = (lat: number, lng: number): number => {
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < coords.length; i++) {
        const dlat = coords[i][0] - lat;
        const dlng = coords[i][1] - lng;
        const d = dlat * dlat + dlng * dlng;
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    };

    // Project all stations onto the polyline and sort by index
    const projected = river.stations
      .map((s) => ({ id: s.id, idx: findNearest(s.lat, s.lng) }))
      .sort((a, b) => a.idx - b.idx);

    const pos = projected.findIndex((p) => p.id === selectedRiver.stationId);
    if (pos === -1) return null;

    const startIdx = pos === 0 ? 0 : Math.round((projected[pos].idx + projected[pos - 1].idx) / 2);
    const endIdx =
      pos === projected.length - 1
        ? coords.length - 1
        : Math.round((projected[pos].idx + projected[pos + 1].idx) / 2);

    const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    return coords.slice(lo, hi + 1);
  }, [selectedRiver?.stationId, selectedRiver?.riverId, riversGeoJSON, riverMetaMap]);

  // Monitoring station markers
  const stationPointToLayer = (feature: Feature, latlng: L.LatLng) => {
    const props = feature.properties as { overall_status: string };
    const color =
      QUALITY_COLORS[props.overall_status as keyof typeof QUALITY_COLORS] ?? "#94a3b8";
    return L.circleMarker(latlng, {
      radius: 6,
      fillColor: tiles.isDark ? "#1e293b" : "white",
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
        if (!isRiverId(props.river_id)) return;
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
      color: tiles.isDark ? "#0f172a" : "white",
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

  // Sewage inlet markers - small brown diamonds sized by flow volume
  const inletPointToLayer = (feature: Feature, latlng: L.LatLng) => {
    const props = feature.properties as { flow: number };
    const radius = props.flow >= 2000 ? 6 : props.flow >= 1000 ? 5 : 4;
    return L.circleMarker(latlng, {
      radius,
      fillColor: "#92400e",
      color: tiles.isDark ? "#1e293b" : "white",
      weight: 1.5,
      fillOpacity: 0.85,
      opacity: 1,
    });
  };

  const onEachInlet = (feature: Feature, layer: Layer) => {
    const props = feature.properties as { name: string; flow: number; waterway: string };
    layer.bindTooltip(
      `<strong>${props.name}</strong><br/><span style="font-size:11px;color:#92400e">${props.flow.toLocaleString()} m\u00B3/day</span>`,
      { sticky: true }
    );
    layer.on({
      mouseover: (e) => { (e.target as L.CircleMarker).setStyle({ radius: 8 }); },
      mouseout: (e) => {
        const flow = props.flow;
        (e.target as L.CircleMarker).setStyle({ radius: flow >= 2000 ? 6 : flow >= 1000 ? 5 : 4 });
      },
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
      <MapResizer />
      {focusCenter && <FlyToCenter center={focusCenter} />}
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      {/* Render order: zones (bottom) → rivers → stations → sources → highlight (top) */}
      {!(hiddenCategories?.has("industrial_zone")) && (
        <GeoJSON key={`zones-${tiles.url}`} data={zonesGeoJSON} style={zoneStyle} onEachFeature={onEachZone} />
      )}
      {/* Rivers as direct Polylines (GeoJSON component has rendering bugs with long paths) */}
      {riverPolylines.filter((river) => {
        const status = riverMetaMap.get(river.river_id)?.overall_status;
        return !(hiddenCategories?.has(status ?? ""));
      }).map((river) =>
        river.segments.map((positions, segIdx) => {
          const riverLabel = language === "ta" ? (river.name_ta ?? river.name) : river.name;
          const cpcbClass = riverMetaMap.get(river.river_id)?.cpcb_class ?? "";
          return (
            <Polyline
              key={`${river.river_id}-${segIdx}`}
              positions={positions}
              pathOptions={{ color: river.color, weight: 4, opacity: 0.85 }}
              eventHandlers={{
                click: (e) => {
                  onSelectRiver({ riverId: river.river_id, latlng: [e.latlng.lat, e.latlng.lng] });
                },
                mouseover: (e) => {
                  (e.target as L.Polyline).setStyle({ weight: 7, opacity: 1 });
                },
                mouseout: (e) => {
                  (e.target as L.Polyline).setStyle({ weight: 4, opacity: 0.85 });
                },
              }}
            >
              <Tooltip sticky>
                <strong>{riverLabel}</strong>
                <br />
                <span style={{ fontSize: "11px", color: "#64748b" }}>{cpcbClass}</span>
              </Tooltip>
            </Polyline>
          );
        })
      )}
      {!(hiddenCategories?.has("station")) && (
        <GeoJSON key={`stations-${tiles.url}`} data={stationsGeoJSON} pointToLayer={stationPointToLayer} onEachFeature={onEachStation} />
      )}
      {inletsGeoJSON && !(hiddenCategories?.has("sewage_inlet")) && (
        <GeoJSON key={`inlets-${tiles.url}`} data={inletsGeoJSON} pointToLayer={inletPointToLayer} onEachFeature={onEachInlet} />
      )}
      {(() => {
        const filteredSources = {
          ...sourcesGeoJSON,
          features: sourcesGeoJSON.features.filter((f) => {
            const type = (f.properties as { type: string }).type;
            return !(hiddenCategories?.has(`source_${type}`));
          }),
        };
        return filteredSources.features.length > 0 ? (
          <GeoJSON key={`sources-${tiles.url}-${hiddenCategories ? [...hiddenCategories].sort().join(",") : ""}`} data={filteredSources} pointToLayer={sourcePointToLayer} onEachFeature={onEachSource} />
        ) : null;
      })()}

      {/* Selected stretch highlight */}
      {stretchHighlight && selectedRiver && (() => {
        const river = riverMetaMap.get(selectedRiver.riverId);
        const color = QUALITY_COLORS[river?.overall_status ?? "degraded"];
        return (
          <Polyline
            positions={stretchHighlight}
            pathOptions={{ color, weight: 8, opacity: 0.45 }}
            interactive={false}
          />
        );
      })()}

      {/* Selected station highlight ring */}
      {(() => {
        if (!selectedRiver?.stationId) return null;
        const river = riverMetaMap.get(selectedRiver.riverId);
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
