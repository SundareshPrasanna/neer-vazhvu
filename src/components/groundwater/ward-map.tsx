"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip } from "react-leaflet";
import { MapResizer } from "@/components/map-resizer";
import type { Layer, LeafletMouseEvent } from "leaflet";
import type { Feature } from "geojson";
import { getGroundwaterColor, getRiskColor, getBlockClassColor } from "@/types/groundwater";
import type { GroundwaterWard, WardRiskData, ViewMode, GWBlock, GWStation } from "@/types/groundwater";
import { useLanguage } from "@/lib/i18n/context";
import { getWardGeoJSON } from "@/lib/data/ward-geo";
import { useMapTiles } from "@/lib/utils/map-tiles";
import "leaflet/dist/leaflet.css";

interface WardMapProps {
  groundwaterData: Map<number, GroundwaterWard>;
  riskData: Map<number, WardRiskData>;
  viewMode: ViewMode;
  onWardSelect: (ward: GroundwaterWard | null) => void;
  onBlockSelect?: (block: GWBlock | null) => void;
}

export function WardMap({ groundwaterData, riskData, viewMode, onWardSelect, onBlockSelect }: WardMapProps) {
  const { t, language } = useLanguage();
  const tiles = useMapTiles();
  const [wardGeoJSON, setWardGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const [blockGeoJSON, setBlockGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const [blocks, setBlocks] = useState<GWBlock[]>([]);
  const [stations, setStations] = useState<GWStation[]>([]);

  useEffect(() => {
    getWardGeoJSON()
      .then(setWardGeoJSON)
      .catch(console.error);

    fetch("/geojson/chennai-gwr-blocks.geojson")
      .then((r) => r.json())
      .then(setBlockGeoJSON)
      .catch(console.error);

    fetch("/data/gwr-blocks.json")
      .then((r) => r.json())
      .then((d) => setBlocks(d.blocks))
      .catch(console.error);

    fetch("/data/gw-stations.json")
      .then((r) => r.json())
      .then((d) => setStations(d.stations))
      .catch(console.error);
  }, []);

  const blockLookup = useMemo(() => {
    const map = new Map<string, GWBlock>();
    for (const b of blocks) map.set(b.name, b);
    return map;
  }, [blocks]);

  // Ward styles
  const wardStyle = (feature: Feature | undefined) => {
    if (!feature) return {};
    const wardNum = Number(feature.properties?.ward_number || feature.properties?.Ward_No);
    let fillColor: string;
    if (viewMode === "risk") {
      const risk = riskData.get(wardNum);
      fillColor = getRiskColor(risk?.riskLevel ?? "noData");
    } else {
      const ward = groundwaterData.get(wardNum);
      fillColor = getGroundwaterColor(ward?.depthM ?? null);
    }
    return { fillColor, weight: 1, opacity: 0.7, color: tiles.stroke, fillOpacity: 0.75 };
  };

  // Block styles
  const blockStyle = (feature: Feature | undefined) => {
    if (!feature) return {};
    const blockName = feature.properties?.block as string;
    const block = blockLookup.get(blockName);
    const fillColor = block ? getBlockClassColor(block.latest.class) : "#94a3b8";
    return { fillColor, weight: 2, opacity: 0.9, color: tiles.strokeLight, fillOpacity: 0.65 };
  };

  const onEachWard = (feature: Feature, layer: Layer) => {
    const wardNum = Number(feature.properties?.ward_number || feature.properties?.Ward_No);
    const ward = groundwaterData.get(wardNum);
    const risk = riskData.get(wardNum);

    const name = language === "ta"
      ? (ward?.wardNameTa || `${t("ward.ward")} ${wardNum}`)
      : (ward?.wardName || `${t("ward.ward")} ${wardNum}`);
    let detail: string;
    if (viewMode === "risk") {
      detail = risk
        ? `<br/><span style="font-size:11px;color:#64748b">${t("ward.ward")} ${wardNum}</span><br/>${t("ward.tooltip_risk")}: ${risk.riskScore.toFixed(0)}/100`
        : `<br/>${t("ward.no_risk_data")}`;
    } else {
      detail = ward
        ? `<br/><span style="font-size:11px;color:#64748b">${t("ward.ward")} ${wardNum}</span><br/>${ward.depthM?.toFixed(1)}m ${t("ward.tooltip_depth")}`
        : `<br/>${t("gw.no_data_lc")}`;
    }
    layer.bindTooltip(`<strong>${name}</strong>${detail}`, { sticky: true });

    layer.on({
      click: () => { onWardSelect(ward || null); },
      mouseover: (e: LeafletMouseEvent) => {
        e.target.setStyle({ weight: 3, color: tiles.hoverStroke, fillOpacity: 0.9 });
      },
      mouseout: (e: LeafletMouseEvent) => {
        e.target.setStyle({ weight: 1, color: tiles.stroke, fillOpacity: 0.75 });
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

  if (viewMode === "exploitation" ? !blockGeoJSON : !wardGeoJSON) {
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
      <MapResizer />
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      {viewMode === "exploitation" ? (
        <>
          {blockGeoJSON && (
            <GeoJSON key={`blocks-${tiles.url}`} data={blockGeoJSON} style={blockStyle} onEachFeature={onEachBlock} />
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
            <GeoJSON key={`${viewMode}-${tiles.url}`} data={wardGeoJSON} style={wardStyle} onEachFeature={onEachWard} />
          )}
        </>
      )}
    </MapContainer>
  );
}
