"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, Tooltip, LayerGroup, Circle, useMap } from "react-leaflet";
import { MapResizer } from "@/components/map-resizer";
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

// Chennai-default GeoJSON URLs and map center. Other cities override via props.
const DEFAULT_CURRENT_GEOJSON_URL = "/geojson/chennai-water-bodies-current.geojson";
const DEFAULT_LOST_GEOJSON_URL = "/geojson/chennai-water-bodies-lost.geojson";
const DEFAULT_RIVERS_GEOJSON_URL = "/geojson/chennai-rivers.geojson";
const DEFAULT_MAP_CENTER: [number, number] = [13.0827, 80.2707];

interface UnifiedMapProps {
  viewMode: ViewMode;
  scoredData: ScoredWaterBody[];
  censusData: CensusWaterBodyProperties[];
  onSelectCurrent: (body: SelectedWaterBody) => void;
  onSelectLost: (body: SelectedWaterBody) => void;
  focusCenter?: [number, number];
  hiddenCategories?: Set<string>;
  // City-aware overrides; default to Chennai paths for backward compat.
  currentGeoJsonUrl?: string;
  lostGeoJsonUrl?: string;
  riversGeoJsonUrl?: string;
  mapCenter?: [number, number];
  mapZoom?: number;
}

/** Flies the map to a given center when it changes */
function FlyToCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 14, { duration: 1 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1]]);
  return null;
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

