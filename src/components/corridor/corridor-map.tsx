"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapResizer } from "@/components/map-resizer";
import { FitToBounds, geoJsonBounds } from "@/components/map/fit-to-bounds";
import { MapInfoButton } from "@/components/map/map-info-button";
import { useMapTiles } from "@/lib/utils/map-tiles";
import type { CorridorManifest } from "@/lib/corridors";
import {
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  categoryColor,
  strokeDashFor,
  type AssessmentCategory,
} from "./classification";

// Bump when the corridor geojson files are regenerated (cache-buster).
const GEO_VERSION = 1;

type UnitView = "firka" | "taluk";

interface CorridorMapProps {
  manifest: CorridorManifest;
}

/**
 * The corridor headline map: CGWB's own assessment-unit (firka) polygons
 * colored by the latest classification, with the taluk view (what official
 * tables show) as a deliberate toggle pair (DECISIONS.md D12a), and SIPCOT
 * park outlines overlaid. Geometry and categories come pre-joined from
 * scripts/build_corridor_sriperumbudur.py; nothing is computed client-side.
 */
export function CorridorMap({ manifest }: CorridorMapProps) {
  const tiles = useMapTiles();
  const [view, setView] = useState<UnitView>("firka");
  const [firkas, setFirkas] = useState<FeatureCollection | null>(null);
  const [taluks, setTaluks] = useState<FeatureCollection | null>(null);
  const [parks, setParks] = useState<FeatureCollection | null>(null);

  const base = `/data/corridors/${manifest.corridorId}`;
  useEffect(() => {
    let cancelled = false;
    async function load(name: string, set: (fc: FeatureCollection) => void) {
      try {
        const res = await fetch(`${base}/${name}?v=${GEO_VERSION}`);
        if (!res.ok) return;
        const fc = (await res.json()) as FeatureCollection;
        if (!cancelled) set(fc);
      } catch {
        // Layer stays off; the table below the map still carries the data.
      }
    }
    load("assessment-firkas.geojson", setFirkas);
    load("assessment-taluks.geojson", setTaluks);
    load("parks.geojson", setParks);
    return () => {
      cancelled = true;
    };
  }, [base]);

  const ed = manifest.latestEdition;
  const active = view === "firka" ? firkas : taluks;
  const bounds = useMemo(
    () => (active ? geoJsonBounds(active) : null),
    [active],
  );

  const unitStyle = (feature?: Feature): PathOptions => {
    const cat = (feature?.properties as Record<string, unknown> | undefined)?.[
      `category_${ed}`
    ] as string | null;
    return {
      fillColor: categoryColor(cat, tiles.isDark),
      fillOpacity: 0.55,
      color: tiles.isDark ? "#0f172a" : "#ffffff",
      weight: 1,
      dashArray: strokeDashFor(cat as AssessmentCategory | null),
    };
  };

  const parkStyle: PathOptions = {
    fillColor: tiles.isDark ? "#e2e8f0" : "#0f172a",
    fillOpacity: 0.08,
    color: tiles.isDark ? "#e2e8f0" : "#0f172a",
    weight: 2,
  };

  const onEachUnit = (feature: Feature, layer: Layer) => {
    const p = (feature.properties ?? {}) as Record<string, unknown>;
    const cat = p[`category_${ed}`] as string | null;
    const label = cat
      ? CATEGORY_LABELS[cat as AssessmentCategory] ?? cat
      : "No published category";
    const name = view === "firka" ? `${p.firka} firka, ${titleCase(String(p.taluk))} taluk` : `${titleCase(String(p.taluk))} taluk, ${p.district} district`;
    const stage =
      view === "taluk" && typeof p[`stage_pct_${ed}`] === "number"
        ? `<br/>Stage of extraction: ${p[`stage_pct_${ed}`]}% (${ed} edition)`
        : "";
    const firkaNote =
      view === "firka"
        ? "<br/><span style='opacity:.75'>Stage % is published at taluk level; toggle to the taluk view.</span>"
        : "";
    layer.bindTooltip(
      `<strong>${name}</strong><br/>${label} (${ed} assessment)${stage}${firkaNote}`,
      { sticky: true },
    );
  };

  const onEachPark = (feature: Feature, layer: Layer) => {
    const p = (feature.properties ?? {}) as Record<string, unknown>;
    const water = p.water_note
      ? `<br/><span style='opacity:.85'>${p.water_note}</span><br/><span style='opacity:.65'>Source: ${p.water_source_label}</span>`
      : "<br/><span style='opacity:.65'>No known public water-source statement for this estate.</span>";
    layer.bindTooltip(
      `<strong>${p.name}</strong><br/>Boundary: SIPCOT GIS (retrieved ${p.retrieved})${water}`,
      { sticky: true },
    );
  };

  return (
    <div className="relative h-[460px] sm:h-[540px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
      <MapContainer
        center={manifest.center}
        zoom={manifest.zoom}
        className="h-full w-full"
        scrollWheelZoom={false}
      >
        <MapResizer />
        <TileLayer url={tiles.url} attribution={tiles.attribution} />
        <FitToBounds bounds={bounds} resetKey={view} padding={[24, 24]} />
        {active && (
          <GeoJSON
            key={`${view}-${tiles.isDark ? "d" : "l"}`}
            data={active}
            style={unitStyle}
            onEachFeature={onEachUnit}
          />
        )}
        {parks && (
          <GeoJSON
            key={`parks-${tiles.isDark ? "d" : "l"}`}
            data={parks}
            style={() => parkStyle}
            onEachFeature={onEachPark}
          />
        )}
      </MapContainer>

      {/* View toggle: the firka/taluk pair is the page's core argument. */}
      <div className="absolute top-3 left-3 z-[1000] flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 shadow-lg text-xs font-medium">
        <button
          onClick={() => setView("firka")}
          className={`px-3 py-1.5 ${view === "firka" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}
          aria-pressed={view === "firka"}
        >
          Firka view
        </button>
        <button
          onClick={() => setView("taluk")}
          className={`px-3 py-1.5 ${view === "taluk" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}
          aria-pressed={view === "taluk"}
        >
          Taluk view
        </button>
      </div>

      {/* Legend: labels always paired with color; dashed samples mirror the
          stroke encoding so the scale never rides on hue alone. */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 dark:bg-slate-800/95 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3 space-y-1">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          CGWB classification, {ed} assessment
        </h4>
        {CATEGORY_ORDER.map((cat) => (
          <div key={cat} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span
              className="w-4 h-3 rounded-sm flex-shrink-0 border"
              style={{
                backgroundColor: categoryColor(cat, tiles.isDark),
                borderStyle: strokeDashFor(cat) ? "dashed" : "solid",
                borderColor: tiles.isDark ? "#0f172a" : "#ffffff",
              }}
            />
            {CATEGORY_LABELS[cat]}
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-slate-700">
          <span className="w-4 h-3 flex-shrink-0 border-2" style={{ borderColor: tiles.isDark ? "#e2e8f0" : "#0f172a" }} />
          Industrial park boundary
        </div>
      </div>

      <MapInfoButton className="absolute top-3 right-3 z-[1000]">
        <div className="space-y-2 text-xs">
          <p className="font-semibold">Sources and method</p>
          <p>
            Classification and unit geometry: Dynamic Ground Water Resource
            Assessment (CGWB and TN SG&amp;SWRDC), {ed} edition, served by
            IN-GRES (ingres.iith.ac.in). Firka polygons are CGWB&apos;s own
            assessment-unit geometry, joined by unit uuid; no boundary was
            drawn or interpolated by us.
          </p>
          <p>
            Park boundaries: SIPCOT GIS (sipcotgis.tn.gov.in), Government of
            Tamil Nadu, outer boundaries only. The mapped extent can exceed the
            notified saleable area.
          </p>
          <p>
            Stage of extraction is published at taluk level from the 2023
            edition onward; firka rows carry the classification. The full
            method and every source line: see the methodology section below
            the map.
          </p>
        </div>
      </MapInfoButton>
    </div>
  );
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
