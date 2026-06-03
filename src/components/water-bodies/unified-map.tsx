"use client";

import { useEffect, useState, useMemo, useRef, useCallback, type ReactNode } from "react";
import { MapContainer, TileLayer, GeoJSON, Tooltip, LayerGroup, Circle, useMap, Pane } from "react-leaflet";
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
import {
  getRichBodyIdByOsmId,
  RICH_BODIES,
} from "@/lib/water-bodies/rich-body-registry";
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
  /** Optional extra Leaflet layers rendered as children of the
   *  MapContainer. Used to plug in opt-in overlays (e.g. cascade
   *  reconstruction) without coupling them into UnifiedMap itself. */
  children?: ReactNode;
  /**
   * When true, suppress hover tooltips on the current/lost/census/
   * orphan-scored layers. The cascade overlay surfaces its own
   * hover tooltip; having both fire at once produces a confusing
   * dual-tooltip stack. Toggling this puts the map into
   * "cascade mode" cleanly.
   */
  suppressLayerTooltips?: boolean;
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

/** For scored water bodies that have neither an OSM polygon nor a
 *  census record (e.g. Madurai's flagship-curated tanks: Vandiyur,
 *  Kannanenthal etc.), draw a Circle whose radius approximates the
 *  body's actual footprint via area-equivalent radius. Clamped so very
 *  small entries stay clickable and very large ones don't dominate the
 *  map. Falls back to a 120 m default when area is unknown. */
