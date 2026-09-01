#!/usr/bin/env python3
"""Stage the Kabini deep-dive sources for ingest_basin.py.

The Kabini atlas (sub-basin C2 of cauvery-ka) is assembled from two places:
  1. Platform data already ingested for the cauvery-ka overview - the C2
     polygon, which stays the clip mask for everything else. KWRIS provenance
     carries over.
  2. Paani Earth's Cauvery basin GIS package (Aug 2026, partner GeoPackages,
     kept OUT of the repo) - hydrology, pressures, stations, dams and the
     polluted-stretch lines, spatially filtered to the Kabini boundary.

Everything lands as clean 4326 GeoJSON in a staging dir; the committed
scripts/basin-sources/kabini-ingest.json maps staged files onto the layer
contract and scripts/ingest_basin.py does the rest. Re-run order:
    python3 scripts/build_kabini_sources.py [--gpkg-dir ...]
    python3 scripts/ingest_basin.py scripts/basin-sources/kabini-ingest.json
    python3 scripts/build_basin_wq_param_packs.py public/data/basins/kabini \
        scripts/basin-sources/kabini-wq-params.json
    python3 scripts/build_basin_flow_readings.py public/data/basins/kabini \
        scripts/basin-sources/kabini-flow.json
    python3 scripts/validate_basin.py scripts/basin-sources/kabini-ingest.json
(re-ingest rewrites flow-stations.geojson AND strips hasReadings from
monitoring-points.geojson, so BOTH pack steps come after it - skipping the
wq step ships the six KSPCB stations hollow.)

Scope rule: the Kabini rises in Wayanad, Kerala, and the partner's own Kabini
watershed polygon is 1.45x our C2 - it includes that Kerala reach. Everything
here is clipped to the KWRIS C2 boundary, so the atlas stays the Karnataka
portion the rest of the platform is decomposed on. The Kerala reach is a
future extension, not a silent inclusion.

Requires shapely (neer-vazhvu-api env) + GDAL (QGIS bundle is auto-found).
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
from build_basin_gpkg_layers import hav_km  # noqa: E402  (published lengths are geodesic)
from ingest_basin import _read_vector  # noqa: E402  (shared GDAL reader, 4326 output)
from nvdm_write import merge_envelope  # noqa: E402  (envelopes survive re-runs)

from shapely.geometry import MultiLineString, MultiPolygon, mapping, shape  # noqa: E402
from shapely.ops import transform, unary_union  # noqa: E402
from shapely.prepared import prep  # noqa: E402

CAUVERY_KA = REPO / "public/data/basins/cauvery-ka"

# Partner GPKG layers -> staged file + provenance. Layer names are verbatim
# from the delivery, including the " — clipped" suffixes AND the stray leading
# and trailing spaces some river layers carry ("Kabini River" is ' Kabini
# River '). Pass them through untouched or ogr2ogr will not find the layer.
OTHER_GPKG = "Other_GIS_Layers.gpkg"
HYDRO_GPKG = "Hydrology_Layers.gpkg"
PRS_GPKG = "PRS_Stretches_Since_1993.gpkg"
ADMIN_GPKG = "Admin-Geopackages.gpkg"

PARTNER_LAYERS = [
    ("KIADB_industrial_areas_KGIS — clipped", "kiadb-areas.geojson"),
    ("KIADB_Industrial_Area_Points_KGIS — clipped", "kiadb-points.geojson"),
    ("Quarries_Cauverybasin_0", "quarries.geojson"),
    ("Cauvery_Arkavathi_Basin_Quarries — movado_qgis__7_quarries", "quarries-paani.geojson"),
    ("KGIS_NotifiedForest_CauveryBasin — clipped", "forests.geojson"),
    ("KGIS_Protected_Areas_CauveryBasin — clipped", "protected-areas.geojson"),
    # Command areas are staged separately (section 8a): keep-if-intersecting
    # admitted the K R Sagar command, 2,011 sq km of Cauvery-mainstem command
    # grazing the basin's northeast edge (Madhuri review, 31 Aug).
    # The Aug-6 CWC and NWMP station layers are NOT staged here: the review
    # round replaced both with validated locations (section 7b below).
]

COMMAND_AREAS_LAYER = "Command_Areas_in_Cauvery_Basin_IndiaWRIS — clipped"
# What belongs here is any command fed by a Kabini-system work, but the WRIS
# register carries no headworks field to say so - the share of the command
# inside the basin is the proxy. It cannot be a majority test: canals export
# water across the divide, so the Kabini dam's own command is only 48.5%
# inside C2, while K R Sagar's (a Cauvery-mainstem work) touches on a 0.4%
# sliver. A quarter splits that two-orders-of-magnitude gap; every share is
# printed so a redelivery landing near the line is seen, not silently judged.
COMMAND_AREA_MIN_SHARE = 0.25

# India-WRIS watershed polygons: the real sub-hydrosheds, replacing the
# single-shed placeholder the first Kabini build shipped. WRIS publishes these
# with codes (wsconc) and no names, so the code IS the name here.
WATERSHEDS_LAYER = "Watersheds_in_CauveryBasin — clipped"
# A watershed counts as a Kabini sub-catchment when this much of the C2
# polygon falls inside it; below that it is a boundary sliver of a neighbour.
SHED_MIN_SHARE_OF_BASIN = 0.002

# Named river centrelines. riverId matches src/lib/basins/kabini.ts.
RIVER_LAYERS = [
    (" Kabini River ", "kabini", "Kabini"),
    ("Gundal River ", "gundal", "Gundal"),
]

DRAINAGE_LAYER = "Kabini_Drainage"
WB_MAJOR_LAYER = "IndiaWRIS_Cauvery_MajorWaterbodies — MajorWaterbodies"
WB_MINOR_LAYER = "KGIS_TIS_CauveryBasin_Karnataka — clipped"
DAMS_LAYER = "IndiaWRIS_All_Dams_14Apr2026 — dam"
BARRAGES_LAYER = "IndiaWRIS_All_Barrage_Weir_Anecuts_14Apr2026 — bwa"

ADMIN_LAYERS = [
    ("Karnataka_All_Districts", "admin-district.geojson", "district clips"),
    ("Karnataka_All_Taluks", "admin-taluk.geojson", "taluk clips"),
    ("Towns_in_KA_CauveryBasin — clipped", "admin-town.geojson", "town clips"),
]

PRS_2025_LAYER = "PRS_2025_Polluted_River_Stretches"

# The basin does not stop at the state line. The Kabini rises in Wayanad and
# 31% of its watershed is in Kerala, which the C2 clip cuts away - so the atlas
# has been drawing a river that appears to start nowhere. These two layers put
# the missing third back as CONTEXT: the full watershed outline, and the
# 84.5 km of centreline above the border. Nothing else is extended across it,
# and no Kerala-side pressure, station or administrative data is claimed.
FULL_WATERSHED_LAYER = "Cauvery_Tributary_Kabini — dissolved"

# ── Review round, 23 Aug 2026 ────────────────────────────────────────────────
# Paani's feedback on the first Kabini build came with ten GeoPackages. These
# are the ones it takes: corrected station locations, the drains the action
# plan says do not exist, and a redrawn earlier stretch.
#
# The earlier stretch is the important one. The first build declined to draw
# it: the geometry then on hand covered about 3 km of a reach KSPCB's own
# action plan describes as roughly 9 km, so the panel reported it from the
# documents and said plainly that it was not on the map. The redrawn line is
# one contiguous 12 km course lying wholly inside the 2025 stretch, so it can
# be drawn - and the growth from one edition to the next is finally visible
# rather than described.
PRS_2018_GPKG = "prs_2020_nanjangudtohejjige.gpkg"
PRS_2018_LAYER = "prs_2020_nanjangudtohejjige"

CWC_GPKG = "Kabini_CWC_Locations.gpkg"
CWC_LAYER = "Kabini_CWC_Locations"
KSPCB_GPKG = "Cauvery_Kabini_Monitoring_Points_KSPCB.gpkg"
KSPCB_LAYER = "Cauvery_Kabini_Monitoring_Points_KSPCB"
STP_GPKG = "Kabini_Basin_Sewage_treatment_Plants.gpkg"
STP_LAYER = "Kabini_Basin_Sewage_treatment_Plants"
DRAIN_INLET_GPKG = "Kabini_PRS_Polluting_drains_inlets.gpkg"
DRAIN_INLET_LAYER = "polluting_drains_inlet_locations_as_per_oct2020mpr"
DRAIN_LINE_GPKG = "Kabini_River_PRS_Polluting_Drains.gpkg"
DRAIN_LINE_LAYER = "kabini_river_prs_polluting_drains_as_per_MPR"
OUTSIDE_UNITS_GPKG = "Industries_Outside_industrial_Area.gpkg"
OUTSIDE_UNITS_LAYER = "industries_outside_industrial_area"
PRS_AREAS_GPKG = "Industrial_Areas_Relevant_to_kabini_PRS.gpkg"
PRS_AREAS_LAYER = "Industrial_Areas_Relevant_to_kabini_PRS"

# Her PRS-relevant industrial-area set overlaps ours almost entirely; what it
# adds are estates that sit OUTSIDE the C2 boundary and drain toward it. Those
# are staged as their own layer rather than merged in, so the distinction
# between "in the basin" and "draining into it" stays visible on the map.
IN_BASIN_AREA_MIN_SHARE = 0.001


def _fc(features: list[dict]) -> dict:
    return {"type": "FeatureCollection", "features": features}


def _write(path: Path, fc: dict, label: str) -> None:
    path.write_text(json.dumps(fc, separators=(",", ":")))
    print(f"  {label:34} {len(fc['features']):5} feats -> {path.name}")


def _geom(f: dict):
    """Shapely geometry for a feature, repaired if the source is dirty."""
    g = f.get("geometry")
    if not g:
        return None
    try:
        s = shape(g)
    except (ValueError, TypeError):
        return None
    if s.is_empty:
        return None
    return s if s.is_valid else s.buffer(0)


def _hav_length_km(geom) -> float:
    """Haversine length of a (Multi)LineString - the *111 flat-degrees
    shortcut overstates east-west runs at this latitude by ~1%."""
    lines = geom.geoms if geom.geom_type == "MultiLineString" else [geom]
    return sum(hav_km(list(ls.coords)) for ls in lines)


_WGS84_A = 6378.137
_WGS84_E2 = 0.00669437999014


def _cos_area_km2(geom) -> float:
    """Cos-lat (sinusoidal) shoelace scaled by the WGS84 ellipsoid's local
    radii - no projection dependency, and it reproduces KWRIS's stated C2
    area (4,883 sq km) to within 0.3 sq km."""
    lat = math.radians(geom.centroid.y)
    s2 = math.sin(lat) ** 2
    m = _WGS84_A * (1 - _WGS84_E2) / (1 - _WGS84_E2 * s2) ** 1.5
    n = _WGS84_A / (1 - _WGS84_E2 * s2) ** 0.5
    deg_km = math.pi * math.sqrt(m * n) / 180
    return transform(lambda x, y: (x * math.cos(math.radians(y)) * deg_km, y * deg_km),
                     geom).area


def _same_dim(geom, dim: int):
    """Keep only the parts of an intersection with the source's dimension.

    Clipping a line against a polygon can hand back stray points where the
    line grazes the boundary; clipping polygons can hand back edge lines.
    """
    if geom.is_empty:
        return None
    if geom.geom_type == "GeometryCollection":
        parts = [g for g in geom.geoms if _DIM.get(g.geom_type) == dim and not g.is_empty]
        if not parts:
            return None
        return MultiLineString(parts) if dim == 1 else MultiPolygon(parts)
    return geom if _DIM.get(geom.geom_type) == dim else None


_DIM = {"Point": 0, "MultiPoint": 0, "LineString": 1, "MultiLineString": 1,
        "Polygon": 2, "MultiPolygon": 2}


def _clip_to(feats: list[dict], mask, pmask, dim: int) -> list[dict]:
    """Clip features to the basin mask, dropping anything outside it."""
    kept = []
    for f in feats:
        g = _geom(f)
        if g is None:
            continue
        if pmask.contains(g):
            out = g
        elif pmask.intersects(g):
            out = _same_dim(g.intersection(mask), dim)
            if out is None:
                continue
        else:
            continue
        kept.append({"type": "Feature", "geometry": mapping(out),
                     "properties": f.get("properties") or {}})
    return kept


def _intersecting(feats: list[dict], pmask) -> list[dict]:
    """Features that touch the basin, kept whole (points, and layers whose
    partner clip is already tighter than ours)."""
    kept = []
    for f in feats:
        g = _geom(f)
        if g is not None and pmask.intersects(g):
            kept.append(f)
    return kept


def _tidy(f: dict, rename: dict[str, str]) -> dict:
    """Collapse wrapped whitespace and rename spreadsheet headers to plain keys."""
    out = {}
    for k, v in (f.get("properties") or {}).items():
        key = rename.get(k)
        if key is None:
            continue
        if isinstance(v, str):
            v = " ".join(v.split())
        out[key] = v
    f["properties"] = out
    return f


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gpkg-dir", default=str(Path.home() / "Downloads/Cauvery_Basin_Geopackages (1)"),
                    help="Paani Earth Cauvery GeoPackage folder (partner data, not in repo)")
    ap.add_argument("--review-dir",
                    default=str(Path.home() / "Downloads/Cauvery_Kabini_Review_23Aug2026"),
                    help="Paani Earth's 23 Aug 2026 review-round GeoPackages")
    ap.add_argument("--out", default=str(REPO / ".cache/kabini-sources"))
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    gdir = Path(args.gpkg_dir)
    gpkg = gdir / OTHER_GPKG
    hyd = gdir / HYDRO_GPKG
    if not gpkg.exists():
        sys.exit(f"Partner GeoPackage not found: {gpkg}")
    if not hyd.exists():
        sys.exit(f"Hydrology GeoPackage not found: {hyd}")

    # ── 1. Boundary from the cauvery-ka C2 polygon: the clip mask for all ──
    subs = json.loads((CAUVERY_KA / "sub-basins.geojson").read_text())
    c2 = next(f for f in subs["features"] if f["properties"].get("code") == "C2")
    boundary = {"type": "Feature", "geometry": c2["geometry"], "properties": {"name": "Kabini"}}
    _write(out / "kabini-boundary.geojson", _fc([boundary]), "boundary (KWRIS C2)")
    kab_geom = shape(c2["geometry"]).buffer(0)
    kabini = prep(kab_geom)

    # ── 2. Sub-hydrosheds: India-WRIS watersheds, clipped to C2 ──
    sheds = []
    for f in _read_vector(hyd, WATERSHEDS_LAYER, None):
        g = _geom(f)
        if g is None or not kabini.intersects(g):
            continue
        inter = _same_dim(g.intersection(kab_geom), 2)
        if inter is None or inter.area < SHED_MIN_SHARE_OF_BASIN * kab_geom.area:
            continue
        code = (f["properties"].get("wsconc") or "").strip()
        if not code:
            continue
        sheds.append({"type": "Feature", "geometry": mapping(inter),
                      "properties": {"shedId": code, "name": code,
                                     "areaKm2": round(f["properties"].get("area_sqkm") or 0, 1)}})
    sheds.sort(key=lambda f: f["properties"]["shedId"])
    _write(out / "kabini-sheds.geojson", _fc(sheds), "sub-hydrosheds (WRIS)")
    shed_shapes = [(f["properties"]["shedId"], shape(f["geometry"])) for f in sheds]

    # ── 3. Rivers: the named centrelines, clipped to C2 ──
    rivers = []
    for layer, river_id, name in RIVER_LAYERS:
        feats = _clip_to(_read_vector(hyd, layer, None), kab_geom, kabini, 1)
        km = sum(shape(f["geometry"]).length for f in feats) * 111
        crossed = sorted({sid for sid, sg in shed_shapes
                          for f in feats if sg.intersects(shape(f["geometry"]))})
        for f in feats:
            f["properties"] = {"riverId": river_id, "name": name}
        rivers += feats
        print(f"    {name:10} ~{km:6.1f} km in basin; sheds {crossed}")
    _write(out / "kabini-rivers.geojson", _fc(rivers), "rivers (named centrelines)")

    # ── 4. Drainage network (heavy; sliced per shed by the engine) ──
    drainage = _clip_to(_read_vector(hyd, DRAINAGE_LAYER, 0.0001), kab_geom, kabini, 1)
    for f in drainage:
        # Most segments are unnamed; the named ones carry the tributaries the
        # rivers layer does not (Nugu, Taraka, Hebbal Halla, Nagar Hole).
        name = (f["properties"].get("rivname") or "").strip()
        f["properties"] = {"name": name} if name else {}
    _write(out / "kabini-drainage.geojson", _fc(drainage), "drainage (WRIS stream network)")

    # ── 5. Waterbodies: WRIS major (named) + KGIS minor irrigation tanks ──
    _write(out / "kabini-waterbodies-major.geojson",
           _fc(_clip_to(_read_vector(hyd, WB_MAJOR_LAYER, None), kab_geom, kabini, 2)),
           "waterbodies-major (WRIS)")
    _write(out / "kabini-waterbodies-minor.geojson",
           _fc(_clip_to(_read_vector(hyd, WB_MINOR_LAYER, None), kab_geom, kabini, 2)),
           "waterbodies-minor (KGIS tanks)")

    # ── 6. Dams + barrages, refreshed from the April 2026 WRIS registers ──
    _write(out / "kabini-dams.geojson",
           _fc(_intersecting(_read_vector(hyd, DAMS_LAYER, None), kabini)), "dams (WRIS NRLD)")
    _write(out / "kabini-barrages.geojson",
           _fc(_intersecting(_read_vector(hyd, BARRAGES_LAYER, None), kabini)),
           "barrages/anicuts (WRIS)")

    # ── 7. Polluted river stretch, 2025 edition ──
    prs_gpkg = gdir / PRS_GPKG
    prs_feats = []
    if prs_gpkg.exists():
        for f in _clip_to(_read_vector(prs_gpkg, PRS_2025_LAYER, None), kab_geom, kabini, 1):
            detail = " ".join((f["properties"].get("Polluted stretch details") or "").split())
            if "KABINI" not in detail.upper():
                continue
            # The stretch's descriptive properties (year, priority, length,
            # label) live in the ingest manifest, where they sit next to their
            # provenance string and can be reviewed against the documents.
            # Print the delivered figures so a re-delivery that moves them is
            # visible at build time rather than silently overridden.
            print(f"    delivered: {detail!r}\n"
                  f"    delivered distance: {f['properties'].get('Distance (In Km)')} km")
            f["properties"] = {}
            prs_feats.append(f)
        _write(out / "kabini-prs.geojson", _fc(prs_feats), "polluted stretch (2025)")
    else:
        print(f"  ! PRS GeoPackage not found ({prs_gpkg.name}); skipping the stretch layer")

    # ── 7a. The Kerala reach, as context ──
    full = _read_vector(hyd, FULL_WATERSHED_LAYER, None)
    full_geom = unary_union([g for g in (_geom(f) for f in full) if g is not None])
    beyond = full_geom.difference(kab_geom)
    beyond_km2 = round(_cos_area_km2(beyond))
    # Two features, because an outline alone cannot show an area. The full
    # extent is the frame; the Kerala share is the thing being pointed at, and
    # it only reads if it can be filled (review, 27 Aug: "I don't see Kabini
    # extended into Kerala" - it was drawn, as 2,199 sq km of empty outline).
    _write(out / "kabini-context-boundary.geojson",
           _fc([{"type": "Feature", "geometry": mapping(full_geom),
                 "properties": {"name": "Kabini basin, full extent (Karnataka and Kerala)",
                                "role": "context"}},
                {"type": "Feature", "geometry": mapping(beyond),
                 "properties": {"name": "The Kerala (Wayanad) headwaters, outside this atlas's clip",
                                "role": "beyond", "areaKm2": beyond_km2}}]),
           "full watershed (with Kerala)")
    print(f"    Kerala share {beyond_km2:,} sq km "
          f"({beyond.area / full_geom.area * 100:.0f}% of the watershed) lies outside the C2 clip; "
          f"full extent {round(_cos_area_km2(full_geom)):,} sq km")

    # Only the reach ABOVE the boundary, so the in-basin course is not drawn
    # twice with two different weights.
    ctx_rivers = []
    for layer, river_id, name in RIVER_LAYERS:
        g = unary_union([x for x in (_geom(f) for f in _read_vector(hyd, layer, None)) if x is not None])
        out_of_basin = _same_dim(g.difference(kab_geom), 1)
        if out_of_basin is None or out_of_basin.is_empty:
            continue
        km = _hav_length_km(out_of_basin)
        ctx_rivers.append({"type": "Feature", "geometry": mapping(out_of_basin),
                           "properties": {"riverId": river_id, "name": name, "role": "context",
                                          "lengthKm": round(km, 1)}})
        print(f"    {name:10} {km:6.1f} km beyond the boundary")
    _write(out / "kabini-context-rivers.geojson", _fc(ctx_rivers), "rivers beyond the boundary")

    # The major waterbodies within the Kerala share - the reservoirs that feed
    # the reach above the state line (Madhuri review, 31 Aug: the headwaters
    # read as a lakeless void). Same WRIS major-waterbodies source as the
    # in-basin layer, majority-inside the Kerala share so nothing is drawn
    # twice; still context, so no Kerala-side claim beyond the geometry.
    ctx_wb = []
    ctx_wb_geoms = []
    for f in _read_vector(hyd, WB_MAJOR_LAYER, None):
        g = _geom(f)
        if g is None or g.area <= 0:
            continue
        if g.intersection(beyond).area / g.area >= 0.5:
            ctx_wb.append(f)
            ctx_wb_geoms.append(g)
            print(f"    Kerala waterbody: {(f['properties'].get('wbname') or '?').strip()}")
    _write(out / "kabini-context-waterbodies.geojson", _fc(ctx_wb),
           "Kerala-share major waterbodies")

    # The rivers those reservoirs sit on. Without them the two context
    # reservoirs floated in Wayanad connected to nothing (Sundaresh, 01 Sep):
    # the only Kerala line was the mainstem, and both dams are on tributaries.
    # Kept: every NAMED watercourse, drawn WHOLE, plus unnamed trunk segments
    # (Strahler ordsh >= 5, where naming lapses mid-course), clipped to the
    # Kerala share. Whole courses, never an order cut alone: a first pass kept
    # ordsh >= 5 plus reservoir feeders, and the Nul Pula surfaced out of
    # nowhere at Sultan Bathery where it happens to reach order 5 - a river
    # may begin at its source, never in the middle of a town (Sundaresh,
    # 01 Sep, round 2). Connectivity is asserted at build time: every context
    # reservoir must touch the staged network.
    CTX_STREAM_MIN_ORDER = 5
    ctx_streams = []
    rivers_kept: set[str] = set()
    for f in _read_vector(hyd, DRAINAGE_LAYER, 0.0001):
        g = _geom(f)
        if g is None:
            continue
        name = (f["properties"].get("rivname") or "").strip()
        order = int(f["properties"].get("ordsh") or 0)
        if not name and order < CTX_STREAM_MIN_ORDER:
            continue
        inter = _same_dim(g.intersection(beyond), 1)
        if inter is None or inter.is_empty:
            continue
        if name:
            rivers_kept.add(name)
        ctx_streams.append({"type": "Feature", "geometry": mapping(inter),
                            "properties": {"name": name, "role": "context"}})
    net = unary_union([shape(f["geometry"]) for f in ctx_streams])
    for f, g in zip(ctx_wb, ctx_wb_geoms):
        d_km = net.distance(g) * 111
        nm = (f["properties"].get("wbname") or "?").strip()
        if d_km > 0.01:
            sys.exit(f"context reservoir {nm!r} is {d_km:.2f} km from the staged "
                     "tributary network - the skeleton no longer connects it")
        print(f"    {nm} connected to the tributary skeleton")
    km = sum(_hav_length_km(shape(f["geometry"])) for f in ctx_streams)
    print(f"    {len(rivers_kept)} named rivers, whole courses; skeleton ~{km:.0f} km")
    _write(out / "kabini-context-streams.geojson", _fc(ctx_streams),
           "Kerala tributary skeleton")

    # ── 7b. Review round (23 Aug 2026): the corrections Paani sent back ──
    rdir = Path(args.review_dir)
    if not rdir.exists():
        sys.exit(f"Review-round GeoPackages not found: {rdir}")

    # The earlier CPCB stretch, redrawn. Clipped like everything else, and
    # measured out loud so a redelivery that moves it is visible at build time.
    prs18 = _clip_to(_read_vector(rdir / PRS_2018_GPKG, PRS_2018_LAYER, None),
                     kab_geom, kabini, 1)
    for f in prs18:
        f["properties"] = {}
    km18 = sum(shape(f["geometry"]).length for f in prs18) * 111
    print(f"    earlier stretch measures ~{km18:.2f} km in basin")
    _write(out / "kabini-prs-2018.geojson", _fc(prs18), "polluted stretch (2018)")

    # Validated CWC sites. Her file carries a third station, Kabini at
    # Muthankera, which sits in Kerala and so falls outside the C2 clip - it
    # is not staged here; build_basin_flow_readings.py appends it from the
    # flow config, and it ships marked pending until its series are fetched.
    cwc_all = _read_vector(rdir / CWC_GPKG, CWC_LAYER, None)
    cwc = _intersecting(cwc_all, kabini)
    dropped = [(f["properties"].get("stationnam"), f["properties"].get("state_name"))
               for f in cwc_all if f not in cwc]
    _write(out / "cwc-sites.geojson", _fc(cwc), "CWC sites (validated)")
    for name, state in dropped:
        print(f"    outside the boundary, not staged: {name} ({state})")

    # stationKey keeps the CPCB_ prefix the first build established: the
    # water-quality readings packs are filed under it.
    kspcb = [_tidy(f, {"Water\nQuality Station Code": "stationKey",
                       "Name or Location of Monitoring Station": "name",
                       "Type of Water Body": "waterBody",
                       "Frequency of Monitoring": "frequency"})
             for f in _intersecting(_read_vector(rdir / KSPCB_GPKG, KSPCB_LAYER, None), kabini)]
    for f in kspcb:
        f["properties"]["stationKey"] = f"CPCB_{f['properties']['stationKey']}"
        f["properties"]["name"] = f["properties"]["name"].rstrip(", ")
    _write(out / "kspcb-sites.geojson", _fc(kspcb), "KSPCB monitoring (validated)")

    stps = [_tidy(f, {"STP_Name": "name",
                      "Implementing Agency": "operator",
                      "Installed Capacity of STPs (in MLD)": "capacityMld",
                      "Treatment Level": "treatmentLevel",
                      "Date of Commissioning": "commissioned",
                      "Destination of Treated Sewage": "destination",
                      "Validation needed": "caveat",
                      "Source": "sourceNote"})
            for f in _intersecting(_read_vector(rdir / STP_GPKG, STP_LAYER, None), kabini)]
    _write(out / "kabini-stps.geojson", _fc(stps), "sewage treatment plants")

    # The drains the action plan says are not there. Inlets are the outfalls
    # the October 2020 MPR itemises; the lines are the streams reaching them.
    # The MPR itemises the drains with descriptions and no names, so the label
    # is the place the report itself names - the phrase after its last
    # "near"/"at"/"behind", trimmed at the comma. The full sentence rides along
    # as the description, so the derivation is always checkable against it.
    inlets = [_tidy(f, {"Details": "description"})
              for f in _intersecting(_read_vector(rdir / DRAIN_INLET_GPKG, DRAIN_INLET_LAYER, None), kabini)]
    for f in inlets:
        text = f["properties"].get("description") or ""
        hits = list(re.finditer(r"\b(?:near|behind|at)\s+", text, flags=re.I))
        place = ""
        if hits:
            tail = text[hits[-1].end():]
            place = tail.split(",")[0].strip()
        f["properties"]["name"] = (place[:1].upper() + place[1:]) if place else "Unnamed outfall"
    _write(out / "kabini-drain-inlets.geojson", _fc(inlets), "polluting drain inlets (MPR)")
    _write(out / "kabini-drain-lines.geojson",
           _fc(_clip_to(_read_vector(rdir / DRAIN_LINE_GPKG, DRAIN_LINE_LAYER, None),
                        kab_geom, kabini, 1)),
           "polluting drains (MPR + WRIS)")

    _write(out / "kabini-units-outside-estates.geojson",
           _fc(_intersecting(_read_vector(rdir / OUTSIDE_UNITS_GPKG, OUTSIDE_UNITS_LAYER, None), kabini)),
           "units outside estates")

    # Industrial areas she flags as influencing the stretch. Only the ones our
    # in-basin layer cannot already carry - the estates outside the boundary -
    # are staged, so the map does not draw the same polygon twice.
    outside_areas = []
    for f in _read_vector(rdir / PRS_AREAS_GPKG, PRS_AREAS_LAYER, None):
        g = _geom(f)
        if g is None or g.area <= 0:
            continue
        if g.intersection(kab_geom).area / g.area > IN_BASIN_AREA_MIN_SHARE:
            continue
        outside_areas.append(f)
    _write(out / "kabini-areas-outside-basin.geojson", _fc(outside_areas),
           "industrial areas outside basin")

    # ── 8. Partner pressure/station layers, filtered to the Kabini polygon ──
    for layer, fname in PARTNER_LAYERS:
        _write(out / fname, _fc(_intersecting(_read_vector(gpkg, layer, None), kabini)),
               layer[:34])

    # ── 8a. Irrigation command areas: substantially inside, not merely
    # touching. Keep-if-intersecting admitted every command that grazes the
    # boundary; the K R Sagar command (Cauvery mainstem) entered on a sliver
    # and sprawled across Mandya (Madhuri review, 31 Aug). Shares are printed
    # so a redelivery that moves one is caught at build time, not on the map.
    commands = []
    for f in _read_vector(gpkg, COMMAND_AREAS_LAYER, None):
        g = _geom(f)
        if g is None or g.area <= 0 or not kabini.intersects(g):
            continue
        share = g.intersection(kab_geom).area / g.area
        name = (f["properties"].get("cname") or "?").strip()
        verdict = "kept" if share >= COMMAND_AREA_MIN_SHARE else "DROPPED"
        print(f"    command area {name:22} {share * 100:5.1f}% in basin - {verdict}")
        if share >= COMMAND_AREA_MIN_SHARE:
            commands.append(f)
    _write(out / "command-areas.geojson", _fc(commands), "command areas (share-filtered)")

    # ── 9. Admin units + the district clips the DEP gaps choropleth needs ──
    admin_gpkg = gdir / ADMIN_GPKG
    if admin_gpkg.exists():
        for layer, fname, label in ADMIN_LAYERS:
            _write(out / fname,
                   _fc(_clip_to(_read_vector(admin_gpkg, layer, None), kab_geom, kabini, 2)),
                   label)

        # Districts carrying gapUnit/severity for gaps.json. The GPKG spells
        # the district "Chamarajanagar"; the platform uses the -a form.
        sev = {"Mysuru": "high", "Chamarajanagar": "medium", "Kodagu": "medium"}
        slug = {"Mysuru": "mysuru", "Chamarajanagar": "chamarajanagara", "Kodagu": "kodagu"}
        display = {"Mysuru": "Mysuru", "Chamarajanagar": "Chamarajanagara", "Kodagu": "Kodagu"}
        clips = []
        for f in _read_vector(admin_gpkg, "Karnataka_All_Districts", None):
            name = (f["properties"].get("district") or "").strip()
            if name not in sev:
                continue
            g = shape(f["geometry"]).buffer(0)
            inter = g.intersection(kab_geom)
            if inter.is_empty:
                continue
            clips.append({"type": "Feature", "geometry": mapping(inter),
                          "properties": {"gapUnit": slug[name], "name": display[name],
                                         "severity": sev[name],
                                         "pctInBasin": round(100.0 * inter.area / g.area, 1)}})
        _write(out / "kabini-district-clips.geojson", _fc(clips), "district clips (gaps)")

    # ── 10. Accountability matrix: the deep dive reuses the overview's C2 file
    # verbatim (same contract, same component). The overview file stays the
    # single place the matrix is authored; re-run this script after editing it.
    acc_src = CAUVERY_KA / "accountability-C2.json"
    acc_dst = REPO / "public/data/basins/kabini/accountability.json"
    acc_dst.parent.mkdir(parents=True, exist_ok=True)
    acc_payload = json.loads(acc_src.read_text())
    acc_dst.write_text(json.dumps(merge_envelope(acc_dst, acc_payload), indent=2) + "\n")
    print(f"  accountability matrix              carried over from {acc_src.name}")

    print(f"\nStaged to {out}. Next: ingest_basin.py scripts/basin-sources/kabini-ingest.json")


if __name__ == "__main__":
    main()
