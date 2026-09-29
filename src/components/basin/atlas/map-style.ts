import L from "leaflet";
import type { Feature } from "geojson";
import type { PathOptions } from "leaflet";
import { prsMapColor } from "@/lib/basins/panel-labels";
import type { BasinLayer, BasinManifest } from "@/lib/basins";
import type { MapMatch } from "@/lib/basins/panel-types";

// How each layer draws on the atlas canvas: draw order, styles, highlight matching and gap-badge geometry.

// Outer rings of a (Multi)Polygon, so each gap part can be badged separately.
export function polygonOuterRings(geom: Feature["geometry"] | null | undefined): [number, number][][] {
  if (!geom) return [];
  if (geom.type === "Polygon") return [geom.coordinates[0] as [number, number][]];
  if (geom.type === "MultiPolygon") return geom.coordinates.map((poly) => poly[0] as [number, number][]);
  return [];
}
// Min bbox area (deg²) for a detached gap part to earn its own badge: includes
// the ~0.36 km² Harohalli/Kaggalahalli exclave, excludes hair-thin slivers.
export const GAP_BADGE_MIN_AREA = 1.2e-5;

/** Draw order on the shared canvas (lower = drawn first = underneath). Base
 *  outlines and sub-catchments sit below thematic fills, lines, and points so
 *  the layers on top receive hover/click, not the catchment beneath them. */
export function drawRank(l: BasinLayer): number {
  if (l.elevation) return -2; // terrain underneath everything, even the gap choropleth
  if (l.gap) return -1; // gap choropleth at the very bottom - all data (incl. STPs) sits above it
  if (l.prs) return 5; // polluted stretch always on top so the thin line stays clickable
  // Below the basin boundary, always: as an ordinary fill it painted the
  // out-of-state shade OVER the boundary line, and the shared edge read as a
  // separate polygon abutting the basin (Madhuri, 31 Aug).
  if (l.family === "context-boundary") return -0.5;
  if (l.family === "boundary" || l.family.startsWith("admin")) return 0;
  if (l.family === "sub-hydrosheds") return 1;
  if (l.geom === "fill") return 2;
  if (l.geom === "line") return 3;
  return 4; // point
}

/** Short, single-line hover label; full detail lives in the click panel. */
export function tipLabel(p: Record<string, unknown>, l: BasinLayer): string {
  if (String(p.kind) === "industrial-area-other") return "Industrial area (unnamed) - no effluent details";
  const kind = p.kind ? String(p.kind).replace(/-/g, " ") : "";
  const raw = String(p.name ?? p.contributor ?? kind ?? l.label).trim() || l.label;
  return raw.length > 46 ? `${raw.slice(0, 46)}…` : raw;
}

/** Admin tooltip: the unit and its place in the hierarchy, e.g.
 *  "Haragadde (gp) - Kanakapura taluk - Ramanagara". */
export function adminTip(p: Record<string, unknown>): string {
  const name = String(p.name ?? "").trim();
  const level = String(p.level ?? "").trim();
  const parts = [level ? `${name} (${level})` : name];
  if (p.parentTaluk) parts.push(`${String(p.parentTaluk)} taluk`);
  if (p.parentDistrict) parts.push(String(p.parentDistrict));
  return parts.join(" - ");
}

export function pressurePointStyle(feat: Feature | undefined, faded: boolean): L.CircleMarkerOptions {
  const kind = String((feat?.properties as Record<string, unknown>)?.kind ?? "");
  const c = PRESSURE_KIND_COLOR[kind] ?? "#b91c1c";
  return { radius: 5, color: c, weight: 1.5, fillColor: c, fillOpacity: faded ? 0.3 : 0.85, opacity: faded ? 0.5 : 1 };
}

// Sub-catchments are dashed INDIGO outlines - a hue absent from the OSM
// basemap (which draws its own admin boundaries in grey/white), so they read
// as ours, not the basemap's. Outline-only (no fill) avoids the darkening
// where catchments meet; the interior stays clickable under canvas. The
// selected catchment pops in amber with a faint highlight fill.
export function shedStyle(feat: Feature | undefined, selectedSheds: Set<string>, faded: boolean, color: string): PathOptions {
  const sid = String((feat?.properties as Record<string, unknown>)?.shedId ?? "");
  const sel = selectedSheds.has(sid);
  return {
    color: sel ? SELECTED_SHED_COLOR : color,
    weight: sel ? 2.5 : 1.4,
    dashArray: sel ? undefined : "5 4",
    opacity: sel ? 0.95 : faded ? 0.45 : 0.8,
    fill: sel,
    fillColor: SELECTED_SHED_COLOR,
    fillOpacity: sel ? 0.08 : 0,
  };
}

