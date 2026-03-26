"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, LayersControl, Tooltip, LayerGroup, Circle } from "react-leaflet";
import L from "leaflet";
import type { Layer } from "leaflet";
import type { Feature } from "geojson";
import type {
  CurrentWaterBodyProperties,
  LostWaterBodyProperties,
  CensusWaterBodyProperties,
  SelectedWaterBody,
} from "@/types/water-bodies";
import { STATUS_COLORS } from "@/types/water-bodies";
import type { ScoredWaterBody } from "@/types/restoration";
import { getPriorityColor } from "@/types/restoration";
import type { ViewMode } from "./view-mode-toggle";
import { useLanguage } from "@/lib/i18n/context";
import { useMapTiles } from "@/lib/utils/map-tiles";
import "leaflet/dist/leaflet.css";

interface UnifiedMapProps {
  viewMode: ViewMode;
  scoredData: ScoredWaterBody[];
  censusData: CensusWaterBodyProperties[];
  onSelectCurrent: (body: SelectedWaterBody) => void;
  onSelectLost: (body: SelectedWaterBody) => void;
}

function getCensusColor(wb: CensusWaterBodyProperties): string {
  if (wb.encroachment_status === "yes") return "#ef4444"; // red
  if (wb.storage_loss_pct != null && wb.storage_loss_pct > 50) return "#f97316"; // orange
  if (wb.is_in_use === false) return "#a855f7"; // purple — not in use
  return "#10b981"; // green — healthy
}

/** Census markers use a small meter-based Circle so they scale with zoom —
 *  tiny dots at city level, visible pins when zoomed in. Census water_spread_area
 *  has mixed/unreliable units (see About > Data Quality). */
const CENSUS_RADIUS_M = 20;