const ORPHAN_RADIUS_MIN_M = 80;
const ORPHAN_RADIUS_MAX_M = 600;
function orphanRadius(areaHa: number | null | undefined): number {
  if (!areaHa || areaHa <= 0) return 120;
  // r = sqrt(area / pi); area_ha * 10000 = sq m
  const r = Math.sqrt((areaHa * 10000) / Math.PI);
  if (r < ORPHAN_RADIUS_MIN_M) return ORPHAN_RADIUS_MIN_M;
  if (r > ORPHAN_RADIUS_MAX_M) return ORPHAN_RADIUS_MAX_M;
  return r;
}

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
  children,
  suppressLayerTooltips = false,
}: UnifiedMapProps) {
  const { t, language } = useLanguage();
  const tiles = useMapTiles();
  const [currentGeoJSON, setCurrentGeoJSON] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [lostGeoJSON, setLostGeoJSON] =
    useState<GeoJSON.FeatureCollection | null>(null);
  // Rich-data bodies (Pallikaranai etc.) have their own canonical
  // polygons from the registry. Render as a top-of-stack overlay so
  // clicks open the deep-zoom RichBodyOverlay regardless of whether
  // the body is also in the OSM extract.
  const [richBodiesGeoJSON, setRichBodiesGeoJSON] =
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

  // Scored bodies that have neither an OSM polygon nor a census record.
  // These are city-curated flagship entries (Madurai's Vandiyur tank,
  // Kannanenthal etc.) - without a polygon to color, they only appear
  // on the map if we draw an explicit Circle for each. Render in a
  // dedicated high-z pane so they sit above polygons and stay
  // clickable.
  const orphanScored = useMemo(
    () => scoredData.filter((wb) => wb.osm_id == null && wb.census_id == null),
    [scoredData],
  );

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
    // Current OSM water-bodies geojson. Cities without one (no Bangalore
    // for now) get a graceful null instead of letting the 404 HTML body
    // explode JSON.parse.
    fetch(currentGeoJsonUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then(setCurrentGeoJSON)
      .catch(console.error);

    // Lost-bodies geojson is OPTIONAL. Chennai/Madurai ship a polygon
    // version (water-bodies-lost-{city}.geojson) with historical tank
    // shapes; Bangalore's lost-kere data is tabular only (no polygons),
    // so this fetch will 404 there and that's fine.
    fetch(lostGeoJsonUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then(setLostGeoJSON)
      .catch(console.error);
  }, [currentGeoJsonUrl, lostGeoJsonUrl]);

  // Fetch all rich-body polygons from the registry, merge into one
  // FeatureCollection. Each feature stamps body_id so the click handler
  // can route to the right rich-body overlay.
  useEffect(() => {
    const entries = Object.values(RICH_BODIES);
    if (entries.length === 0) return;
    Promise.all(
      entries.map((b) =>
        fetch(b.polygon_path)
          .then((r) => r.json())
          .then((gj: GeoJSON.FeatureCollection) => ({ body: b, gj }))
          .catch(() => null),
      ),
    ).then((results) => {
      const features: GeoJSON.Feature[] = [];
      for (const r of results) {
        if (!r) continue;
        for (const f of r.gj.features) {
          features.push({
            ...f,
            properties: {
              ...(f.properties ?? {}),
              body_id: r.body.id,
              name: r.body.name,
              name_ta: r.body.name_ta ?? "",
              osm_id: r.body.osm_id,
            },
          });
        }
      }
      setRichBodiesGeoJSON({ type: "FeatureCollection", features });
    });
  }, []);

  // Match unnamed water body polygons to rivers by centroid proximity
  useEffect(() => {
    if (!currentGeoJSON) return;
    fetch(riversGeoJsonUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((riversGeo: GeoJSON.FeatureCollection | null) => {
        if (!riversGeo) return;
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

  // When a category is toggled off in the legend the layer was still
  // intercepting clicks + hover events (visibly dimmed but pointer-
  // capturing), which blocked clicks on bodies underneath. Toggle the
  // SVG element's pointer-events so hidden features stop swallowing
  // mouse interactions and let clicks pass through to whatever sits
  // below in z-order.
  const togglePointerEventsByStatus = useCallback(
    (layerRef: L.GeoJSON | null, getCategory: (props: Record<string, unknown>) => string | null) => {
      if (!layerRef) return;
      layerRef.eachLayer((sub) => {
        const feat = (sub as L.GeoJSON & { feature?: Feature }).feature;
        const props = (feat?.properties ?? {}) as Record<string, unknown>;
        const cat = getCategory(props);
        const isHidden = cat ? (hiddenCategories?.has(cat) ?? false) : false;
        const el = (sub as L.Path).getElement?.();
        if (el) (el as HTMLElement).style.pointerEvents = isHidden ? "none" : "";
      });
    },
    [hiddenCategories],
  );

  useEffect(() => {
    togglePointerEventsByStatus(lostLayerRef.current, (props) => {
      const s = props.status;
      return typeof s === "string" ? s : null;
    });
  }, [hiddenCategories, togglePointerEventsByStatus]);

  // Same pointer-events guard for current-water-body polygons. Category
  // depends on view mode: restoration -> priority_level, water-bodies ->
  // encroached/existing (per census match).
  useEffect(() => {
    togglePointerEventsByStatus(currentLayerRef.current, (props) => {
      const osmId = typeof props.osm_id === "number" ? props.osm_id : null;
      if (osmId == null) return null;
      if (viewMode === "restoration") {
        const scored = scoreLookupByOsmId.get(osmId);
        return scored?.priority_level ?? null;
      }
      const census = censusMatchByOsmId.get(osmId);
      return census?.encroachment_status === "yes" ? "encroached" : "existing";
    });
  }, [
    hiddenCategories,
    togglePointerEventsByStatus,
    viewMode,
    scoreLookupByOsmId,
    censusMatchByOsmId,
  ]);

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

    if (suppressLayerTooltips) {
      // Skip tooltip binding entirely; the cascade overlay's hover tooltip
      // owns the hover surface in this mode. Click-to-select still works
      // because we still install the click handler below.
    } else if (viewMode === "restoration") {
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
    const richBodyId = getRichBodyIdByOsmId(props.osm_id) ?? undefined;
    // Resolve which legend category this body belongs to so we can guard
    // hover/click handlers against firing for hidden categories. Mirror
    // currentStyle's category mapping.
    const resolveCategory = () => {
      if (viewMode === "restoration") {
        return scoreLookupByOsmId.get(props.osm_id)?.priority_level ?? null;
      }
      return censusMatch?.encroachment_status === "yes" ? "encroached" : "existing";
    };
    layer.on({
      click: (e) => {
        const cat = resolveCategory();
        if (cat && hiddenCategories?.has(cat)) return;
        const latlng: [number, number] = [e.latlng.lat, e.latlng.lng];
        onSelectCurrent({ kind: "current", props, latlng, censusMatch, richBodyId });
      },
      mouseover: (e) => {
        const cat = resolveCategory();
        if (cat && hiddenCategories?.has(cat)) return;
        (e.target as L.Path).setStyle({ fillOpacity: viewMode === "restoration" ? 0.8 : 0.7, weight: 2.5 });
      },
      mouseout: (e) => {
        const cat = resolveCategory();
        if (cat && hiddenCategories?.has(cat)) return;
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

    if (!suppressLayerTooltips) {
      layer.bindTooltip(
        `<strong>${name}</strong><br/><span style="font-size:11px;color:#64748b">${statusLabel} · ${t("wb_map.was_area")} ${props.historical_area_ha} ha</span>`,
        { sticky: true }
      );
    }

    layer.on({
      click: (e) => {
        // Guard: a stale handler can fire from a "hidden" feature
        // because the .on() closure was attached before the hide was
        // toggled. Disabling pointer-events on the element (above) is
        // the primary defence; this is a belt-and-braces fallback.
        if (hiddenCategories?.has(props.status)) return;
        const latlng: [number, number] = [e.latlng.lat, e.latlng.lng];
        onSelectLost({ kind: "lost", props, latlng });
      },
      mouseover: (e) => {
        if (hiddenCategories?.has(props.status)) return;
        (e.target as L.Path).setStyle({ fillOpacity: 0.6, weight: 3 });
      },
      mouseout: (e) => {
        if (hiddenCategories?.has(props.status)) return;
        (e.target as L.Path).setStyle({ fillOpacity: 0.35, weight: 2 });
      },
    });
  };

  // ─── Rich-body layer (Pallikaranai etc.) ─────────────────────────
  // Subtle indicator at default city zoom - dashed thin lighter emerald
  // so the rich-body bodies read as "interactive zones you can explore"
  // without competing visually with the regular OSM water polygons. The
  // line brightens + thickens on hover so the affordance is obvious when
  // the user moves over it. Fill stays transparent so OSM imagery shows
  // through and the polygon reads as a "frame" not a colored shape.
  const richBodyStyle = useCallback(() => ({
    color: "#34d399",       // emerald-400 (lighter than emerald-500)
    weight: 1.5,
    opacity: 0.7,
    fillColor: "#34d399",
    fillOpacity: 0,
    dashArray: "6 5",
    className: "rich-body-polygon",
  }), []);

  const onEachRichBody = (feature: Feature, layer: Layer) => {
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    const body_id = typeof props.body_id === "string" ? props.body_id : null;
    const name = typeof props.name === "string" ? props.name : "";
    const osm_id = typeof props.osm_id === "number" ? props.osm_id : 0;
    const name_ta = typeof props.name_ta === "string" ? props.name_ta : "";

    if (!suppressLayerTooltips && body_id) {
      const labelName = language === "ta" && name_ta ? name_ta : name;
      layer.bindTooltip(
        `<strong>${labelName}</strong><br/><span style="font-size:11px;color:#10b981">Click to explore boundary, encroachment, timeline →</span>`,
        { sticky: true }
      );
    }

    layer.on({
      click: (e) => {
        if (!body_id) return;
        const latlng: [number, number] = [e.latlng.lat, e.latlng.lng];
        onSelectCurrent({
          kind: "current",
          props: {
            osm_id,
            osm_type: "relation",
            name,
            name_ta,
            water_type: "wetland",
            area_ha: null,
          },
          latlng,
          richBodyId: body_id,
        });
      },
      mouseover: (e) => {
        (e.target as L.Path).setStyle({
          color: "#10b981",     // emerald-500, brighter on hover
          weight: 3,
          opacity: 1,
          fillOpacity: 0.08,
          dashArray: "",        // solid on hover so it pops
        });
      },
      mouseout: (e) => {
        (e.target as L.Path).setStyle({
          color: "#34d399",
          weight: 1.5,
          opacity: 0.7,
          fillOpacity: 0,
          dashArray: "6 5",
        });
      },
    });
  };

  const pointToLayer = (feature: Feature, latlng: L.LatLng) => {
    const props = feature.properties as LostWaterBodyProperties;
    const status = props.status as keyof typeof STATUS_COLORS;
    const color = STATUS_COLORS[status] || "#dc2626";
    // pointToLayer bypasses react-leaflet's Pane context: the circle
    // is constructed by Leaflet directly and lands in overlayPane
    // (z 400) by default, BEHIND the current-water-body polygons
    // ALSO in overlayPane. That's why a lost-body circle co-located
    // with a current polygon (e.g. Madurai's Sellur tank) was getting
    // its clicks intercepted. Setting `pane` here puts the circle in
    // the same z=540 pane the wrapping <Pane> element established.
    return L.circle(latlng, {
      radius: props.approx_radius_m,
      fillColor: color,
      color,
      weight: 2,
      fillOpacity: 0.35,
      opacity: 0.85,
      dashArray: "6, 4",
      pane: "lost-bodies-pane",
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
      {/* No FitToBounds here: the OSM water-body collection's extent
          includes far-flung outliers (Pulicat in the north for Chennai,
          Hesaraghatta in the west for Bengaluru) which pull the auto-fit
          well past the urban core and leave the city body unreadable.
          The city's pre-tuned center+zoom (mapCenter / mapZoom passed by
          the parent page) is the right frame for this map. The Reset
          button on the rich-body deep-zoom panel handles per-body
          fit-to-bounds where that *is* the right frame. */}
      {currentGeoJSON && (
        <GeoJSON
          ref={(layer) => { currentLayerRef.current = layer; }}
          key={`current-${viewMode}-${language}-${censusMatchByOsmId.size}-${tiles.url}-${suppressLayerTooltips}`}
          data={currentGeoJSON}
          style={currentStyle}
          onEachFeature={onEachCurrent}
        />
      )}
      {/* Lost-body markers in their own pane, well above overlayPane's
          400. We explicitly set pointerEvents:auto because some Leaflet
          builds don't inherit hit-testing into custom panes (a pane at
          z 450 can render visually on top while the polygon below it
          continues to win clicks - exactly the "Sellur tank circle is
          behind the polygon" symptom). */}
      {lostGeoJSON && (
        <Pane name="lost-bodies-pane" style={{ zIndex: 540, pointerEvents: "auto" }}>
          <GeoJSON
            ref={(layer) => { lostLayerRef.current = layer; }}
            key={`lost-${language}-${tiles.url}-${suppressLayerTooltips}`}
            data={lostGeoJSON}
            pointToLayer={pointToLayer}
            style={lostStyle}
            onEachFeature={onEachLost}
          />
        </Pane>
      )}
      {/* Rich-data bodies on the top pane so their clicks always win
          over lost-body circles / current-water-body polygons that may
          sit at the same lat/lon. */}
      {richBodiesGeoJSON && richBodiesGeoJSON.features.length > 0 && (
        <Pane name="rich-bodies-pane" style={{ zIndex: 560, pointerEvents: "auto" }}>
          <GeoJSON
            key={`rich-${language}-${tiles.url}`}
            data={richBodiesGeoJSON}
            style={richBodyStyle as L.StyleFunction}
            onEachFeature={onEachRichBody}
          />
        </Pane>
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
                    {!suppressLayerTooltips && (
                      <Tooltip sticky>
                        <strong>{name}</strong>
                        <br />
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          {type}
                          {wb.ownership ? ` · ${wb.ownership}` : ""}
                        </span>
                      </Tooltip>
                    )}
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
                    {!suppressLayerTooltips && (
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
                    )}
                  </Circle>
                );
              })}
        </LayerGroup>
      )}
      {/* Orphan scored bodies: flagship-curated entries that have no
          OSM polygon to color in restoration mode. We render them as
          Circles in a dedicated pane stacked above the polygon pane
          and the lost-bodies pane so they stay both visible AND
          clickable when their footprint overlaps a polygon (Madurai's
          flagship tanks are 100s of hectares - their circles often
          overlap smaller OSM polygons of nearby bodies).
          pointerEvents:auto is required for the same hit-testing
          reason as the lost-bodies pane comment above. */}
      {viewMode === "restoration" && orphanScored.length > 0 && (
        <Pane name="scored-orphans-pane" style={{ zIndex: 560, pointerEvents: "auto" }}>
          <LayerGroup>
            {orphanScored.filter((wb) => !hiddenCategories?.has(wb.priority_level)).map((wb) => {
              const color = getPriorityColor(wb.priority_level);
              const name = wb.name || t("wb_panel.unnamed");
              return (
                <Circle
                  key={wb.id}
                  center={wb.centroid}
                  radius={orphanRadius(wb.area_ha)}
                  pathOptions={{
                    fillColor: color,
                    color,
                    weight: 2,
                    fillOpacity: 0.55,
                    opacity: 0.95,
                    // Dashed stroke distinguishes "approximate" footprint
                    // (computed from area, no polygon) from precise OSM
                    // outlines.
                    dashArray: "4, 3",
                  }}
                  eventHandlers={{
                    click: () => {
                      onSelectCurrent({
                        kind: "scored",
                        scored: wb,
                        latlng: wb.centroid,
                      });
                    },
                  }}
                >
                  {!suppressLayerTooltips && (
                    <Tooltip sticky>
                      <strong>{name}</strong>
                      <br />
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        {t("lr.priority_score")}: {wb.priority_score} · {t(`lr.${wb.priority_level}`)}
                      </span>
                    </Tooltip>
                  )}
                </Circle>
              );
            })}
          </LayerGroup>
        </Pane>
      )}
      {children}
    </MapContainer>
  );
}
