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

def paani_review(title: str) -> dict:
    """One layer of the 23 Aug 2026 review-round delivery - a dated, closed edition."""
    return {
        "title": f"{title} - Kabini review round (GeoPackages, 23 Aug 2026 delivery)",
        "publisher": "Paani Earth Foundation",
        "closed": True,
        "as_of": "2026-08",
        "role": "input",
        "license": "partner-supplied compilation, cited with attribution; underlying government layers as attributed per layer",
    }


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

KSPCB_FREGISTER = {
    "title": "KSPCB F-Register 2020-21, Regional Office Mysore-2, as on 31 March 2021 "
             "(consented industries by taluk, category and working status)",
    "publisher": "Karnataka State Pollution Control Board",
    "url": "https://kspcb.karnataka.gov.in/sites/default/files/inline-files/Mysore-2_1.pdf",
    "closed": True,
    "as_of": "2021-03-31",
    "role": "input",
    "license": "government register, cited with attribution",
}

FABDEM = {
    "id": "fabdem-dem",
    "title": "FABDEM v1-2 30 m bare-earth DEM (hypsometric bands for the basin)",
    "publisher": "University of Bristol (Hawker et al.), via GEE sat-io",
    "license": registry_license("fabdem-dem"),
    "role": "input",
}

CPCB_PRS = {
    "id": "cpcb-prs-report",
    "title": "Polluted River Stretches for Restoration of Water Quality 2025 (updated version) - Karnataka list p.15, station BOD pp.48 and 144, stretch maxima p.77, improvement-since-2018 annexure p.108",
    "publisher": "Central Pollution Control Board",
    "url": "https://cpcb.gov.in/polluted-river-stretches/",
    "license": registry_license("cpcb-prs-report"),
    "role": "asserts",
    "as_of": "2025-10",
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
    "sub-hydrosheds.geojson": ("basins/sub-hydrosheds", [paani("India-WRIS watershed polygons (Watersheds_in_CauveryBasin)"), KWRIS], "derived", PIPELINE, True),
    "rivers.geojson": ("basins/rivers", [paani("India-WRIS named river centrelines (Kabini, Gundal)"), KWRIS], "derived", PIPELINE, True),
    "context-boundary.geojson": ("basins/context-boundary", [paani("India-WRIS Kabini tributary watershed, full extent across Karnataka and Kerala"), KWRIS], "derived", PIPELINE, True),
    "context-rivers.geojson": ("basins/context-rivers", [paani("India-WRIS named river centrelines, the reach above the Karnataka boundary"), KWRIS], "derived", PIPELINE, True),
    "context-waterbodies.geojson": ("basins/context-waterbodies", [paani("India-WRIS major waterbodies, the Kerala (Wayanad) share of the watershed"), KWRIS], "derived", PIPELINE, True),
    "drainage.geojson": ("basins/drainage", [paani("India-WRIS stream network for the Kabini (Kabini_Drainage)"), KWRIS], "derived", PIPELINE, True),
    "waterbodies-major.geojson": ("basins/waterbodies-major", [paani("India-WRIS major waterbodies"), KWRIS], "derived", PIPELINE, True),
    "waterbodies-minor.geojson": ("basins/waterbodies-minor", [paani("KGIS minor-irrigation tank inventory (KGIS TIS)"), KWRIS], "derived", PIPELINE, True),
    "prs.geojson": ("basins/prs", [paani("CPCB polluted river stretches, digitised (PRS_Stretches_Since_1993)"), paani_review("The 2018 stretch, redrawn against the monitoring station locations"), CPCB_PRS, KWRIS], "derived", PIPELINE, True),
    "prs-drains.geojson": ("basins/prs-drains", [paani_review("Polluting drain outfalls and the drains reaching them, from the October 2020 progress report"), NMCG_MPR, KWRIS], "derived", PIPELINE, True),
    "prs.json": ("basins/prs", [CPCB_PRS, KSPCB_PLAN, NMCG_MPR, DEP_MYSURU, KSPCB_FREGISTER, WRIS], "manual",
                 "Authored from the documents' own tables, page-cited; the 2018 stretch length is KSPCB's own figure because the delivered geometry maps only part of it. Nanjangud industrial-register counts come from scripts/build_kabini_fregister.py.", False),
    "elevation-bands.geojson": ("basins/elevation-bands", [FABDEM, KWRIS], "derived",
                                "neer-vazhvu-api/scripts/build_elevation_bands.py --basin kabini", True),
    "admin-district.geojson": ("basins/admin-district", [paani("KGIS district boundaries"), KWRIS], "derived", PIPELINE, True),
    "admin-taluk.geojson": ("basins/admin-taluk", [paani("KGIS taluk (subdistrict) boundaries"), KWRIS], "derived", PIPELINE, True),
    "admin-town.geojson": ("basins/admin-town", [paani("KGIS urban local body boundaries"), KWRIS], "derived", PIPELINE, True),
    "flow-stations.geojson": ("basins/flow-stations", [paani_review("CWC hydrological observation sites, locations and site types validated"), WRIS], "mixed", f"{PIPELINE} + {FLOW}", True),
    "monitoring-points.geojson": ("basins/monitoring-points", [paani_review("KSPCB water-quality monitoring stations, validated and extended")], "derived", PIPELINE, True),
    "pressures-industrial.geojson": ("basins/pressures-industrial", [paani("KIADB industrial areas and points (KGIS)"), paani_review("Industrial areas draining toward the stretch, and units outside any estate")], "derived", PIPELINE, True),
    "pressures-quarries.geojson": ("basins/pressures-quarries", [paani("Quarry polygons"), OSM], "derived", PIPELINE, True),
    "forests.geojson": ("basins/forests", [paani("KGIS notified forest boundaries")], "derived", PIPELINE, True),
    "protected-areas.geojson": ("basins/protected-areas", [paani("KGIS protected area boundaries (KFDC)")], "derived", PIPELINE, True),
    "command-areas.geojson": ("basins/command-areas", [paani("India-WRIS irrigation command areas")], "derived", PIPELINE, True),
    "infrastructure.geojson": ("basins/infrastructure", [paani("India-WRIS dam and barrage/weir/anicut registers, 14 April 2026 extracts"), paani_review("Sewage treatment plants, from the January 2025 progress report and the CPCB 2021 inventory")], "derived", PIPELINE, True),
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

        # Heavy families are sliced per sub-hydroshed by the ingest engine and
        # each shard is fetched on its own, so every shard carries the same
        # envelope as its family file. (The engine preserves these on re-ingest;
        # this is what puts them there the first time.)
        shard_dir = fp.parent / fp.stem
        n_shards = 0
        if fp.suffix == ".geojson" and shard_dir.is_dir():
            for shard in sorted(shard_dir.glob("*.geojson")):
                sp = json.loads(shard.read_text())
                sp = {k: v for k, v in sp.items() if k not in ENVELOPE_KEYS}
                shard.write_text(json.dumps({**envelope, **sp}, separators=(",", ":")))
                n_shards += 1
            print(f"    + {n_shards} sliced shards")
    print(f"{len(ARTIFACTS)} artifacts enveloped.")


if __name__ == "__main__":
    main()