export function UnifiedMap({ viewMode, scoredData, censusData, onSelectCurrent, onSelectLost }: UnifiedMapProps) {
  const { t, language } = useLanguage();
  const tiles = useMapTiles();
  const [currentGeoJSON, setCurrentGeoJSON] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [lostGeoJSON, setLostGeoJSON] =
    useState<GeoJSON.FeatureCollection | null>(null);

  // Build lookup from id to scored data, plus osm_id shortcut
  const { scoreLookupById, scoreLookupByOsmId } = useMemo(() => {
    const byId = new Map<string, ScoredWaterBody>();
    const byOsm = new Map<number, ScoredWaterBody>();
    for (const wb of scoredData) {
      byId.set(wb.id, wb);
      if (wb.osm_id != null) byOsm.set(wb.osm_id, wb);
    }
    return { scoreLookupById: byId, scoreLookupByOsmId: byOsm };
  }, [scoredData]);

  // Match census records to OSM polygons by proximity (200m threshold)
  const { censusMatchByOsmId, unmatchedCensus } = useMemo(() => {
    const matchMap = new Map<number, CensusWaterBodyProperties>();
    const unmatched: CensusWaterBodyProperties[] = [];

    if (!currentGeoJSON || censusData.length === 0) {
      return { censusMatchByOsmId: matchMap, unmatchedCensus: censusData };
    }

    // Compute centroids for all OSM polygons
    const osmCentroids: { osmId: number; lat: number; lng: number }[] = [];
    for (const feat of currentGeoJSON.features) {
      const coords = feat.geometry.type === "Polygon"
        ? (feat.geometry as GeoJSON.Polygon).coordinates[0]
        : feat.geometry.type === "MultiPolygon"
        ? (feat.geometry as GeoJSON.MultiPolygon).coordinates[0][0]
        : null;
      if (!coords || coords.length === 0) continue;
      let latSum = 0, lngSum = 0;
      for (const [lng, lat] of coords) { latSum += lat; lngSum += lng; }
      osmCentroids.push({
        osmId: (feat.properties as CurrentWaterBodyProperties).osm_id,
        lat: latSum / coords.length,
        lng: lngSum / coords.length,
      });
    }

    // Haversine distance in meters (simplified for short distances)
    const toRad = (d: number) => (d * Math.PI) / 180;
    const haversineM = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const dlat = toRad(lat2 - lat1), dlng = toRad(lng2 - lng1);
      const a = Math.sin(dlat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dlng / 2) ** 2;
      return 6371000 * 2 * Math.asin(Math.sqrt(a));
    };

    const MATCH_THRESHOLD_M = 200;
    // Track best census match per OSM id (closest wins)
    const bestMatch = new Map<number, { census: CensusWaterBodyProperties; dist: number }>();

    for (const census of censusData) {
      let bestDist = Infinity;
      let bestOsmId = -1;
      for (const osm of osmCentroids) {
        const d = haversineM(census.latitude, census.longitude, osm.lat, osm.lng);
        if (d < bestDist) { bestDist = d; bestOsmId = osm.osmId; }
      }
      if (bestDist <= MATCH_THRESHOLD_M && bestOsmId >= 0) {
        const existing = bestMatch.get(bestOsmId);
        if (!existing || bestDist < existing.dist) {
          bestMatch.set(bestOsmId, { census, dist: bestDist });
        }
        // If this census displaced another, push the displaced to unmatched
        if (existing && bestDist < existing.dist) {
          unmatched.push(existing.census);
        }
      } else {
        unmatched.push(census);
      }
    }

    // Also push census records that were displaced by closer matches
    for (const [osmId, { census }] of bestMatch) {
      matchMap.set(osmId, census);
    }

    return { censusMatchByOsmId: matchMap, unmatchedCensus: unmatched };
  }, [currentGeoJSON, censusData]);

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

  // --- Styles ---

  const currentStyle = (feature: Feature | undefined) => {
    if (viewMode === "restoration") {
      const osmId = feature?.properties?.osm_id as number | undefined;
      const scored = osmId ? scoreLookupByOsmId.get(osmId) : undefined;
      const color = scored ? getPriorityColor(scored.priority_level) : "#94a3b8";
      return {
        fillColor: color,
        color,
        weight: 1.5,
        fillOpacity: 0.55,
        opacity: 0.8,
      };
    }
    // In water-bodies mode, color matched polygons by census status
    const osmId = feature?.properties?.osm_id as number | undefined;
    const censusMatch = osmId ? censusMatchByOsmId.get(osmId) : undefined;
    if (censusMatch) {
      const color = getCensusColor(censusMatch);
      return { fillColor: color, color, weight: 2, fillOpacity: 0.5, opacity: 0.85 };
    }
    return {
      fillColor: "#3b82f6",
      color: "#1d4ed8",
      weight: 1.5,
      fillOpacity: 0.45,
      opacity: 0.8,
    };
  };

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

  // --- Interaction handlers ---

  const defaultFillOpacity = viewMode === "restoration" ? 0.55 : 0.45;

  const onEachCurrent = (feature: Feature, layer: Layer) => {
    const props = feature.properties as CurrentWaterBodyProperties;
    const name =
      language === "ta"
        ? (props.name_ta?.trim() || `${t("wb_panel.water_body")} #${props.osm_id}`)
        : (props.name || t("wb_panel.unnamed"));

    if (viewMode === "restoration") {
      const scored = scoreLookupByOsmId.get(props.osm_id);
      if (scored) {
        const levelLabel = t(`lr.${scored.priority_level}`);
        layer.bindTooltip(
          `<strong>${name}</strong><br/>` +
          `<span style="font-size:11px;color:#64748b">${t("lr.priority_score")}: ${scored.priority_score} · ${levelLabel}</span>`,
          { sticky: true }
        );
      } else {
        // Unscored polygons (rivers, etc.) - still show the name
        const normalizedType = (props.water_type || "water").toLowerCase();
        const typeLabel = t(`wb_type.${normalizedType}`);
        const type = typeLabel.startsWith("wb_type.") ? props.water_type || t("wb_panel.water_body") : typeLabel;
        layer.bindTooltip(
          `<strong>${name}</strong><br/><span style="font-size:11px;color:#64748b">${type}</span>`,
          { sticky: true }
        );
      }
    } else {
      const areaText = props.area_ha
        ? `${props.area_ha.toLocaleString()} ha`
        : t("wb_panel.unknown");
      const normalizedType = (props.water_type || "water").toLowerCase();
      const typeLabel = t(`wb_type.${normalizedType}`);
      const type = typeLabel.startsWith("wb_type.") ? props.water_type || t("wb_panel.water_body") : typeLabel;
      const censusMatch = censusMatchByOsmId.get(props.osm_id);
      const censusInfo = censusMatch
        ? `<br/><span style="font-size:11px;color:#64748b">${
            censusMatch.ownership || ""
          }${censusMatch.encroachment_status === "yes"
            ? ` · ${t("wb_panel.encroached")}${censusMatch.encroachment_pct != null ? ` (${censusMatch.encroachment_pct}%)` : ""}`
            : ""
          }</span>`
        : "";
      layer.bindTooltip(
        `<strong>${name}</strong><br/><span style="font-size:11px;color:#64748b">${type} · ${areaText}</span>${censusInfo}`,
        { sticky: true }
      );
    }

    const censusMatch = censusMatchByOsmId.get(props.osm_id);
    layer.on({
      click: (e) => {
        const latlng: [number, number] = [e.latlng.lat, e.latlng.lng];
        onSelectCurrent({ kind: "current", props, latlng, censusMatch });
      },
      mouseover: (e) => {
        (e.target as L.Path).setStyle({ fillOpacity: viewMode === "restoration" ? 0.8 : 0.7, weight: 2.5 });
      },
      mouseout: (e) => {
        (e.target as L.Path).setStyle({ fillOpacity: defaultFillOpacity, weight: 1.5 });
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
        const latlng: [number, number] = [e.latlng.lat, e.latlng.lng];
        onSelectLost({ kind: "lost", props, latlng });
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
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      <LayersControl position="topright">
        {currentGeoJSON && (
          <LayersControl.Overlay name={viewMode === "restoration" ? t("lr.priority_level") : t("wb_map.existing_layer")} checked>
            <GeoJSON
              key={`current-${viewMode}-${language}-${censusMatchByOsmId.size}`}
              data={currentGeoJSON}
              style={currentStyle}
              onEachFeature={onEachCurrent}
            />
          </LayersControl.Overlay>
        )}
        {lostGeoJSON && (
          <LayersControl.Overlay name={t("wb_map.lost_layer")} checked>
            <GeoJSON
              key={`lost-${language}`}
              data={lostGeoJSON}
              pointToLayer={pointToLayer}
              style={lostStyle}
              onEachFeature={onEachLost}
            />
          </LayersControl.Overlay>
        )}
        {unmatchedCensus.length > 0 && viewMode === "water-bodies" && (
          <LayersControl.Overlay name={t("wb_map.census_layer")} checked>
            <LayerGroup>
              {unmatchedCensus.map((wb) => {
                const color = getCensusColor(wb);
                const name = wb.name || t("wb_panel.unnamed");
                const type = wb.water_body_type || t("wb_panel.water_body");
                return (
                  <Circle
                    key={wb.id}
                    center={[wb.latitude, wb.longitude]}
                    radius={CENSUS_RADIUS_M}
                    pathOptions={{
                      fillColor: color,
                      color,
                      weight: 1.5,
                      fillOpacity: 0.7,
                      opacity: 0.9,
                    }}
                    eventHandlers={{
                      click: () => {
                        onSelectCurrent({
                          kind: "census",
                          props: wb,
                          latlng: [wb.latitude, wb.longitude],
                        });
                      },
                    }}
                  >
                    <Tooltip sticky>
                      <strong>{name}</strong>
                      <br />
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        {type}
                        {wb.ownership ? ` · ${wb.ownership}` : ""}
                      </span>
                    </Tooltip>
                  </Circle>
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>
        )}
        {unmatchedCensus.length > 0 && viewMode === "restoration" && (
          <LayersControl.Overlay name={t("wb_map.census_layer")} checked>
            <LayerGroup>
              {unmatchedCensus.map((wb) => {
                const scored = scoreLookupById.get(`census:${wb.id}`);
                const color = scored ? getPriorityColor(scored.priority_level) : "#94a3b8";
                const name = wb.name || t("wb_panel.unnamed");
                return (
                  <Circle
                    key={wb.id}
                    center={[wb.latitude, wb.longitude]}
                    radius={CENSUS_RADIUS_M}
                    pathOptions={{
                      fillColor: color,
                      color,
                      weight: 1.5,
                      fillOpacity: 0.7,
                      opacity: 0.9,
                    }}
                    eventHandlers={{
                      click: () => {
                        onSelectCurrent({
                          kind: "census",
                          props: wb,
                          latlng: [wb.latitude, wb.longitude],
                        });
                      },
                    }}
                  >
                    <Tooltip sticky>
                      <strong>{name}</strong>
                      {scored && (
                        <>
                          <br />
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            {t("lr.priority_score")}: {scored.priority_score} · {t(`lr.${scored.priority_level}`)}
                          </span>
                        </>
                      )}
                    </Tooltip>
                  </Circle>
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>
        )}
      </LayersControl>
    </MapContainer>
  );
}
