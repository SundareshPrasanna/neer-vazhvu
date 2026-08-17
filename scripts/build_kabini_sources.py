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
    python3 scripts/build_basin_flow_readings.py public/data/basins/kabini \
        scripts/basin-sources/kabini-flow.json
    python3 scripts/validate_basin.py scripts/basin-sources/kabini-ingest.json
(re-ingest rewrites flow-stations.geojson, so the readings step comes after it.)

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
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
from ingest_basin import _read_vector  # noqa: E402  (shared GDAL reader, 4326 output)
from nvdm_write import merge_envelope  # noqa: E402  (envelopes survive re-runs)

from shapely.geometry import MultiLineString, MultiPolygon, mapping, shape  # noqa: E402
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
    ("Command_Areas_in_Cauvery_Basin_IndiaWRIS — clipped", "command-areas.geojson"),
    ("Paani_Cauvery_Karnataka_CWC_Sites", "cwc-sites.geojson"),
    ("Paani_Cauvery_Karnataka_CPCB_NWMP_Sites", "nwmp-sites.geojson"),
]

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

# The 2025 CPCB stretch. Its 2018/2020 siblings in the same GeoPackage are
# NOT staged: KSPCB's own action plan puts that stretch at about 9 km
# (Nanjangud water-supply intake to Hejjige village), but the delivered
# geometry covers only ~3 km of it, so drawing it would understate the reach
# by two thirds. The 2018 and 2020 lengths are reported in prs.json from the
# documents instead, and the partial digitisation is flagged there.
PRS_2025_LAYER = "PRS_2025_Polluted_River_Stretches"


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


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gpkg-dir", default=str(Path.home() / "Downloads/Cauvery_Basin_Geopackages (1)"),
                    help="Paani Earth Cauvery GeoPackage folder (partner data, not in repo)")
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

    # ── 8. Partner pressure/station layers, filtered to the Kabini polygon ──
    for layer, fname in PARTNER_LAYERS:
        _write(out / fname, _fc(_intersecting(_read_vector(gpkg, layer, None), kabini)),
               layer[:34])

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
