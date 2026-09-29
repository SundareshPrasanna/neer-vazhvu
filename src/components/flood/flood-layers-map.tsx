"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, GeoJSON, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { FeatureCollection } from "geojson";
import type { PathOptions } from "leaflet";
import { BaseMap } from "@/components/map/base-map";
import { FitToBounds, geoJsonBounds, pointsBounds } from "@/components/map/fit-to-bounds";
import { ElevationBandsLayer } from "@/components/map/elevation-bands-layer";
import { fetchJsonOrNull } from "@/lib/data/fetch-json";
import type { FloodMapLayer } from "@/content/flood/types";

type Props = Record<string, unknown>;
interface Point { id: string; lat: number; lng: number; row: number; props: Props }

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
const SMALL = { fontSize: "11px" };
const MUTED = { fontSize: "11px", color: "#64748b" };
const NOTE = { fontSize: "10px", color: "#94a3b8", fontStyle: "italic" };

/** Point features as plain markers: CircleMarkers rendered straight off a
 *  FeatureCollection never painted. A categorised layer keeps its rows' categories. */
function toPoints(fc: FeatureCollection, l: FloodMapLayer, li: number): Point[] {
  const out: Point[] = [];
  (fc.features ?? []).forEach((f, i) => {
    if (f?.geometry?.type !== "Point") return;
    const c = f.geometry.coordinates;
    const lng = Number(c?.[0]);
    const lat = Number(c?.[1]);
    if (!Array.isArray(c) || c.length < 2 || !Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const props = (f.properties ?? {}) as Props;
    const row = l.categoryProp ? l.rows.findIndex((r) => r.value === props[l.categoryProp!]) : 0;
    if (row >= 0) out.push({ id: `${li}-${i}`, lat, lng, row, props });
  });
  return out;
}

function PointLabel({ l, p, popup = false }: { l: FloodMapLayer; p: Props; popup?: boolean }) {
  const suffix = l.suffix && p[l.suffix.prop];
  return (
    <>
      <strong>{String(p[l.nameProp ?? "name"] || l.nameFallback)}</strong>
      {suffix ? <span style={SMALL}>{l.suffix!.prefix}{String(suffix)}</span> : null}
      {l.lines?.map((ln) =>
        ln.always || p[ln.prop] ? (
          <Fragment key={ln.prop}>
            <br />
            <span style={ln.muted ? MUTED : SMALL}>{ln.prefix}{String(p[ln.prop] ?? "")}</span>
          </Fragment>
        ) : null,
      )}
      {popup && l.popupNote && (
        <>
          <br />
          <span style={NOTE}>{l.popupNote}</span>
        </>
      )}
    </>
  );
}

/** The layers of a FloodMapSpec over base tiles and the elevation bands. */
export function FloodLayersMap({
  center,
  zoom,
  layers,
  checked,
  elevationData,
}: {
  center: [number, number];
  zoom: number;
  layers: FloodMapLayer[];
  /** Per layer, per row: is the row's checkbox on. */
  checked: boolean[][];
  elevationData: FeatureCollection | null;
}) {
  const [data, setData] = useState<Record<number, FeatureCollection>>({});
  const requested = useRef(new Set<number>());
  const shown = (li: number) => checked[li].some(Boolean);

  useEffect(() => {
    layers.forEach((l, li) => {
      if (requested.current.has(li) || !checked[li].some(Boolean)) return;
      requested.current.add(li);
      fetchJsonOrNull<FeatureCollection>(l.url)
        .catch(() => null)
        .then((fc) => setData((d) => ({ ...d, [li]: fc ?? EMPTY })));
    });
  }, [layers, checked]);

  const points = useMemo(
    () => layers.map((l, li) => (l.kind === "point" && data[li] ? toPoints(data[li], l, li) : [])),
    [layers, data],
  );
  const lineStyles = useMemo(
    () => layers.map((l): PathOptions => ({ color: l.style.color, weight: l.style.weight, opacity: l.style.opacity ?? 1 })),
    [layers],
  );

  const order = layers.map((_, li) => li).reverse();
  const visible = points.map((ps, li) => ps.filter((p) => checked[li][p.row]));
  const pointLayers = order.filter((li) => layers[li].kind === "point");
  const lineLayers = order.filter((li) => layers[li].kind === "line");
  const fitLayers = layers.map((_, li) => li).filter((li) => layers[li].fit);
  const shownPoints = pointLayers.flatMap((li) => visible[li]);
  const fitLine = fitLayers.find(shown);
  const bounds = shownPoints.length
    ? pointsBounds(shownPoints.map((p) => [p.lat, p.lng] as [number, number]))
    : fitLine != null
      ? geoJsonBounds(data[fitLine] ?? null)
      : null;
  const counts = layers.flatMap((l, li) => (l.kind === "point" ? [visible[li].length] : []));
  const resetKey = `${counts.join(":")}|${fitLayers.map((li) => (data[li] ? 1 : 0)).join("")}`;

  return (
    <BaseMap center={center} zoom={zoom} scrollWheelZoom>
      <ElevationBandsLayer data={elevationData} />
      <FitToBounds bounds={bounds} resetKey={resetKey} maxZoom={12} />
      {lineLayers.map((li) => {
        const l = layers[li];
        if (!data[li] || !shown(li)) return null;
        return (
          <GeoJSON
            key={l.url}
            data={data[li]}
            style={lineStyles[li]}
            onEachFeature={(f, layer) => {
              const name = (l.nameProp && f.properties?.[l.nameProp]) || l.nameFallback;
              if (name) layer.bindTooltip(String(name), { sticky: true });
            }}
          />
        );
      })}
      {pointLayers.map((li) => {
        const l = layers[li];
        return visible[li].map((p) => {
          const r = l.rows[p.row];
          return (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={r.radius ?? l.style.radius ?? 6}
              pathOptions={{
                color: l.style.color,
                weight: l.style.weight,
                fillColor: r.fillColor ?? l.style.fillColor,
                fillOpacity: l.style.fillOpacity,
              }}
            >
              <Tooltip>
                <PointLabel l={l} p={p.props} />
              </Tooltip>
              {/* Tooltips are hover-only; on phones a tap must open something. */}
              {l.popup && (
                <Popup>
                  <PointLabel l={l} p={p.props} popup />
                </Popup>
              )}
            </CircleMarker>
          );
        });
      })}
    </BaseMap>
  );
}
