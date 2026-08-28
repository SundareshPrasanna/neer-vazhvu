#!/usr/bin/env python3
"""Stamp NVDM v1 envelopes on the Cauvery-KA snapshot + NWMP-pack artifacts
(L2 gate, enforcing on new data artifacts).

Covers the 16 artifacts added by the Aug-2026 Phase 2 continuation and the
snapshot rebuild that followed the 23 Aug review:
  - cauvery-ka rivers + context-boundary + context-rivers (Paani GeoPackage
    geometry)
  - cauvery-ka state-boundary + waterbodies + city-footprint (23 Aug review
    package; the snapshot layers the feedback deck asked for)
  - ten readings/CPCB_*.json BOD/DO/FC trend packs (Kabini + Arkavathi)

The modified files are deliberately NOT here: kabini/monitoring-points.geojson
keeps the envelope nvdm_envelope_kabini.py stamped (both producers preserve it
via nvdm_write.merge_envelope), and arkavathi's + cauvery-ka's other artifacts
are grandfathered L0 with their basins.

Run AFTER the producers (build_basin_gpkg_layers.py,
build_basin_wq_param_packs.py); both preserve existing envelopes, so this only
needs re-running when the source list itself changes.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
from registry_license import registry_license  # noqa: E402

BASINS = REPO / "public/data/basins"

ENVELOPE_KEYS = ("nvdm", "dataset", "scope", "provenance", "projection", "ext")


def paani(title: str) -> dict:
    """One layer of the partner GeoPackage delivery - a dated, closed edition."""
    return {
        "title": f"{title} - Cauvery Basin GIS package (GeoPackages, Aug 2026 delivery)",
        "publisher": "Paani Earth Foundation",
        "closed": True,
        "as_of": "2026-08",
        "role": "input",
        "license": "partner-supplied compilation, cited with attribution; underlying government layers as attributed per layer",
    }


def snapshot(title: str) -> dict:
    """A layer of the 23 Aug 2026 review package - the same closed partner
    delivery, a different dated edition of it."""
    return {
        "title": f"{title} - Cauvery snapshot layer package (GeoPackages, 23 Aug 2026 review delivery)",
        "publisher": "Paani Earth Foundation",
        "closed": True,
        "as_of": "2026-08-23",
        "role": "input",
        "license": "partner-supplied compilation, cited with attribution; underlying government layers as attributed per layer",
    }


CPCB_NWMP = {
    "id": "cpcb-nwmp-annual",
    "title": "CPCB NWMP annual Water Quality of Rivers tables, 2020-2024 editions (station-wise observed min-max per parameter)",
    "publisher": "Central Pollution Control Board",
    "url": "https://cpcb.gov.in/nwmp-data/",
    "license": registry_license("cpcb-nwmp-annual"),
    "role": "input",
    "as_of": "2024",
}

GPKG_PIPELINE = "scripts/build_basin_gpkg_layers.py (scripts/basin-sources/cauvery-ka-paani.json)"


def wq(basin: str) -> str:
    return f"scripts/build_basin_wq_param_packs.py (scripts/basin-sources/{basin}-wq-params.json)"


# path (relative to public/data/basins) -> (scope id, dataset, sources, method, produced_by)
ARTIFACTS: dict[str, tuple[str, str, list[dict], str, str]] = {
    "cauvery-ka/rivers.geojson": (
        "cauvery-ka", "basins/rivers",
        [paani("Named river centrelines (Hydrology_Layers.gpkg), mainstem + ten tributaries, clipped to the Karnataka basin share")],
        "derived", GPKG_PIPELINE),
    "cauvery-ka/context-boundary.geojson": (
        "cauvery-ka", "basins/context-boundary",
        [paani("Full Cauvery basin boundary across Karnataka, Kerala, Tamil Nadu and Puducherry (Hydrology_Layers.gpkg)")],
        "derived", GPKG_PIPELINE),
    "cauvery-ka/context-rivers.geojson": (
        "cauvery-ka", "basins/context-rivers",
        [paani("Named river centrelines above the Karnataka basin share (Hydrology_Layers.gpkg), "
               "clipped to the out-of-state upstream catchment")],
        "derived", GPKG_PIPELINE),
    "cauvery-ka/state-boundary.geojson": (
        "cauvery-ka", "basins/state-boundary",
        [snapshot("Karnataka state boundary (Cauvery_Snapshot_view_layers.gpkg), KGIS state layer")],
        "derived", GPKG_PIPELINE),
    "cauvery-ka/waterbodies.geojson": (
        "cauvery-ka", "basins/waterbodies",
        [snapshot("India-WRIS major waterbodies register for the Cauvery basin "
                  "(Cauvery_Snapshot_view_layers.gpkg), clipped to the Karnataka basin share")],
        "derived", GPKG_PIPELINE),
    "cauvery-ka/city-footprint.geojson": (
        "cauvery-ka", "basins/city-footprint",
        [paani("Greater Bengaluru Authority boundary split by the Cauvery basin divide "
               "(Admin-Geopackages.gpkg), used as geometry only")],
        "derived", GPKG_PIPELINE),
    **{f"kabini/readings/CPCB_{c}.json": (
        "kabini", "basins/readings", [CPCB_NWMP], "derived", wq("kabini"))
       for c in (41, 1197, 1445, 2775, 3575)},
    **{f"arkavathi/readings/CPCB_{c}.json": (
        "arkavathi", "basins/readings", [CPCB_NWMP], "derived", wq("arkavathi"))
       for c in (1165, 2778, 2779, 4108, 4501)},
}


def main() -> None:
    today = date.today().isoformat()
    for rel, (scope_id, dataset, sources, method, produced_by) in ARTIFACTS.items():
        fp = BASINS / rel
        payload = json.loads(fp.read_text())
        payload = {k: v for k, v in payload.items() if k not in ENVELOPE_KEYS}
        envelope = {
            "nvdm": "1.0",
            "dataset": dataset,
            "scope": {"kind": "basin", "id": scope_id},
            "provenance": {
                "sources": sources,
                "method": method,
                "produced_at": today,
                "produced_by": produced_by,
            },
        }
        fp.write_text(json.dumps({**envelope, **payload}, separators=(",", ":"), ensure_ascii=False))
        print(f"  enveloped {rel}")
    print(f"{len(ARTIFACTS)} artifacts enveloped.")


if __name__ == "__main__":
    main()
