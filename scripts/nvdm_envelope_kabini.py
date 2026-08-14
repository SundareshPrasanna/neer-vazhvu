#!/usr/bin/env python3
"""Stamp NVDM v1 envelopes on the Kabini basin artifacts (L2 gate, enforcing).

Kabini is the first basin built after NVDM v1 acceptance (2026-07-30), so its
artifacts carry envelopes from birth - the older basins are grandfathered L0.
Run AFTER the pipeline (build_kabini_sources.py -> ingest_basin.py ->
build_basin_flow_readings.py); both producers preserve existing envelopes via
nvdm_write.merge_envelope, so this only needs re-running when the source list
itself changes.

Identity follows the catalogue: dataset = basins/<layer>, scope = kabini.
Living sources carry Headwaters registry ids (licence text comes from the
registry, never inline); one-time editions (the partner GeoPackage delivery,
the district DEP PDFs) are closed + dated per the envelope schema.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
from registry_license import registry_license  # noqa: E402

BASIN = REPO / "public/data/basins/kabini"

# ── Source blocks ────────────────────────────────────────────────────────────

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


KWRIS = {
    "id": "kwris-basin-geoserver",
    "title": "Karnataka WRD basin decomposition, sub-basin C2 (KWRIS GeoServer, via the cauvery-ka atlas ingest)",
    "publisher": "ACIWRM / Karnataka Water Resources Department",
    "url": "https://kwris.karnataka.gov.in/",
    "license": registry_license("kwris-basin-geoserver"),
    "role": "input",
    "as_of": "2026-07",
}

WRIS = {
    "id": "wris-live-services",
    "title": "India-WRIS Dataset API - CWC hydrological observations (River Water Level / River Water Discharge)",
    "publisher": "CWC / NWIC, India-WRIS",
    "url": "https://indiawris.gov.in/wris/",
    "license": registry_license("wris-live-services"),
    "role": "asserts",
}

OSM = {
    "id": "osm-overpass",
    "title": "Quarry polygons digitised from OpenStreetMap",
    "publisher": "OpenStreetMap contributors",
    "url": "https://www.openstreetmap.org/",
    "license": registry_license("osm-overpass"),
    "role": "input",
}

NMCG_MPR = {
    "id": "nmcg-ngt-mpr-listing",
    "title": "NMCG monthly progress reports (Karnataka, Kabini stretch) - via the cauvery-ka accountability matrix",
    "publisher": "NMCG",
    "url": "https://nmcg.nic.in/ngtprogressreport.aspx",
    "license": registry_license("nmcg-ngt-mpr-listing"),
    "role": "asserts",
}

KSPCB_PLAN = {
    "title": "KSPCB Action Plan for Rejuvenation of River Kabini (edition mirrored for the cauvery-ka accountability build)",
    "publisher": "Karnataka State Pollution Control Board",
    "closed": True,
    "as_of": "2026-07",
    "role": "asserts",
    "license": "government plan document, cited with attribution",
}


def dep(district: str, url: str, as_of: str) -> dict:
    return {
        "title": f"District Environmental Plan, {district}",
        "publisher": f"District Administration, {district}",
        "url": url,
        "closed": True,
        "as_of": as_of,
        "role": "asserts",
        "license": "government plan document, cited with attribution",
    }


DEP_MYSURU = dep("Mysuru", "https://cdn.s3waas.gov.in/s30d3180d672e08b4c5312dcdafdf6ef36/uploads/2022/05/2022051170.pdf", "2022-05")
DEP_CHAMARAJANAGARA = dep("Chamarajanagar", "https://cdn.s3waas.gov.in/s3959a557f5f6beb411fd954f3f34b21c3/uploads/2021/07/2021071512.pdf", "2021-06")
DEP_KODAGU = dep("Kodagu", "https://cdn.s3waas.gov.in/s3c8ed21db4f678f3b13b9d5ee16489088/uploads/2021/07/2021071559.pdf", "2021-07")

PIPELINE = "scripts/build_kabini_sources.py + scripts/ingest_basin.py (scripts/basin-sources/kabini-ingest.json)"
FLOW = "scripts/build_basin_flow_readings.py (scripts/basin-sources/kabini-flow.json)"

# file (relative to the basin dir) -> (dataset, sources, method, produced_by, compact)
ARTIFACTS: dict[str, tuple[str, list[dict], str, str, bool]] = {
    "boundary.geojson": ("basins/boundary", [KWRIS], "derived", PIPELINE, True),
    "sub-hydrosheds.geojson": ("basins/sub-hydrosheds", [KWRIS], "derived", PIPELINE, True),
    "rivers.geojson": ("basins/rivers", [KWRIS], "derived", PIPELINE, True),
    "flow-stations.geojson": ("basins/flow-stations", [paani("CWC hydrological observation sites"), WRIS], "mixed", f"{PIPELINE} + {FLOW}", True),
    "monitoring-points.geojson": ("basins/monitoring-points", [paani("CPCB NWMP monitoring stations (WRIS station registry)")], "derived", PIPELINE, True),
    "pressures-industrial.geojson": ("basins/pressures-industrial", [paani("KIADB industrial areas and points (KGIS)")], "derived", PIPELINE, True),
    "pressures-quarries.geojson": ("basins/pressures-quarries", [paani("Quarry polygons"), OSM], "derived", PIPELINE, True),
    "forests.geojson": ("basins/forests", [paani("KGIS notified forest boundaries")], "derived", PIPELINE, True),
    "protected-areas.geojson": ("basins/protected-areas", [paani("KGIS protected area boundaries (KFDC)")], "derived", PIPELINE, True),
    "command-areas.geojson": ("basins/command-areas", [paani("India-WRIS irrigation command areas")], "derived", PIPELINE, True),
    "infrastructure.geojson": ("basins/infrastructure", [paani("CWC dam register points")], "derived", PIPELINE, True),
    "gaps.geojson": ("basins/gaps", [paani("District boundaries (KGIS Admin GeoPackage)"), KWRIS], "derived", PIPELINE, True),
    "gaps.json": ("basins/gaps", [DEP_MYSURU, DEP_CHAMARAJANAGARA, DEP_KODAGU], "manual", "Authored from the three district plans' own tables, page-cited; see the conflicts entries for the plans' internal contradictions.", False),
    "accountability.json": ("basins/accountability", [KSPCB_PLAN, NMCG_MPR], "manual", "Authored on the cauvery-ka overview (accountability-C2.json) and carried verbatim by scripts/build_kabini_sources.py.", False),
    "inventory.json": ("basins/inventory", [paani("All partner layers"), KWRIS], "derived", PIPELINE, False),
    "readings/CCP00B1.json": ("basins/readings", [WRIS], "api", FLOW, True),
    "readings/0043-CDBNG.json": ("basins/readings", [WRIS], "api", FLOW, True),
    "readings/0033-cdbng.json": ("basins/readings", [WRIS], "api", FLOW, True),
}

ENVELOPE_KEYS = ("nvdm", "dataset", "scope", "provenance", "projection", "ext")


def main() -> None:
    today = date.today().isoformat()
    for rel, (dataset, sources, method, produced_by, compact) in ARTIFACTS.items():
        fp = BASIN / rel
        payload = json.loads(fp.read_text())
        payload = {k: v for k, v in payload.items() if k not in ENVELOPE_KEYS}
        envelope = {
            "nvdm": "1.0",
            "dataset": dataset,
            "scope": {"kind": "basin", "id": "kabini"},
            "provenance": {
                "sources": sources,
                "method": method,
                "produced_at": today,
                "produced_by": produced_by,
            },
        }
        doc = {**envelope, **payload}
        if compact:
            fp.write_text(json.dumps(doc, separators=(",", ":")))
        else:
            fp.write_text(json.dumps(doc, indent=2) + "\n")
        print(f"  enveloped {rel:28} -> {dataset}")
    print(f"{len(ARTIFACTS)} artifacts enveloped.")


if __name__ == "__main__":
    main()
