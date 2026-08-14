#!/usr/bin/env python3
"""Stage the Kabini deep-dive sources for ingest_basin.py.

The Kabini atlas (sub-basin C2 of cauvery-ka) is assembled from two places:
  1. Platform data already ingested for the cauvery-ka overview - the C2
     polygon (boundary + single sub-hydroshed) and the C2 stream segments
     (rivers). KWRIS provenance carries over.
  2. Paani Earth's Cauvery basin GIS package (Aug 2026, partner GeoPackages,
     kept OUT of the repo) - pressures, stations and dams, spatially filtered
     to features intersecting the Kabini boundary.

Everything lands as clean 4326 GeoJSON in a staging dir; the committed
scripts/basin-sources/kabini-ingest.json maps staged files onto the layer
contract and scripts/ingest_basin.py does the rest. Re-run order:
    python3 scripts/build_kabini_sources.py [--gpkg-dir ...]
    python3 scripts/ingest_basin.py scripts/basin-sources/kabini-ingest.json
    python3 scripts/validate_basin.py scripts/basin-sources/kabini-ingest.json

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

from shapely.geometry import shape  # noqa: E402
from shapely.prepared import prep  # noqa: E402

CAUVERY_KA = REPO / "public/data/basins/cauvery-ka"

# Partner GPKG layers -> staged file + provenance. Layer names are verbatim
# from the delivery, including the " — clipped" suffixes.
OTHER_GPKG = "Other_GIS_Layers.gpkg"
PARTNER_LAYERS = [
    ("KIADB_industrial_areas_KGIS — clipped", "kiadb-areas.geojson"),
    ("KIADB_Industrial_Area_Points_KGIS — clipped", "kiadb-points.geojson"),
    ("Quarries_Cauverybasin_0", "quarries.geojson"),
    ("Cauvery_Arkavathi_Basin_Quarries — movado_qgis__7_quarries", "quarries-paani.geojson"),
    ("KGIS_NotifiedForest_CauveryBasin — clipped", "forests.geojson"),
    ("KGIS_Protected_Areas_CauveryBasin — clipped", "protected-areas.geojson"),
    ("Command_Areas_in_Cauvery_Basin_IndiaWRIS — clipped", "command-areas.geojson"),
    ("CWC_MLRD_CauveryBasin — clipped", "dams.geojson"),
    ("Paani_Cauvery_Karnataka_CWC_Sites", "cwc-sites.geojson"),
    ("Paani_Cauvery_Karnataka_CPCB_NWMP_Sites", "nwmp-sites.geojson"),
]


def _fc(features: list[dict]) -> dict:
    return {"type": "FeatureCollection", "features": features}


def _write(path: Path, fc: dict, label: str) -> None:
    path.write_text(json.dumps(fc, separators=(",", ":")))
    print(f"  {label:26} {len(fc['features']):5} feats -> {path.name}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gpkg-dir", default=str(Path.home() / "Downloads/Cauvery_Basin_Geopackages"),
                    help="Paani Earth Cauvery GeoPackage folder (partner data, not in repo)")
    ap.add_argument("--out", default=str(REPO / ".cache/kabini-sources"))
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    gpkg = Path(args.gpkg_dir) / OTHER_GPKG
    if not gpkg.exists():
        sys.exit(f"Partner GeoPackage not found: {gpkg}")

    # ── 1. Boundary + single sub-hydroshed from the cauvery-ka C2 polygon ──
    subs = json.loads((CAUVERY_KA / "sub-basins.geojson").read_text())
    c2 = next(f for f in subs["features"] if f["properties"].get("code") == "C2")
    boundary = {"type": "Feature", "geometry": c2["geometry"], "properties": {"name": "Kabini"}}
    _write(out / "kabini-boundary.geojson", _fc([boundary]), "boundary (KWRIS C2)")
    shed = {"type": "Feature", "geometry": c2["geometry"],
            "properties": {"shedId": "C2", "name": "Kabini"}}
    _write(out / "kabini-sheds.geojson", _fc([shed]), "sub-hydroshed (=boundary)")

    # ── 2. Rivers: the C2 stream segments from the overview ingest ──
    streams = json.loads((CAUVERY_KA / "streams.geojson").read_text())
    segs = [f for f in streams["features"] if f["properties"].get("subBasin") == "C2"]
    for f in segs:
        f["properties"] = {"riverId": "kabini", "name": "Kabini",
                           "lengthM": f["properties"].get("lengthM")}
    _write(out / "kabini-rivers.geojson", _fc(segs), "rivers (KWRIS C2 streams)")

    # ── 3. Partner layers, filtered to the Kabini polygon ──
    kabini = prep(shape(c2["geometry"]).buffer(0))
    for layer, fname in PARTNER_LAYERS:
        feats = _read_vector(gpkg, layer, None)
        kept = []
        for f in feats:
            geom = f.get("geometry")
            if not geom:
                continue
            try:
                g = shape(geom)
            except (ValueError, TypeError):
                continue
            if not g.is_valid:
                g = g.buffer(0)
            if kabini.intersects(g):
                kept.append(f)
        _write(out / fname, _fc(kept), layer[:26])

    # ── 3b. District clips for the DEP gaps choropleth: districts intersected
    # with the Kabini polygon, carrying gapUnit/severity for gaps.json.
    kab_geom = shape(c2["geometry"]).buffer(0)
    # GPKG spells the district "Chamarajanagar"; the platform uses the -a form.
    sev = {"Mysuru": "high", "Chamarajanagar": "medium", "Kodagu": "medium"}
    slug = {"Mysuru": "mysuru", "Chamarajanagar": "chamarajanagara", "Kodagu": "kodagu"}
    display = {"Mysuru": "Mysuru", "Chamarajanagar": "Chamarajanagara", "Kodagu": "Kodagu"}
    admin_gpkg = Path(args.gpkg_dir) / "Admin-Geopackages.gpkg"
    clips = []
    if admin_gpkg.exists():
        from shapely.geometry import mapping
        for f in _read_vector(admin_gpkg, "Karnataka_All_Districts", None):
            name = (f["properties"].get("district") or "").strip()
            if name not in sev:
                continue
            g = shape(f["geometry"]).buffer(0)
            inter = g.intersection(kab_geom)
            if inter.is_empty:
                continue
            clips.append({"type": "Feature", "geometry": mapping(inter),
                          "properties": {"gapUnit": slug[name], "name": display[name], "severity": sev[name],
                                         "pctInBasin": round(100.0 * inter.area / g.area, 1)}})
        _write(out / "kabini-district-clips.geojson", _fc(clips), "district clips (gaps)")

    # ── 4. Accountability matrix: the deep dive reuses the overview's C2 file
    # verbatim (same contract, same component). The overview file stays the
    # single place the matrix is authored; re-run this script after editing it.
    acc_src = CAUVERY_KA / "accountability-C2.json"
    acc_dst = REPO / "public/data/basins/kabini/accountability.json"
    acc_dst.parent.mkdir(parents=True, exist_ok=True)
    acc_dst.write_text(acc_src.read_text())
    print(f"  accountability matrix       carried over from {acc_src.name}")

    print(f"\nStaged to {out}. Next: ingest_basin.py scripts/basin-sources/kabini-ingest.json")


if __name__ == "__main__":
    main()