export function lineStyle(l: BasinLayer, feat: Feature | undefined, manifest: BasinManifest, selectedRiverId: string | null, faded: boolean, showGrowth = false, prsYears: number[] = []): PathOptions {
  if (l.prs) {
    const yr = Number((feat?.properties as Record<string, unknown>)?.year);
    if (showGrowth && prsYears.length > 1) {
      // Growth view: each older reach is drawn LAST (on top) and thicker, so
      // it fully covers the newer line beneath it on the length they share.
      // A newer band therefore shows only where the stretch EXTENDED.
      const fromNewest = Math.max(prsYears.length - 1 - prsYears.indexOf(yr), 0);
      return { color: prsMapColor(fromNewest), weight: 4 + fromNewest * 4, opacity: fromNewest ? 1 : 0.95 };
    }
    // Default: just the current (latest) stretch, red.
    return { color: "#dc2626", weight: 5, opacity: faded ? 0.5 : 0.95 };
  }
  if (l.family === "context-rivers") {
    // Heavier than the in-basin course, not lighter: this is the reach a
    // reader is being asked to notice, and a pale hairline read as a minor
    // stream against the basemap.
    return { color: l.color, weight: 3, dashArray: "7 4", opacity: faded ? 0.55 : 1 };
  }
  if (l.family === "context-streams") {
    // The Kerala tributary skeleton: visibly a level below the mainstem
    // context line, so the reservoirs read as ON rivers without the
    // headwaters shouting over the subject.
    return { color: l.color, weight: 1.25, dashArray: "4 4", opacity: faded ? 0.4 : 0.7 };
  }
  if (l.family === "prs-drains") {
    // The drains feeding the polluted stretch. Weight-1 amber vanished into
    // the basemap's orange roads (Madhuri, 31 Aug); these are the lines the
    // outfall dots exist to explain, so they draw like it.
    return { color: l.color, weight: 3, opacity: faded ? 0.5 : 0.95 };
  }
  if (l.family === "rivers") {
    const rprops = feat?.properties as Record<string, unknown>;
    const rid = String(rprops?.riverId ?? rprops?.river_id ?? "");
    const r = manifest.rivers.find((x) => x.riverId === rid);
    const sel = rid === selectedRiverId;
    return { color: r?.color ?? l.color, weight: sel ? 5 : 3, opacity: sel || !selectedRiverId ? 1 : 0.75 };
  }
  if (l.classes) {
    // Classed lines (a canal network): colour by class, and the first class listed draws heaviest.
    const v = String((feat?.properties as Record<string, unknown> | undefined)?.[l.classes.prop] ?? "");
    const rank = Math.max(l.classes.rows.findIndex((r) => r.value === v), 0);
    return { color: classColor(l, feat), weight: rank === 0 ? 2.5 : rank === 1 ? 1.6 : 1, opacity: faded ? 0.4 : 0.9, fill: false };
  }
  // fill: false matters when a polygon family is routed through the line
  // path - Leaflet's default otherwise fills it, tinting the whole shape.
  return { color: l.color, weight: 1, opacity: faded ? 0.4 : 0.85, fill: false };
}

/** A classed layer's colour for this feature (see BasinLayer.classes), else the layer colour. */
function classColor(l: BasinLayer, feat: Feature | undefined): string {
  if (!l.classes) return l.color;
  const v = String((feat?.properties as Record<string, unknown> | undefined)?.[l.classes.prop] ?? "");
  return l.classes.rows.find((r) => r.value === v)?.color ?? l.color;
}

