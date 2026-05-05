"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { MapResizer } from "@/components/map-resizer";
import L from "leaflet";
import type { Layer, LeafletMouseEvent } from "leaflet";
import type { Feature } from "geojson";
import { getGroundwaterColor, getGroundwaterStatus, getRiskColor, getBlockClassColor } from "@/types/groundwater";
import type { GroundwaterWard, WardRiskData, ViewMode, GWBlock, GWStation, WrisStation } from "@/types/groundwater";
import { useLanguage } from "@/lib/i18n/context";
import { getWardGeoJSON } from "@/lib/data/ward-geo";
import { useMapTiles } from "@/lib/utils/map-tiles";
import { SelectedWardHighlight } from "@/components/map/selected-ward-highlight";
import "leaflet/dist/leaflet.css";

// Chennai-default URLs and map center. Other cities override via props.
const DEFAULT_BLOCK_GEOJSON_URL = "/geojson/chennai-gwr-blocks.geojson";
const DEFAULT_BLOCKS_JSON_URL = "/data/gwr-blocks.json";
const DEFAULT_STATIONS_JSON_URL = "/data/gw-stations.json";
const DEFAULT_WARDS_GEOJSON_URL = "/geojson/chennai-wards-2022.geojson";
const DEFAULT_MAP_CENTER: [number, number] = [13.0827, 80.2707];

/** Flies the map to a given center when it changes */
function FlyToWard({ wardNumber, wardGeoJsonUrl }: { wardNumber: number; wardGeoJsonUrl: string }) {
  const map = useMap();
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  useEffect(() => { getWardGeoJSON(wardGeoJsonUrl).then(setGeo); }, [wardGeoJsonUrl]);
  useEffect(() => {
    if (!geo) return;
    const feature = geo.features.find((f) => {
      const num = Number(f.properties?.ward_number || f.properties?.Ward_No);
      return num === wardNumber;
    });
    if (feature) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const L = require("leaflet");
      const bounds = L.geoJSON(feature).getBounds();
      map.flyToBounds(bounds, { padding: [40, 40], duration: 0.8, maxZoom: 14 });
    }
  }, [wardNumber, geo, map]);
  return null;
}

interface WardMapProps {
  groundwaterData: Map<number, GroundwaterWard>;
  riskData: Map<number, WardRiskData>;
  viewMode: ViewMode;
  selectedWardNumber?: number | null;
  flyToWard?: number | null;
  onWardSelect: (ward: GroundwaterWard | null) => void;
  onBlockSelect?: (block: GWBlock | null) => void;
  onWrisStationSelect?: (station: WrisStation | null) => void;
  wrisStations?: WrisStation[];
  selectedWrisStationCode?: string | null;
  hiddenCategories?: Set<string>;
  // City-aware overrides; default to Chennai's paths for backward compat.
  blockGeoJsonUrl?: string;
  blocksJsonUrl?: string;
  stationsJsonUrl?: string;
  wardGeoJsonUrl?: string;
  mapCenter?: [number, number];
  mapZoom?: number;
}

