#!/usr/bin/env python3
"""Stamp NVDM v1 envelopes on the erode-rivers basin artifacts (L2 gate,
enforcing on new data artifacts).

Run AFTER scripts/build_erode_rivers_basin.py; the builder writes through
nvdm_write.write_artifact, which preserves these envelopes on every later
re-run, so this only needs re-running when the source list itself changes.

Identity follows the catalogue: dataset = basins/<layer>, scope = erode-rivers.
Every source here is a living one and carries its Headwaters registry id
(licence text comes from the registry, never inline). Every registered id named
here must list the artifact in its registry dependsOn - basins.json,
platform.json and chennai.json carry those joins.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
from registry_license import registry_license  # noqa: E402

BASIN = REPO / "public/data/basins/erode-rivers"
BUILD = "scripts/build_erode_rivers_basin.py"


def reg(sid: str, title: str, publisher: str, role: str = "input", **extra) -> dict:
    return {"id": sid, "title": title, "publisher": publisher, "license": registry_license(sid), "role": role, **extra}


TNGIS = reg("tngis-open-geoserver", "TNGIS open GeoServer (WFS): district, taluk, block and village panchayat boundaries, TN WRD sub-basins and reservoirs, micro-watershed atlas, all-water-bodies register, named tanks, mine leases, industry register matched to land parcels", "Tamil Nadu e-Governance Agency (TNGIS)",
            url="https://tngis.tn.gov.in/tngismaps/ows")
SIPCOT = reg("sipcot-gis-geoserver", "SIPCOT GIS (WFS): industrial complex outlines, Perundurai DTA and SEZ", "State Industries Promotion Corporation of Tamil Nadu (SIPCOT)",
             url="https://sipcotgis.tn.gov.in/")
OSM = reg("osm-overpass", "OpenStreetMap (Overpass API extract: named river and canal courses)", "OpenStreetMap contributors")
CPCB_PRS = reg("cpcb-prs-report", "CPCB, Polluted River Stretches for Restoration of Water Quality, October 2025 (updated version)", "Central Pollution Control Board",
               url="https://cpcb.gov.in/polluted-river-stretches/", as_of="2025-10")
TNPCB_WQ = reg("tnpcb-prs-cauvery", "TNPCB stretch-wise monthly water-quality reports, January to December 2023 (the last year published)", "Tamil Nadu Pollution Control Board",
               url="https://tnpcb.gov.in/pollutedriverstretches.php", as_of="2023-12")
INGRES = reg("ingres-gw-assessment-tn", "IN-GRES dynamic groundwater assessment 2024-2025, stage of extraction by taluk", "CGWB with IIT Hyderabad (IN-GRES)",
             url="https://ingres.iith.ac.in/", as_of="2025")  # assessment year 2024-2025; as_of takes a date, the title carries the span

MPR = reg("nmcg-ngt-mpr-listing", "Tamil Nadu monthly progress reports to NMCG under NGT O.A. 673/2018 (August 2020 to June 2026 editions)", "Government of Tamil Nadu, via the National Mission for Clean Ganga",
          url="https://nmcg.nic.in/ngtprogressreport.aspx", as_of="2026-06")
TNPCB_PLAN = reg("tnpcb-prs-cauvery", "TNPCB, Action Plan on Rejuvenation of River Cauvery, Mettur to Mayiladuthurai stretch (Priority I), 2019, with the preamble to the stretch action plans; TNPCB NWMP annual data 2024 (station 1320)", "Tamil Nadu Pollution Control Board",
                 url="https://tnpcb.gov.in/PDF/About_Us/projects/PR-Stretches/Water-QA-MN-report/actionplan/PrsCauvery24919.pdf", as_of="2019")
# One-time documents (closed + dated; no registry id exists for them).
MAWS_NOTES = {
    "title": "Municipal Administration and Water Supply Department, policy notes 2020-21, 2024-25 and 2025-26 (Erode Corporation sewerage and solid waste)",
    "publisher": "Government of Tamil Nadu, Municipal Administration and Water Supply Department",
    "license": "public policy document, cited with attribution",
    "closed": True,
    "as_of": "2025",
    "role": "input",
}
TEXTILES_NVC = {
    "title": "Nadanthai Vaazhi Cauvery: proposed common effluent treatment plants and common reject management systems (proposal of 13.03.2023), tntextiles.tn.gov.in",
    "publisher": "Department of Textiles, Government of Tamil Nadu",
    "license": "government plan document, cited with attribution",
    "closed": True,
    "as_of": "2023-03",
    "role": "input",
}
TNPCB_CETP_LISTS = {
    "title": "Details of Common Effluent Treatment Plants pertaining to the clusters of textile and tannery industries in Tamil Nadu (2020), tnpcb.gov.in/cept.php",
    "publisher": "Tamil Nadu Pollution Control Board",
    "license": "government register, cited with attribution",
    "closed": True,
    "as_of": "2020",
    "role": "input",
}
CEPI_PLAN = {
    "title": "CEPI action plan for the Erode industrial cluster (September 2020), Table 1.1 and sections 1.1 and 1.6",
    "publisher": "Tamil Nadu Pollution Control Board, published by the Central Pollution Control Board",
    "license": "government plan document, cited with attribution",
    "closed": True,
    "as_of": "2020-09",
    "role": "input",
}
CPCB_MINUTES = {
    "title": "CPCB task team minutes under NGT O.A. 673/2018, 3rd and 5th meetings (2019)",
    "publisher": "Central Pollution Control Board",
    "license": "GoI publication, cited with attribution",
    "closed": True,
    "as_of": "2019",
    "role": "input",
}

NWDP = reg("nwic-nwdp-groundwater-level", "National Water Data Portal: Ground Water Level datasets for Tamil Nadu (CGWB telemetry 2026-2030, Tamil Nadu SW GW telemetry 2026-2030, CGWB manual quarterly 2021-2025)", "National Water Informatics Centre (NWIC), Ministry of Jal Shakti",
           url="https://nwdp.nwic.gov.in/")

CWC_CANALS = reg("nwic-nwdp-cwc-canal-network", "CWC canal network and water resource project (command area) layers, National Water Data Portal", "Central Water Commission, via the National Water Informatics Centre (NWIC)",
                 url="https://nwdp.nwic.gov.in/", as_of="2025")
CWC_RIVER = reg("nwic-nwdp-cwc-river-data", "CWC river discharge (manual daily), surface water quality and daily reservoir levels for Tamil Nadu and the Cauvery basin, National Water Data Portal", "Central Water Commission, via the National Water Informatics Centre (NWIC)",
                url="https://nwdp.nwic.gov.in/")
TNPCB_RT = reg("tnpcb-realtime-wq-dashboard", "TNPCB real-time water quality monitoring dashboard: monthly means of sensor readings", "Tamil Nadu Pollution Control Board",
               url="https://tnpcb.gov.in/rtwqmstnpcb")
SHEDS_IN = "public/data/basins/erode-rivers/sub-hydrosheds.geojson"  # the shedId join
# The panchayat outlines carry each panchayat's tap-connection headline and Census 2011 totals from the district Atlas.
ATLAS_PANCHAYAT_INPUTS = sorted(
    str(p.relative_to(REPO)) for fam in ("briefs", "census-2011") for p in (REPO / "public/data/atlas/tn/erode" / fam).glob("*.json")
)
RIVERS_IN = "public/data/basins/erode-rivers/rivers.geojson"
CAUVERY_TN = "public/data/basins/cauvery-tn"
GW_IN = "public/data/atlas/tn/erode/groundwater-taluks.json"
SECTORS_IN = "pipeline-inputs/basins/erode-rivers/tnpcb-type-sectors.json"  # named in the note: internal_inputs takes catalogued artifacts only

# file (relative to the basin dir) -> (dataset, sources, internal_inputs, compact); MANUAL names the hand-authored ones
MANUAL = {"prs.json"}
ARTIFACTS: dict[str, tuple[str, list[dict], list[str], bool]] = {
    "boundary.geojson": ("basins/boundary", [TNGIS], [], True),
    "sub-hydrosheds.geojson": ("basins/sub-hydrosheds", [TNGIS], [], True),
    "rivers.geojson": ("basins/rivers", [OSM, CWC_CANALS, TNGIS], [], True),
    "canals.geojson": ("basins/canals", [CWC_CANALS, TNGIS], [SHEDS_IN], True),
    "command-areas.geojson": ("basins/command-areas", [CWC_CANALS, TNGIS], [SHEDS_IN], True),
    "reservoirs.geojson": ("basins/reservoirs", [TNGIS, CWC_RIVER], [SHEDS_IN], True),
    "tanks.geojson": ("basins/tanks", [TNGIS], [f"{CAUVERY_TN}/tanks.geojson", SHEDS_IN], True),
    "monitoring-points.geojson": ("basins/monitoring-points", [TNPCB_WQ, OSM, TNGIS], [f"{CAUVERY_TN}/wq-stations.geojson", SHEDS_IN], True),
    "prs.geojson": ("basins/prs", [CPCB_PRS, TNPCB_PLAN, OSM, TNGIS], [RIVERS_IN], True),
    "prs-drains.geojson": ("basins/prs-drains", [TNPCB_PLAN, TNGIS], [RIVERS_IN, SHEDS_IN], True),
    "prs.json": ("basins/prs", [CPCB_PRS, TNPCB_PLAN, MPR, MAWS_NOTES, CPCB_MINUTES, TEXTILES_NVC, TNPCB_CETP_LISTS, CEPI_PLAN], [], False),
    "industries.geojson": ("basins/industries", [TNGIS], [SHEDS_IN], True),
    "treatment-plants.geojson": ("basins/treatment-plants", [TNGIS, TEXTILES_NVC, TNPCB_CETP_LISTS, MPR], [SHEDS_IN], True),
    "cepi-area.geojson": ("basins/cepi-area", [CEPI_PLAN, TNGIS], [SHEDS_IN], True),
    "industrial-estates.geojson": ("basins/industrial-estates", [SIPCOT, TNGIS], [SHEDS_IN], True),
    "quarries.geojson": ("basins/quarries", [TNGIS], [SHEDS_IN], True),
    "groundwater-taluks.geojson": ("basins/groundwater-taluks", [INGRES, TNGIS], [GW_IN, SHEDS_IN], True),
    "admin-taluk.geojson": ("basins/admin-taluk", [TNGIS], [SHEDS_IN], True),
    "groundwater-wells.geojson": ("basins/groundwater-wells", [NWDP, TNGIS], [SHEDS_IN], True),
    "gauging-stations.geojson": ("basins/gauging-stations", [CWC_RIVER, OSM, TNGIS], [RIVERS_IN, SHEDS_IN], True),
    "realtime-stations.geojson": ("basins/realtime-stations", [TNPCB_RT, TNGIS], [SHEDS_IN], True),
    "admin-block.geojson": ("basins/admin-block", [TNGIS], [SHEDS_IN], True),
    "admin-gp.geojson": ("basins/admin-gp", [TNGIS], [SHEDS_IN, *ATLAS_PANCHAYAT_INPUTS], True),
    "waterbodies-major.geojson": ("basins/waterbodies-major", [TNGIS], [SHEDS_IN], True),
    "waterbodies-minor.geojson": ("basins/waterbodies-minor", [TNGIS], [SHEDS_IN], True),
    "watersheds.geojson": ("basins/watersheds", [TNGIS], [SHEDS_IN], True),
    "sub-watersheds.geojson": ("basins/sub-watersheds", [TNGIS], [SHEDS_IN], True),
    "mini-watersheds.geojson": ("basins/mini-watersheds", [TNGIS], [SHEDS_IN], True),
    "micro-watersheds.geojson": ("basins/micro-watersheds", [TNGIS], [SHEDS_IN], True),
    "inventory.json": ("basins/inventory", [TNGIS, OSM, SIPCOT, CPCB_PRS, TNPCB_WQ, TNPCB_PLAN, INGRES, NWDP, CWC_CANALS, CWC_RIVER, TNPCB_RT], [], False),
}

ENVELOPE_KEYS = ("nvdm", "dataset", "scope", "projection", "provenance", "ext")
NOTE = (
    "Erode district's rivers, groundwater and industry (scope erode-rivers; the district's own scope id is tn-erode). "
    "The district boundary is the frame and TN WRD's sub-basins, clipped to it, are the catchments (shedId). "
    "The industry register holds only units TNGIS matched to a land parcel, so every count is a lower bound; "
    f"sector comes from the reviewed TNPCB type-code lookup {SECTORS_IN}."
)


def stamp(fp: Path, dataset: str, sources: list[dict], internal_inputs: list[str], compact: bool, produced_at: str) -> None:
    payload = json.loads(fp.read_text())
    payload = {k: v for k, v in payload.items() if k not in ENVELOPE_KEYS}
    manual = fp.name in MANUAL
    prov: dict = {"sources": sources, "method": "manual" if manual else "derived", "produced_at": produced_at,
                  "produced_by": "Authored from the documents' own pages, page-cited; every figure is quoted or transcribed from the cited source." if manual else BUILD}
    if internal_inputs:
        prov["internal_inputs"] = internal_inputs
    prov["note"] = NOTE
    doc = {"nvdm": "1.0", "dataset": dataset, "scope": {"kind": "basin", "id": "erode-rivers"}, "provenance": prov, **payload}
    fp.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) if compact else json.dumps(doc, ensure_ascii=False, indent=2) + "\n")


def main() -> None:
    today = date.today().isoformat()
    for rel, (dataset, sources, inputs, compact) in ARTIFACTS.items():
        fp = BASIN / rel
        if not fp.exists():
            print(f"  missing {rel} - run {BUILD} first")
            continue
        stamp(fp, dataset, sources, inputs, compact, today)
        print(f"  enveloped {rel:32} -> {dataset}")
        # Heavy families are sliced per catchment; every shard carries its family's envelope.
        shard_dir = fp.parent / fp.stem
        if shard_dir.is_dir():
            shards = sorted(shard_dir.glob("*.geojson"))
            for shard in shards:
                stamp(shard, dataset, sources, inputs, True, today)
            print(f"    + {len(shards)} shards")
    # Station chart packs: CWC gauges (cwc-) and CWC reservoir levels (reservoir-); the rest are TNPCB's sensor stations.
    for pack in sorted((BASIN / "readings").glob("*.json")):
        stamp(pack, "basins/readings", [CWC_RIVER] if pack.name.startswith(("cwc-", "reservoir-")) else [TNPCB_RT], [], True, today)
    print(f"  enveloped {len(list((BASIN / 'readings').glob('*.json')))} station packs -> basins/readings")
    extra = sorted(p.name for p in BASIN.glob("*.*json") if p.name not in ARTIFACTS)
    if extra:
        raise SystemExit(f"artifacts with no envelope rule: {extra}")


if __name__ == "__main__":
    main()