export function pointStyle(l: BasinLayer, feat: Feature | undefined, faded: boolean): L.CircleMarkerOptions {
  const p = (feat?.properties ?? {}) as Record<string, unknown>;
  const color = classColor(l, feat);
  // Hollow marks a station you cannot read here today, but the cue is keyed
  // per layer type: a readings layer goes hollow when no readings pack is
  // attached (solid promises a chart on tap - see the tap gate on
  // StationReadingsPanel), a non-readings monitoring layer when the station's
  // data is not in the public domain. Treatment plants never reach here -
  // they render as shaped markers (treatmentIcon) that carry their own
  // solid/hollow status convention.
  const hollow = l.readings
    ? p.hasReadings !== true
    : l.family === "monitoring-points" && String(p.publicDomain ?? "").toUpperCase() !== "YES";
  return {
    radius: 5,
    color,
    weight: 1.5,
    fillColor: hollow ? "transparent" : color,
    fillOpacity: faded ? 0.3 : hollow ? 0 : 0.85,
    opacity: faded ? 0.5 : 1,
  };
}

// Treatment plants are DOM markers, not canvas circles: STP = square, FSTP =
// triangle (Madhuri's review - identical small circles were unfindable in a
// demo), sized well above the 10 px data dots and drawn in the markerPane,
// which stacks above every canvas fill. Solid = operational, hollow = not yet
// functional - the same status convention the circles used; the white outline
// on solid shapes keeps them legible on both the light and darkened basemaps.
export function treatmentIcon(l: BasinLayer, feat: Feature | undefined): L.DivIcon {
  const p = (feat?.properties ?? {}) as Record<string, unknown>;
  const operational = /operational/i.test(String(p.status ?? ""));
  const fill = operational ? l.color : "none";
  const stroke = operational ? "#ffffff" : l.color;
  const sw = operational ? 1.5 : 2.5;
  const shape =
    l.family === "fstp"
      ? `<polygon points="9,1.5 17,16 1,16" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`
      : `<rect x="2" y="2" width="14" height="14" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">${shape}</svg>`,
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

// ── shared color sources (the map, legend, and rail all read from these +
//    each layer's manifest `color`, so they can never drift out of sync) ──

// Warm red->orange->amber ramp: reads as "pressure", three steps distinct and
// each mid-toned so it holds on both the light and dark basemaps.
export const PRESSURE_KIND_COLOR: Record<string, string> = {
  "industrial-area": "#C62828",
  quarry: "#ea580c",
  "waste-facility": "#ca8a04",
  // Named 17-category major polluters (KSPCB) - a deep rose, distinct from the
  // red/orange/amber area kinds and rendered as a point, not a fill.
  "major-industry": "#9d174d",
};
// The selected sub-catchment highlight (warm amber - the only warm structural
// cue, so "you are scoped here" stands out from the cool context).
const SELECTED_SHED_COLOR = "#f59e0b";

// Admin levels are all neutral; tell them apart by dash pattern + weight.
const ADMIN_DASH: Record<string, string | undefined> = {
  "admin-district": undefined,
  "admin-taluk": "6 4",
  "admin-town": "2 3",
  "admin-gp": "1 4",
};

export type MapHighlight = MapMatch;

export function matchesHighlight(hl: MapHighlight | null | undefined, l: BasinLayer, feat: Feature | undefined): boolean {
  if (!hl || hl.family !== l.family) return false;
  const p = (feat?.properties ?? {}) as Record<string, unknown>;
  // Kind guard: a name-contains match must not leak onto other kinds sharing
  // the family (e.g. a 17-category industry whose address names the estate).
  if (hl.kinds && !hl.kinds.includes(String(p.kind ?? ""))) return false;
  if (!hl.prop) return true;
  const v = String(p[hl.prop] ?? "");
  if (hl.values?.includes(v)) return true;
  return hl.contains?.some((c) => v.toLowerCase().includes(c.toLowerCase())) ?? false;
}

/** `gapUnit` is the polygon-backed selection (see mapGapUnit), never a ULB key. */
export function fillStyle(l: BasinLayer, feat: Feature | undefined, faded: boolean, gapUnit?: string | null, hl?: MapHighlight | null): PathOptions {
  if (matchesHighlight(hl, l, feat)) {
    return { color: SELECTED_SHED_COLOR, weight: 3, fillColor: l.color, fillOpacity: 0.35, opacity: 1 };
  }
  if (l.family === "context-boundary") {
    // Two roles. "context" is the full outline: dashed, in the layer's
    // outlineColor - pale enough to defer to the bold clip frame, bright
    // enough to survive a dark basemap (Madhuri, 31 Aug: the old slate dash
    // was invisible, so the basin looked like it stopped at Karnataka).
    // "beyond" is the out-of-state catchment itself, and it gets a FILL -
    // 2,199 sq km drawn as bare outline is 2,199 sq km nobody can see
    // (review, 27 Aug) - but NO stroke: its only edges are the full outline
    // and the basin boundary, which draw themselves.
    if ((feat?.properties as Record<string, unknown> | undefined)?.role === "beyond") {
      return { stroke: false, fillColor: l.color, fillOpacity: faded ? 0.12 : 0.25 };
    }
    return { color: l.outlineColor ?? l.color, weight: 2.5, dashArray: "7 5", fill: false, opacity: faded ? 0.6 : 0.95 };
  }
  if (l.family === "boundary") {
    // Bold SOLID line in the manifest color (fuchsia) - a hue the OSM basemap
    // never uses, so the basin edge can't be mistaken for a basemap boundary.
    return { color: l.color, weight: 3, fill: false, opacity: 0.95 };
  }
  if (l.family.startsWith("admin") || l.outline) {
    // District is always-on context (outline only). The opt-in finer levels get
    // a faint fill so the whole unit is tappable (hierarchy on tap/hover).
    const detail = l.family !== "admin-district";
    const oc = classColor(l, feat);
    return {
      color: oc,
      weight: l.family === "admin-district" ? 1.4 : 1.2,
      fill: detail,
      fillColor: oc,
      fillOpacity: detail ? (faded ? 0.03 : l.classes ? 0.18 : 0.07) : 0,
      opacity: faded ? 0.4 : 0.85,
      dashArray: ADMIN_DASH[l.family],
    };
  }
  if (l.gap) {
    const unit = String((feat?.properties as Record<string, unknown>)?.gapUnit ?? "");
    const sev = String((feat?.properties as Record<string, unknown>)?.severity ?? "high");
    const c = sev === "high" ? "#dc2626" : sev === "medium" ? "#ea580c" : "#f59e0b";
    // When a unit is selected, grey out the others so the selection stands out.
    if (gapUnit != null && gapUnit !== unit) {
      return { color: "#cbd5e1", weight: 1, fillColor: "#94a3b8", fillOpacity: 0.12 };
    }
    const isSel = gapUnit === unit;
    return { color: c, weight: isSel ? 3 : 2, fillColor: c, fillOpacity: faded ? 0.2 : isSel ? 0.55 : 0.4 };
  }
  if (l.family.startsWith("pressures")) {
    const p = (feat?.properties as Record<string, unknown>) ?? {};
    const kind = String(p.kind ?? "");
    // Industrial areas are sub-coloured by CETP coverage, palette fixed with
    // Madhuri (Aug 2026): no CETP = red, CETP available = blue, status to be
    // verified = yellow. All three are SOLID fills at the same opacity - the
    // old faint/dashed states vanished against the basemap in a live demo.
    if (kind === "industrial-area-other") {
      // Unattributed (likely KSSIDC) estates: marked but detail-less, so a
      // quiet dashed grey - visibly present, visibly not the KIADB story.
      return { color: "#94a3b8", weight: 1, fillColor: "#94a3b8", fillOpacity: faded ? 0.12 : 0.25, dashArray: "3 3" };
    }
    if (kind === "industrial-area") {
      const cetp = String(p.cetp ?? "unknown");
      const c = cetp === "none" ? "#C62828" : cetp === "served" ? "#1976D2" : "#F9A825";
      return { color: c, weight: 1, fillColor: c, fillOpacity: faded ? 0.2 : 0.55 };
    }
    const c = PRESSURE_KIND_COLOR[kind] ?? l.color;
    return { color: c, weight: 1, fillColor: c, fillOpacity: faded ? 0.2 : 0.5 };
  }
  // waterbodies, command-areas; classed layers take each feature's class colour
  const c = classColor(l, feat);
  return { color: c, weight: 0.8, fillColor: c, fillOpacity: faded ? 0.3 : l.classes ? 0.5 : 0.6 };
}