export function UnifiedMap({
  viewMode,
  scoredData,
  censusData,
  onSelectCurrent,
  onSelectLost,
  focusCenter,
  hiddenCategories,
  currentGeoJsonUrl = DEFAULT_CURRENT_GEOJSON_URL,
  lostGeoJsonUrl = DEFAULT_LOST_GEOJSON_URL,
  riversGeoJsonUrl = DEFAULT_RIVERS_GEOJSON_URL,
  mapCenter = DEFAULT_MAP_CENTER,
  mapZoom = 11,
}: UnifiedMapProps) {
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

  // Load rivers GeoJSON and build a name lookup for unnamed water body polygons
  const [riverNameByOsmId, setRiverNameByOsmId] = useState<Map<number, { name: string; name_ta: string }>>(new Map());

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
    fetch(currentGeoJsonUrl)
      .then((r) => r.json())
      .then(setCurrentGeoJSON)
      .catch(console.error);

    fetch(lostGeoJsonUrl)
      .then((r) => r.json())
      .then(setLostGeoJSON)
      .catch(console.error);
  }, [currentGeoJsonUrl, lostGeoJsonUrl]);

  // Match unnamed water body polygons to rivers by centroid proximity
  useEffect(() => {
    if (!currentGeoJSON) return;
    fetch(riversGeoJsonUrl)
      .then((r) => r.json())
      .then((riversGeo: GeoJSON.FeatureCollection) => {
        // Extract river line sample points with names
        const riverPoints: { lat: number; lng: number; name: string; name_ta: string }[] = [];
        for (const feat of riversGeo.features) {
          const rProps = feat.properties as { name?: string; name_ta?: string };
          const name = rProps.name || "";
          const name_ta = rProps.name_ta || "";
          const addCoords = (coords: number[][]) => {
            // Sample every 5th point to keep it fast
            for (let i = 0; i < coords.length; i += 5) {
              riverPoints.push({ lat: coords[i][1], lng: coords[i][0], name, name_ta });
            }
          };
          const geom = feat.geometry;
          if (geom.type === "LineString") addCoords((geom as GeoJSON.LineString).coordinates);
          else if (geom.type === "MultiLineString") {
            for (const line of (geom as GeoJSON.MultiLineString).coordinates) addCoords(line);
          }
        }

        const toRad = (d: number) => (d * Math.PI) / 180;
        const haversineM = (lat1: number, lng1: number, lat2: number, lng2: number) => {
          const dlat = toRad(lat2 - lat1), dlng = toRad(lng2 - lng1);
          const a = Math.sin(dlat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dlng / 2) ** 2;
          return 6371000 * 2 * Math.asin(Math.sqrt(a));
        };

        const lookup = new Map<number, { name: string; name_ta: string }>();
        for (const feat of currentGeoJSON.features) {
          const props = feat.properties as CurrentWaterBodyProperties;
          // Only match unnamed polygons
          if (props.name) continue;
          // Compute centroid
          const coords = feat.geometry.type === "Polygon"
            ? (feat.geometry as GeoJSON.Polygon).coordinates[0]
            : feat.geometry.type === "MultiPolygon"
            ? (feat.geometry as GeoJSON.MultiPolygon).coordinates[0][0]
            : null;
          if (!coords || coords.length === 0) continue;
          let latSum = 0, lngSum = 0;
          for (const [lng, lat] of coords) { latSum += lat; lngSum += lng; }
          const cLat = latSum / coords.length, cLng = lngSum / coords.length;

          // Find nearest river point
          let bestDist = Infinity, bestName = "", bestNameTa = "";
          for (const rp of riverPoints) {
            const d = haversineM(cLat, cLng, rp.lat, rp.lng);
            if (d < bestDist) { bestDist = d; bestName = rp.name; bestNameTa = rp.name_ta; }
          }
          // Within 500m of a river line = label as that river
          if (bestDist < 500 && bestName) {
            lookup.set(props.osm_id, { name: bestName, name_ta: bestNameTa });
          }
        }
        setRiverNameByOsmId(lookup);
      })
      .catch(console.error);
  }, [currentGeoJSON, riversGeoJsonUrl]);

  // --- Styles ---

  // Refs for imperative style updates (avoids expensive GeoJSON remounts on legend toggle)
  const currentLayerRef = useRef<L.GeoJSON | null>(null);
  const lostLayerRef = useRef<L.GeoJSON | null>(null);

  const currentStyle = useCallback((feature: Feature | undefined) => {
    if (viewMode === "restoration") {
      const osmId = feature?.properties?.osm_id as number | undefined;
      const scored = osmId ? scoreLookupByOsmId.get(osmId) : undefined;
      const color = scored ? getPriorityColor(scored.priority_level) : "#94a3b8";
      const category = scored?.priority_level;
      const isHidden = category ? (hiddenCategories?.has(category) ?? false) : false;
      return {
        fillColor: color,
        color,
        weight: 1.5,
        fillOpacity: isHidden ? 0.05 : 0.55,
        opacity: isHidden ? 0.1 : 0.8,
      };
    }
    // In water-bodies mode, color matched polygons by census status
    const osmId = feature?.properties?.osm_id as number | undefined;
    const censusMatch = osmId ? censusMatchByOsmId.get(osmId) : undefined;
    if (censusMatch) {
      const color = getCensusColor(censusMatch);
      // Determine census category for filtering
      let category: string;
      if (censusMatch.encroachment_status === "yes") category = "census_encroached";
      else if (censusMatch.storage_loss_pct != null && censusMatch.storage_loss_pct > 50) category = "census_degraded";
      else category = "census_healthy";
      const isHidden = hiddenCategories?.has(category) ?? false;
      return { fillColor: color, color, weight: 2, fillOpacity: isHidden ? 0.05 : 0.5, opacity: isHidden ? 0.1 : 0.85 };
    }
    const isHidden = hiddenCategories?.has("existing") ?? false;
    return {
      fillColor: "#3b82f6",
      color: "#1d4ed8",
      weight: 1.5,
      fillOpacity: isHidden ? 0.05 : 0.45,
      opacity: isHidden ? 0.1 : 0.8,
    };
  }, [viewMode, scoreLookupByOsmId, censusMatchByOsmId, hiddenCategories]);

  const lostStyle = useCallback((feature: Feature | undefined) => {
    const status = feature?.properties?.status as
      | keyof typeof STATUS_COLORS
      | undefined;
    const color = status ? STATUS_COLORS[status] : "#dc2626";
    const isHidden = status ? (hiddenCategories?.has(status) ?? false) : false;
    return {
      fillColor: color,
      color,
      weight: 2,
      fillOpacity: isHidden ? 0.05 : 0.35,
      opacity: isHidden ? 0.1 : 0.85,
      dashArray: "6, 4",
    };
  }, [hiddenCategories]);

  // Imperatively restyle layers when hiddenCategories changes
  useEffect(() => {
    currentLayerRef.current?.setStyle(currentStyle as L.StyleFunction);
  }, [hiddenCategories, currentStyle]);

  useEffect(() => {
    lostLayerRef.current?.setStyle(lostStyle as L.StyleFunction);
  }, [hiddenCategories, lostStyle]);

  // --- Interaction handlers ---

  const defaultFillOpacity = viewMode === "restoration" ? 0.55 : 0.45;

  const onEachCurrent = (feature: Feature, layer: Layer) => {
    const props = feature.properties as CurrentWaterBodyProperties;
    // Check if this unnamed polygon is near a river
    const riverInfo = riverNameByOsmId.get(props.osm_id);
    const name = (() => {
      if (language === "ta") {
        return props.name_ta?.trim() || riverInfo?.name_ta || riverInfo?.name || `${t("wb_panel.water_body")} #${props.osm_id}`;
      }
      return props.name || riverInfo?.name || t("wb_panel.unnamed");
    })();

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
        // Unscored polygons (rivers, etc.) - show name
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
      center={mapCenter}
      zoom={mapZoom}
      className="h-full w-full"
      scrollWheelZoom={true}
    >
      <MapResizer />
      {focusCenter && <FlyToCenter center={focusCenter} />}
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      {currentGeoJSON && (
        <GeoJSON
          ref={(layer) => { currentLayerRef.current = layer; }}
          key={`current-${viewMode}-${language}-${censusMatchByOsmId.size}-${tiles.url}`}
          data={currentGeoJSON}
          style={currentStyle}
          onEachFeature={onEachCurrent}
        />
      )}
      {lostGeoJSON && (
        <GeoJSON
          ref={(layer) => { lostLayerRef.current = layer; }}
          key={`lost-${language}-${tiles.url}`}
          data={lostGeoJSON}
          pointToLayer={pointToLayer}
          style={lostStyle}
          onEachFeature={onEachLost}
        />
      )}
      {unmatchedCensus.length > 0 && viewMode === "water-bodies" && (
        <LayerGroup>
              {unmatchedCensus.filter((wb) => {
                let cat: string;
                if (wb.encroachment_status === "yes") cat = "census_encroached";
                else if (wb.storage_loss_pct != null && wb.storage_loss_pct > 50) cat = "census_degraded";
                else cat = "census_healthy";
                return !(hiddenCategories?.has(cat));
              }).map((wb) => {
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
      )}
      {unmatchedCensus.length > 0 && viewMode === "restoration" && (
        <LayerGroup>
              {unmatchedCensus.filter((wb) => {
                const scored = scoreLookupById.get(`census:${wb.id}`);
                return !(scored && hiddenCategories?.has(scored.priority_level));
              }).map((wb) => {
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
      )}
    </MapContainer>
  );
}