export function WardMap({
  groundwaterData,
  riskData,
  viewMode,
  selectedWardNumber,
  flyToWard,
  onWardSelect,
  onBlockSelect,
  onWrisStationSelect,
  wrisStations,
  selectedWrisStationCode,
  hiddenCategories,
  blockGeoJsonUrl = DEFAULT_BLOCK_GEOJSON_URL,
  blocksJsonUrl = DEFAULT_BLOCKS_JSON_URL,
  stationsJsonUrl = DEFAULT_STATIONS_JSON_URL,
  wardGeoJsonUrl = DEFAULT_WARDS_GEOJSON_URL,
  mapCenter = DEFAULT_MAP_CENTER,
  mapZoom = 11,
}: WardMapProps) {
  const { t, language } = useLanguage();
  const tiles = useMapTiles();
  const [wardGeoJSON, setWardGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const [blockGeoJSON, setBlockGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const [blocks, setBlocks] = useState<GWBlock[]>([]);
  const [stations, setStations] = useState<GWStation[]>([]);

  useEffect(() => {
    getWardGeoJSON(wardGeoJsonUrl)
      .then(setWardGeoJSON)
      .catch(console.error);

    fetch(blockGeoJsonUrl)
      .then((r) => r.json())
      .then(setBlockGeoJSON)
      .catch(console.error);

    fetch(blocksJsonUrl)
      .then((r) => r.json())
      .then((d) => setBlocks(d.blocks))
      .catch(console.error);

    fetch(stationsJsonUrl)
      .then((r) => r.json())
      .then((d) => setStations(d.stations))
      .catch(console.error);
  }, [wardGeoJsonUrl, blockGeoJsonUrl, blocksJsonUrl, stationsJsonUrl]);

  const blockLookup = useMemo(() => {
    const map = new Map<string, GWBlock>();
    for (const b of blocks) map.set(b.name, b);
    return map;
  }, [blocks]);

  // Refs for imperative style updates (avoids expensive GeoJSON remounts on legend toggle)
  const wardLayerRef = useRef<L.GeoJSON | null>(null);
  const blockLayerRef = useRef<L.GeoJSON | null>(null);

  // Ward styles
  const wardStyle = useCallback((feature: Feature | undefined) => {
    if (!feature) return {};
    const wardNum = Number(feature.properties?.ward_number || feature.properties?.Ward_No);
    let fillColor: string;
    let category: string;
    if (viewMode === "risk") {
      const risk = riskData.get(wardNum);
      const level = risk?.riskLevel ?? "noData";
      fillColor = getRiskColor(level);
      category = level;
    } else {
      const ward = groundwaterData.get(wardNum);
      fillColor = getGroundwaterColor(ward?.depthM ?? null);
      category = getGroundwaterStatus(ward?.depthM ?? null);
    }
    const isHidden = hiddenCategories?.has(category) ?? false;
    return { fillColor, weight: 1, opacity: isHidden ? 0.1 : 0.7, color: tiles.stroke, fillOpacity: isHidden ? 0.05 : 0.75 };
  }, [viewMode, riskData, groundwaterData, hiddenCategories, tiles.stroke]);

  // Map block class names to legend IDs
  const blockClassToLegendId: Record<string, string> = {
    "Safe": "safe",
    "Semi Critical": "semi_critical",
    "Critical": "critical",
    "Over Exploited": "over_exploited",
  };

  // Block styles
  const blockStyle = useCallback((feature: Feature | undefined) => {
    if (!feature) return {};
    const blockName = feature.properties?.block as string;
    const block = blockLookup.get(blockName);
    const fillColor = block ? getBlockClassColor(block.latest.class) : "#94a3b8";
    const legendId = block ? blockClassToLegendId[block.latest.class] : undefined;
    const isHidden = legendId ? (hiddenCategories?.has(legendId) ?? false) : false;
    return { fillColor, weight: 2, opacity: isHidden ? 0.1 : 0.9, color: tiles.strokeLight, fillOpacity: isHidden ? 0.05 : 0.65 };
  }, [blockLookup, hiddenCategories, tiles.strokeLight]);

  const onEachWard = (feature: Feature, layer: Layer) => {
    const wardNum = Number(feature.properties?.ward_number || feature.properties?.Ward_No);
    const ward = groundwaterData.get(wardNum);
    const risk = riskData.get(wardNum);

    const zoneName = feature.properties?.Zone_Name || ward?.zone || "";
    const heading = zoneName ? `${t("ward.ward")} ${wardNum} - ${zoneName}` : `${t("ward.ward")} ${wardNum}`;
    let detail: string;
    if (viewMode === "risk") {
      detail = risk
        ? `<br/>${t("ward.tooltip_risk")}: ${risk.riskScore.toFixed(0)}/100`
        : `<br/>${t("ward.no_risk_data")}`;
    } else {
      detail = ward
        ? `<br/>${ward.depthM?.toFixed(1)}m ${t("ward.tooltip_depth")}`
        : `<br/>${t("gw.no_data_lc")}`;
    }
    layer.bindTooltip(`<strong>${heading}</strong>${detail}`, { sticky: true });

    layer.on({
      click: () => { onWardSelect(ward || null); },
      mouseover: (e: LeafletMouseEvent) => {
        e.target.setStyle({ weight: 3, color: tiles.hoverStroke, fillOpacity: 0.9 });
      },
      mouseout: (e: LeafletMouseEvent) => {
        // Keep slightly bolder style if this is the selected ward
        if (wardNum === selectedWardNumber) {
          e.target.setStyle({ weight: 2, color: tiles.stroke, fillOpacity: 0.85 });
        } else {
          e.target.setStyle({ weight: 1, color: tiles.stroke, fillOpacity: 0.75 });
        }
      },
    });
  };

  const onEachBlock = (feature: Feature, layer: Layer) => {
    const blockName = feature.properties?.block as string;
    const block = blockLookup.get(blockName);
    if (!block) return;

    const classKey = block.latest.class.toLowerCase().replace(/ /g, "_");
    const classLabel = t(`gw_block.${classKey}`) || block.latest.class;

    layer.bindTooltip(
      `<strong>${blockName}</strong><br/>` +
      `<span style="font-size:11px;color:#64748b">${classLabel} - ${block.latest.development_pct}% ${t("gw_block.development")}</span>`,
      { sticky: true }
    );

    layer.on({
      click: () => { onBlockSelect?.(block); },
      mouseover: (e: LeafletMouseEvent) => {
        e.target.setStyle({ weight: 3, color: tiles.hoverStroke, fillOpacity: 0.8 });
      },
      mouseout: (e: LeafletMouseEvent) => {
        e.target.setStyle({ weight: 2, color: tiles.strokeLight, fillOpacity: 0.65 });
      },
    });
  };

  // Imperatively restyle layers when hiddenCategories changes (avoids full GeoJSON remount)
  useEffect(() => {
    wardLayerRef.current?.setStyle(wardStyle as L.StyleFunction);
  }, [hiddenCategories, wardStyle]);

  useEffect(() => {
    blockLayerRef.current?.setStyle(blockStyle as L.StyleFunction);
  }, [hiddenCategories, blockStyle]);

  if (viewMode === "exploitation" ? !blockGeoJSON : !wardGeoJSON) {
    return (
      <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <span className="text-slate-500 dark:text-slate-400">{t("common.loading_map")}</span>
      </div>
    );
  }

  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      className="h-full w-full"
      scrollWheelZoom={true}
    >
      <MapResizer />
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      {flyToWard && <FlyToWard wardNumber={flyToWard} wardGeoJsonUrl={wardGeoJsonUrl} />}

      {viewMode === "exploitation" ? (
        <>
          {blockGeoJSON && (
            <GeoJSON ref={(layer) => { blockLayerRef.current = layer; }} key={`blocks-${tiles.url}`} data={blockGeoJSON} style={blockStyle} onEachFeature={onEachBlock} />
          )}
          {stations.map((s) => (
            <CircleMarker
              key={s.station_code}
              center={[s.lat, s.lng]}
              radius={4}
              pathOptions={{ fillColor: "#3b82f6", color: "#1e3a5f", weight: 1, fillOpacity: 0.8 }}
            >
              <Tooltip>
                <strong>{s.name}</strong>
                <br />
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  {s.agency} - {t("gw_block.stations")}
                </span>
              </Tooltip>
            </CircleMarker>
          ))}
        </>
      ) : (
        <>
          {wardGeoJSON && (
            <GeoJSON ref={(layer) => { wardLayerRef.current = layer; }} key={`${viewMode}-${tiles.url}`} data={wardGeoJSON} style={wardStyle} onEachFeature={onEachWard} />
          )}
          {/* key includes viewMode so highlight remounts on top after choropleth remounts */}
          <SelectedWardHighlight key={`highlight-${viewMode}`} wardNumber={selectedWardNumber ?? null} />

          {/* Live CGWB stations overlay (India WRIS) - only on depth view */}
          {viewMode === "depth" && wrisStations?.map((s) => {
            if (s.latitude == null || s.longitude == null) return null;
            // Respect the legend's sensor-status filters so reviewers can hide
            // suspect/stale stations when evaluating the map.
            if (s.dataQualityFlag === "stuck" && hiddenCategories?.has("wris_stuck")) return null;
            if (s.dataQualityFlag === "stale" && hiddenCategories?.has("wris_stale")) return null;
            const depth = Math.abs(s.latestDepthM);
            const isSelected = selectedWrisStationCode === s.stationCode;
            const isSuspect = s.dataQualityFlag === "stuck" || s.dataQualityFlag === "stale";
            // Stations flagged as stuck/stale get a neutral grey fill and a
            // dashed border so they don't mislead users into thinking the
            // depth is a real current reading.
            const fillColor = isSuspect ? "#94a3b8" : getGroundwaterColor(depth);
            const borderColor = isSelected
              ? "#0c4a6e"
              : s.dataQualityFlag === "stuck"
                ? "#b45309"
                : "#1e293b";
            return (
              <CircleMarker
                key={s.stationCode}
                center={[s.latitude, s.longitude]}
                radius={isSelected ? 8 : 6}
                pathOptions={{
                  fillColor,
                  color: borderColor,
                  weight: isSelected ? 2.5 : 1.5,
                  fillOpacity: isSuspect ? 0.55 : 0.95,
                  dashArray: s.dataQualityFlag === "stuck" ? "2 3" : undefined,
                }}
                eventHandlers={{
                  click: () => onWrisStationSelect?.(s),
                }}
              >
                <Tooltip>
                  <strong>{s.stationName}</strong>
                  <br />
                  <span style={{ fontSize: "11px" }}>
                    {depth.toFixed(2)}m {t("wris.depth_below_ground")}
                  </span>
                  <br />
                  <span style={{ fontSize: "10px", color: "#64748b" }}>
                    {s.acquisitionMode === "Telemetric"
                      ? t("wris.mode_telemetric")
                      : t("wris.mode_manual")}
                  </span>
                  {s.dataQualityFlag === "stuck" && (
                    <>
                      <br />
                      <span style={{ fontSize: "10px", color: "#b45309", fontWeight: 600 }}>
                        {t("wris.quality_stuck_title")}
                      </span>
                    </>
                  )}
                  {s.dataQualityFlag === "stale" && (
                    <>
                      <br />
                      <span style={{ fontSize: "10px", color: "#64748b", fontStyle: "italic" }}>
                        {t("wris.quality_stale_title")}
                      </span>
                    </>
                  )}
                </Tooltip>
              </CircleMarker>
            );
          })}
        </>
      )}
    </MapContainer>
  );
}
