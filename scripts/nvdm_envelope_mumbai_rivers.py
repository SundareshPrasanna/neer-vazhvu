#!/usr/bin/env python3
"""Stamp NVDM v1 envelopes on the mumbai-rivers basin artifacts (L2 gate,
enforcing on new data artifacts).

Run AFTER scripts/build_mumbai_rivers_basin.py; the builder writes through
nvdm_write.write_artifact, which preserves these envelopes on every later
re-run, so this only needs re-running when the source list itself changes.

Identity follows the catalogue: dataset = basins/<layer>, scope = mumbai-rivers.
Living sources carry Headwaters registry ids (licence text comes from the
registry, never inline); one-time documents are closed + dated. Every
registered id named here must list the artifact in its registry dependsOn -
scripts/source-registry/mumbai.json and platform.json carry those joins.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
from registry_license import registry_license  # noqa: E402

BASIN = REPO / "public/data/basins/mumbai-rivers"
BUILD = "scripts/build_mumbai_rivers_basin.py"

# ── Source blocks ────────────────────────────────────────────────────────────

def reg(sid: str, title: str, publisher: str, role: str = "input", **extra) -> dict:
    return {"id": sid, "title": title, "publisher": publisher, "license": registry_license(sid), "role": role, **extra}


OSM = reg("osm-overpass", "OpenStreetMap (Overpass API extracts: rivers, water bodies, drains, industrial landuse, corporation boundaries)", "OpenStreetMap contributors")
FABDEM = reg("fabdem-dem", "FABDEM v1-2 30 m bare-earth DEM", "University of Bristol (Hawker et al.), via GEE sat-io")
CPCB_PRS = reg("cpcb-prs-report", "CPCB, Polluted River Stretches for Restoration of Water Quality, October 2025 (updated version)", "Central Pollution Control Board",
               url="https://cpcb.gov.in/polluted-river-stretches/", as_of="2025-10")
MPCB_WQR = reg("mpcb-water-quality-reports", "MPCB annual Water Quality Status of Maharashtra reports (2018-19 to 2023-24; 2019-20 never published)", "Maharashtra Pollution Control Board",
               url="https://mpcb.gov.in/focus-area/reports-documents/water", as_of="2024")
PRAJA = reg("praja-civic-issues-mumbai", "Praja Foundation, Report on the Status of Civic Issues in Mumbai (May 2025 edition = 2024 data; RTI-sourced tables)", "Praja Foundation (via OpenCity mirror)", as_of="2024")
MPCB_STP = reg("mpcb-stp-inventory", "MPCB per-STP inventory (STP information published on the website)", "Maharashtra Pollution Control Board")
BMC_ESR = reg("bmc-esr-annual", "BMC Environment Status Report 2024-25 (MSDP-2 plant progress and completion dates, Table 11.1; Mithi works status)", "Brihanmumbai Municipal Corporation", role="asserts", as_of="2025")
CGWB = reg("cgwb-yearbook-maharashtra", "CGWB Ground Water Year Book of Maharashtra (2024-25; 2022-23 stitched) - National Hydrograph Network wells", "CGWB Central Region, Nagpur", as_of="2025")
FLOOD = reg("bmc-dm-floodspots", "BMC Disaster Management flood-spot register (floodSpot/loadAll API)", "BMC Disaster Management (dmwebtwo.mcgm.gov.in)")
PRAVAH = reg("wrd-pravah-dam-feed", "Maharashtra WRD Pravah dam-safety daily bulletin (live capacities of the state dams)", "Maharashtra WRD (Pravah dam-safety portal)", role="asserts")

# One-time documents (closed + dated; no registry id exists for them).
LOST_TANKS_BOOK = {
    "title": "Sharada Dwivedi and Rahul Mehrotra, Bombay: The Cities Within (1995), with Sahapedia (tanks and pyaaus of Bombay) and Gillian Tindall, City of Gold (1982)",
    "publisher": "Eminence Designs (Dwivedi & Mehrotra); Sahapedia; Temple Smith (Tindall)",
    "license": "academic publication, cited with attribution",
    "closed": True,
    "as_of": "1995",
    "role": "input",
}
BMC_SHARES = {
    "title": "BMC Hydraulic Engineer's Department, published live-storage (useful content) figures for the seven lakes, as carried in the city config (src/lib/cities/mumbai.ts, fullCapacityMcft)",
    "publisher": "Brihanmumbai Municipal Corporation, Hydraulic Engineer's Department",
    "license": "Maharashtra government publication, cited with attribution",
    "closed": True,
    "as_of": "2026",
}
MITHI_ACTION_PLAN = {
    "title": "MPCB Action Plan for Mithi River (2019) - station 2168 series context and the 16-point sampling",
    "publisher": "Maharashtra Pollution Control Board",
    "license": "Maharashtra government publication, cited with attribution",
    "closed": True,
    "as_of": "2019",
}
NGT_POWAI = {
    "title": "NGT OA 150/2025 (Powai Lake) proceedings, July 2025, as reported by the Free Press Journal (18 MLD inflow; STP not before 11 December 2027)",
    "publisher": "National Green Tribunal (Western Zone bench), via Free Press Journal",
    "license": "press report of tribunal proceedings, cited with attribution",
    "closed": True,
    "as_of": "2025-07",
}

RIVERS_IN = "public/geojson/mumbai-rivers.geojson"
CORPS_IN = "public/geojson/mumbai-corporations-2024.geojson"
WB_IN = "public/geojson/mumbai-water-bodies-current.geojson"
CASCADE_IN = "public/data/cascade/mumbai-cascade-catchments.geojson"
SHEDS_IN = "public/data/basins/mumbai-rivers/sub-hydrosheds.geojson"  # the shedId join; the pipeline input behind it is named in the note
RQ_IN = "public/data/river-quality-mumbai.json"

# file (relative to the basin dir) -> (dataset, sources, method, produced_by, internal_inputs, compact)
ARTIFACTS: dict[str, tuple[str, list[dict], str, str, list[str], bool]] = {
    "boundary.geojson": ("basins/boundary", [OSM], "derived", BUILD, [CORPS_IN], True),
    "admin-corporation.geojson": ("basins/admin-corporation", [OSM], "derived", BUILD, [CORPS_IN], True),
    "sub-hydrosheds.geojson": ("basins/sub-hydrosheds", [FABDEM, OSM], "derived", f"{BUILD} over scripts/derive_mumbai_subbasins_fabdem.py (pipeline-inputs/mumbai-river-catchments-fabdem.geojson) + neer-vazhvu-api/app/cascade", [CASCADE_IN, RIVERS_IN], True),
    "reservoir-catchments.geojson": ("basins/reservoir-catchments", [FABDEM, OSM], "derived", f"{BUILD} over neer-vazhvu-api/app/cascade catchments", [CASCADE_IN], True),
    "rivers.geojson": ("basins/rivers", [OSM], "derived", BUILD, [RIVERS_IN], True),
    "waterbodies-major.geojson": ("basins/waterbodies-major", [OSM, FABDEM], "derived", BUILD, [WB_IN, SHEDS_IN], True),
    "waterbodies-minor.geojson": ("basins/waterbodies-minor", [OSM, FABDEM], "derived", BUILD, [WB_IN, SHEDS_IN], True),
    "waterbodies-lost.geojson": ("basins/waterbodies-lost", [LOST_TANKS_BOOK, FABDEM], "derived", BUILD, ["public/data/water-bodies-lost-mumbai.json", SHEDS_IN], True),
    "reservoirs.geojson": ("basins/reservoirs", [PRAVAH, BMC_SHARES, OSM, FABDEM], "derived", BUILD, ["public/data/mmr-dam-storage.json", WB_IN, CASCADE_IN], True),
    "monitoring-points.geojson": ("basins/monitoring-points", [MPCB_WQR, PRAJA, CPCB_PRS, MITHI_ACTION_PLAN, FABDEM], "derived", BUILD, [RQ_IN, SHEDS_IN], True),
    "prs-stretches.geojson": ("basins/prs-stretches", [CPCB_PRS, OSM, MPCB_WQR], "derived", BUILD, [RIVERS_IN, RQ_IN], True),
    "groundwater-wells.geojson": ("basins/groundwater-wells", [CGWB, FABDEM], "derived", BUILD, ["public/data/mumbai-cgwb-stations.json", SHEDS_IN], True),
    "infrastructure.geojson": ("basins/infrastructure", [MPCB_STP, PRAJA, OSM, BMC_ESR, FABDEM], "derived", BUILD, ["public/data/industrial-sources-mumbai.json", "public/data/commitments-mumbai.json", SHEDS_IN], True),
    "flood-hotspots.geojson": ("basins/flood-hotspots", [FLOOD, FABDEM], "derived", BUILD, ["public/data/mumbai-flood-hotspots.geojson", SHEDS_IN], True),
    "industries.geojson": ("basins/industries", [OSM, FABDEM], "derived", f"{BUILD} (Overpass landuse=industrial, fetched 2026-09-06)", [SHEDS_IN], True),
    "drainage.geojson": ("basins/drainage", [OSM, FABDEM], "derived", BUILD, ["public/geojson/mumbai-drainage.geojson", SHEDS_IN], True),
    "gaps.geojson": ("basins/gaps", [FABDEM, OSM], "derived", BUILD, [SHEDS_IN], True),
    "gaps.json": ("basins/gaps", [CPCB_PRS, MPCB_WQR, PRAJA, MPCB_STP, BMC_ESR, NGT_POWAI, MITHI_ACTION_PLAN], "manual",
                  "Authored from the documents' own tables, annexure- and table-cited; the river-file and commitments-register artifacts carry the same figures with their per-record citations.", [], False),
    "inventory.json": ("basins/inventory", [OSM, FABDEM, CPCB_PRS, MPCB_WQR], "derived", BUILD, [], False),
    "readings/mithi-kurla.json": ("basins/readings", [MPCB_WQR, PRAJA, CPCB_PRS], "derived", BUILD, [RQ_IN], True),
    "readings/ulhas-badlapur.json": ("basins/readings", [MPCB_WQR, CPCB_PRS], "derived", BUILD, [RQ_IN], True),
    "readings/ulhas-nrc-mohane.json": ("basins/readings", [MPCB_WQR, CPCB_PRS], "derived", BUILD, [RQ_IN], True),
    "readings/ulhas-jambhul.json": ("basins/readings", [MPCB_WQR, CPCB_PRS], "derived", BUILD, [RQ_IN], True),
}

ENVELOPE_KEYS = ("nvdm", "dataset", "scope", "projection", "provenance", "ext")


def stamp(fp: Path, dataset: str, sources: list[dict], method: str, produced_by: str, internal_inputs: list[str], compact: bool, produced_at: str) -> None:
    payload = json.loads(fp.read_text())
    payload = {k: v for k, v in payload.items() if k not in ENVELOPE_KEYS}
    prov: dict = {"sources": sources, "method": method, "produced_at": produced_at, "produced_by": produced_by}
    if internal_inputs:
        prov["internal_inputs"] = internal_inputs
    prov["note"] = (
        "Mumbai's rivers and lakes basin atlas (scope mumbai-rivers; the city's own scope id 'mumbai' is the MMR region). "
        "Catchment joins (shedId) come from sub-hydrosheds.geojson, whose city half is the reviewed pipeline input "
        "pipeline-inputs/mumbai-river-catchments-fabdem.geojson (FABDEM + WhiteboxTools); CPCB stretch and station figures are read from "
        "the reviewed national table pipeline-inputs/atlas/prs/cpcb-2025.json. FABDEM lineage makes the catchment-joined families "
        "CC BY-NC-SA (non-commercial) encumbered."
    )
    doc = {**{"nvdm": "1.0", "dataset": dataset, "scope": {"kind": "basin", "id": "mumbai-rivers"}, "provenance": prov}, **payload}
    fp.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) if compact else json.dumps(doc, ensure_ascii=False, indent=2) + "\n")


def main() -> None:
    today = date.today().isoformat()
    for rel, (dataset, sources, method, produced_by, inputs, compact) in ARTIFACTS.items():
        fp = BASIN / rel
        if not fp.exists():
            print(f"  missing {rel} - run {BUILD} first")
            continue
        stamp(fp, dataset, sources, method, produced_by, inputs, compact, today)
        print(f"  enveloped {rel:32} -> {dataset}")
        # Heavy families are sliced per catchment; every shard carries its family's envelope.
        shard_dir = fp.parent / fp.stem
        if shard_dir.is_dir():
            for shard in sorted(shard_dir.glob("*.geojson")):
                stamp(shard, dataset, sources, method, produced_by, inputs, True, today)
            print(f"    + {len(list(shard_dir.glob('*.geojson')))} shards")


if __name__ == "__main__":
    main()
