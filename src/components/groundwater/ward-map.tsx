"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip, useMap, Pane } from "react-leaflet";
import { MapResizer } from "@/components/map-resizer";
import L from "leaflet";
import type { Layer, LeafletMouseEvent } from "leaflet";
import type { Feature } from "geojson";
import { getGroundwaterColor, getGroundwaterStatus, getRiskColor, getBlockClassColor } from "@/types/groundwater";
import type { GroundwaterWard, WardRiskData, ViewMode, GWBlock, GWStation, WrisStation, CgwbStation } from "@/types/groundwater";
import { useLanguage } from "@/lib/i18n/context";
import { getWardGeoJSON } from "@/lib/data/ward-geo";
import { CorporationBoundaries } from "@/components/map/corporation-boundaries";
import { tryGetPlaceConfig } from "@/lib/cities";
import { useMapTiles } from "@/lib/utils/map-tiles";
import { districtsAsBlocks } from "@/lib/groundwater/districts-as-blocks";
import { SelectedWardHighlight } from "@/components/map/selected-ward-highlight";
import { FitToBounds, geoJsonBounds } from "@/components/map/fit-to-bounds";
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
      const num = Number(f.properties?.ward_number ?? f.properties?.Ward_No ?? f.properties?.ward_no);
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
  /** CGWB Year Book stations (quarterly, peer-reviewed). Rendered as a
   *  parallel point overlay alongside (or instead of) the WRIS live
   *  station network. Used today by Madurai. */
  cgwbStations?: CgwbStation[];
  selectedCgwbStationName?: string | null;
  onCgwbStationSelect?: (station: CgwbStation | null) => void;
  hiddenCategories?: Set<string>;
  // City-aware overrides; default to Chennai's paths for backward compat.
  blockGeoJsonUrl?: string;
  blocksJsonUrl?: string;
  stationsJsonUrl?: string;
  wardGeoJsonUrl?: string;
  mapCenter?: [number, number];
  mapZoom?: number;
  /** Place id, used to overlay corporation boundaries for region places. */
  cityId?: string;
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
  cgwbStations,
  selectedCgwbStationName,
  onCgwbStationSelect,
  hiddenCategories,
  blockGeoJsonUrl = DEFAULT_BLOCK_GEOJSON_URL,
  blocksJsonUrl = DEFAULT_BLOCKS_JSON_URL,
  stationsJsonUrl = DEFAULT_STATIONS_JSON_URL,
  wardGeoJsonUrl = DEFAULT_WARDS_GEOJSON_URL,
  mapCenter = DEFAULT_MAP_CENTER,
  mapZoom = 11,
  cityId,
}: WardMapProps) {
  const { t, language } = useLanguage();
  const tiles = useMapTiles();
  const [wardGeoJSON, setWardGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const [blockGeoJSON, setBlockGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  // Whether the block-geojson fetch has settled (resolved OR 404'd). Cities
  // excluded from the CGWB block assessment (Mumbai) legitimately have no
  // block layer, so the loading overlay must key off "fetch done", not
  // "blockGeoJSON is non-null" - otherwise it hangs forever on a null layer.
  const [blockGeoResolved, setBlockGeoResolved] = useState(false);
  const [blocks, setBlocks] = useState<GWBlock[]>([]);
  const [stations, setStations] = useState<GWStation[]>([]);

  useEffect(() => {
    getWardGeoJSON(wardGeoJsonUrl)
      .then(setWardGeoJSON)
      .catch(console.error);

    // Guard r.ok on the block layers too: cities excluded from the CGWB
    // block assessment (Mumbai) or without a curated blocks file ship no
    // gwr-blocks geojson/json, and parsing the 404 HTML error page as JSON
    // throws a SyntaxError that leaves the map stuck loading.
    fetch(blockGeoJsonUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then(setBlockGeoJSON)
      .catch(console.error)
      .finally(() => setBlockGeoResolved(true));

    // Same adapter the groundwater client uses. This component fetches its own
    // copy of the blocks file rather than taking a prop, so fixing the client
    // alone left the CHOROPLETH still reading an empty array - Gurugram drew
    // six polygons in the "no data" grey while the page title and legend, which
    // read the client's copy, said the data was there.
    fetch(blocksJsonUrl)
      .then((r) => (r.ok ? r.json() : { blocks: [] }))
      .then((d) => setBlocks(districtsAsBlocks(d)))
      .catch(console.error);

    // Static gw-stations.json is Chennai's fallback metadata bundle;
    // Bangalore has no equivalent file (live WRIS readings come through
    // the wrisStations prop instead). Guard r.ok so a 404 doesn't try to
    // parse the Next.js HTML error page as JSON.
    fetch(stationsJsonUrl)
      .then((r) => (r.ok ? r.json() : { stations: [] }))
      .then((d) => setStations(d.stations ?? []))
      .catch(() => setStations([]));
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
    const wardNum = Number(feature.properties?.ward_number ?? feature.properties?.Ward_No ?? feature.properties?.ward_no);
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
    // A ward with no data shouldn't paint a solid grey block - that reads as
    // "measured", not "absent". Render it as a faint outline instead. This is
    // the normal state for a CGWB-stations-only city (Mumbai), where the wells
    // carry the data and the ward layer is just spatial context.
    const noData = category === "noData";
    const fillOpacity = isHidden ? 0.05 : noData ? 0.06 : 0.75;
    return { fillColor, weight: 1, opacity: isHidden ? 0.1 : 0.7, color: tiles.stroke, fillOpacity };
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
    const wardNum = Number(feature.properties?.ward_number ?? feature.properties?.Ward_No ?? feature.properties?.ward_no);
    const ward = groundwaterData.get(wardNum);
    const risk = riskData.get(wardNum);

    const zoneName = feature.properties?.Zone_Name || feature.properties?.zone_name || feature.properties?.corporation || ward?.zone || "";
    const wardName = String(
      feature.properties?.ward_name ?? feature.properties?.Ward_Name ?? ward?.wardName ?? `Ward ${wardNum}`,
    );
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

    // Build a synthetic ward when we don't have depth data (Bangalore
    // groundwaterViews.depth=false, so groundwaterData is empty) but
    // we still want clicks on the risk choropleth to surface the
    // ward detail panel. The panel handles depthM=null cleanly.
    const wardForPanel: GroundwaterWard | null =
      ward ??
      (risk
        ? {
            wardNumber: wardNum,
            wardName,
            zone: zoneName || "",
            depthM: null,
            trend: "unknown",
          }
        : null);

    layer.on({
      click: () => { onWardSelect(wardForPanel); },
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

  // Show a tiny non-blocking overlay while the relevant layer for the
  // current viewMode is still loading. Crucially, we DO NOT unmount the
  // MapContainer here - if the user switches viewMode while one layer
  // hasn't finished loading, unmounting + remounting the MapContainer
  // resets Leaflet's internal zoom/center to the initial mapZoom prop,
  // which is what caused the "zoom jumps when switching tabs" bug.
  const layerLoading =
    viewMode === "exploitation"
      ? !blockGeoJSON && !blockGeoResolved
      : !wardGeoJSON;

  // Fit to the ward layer extended to include the CGWB station points, so a
  // region's wells (e.g. the MMR's Thane/Palghar/Raigad stations beyond the BMC
  // wards) are in frame. No-op where the stations sit within the wards.
  const stationFitBounds = useMemo(() => {
    const wb = geoJsonBounds(wardGeoJSON);
    if (!cgwbStations || cgwbStations.length === 0) return wb;
    const b = L.latLngBounds([]);
    if (wb) b.extend(wb as L.LatLngBoundsExpression);
    for (const s of cgwbStations) {
      if (s.lat != null && s.lng != null) b.extend([s.lat, s.lng]);
    }
    return b.isValid() ? b : wb;
  }, [wardGeoJSON, cgwbStations]);

  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      className="h-full w-full"
      scrollWheelZoom={true}
    >
      {layerLoading && (
        <div className="absolute inset-0 z-[600] bg-slate-100/40 dark:bg-slate-800/40 flex items-center justify-center pointer-events-none">
          <span className="text-slate-500 dark:text-slate-400 text-sm">{t("common.loading_map")}</span>
        </div>
      )}
      <MapResizer />
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      {/* Region places (the MMR) overlay their corporation boundaries as
          context. No-op for single-city places / when cityId is absent. */}
      {cityId && tryGetPlaceConfig(cityId)?.placeKind === "region" && (
        <CorporationBoundaries cityId={cityId} />
      )}
      {/* Fit the map to the active layer's extent. Refires when viewMode
          flips (block extent vs full ward extent can be very different,
          especially in Bangalore where 369 GBA wards span ~800 km² but
          GWR blocks are a compact subset). */}
      <FitToBounds
        bounds={
          viewMode === "exploitation"
            ? geoJsonBounds(blockGeoJSON)
            : stationFitBounds
        }
        resetKey={viewMode}
        maxZoom={12}
      />
      {flyToWard && <FlyToWard wardNumber={flyToWard} wardGeoJsonUrl={wardGeoJsonUrl} />}

      {viewMode === "exploitation" ? (
        <>
          {blockGeoJSON && (
            <GeoJSON ref={(layer) => { blockLayerRef.current = layer; }} key={`blocks-${tiles.url}`} data={blockGeoJSON} style={blockStyle} onEachFeature={onEachBlock} />
          )}
          {/* When the page passes live WRIS readings, render them as rich
              colored markers (depth + quality flag). Otherwise fall back to
              the basic static-metadata blue dots. This lights up Madurai's
              exploitation view with live data while leaving Chennai's
              behaviour intact when wrisStations is empty.
              Render inside a custom Pane with z-index above the
              overlayPane (400) so the GeoJSON re-mount on viewMode toggle
              doesn't push the choropleth fill above the markers. */}
          <Pane name="wris-stations-pane" style={{ zIndex: 450 }}>
          {wrisStations && wrisStations.length > 0
            ? wrisStations.map((s) => {
                if (s.latitude == null || s.longitude == null) return null;
                if (s.dataQualityFlag === "stuck" && hiddenCategories?.has("wris_stuck")) return null;
                if (s.dataQualityFlag === "stale" && hiddenCategories?.has("wris_stale")) return null;
                const depth = Math.abs(s.latestDepthM);
                const isSelected = selectedWrisStationCode === s.stationCode;
                const isSuspect = s.dataQualityFlag === "stuck" || s.dataQualityFlag === "stale";
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
                    radius={isSelected ? 7 : 5}
                    pathOptions={{
                      fillColor,
                      color: borderColor,
                      weight: isSelected ? 2.5 : 1.5,
                      fillOpacity: isSuspect ? 0.55 : 0.9,
                      dashArray: s.dataQualityFlag === "stuck" ? "2 3" : undefined,
                    }}
                    eventHandlers={{
                      click: () => onWrisStationSelect?.(s),
                    }}
                  >
                    <Tooltip pane="tooltipPane">
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
                    </Tooltip>
                  </CircleMarker>
                );
              })
            : stations.map((s) => (
                <CircleMarker
                  key={s.station_code}
                  center={[s.lat, s.lng]}
                  radius={4}
                  pathOptions={{ fillColor: "#3b82f6", color: "#1e3a5f", weight: 1, fillOpacity: 0.8 }}
                >
                  <Tooltip pane="tooltipPane">
                    <strong>{s.name}</strong>
                    <br />
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      {s.agency} - {t("gw_block.stations")}
                    </span>
                  </Tooltip>
                </CircleMarker>
              ))}
          {/* CGWB Year Book stations - quarterly peer-reviewed point
              readings, used today by Madurai. Rendered with depth-coloured
              fill and a dashed stroke so they're visually distinct from
              the WRIS live network (solid stroke). The latest reading is
              the marker's depth signal. */}
          {cgwbStations && cgwbStations.length > 0 && cgwbStations.map((s, i) => {
            const sorted = [...s.readings].sort(
              (a, b) => (a.year * 100 + a.month) - (b.year * 100 + b.month),
            );
            const latest = sorted[sorted.length - 1];
            if (!latest) return null;
            const depth = latest.depth_m_bgl;
            // A reading that carries no usable depth is SKIPPED, not rendered
            // with a crash. `depth.toFixed(2)` took the whole groundwater page
            // down when a producer emitted readings in a shape this map does
            // not read; the artifact was wrong, but one bad well should cost
            // that well, not the page.
            if (typeof depth !== "number" || Number.isNaN(depth)) return null;
            const isSelected = selectedCgwbStationName === s.name;
            const fillColor = getGroundwaterColor(depth);
            return (
              <CircleMarker
                // name+lat+lng is NOT unique: WRIS issues separate station
                // codes for co-located piezometers, so Kolkata ships two
                // 'Jafarpur_1' wells at 22.6736,88.7933 (codes ...501/...502)
                // and React saw a duplicate key. Prefer the station code,
                // which is unique per well; fall back to the index for the
                // transcribed Year-Book cities that carry no code.
                key={s.station_code ?? `cgwb-${s.name}-${s.lat}-${s.lng}-${i}`}
                center={[s.lat, s.lng]}
                radius={isSelected ? 7 : 5}
                pathOptions={{
                  fillColor,
                  color: isSelected ? "#0c4a6e" : "#1e293b",
                  weight: isSelected ? 2.5 : 1.5,
                  fillOpacity: 0.9,
                  dashArray: "1 2",
                }}
                eventHandlers={{
                  click: () => onCgwbStationSelect?.(s),
                }}
              >
                <Tooltip pane="tooltipPane">
                  <strong>{s.name}</strong>
                  <br />
                  <span style={{ fontSize: "11px" }}>
                    {depth.toFixed(2)}m below ground
                  </span>
                  <br />
                  <span style={{ fontSize: "10px", color: "#64748b" }}>
                    CGWB Year Book - {s.block} block - {sorted.length} quarterly readings
                  </span>
                </Tooltip>
              </CircleMarker>
            );
          })}
          </Pane>
        </>
      ) : (
        <>
          {/* District outline (union of GWR blocks) drawn as a faint
              stroke-only background. The ward choropleth covers the city
              core; the district outline shows the full data scope so
              stations 30-60 km out (in rural blocks like Sedapatti,
              Tirumangalam, Melur) read as inside the district rather
              than "off the map". Cities where city == district (Chennai)
              just see a redundant outline; harmless. */}
          {blockGeoJSON && (
            <GeoJSON
              key={`district-outline-${tiles.url}`}
              data={blockGeoJSON}
              style={{
                fillOpacity: 0,
                color: tiles.stroke,
                weight: 1,
                opacity: 0.45,
                dashArray: "4 4",
              }}
              interactive={false}
            />
          )}
          {wardGeoJSON && (
            <GeoJSON ref={(layer) => { wardLayerRef.current = layer; }} key={`${viewMode}-${tiles.url}`} data={wardGeoJSON} style={wardStyle} onEachFeature={onEachWard} />
          )}
          {/* key includes viewMode so highlight remounts on top after choropleth remounts */}
          <SelectedWardHighlight key={`highlight-${viewMode}`} wardNumber={selectedWardNumber ?? null} wardGeoJsonUrl={wardGeoJsonUrl} />

          {/* Live CGWB stations overlay (India WRIS) - only on depth view.
              Wrapped in a custom Pane (z-index above overlayPane) so the
              ward choropleth fill never hides the markers. */}
          <Pane name="wris-stations-pane-depth" style={{ zIndex: 450 }}>
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
                <Tooltip pane="tooltipPane">
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
          </Pane>
        </>
      )}
    </MapContainer>
  );
}
