#!/usr/bin/env python3
"""Mumbai NVDM migration: inject the v1 envelope into every envelope-capable
Mumbai artifact (spec Part 9 - Mumbai is city 5, the LAST of the legacy
migration, after the Madurai pilot, Chennai, Delhi and Bangalore, whose
injectors this clones).

Everything here is ADDITIVE: envelope keys are inserted ahead of the existing
payload, no legacy key is removed or renamed, and no value is changed - shape
migration and value changes are separate commits by spec rule 9.4. Scope kind
is REGION, not city: Mumbai on this platform is the full MMR (9 corporations),
and the scope registry says so.

The per-dataset provenance map below is the reviewable heart of this script:
every source entry was verified against the file's own legacy keys
(_note/_provenance/_source/_sources/source/primary_source), the Headwaters
registry (scripts/source-registry/mumbai.json + platform.json), or the
generating pipeline's code (scripts/build-mumbai-*.py, the neer-vazhvu-api
scrapers, app/cascade/districts.py). internal_inputs lists were read out of
the producers' actual load() calls, not their comments. Where a fact could
not be verified it is NOT stated (no fabricated provenance).

Mumbai-specific verifications on record:
  - DataMeet Municipal_Spatial_Data licence is CC BY-SA 2.5 IN per the Mumbai
    folder Readme (repo default CC BY 4.0 "unless explicitly stated";
    verified 2026-07-30). The committed wards layer's legacy _provenance says
    ODbL - a LICENCE CORRECTION recorded in the registry entry and here, the
    payload string left as-is (producer fixed for future runs).
  - Praja civic-issues data keeps its exact registry licence wording:
    "report (c) Praja, RTI-sourced tables; OpenCity mirror" - RTI-sourced
    tables inside a copyrighted report, NOT an open licence.
  - The mumbai cascade run is the DISTRICT pipeline (d8_steepest_descent_v1 /
    catchments_fabdem_wbt_v1) over FABDEM + the committed water-bodies and
    rivers layers; the Sentinel/OSM channel cross-checks are NotImplemented
    (P5) and the buildings/rainfall stages did not run (no such fields in the
    outputs), so unlike Bangalore's city pipeline those upstreams are NOT
    listed here.
  - compute-mumbai-ward-risk.py reads wards-2023 + flood-hotspots + rivers
    (committed, internal_inputs) plus the DataMeet slum clusters (fetched at
    build time, not committed - an external source, not an internal input);
    the Praja Table-4 supply hours are embedded in the script.

Skipped on purpose:
  - cascade/catchment-downstream, cascade/catchment-streams: naked
    indexed-collection maps, grandfathered (spec 6.1) - an envelope would
    change their shape.
  - rainfall-recent-mumbai.json: envelope OWNED BY ITS PRODUCER
    (fetch_recent_rainfall.py, daily) since the pilot.

Citation debt carried honestly (enveloped, but flagged):
  - restoration-priority-mumbai.json: Masunda and Kacharali carry
    area_ha null (flagship register has no area for them; Kala Talao's area
    records conflict) - the contract wants a number, so the artifact reads L2
    with an L3-fail note until the upstream areas are resolved. No number is
    invented to pass a gate.
  - allocations-mumbai.json: five self-supplied arrangements carry
    authority_id null (the corporation is its own authority) - same honest
    L3 fail as Bangalore and Delhi.

Formatting: files stored minified (single-line GeoJSON/maps) stay single-line
with the producer's own separators (spaced json.dump default vs compact);
pretty files keep their stored indent (Mumbai has BOTH indent=1 and indent=2
artifacts). Byte-idempotent under --refresh.

Idempotent: files already carrying `nvdm` are left untouched (--refresh
recomputes the envelope but preserves the original produced_at).
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCOPE = {"kind": "region", "id": "mumbai"}

# ---- source literals (verified) -------------------------------------------

FABDEM = {
    "id": "fabdem-dem",
    "title": "FABDEM v1-2 30 m bare-earth DEM",
    "publisher": "University of Bristol (Hawker et al.), via GEE sat-io",
    "license": "CC BY-NC-SA 4.0 (non-commercial)",
    "role": "input",
}
OSM_SOURCE = {
    "id": "osm-overpass",
    "title": "OpenStreetMap (Overpass API extract)",
    "publisher": "OpenStreetMap contributors",
    "license": "ODbL 1.0",
}
SENTINEL2 = {
    "id": "sentinel-2-l2a",
    "title": "Sentinel-2 L2A imagery (MNDWI shoreline epochs)",
    "publisher": "ESA Copernicus",
    "license": "Copernicus free and open data, attribution required",
    "role": "input",
}
LANDSAT = {
    "id": "usgs-landsat",
    "title": "Landsat 5/7/8 surface reflectance archive (GEE collections)",
    "publisher": "USGS / NASA (Landsat program)",
    "license": "USGS public domain, courtesy attribution",
    "role": "input",
}
IMD_GRID = {
    "id": "imd-gridded-rain",
    "title": "IMD gridded monthly rainfall (0.25 deg, Mumbai grid point)",
    "publisher": "India Meteorological Department",
    "license": "GoI publication, cited with attribution",
}
DATAMEET = {
    "id": "datameet-mumbai-spatial",
    "title": "DataMeet Municipal_Spatial_Data - Mumbai (BMC ward boundaries + SRA-derived slum clusters)",
    "publisher": "DataMeet community (Pune chapter, DataMeet Trust)",
    "license": "CC BY-SA 2.5 IN (Mumbai folder Readme, verified 2026-07-30; share-alike)",
}

# One-time documents (closed + as_of; never registrable as living sources).
MCGM_HANDBOOK = {
    "title": "MCGM 'Water Supply Projects and Water Distribution System O&M' handbook (hosted at Somaiya CDEM)",
    "publisher": "MCGM Hydraulic Engineer's Department",
    "url": "https://cdem.somaiya.edu/media/pdf/Water%20hand%20book%20.pdf",
    "license": "government handbook, cited with attribution",
    "closed": True,
    "as_of": "2012",
}
WHITEPAPER_24X7 = {
    "title": "'Toward Equitable and 24x7 Water Supply for Greater Mumbai' White Paper - key figures via ORF",
    "publisher": "MCGM (White Paper) / ORF (secondary carrier)",
    "license": "public policy document, cited with attribution",
    "closed": True,
    "as_of": "2018",
}
MITHI_ACTION_PLAN = {
    "title": "MPCB Action Plan for Mithi River (2019) - station 2168 series context",
    "publisher": "Maharashtra Pollution Control Board",
    "license": "Maharashtra government publication, cited with attribution",
    "closed": True,
    "as_of": "2019",
}
KALYAN_ESR_2005 = {
    "title": "MPCB Kalyan Region Environment Status Report 2004-05 (Ulhas/Waldhuni baseline)",
    "publisher": "Maharashtra Pollution Control Board",
    "license": "Maharashtra government publication, cited with attribution",
    "closed": True,
    "as_of": "2005",
}
MSMP_2017 = {
    "title": "Maharashtra Shoreline Management Plan 2017 (ADB SCPMIP) - named-beach erosion risk grades",
    "publisher": "Maharashtra Maritime Board",
    "url": "https://mahammb.maharashtra.gov.in/site/upload/pdf/MaharashtraSMP2017.pdf",
    "license": "government plan document, cited with attribution",
    "closed": True,
    "as_of": "2017",
}
NCCR_2018 = {
    "title": "NCCR National Assessment of Shoreline Changes 1990-2016 (Kankara, Ramana Murthy & Rajeevan 2018) - Mumbai district table",
    "publisher": "National Centre for Coastal Research, MoES",
    "license": "GoI publication, cited with attribution",
    "closed": True,
    "as_of": "2018",
}
CCC_2005 = {
    "title": "Concerned Citizens' Commission, 'Mumbai Marooned' - enquiry into the 26 July 2005 deluge",
    "publisher": "Concerned Citizens' Commission",
    "license": "published civil-society report, cited with attribution",
    "closed": True,
    "as_of": "2005",
}
NIDM_2009 = {
    "title": "Gupta, 'Urban floods: case study of Mumbai', Disaster & Development Vol 3(2)",
    "publisher": "National Institute of Disaster Management",
    "license": "GoI journal publication, cited with attribution",
    "closed": True,
    "as_of": "2009",
}
OECD_2010 = {
    "title": "Hallegatte et al., flood risks and climate change in Mumbai (OECD Environment Working Paper)",
    "publisher": "OECD",
    "license": "OECD working paper, cited with attribution",
    "closed": True,
    "as_of": "2010",
}

REG_IDS = {
    "mpcb-water-quality-reports": (
        "MPCB annual Water Quality Status of Maharashtra reports (WQR series 2007-2024; 2019-20 never published)",
        "Maharashtra Pollution Control Board",
        "Maharashtra government publication, cited with attribution",
    ),
    "praja-civic-issues-mumbai": (
        "Praja Foundation, 'Report on the Status of Civic Issues in Mumbai' (RTI-sourced ward tables; May 2025 edition = 2024 data)",
        "Praja Foundation (via OpenCity mirror)",
        "report (c) Praja, RTI-sourced tables; OpenCity mirror",
    ),
    "wrd-flood-line-maps": (
        "Maharashtra WRD Flood Line Maps (legal red/blue-line sheets; 41 of 494 statewide cover the 6 MMR rivers)",
        "Maharashtra Water Resources Department",
        "Maharashtra government publication, cited with attribution",
    ),
    "bmc-esr-annual": (
        "BMC Environment Status Report (annual)",
        "Brihanmumbai Municipal Corporation",
        "government publication, cited with attribution",
    ),
    "bmc-rti-manuals": (
        "BMC Hydraulic Engineer RTI manuals (Dy HE Bhandup Complex + Water Supply Projects departments, Dec 2024)",
        "BMC Hydraulic Engineer's Department",
        "government publication, cited with attribution",
    ),
    "bmc-climate-action-plan": (
        "BMC Climate Budget Report / Mumbai Climate Action Plan (via OpenCity)",
        "BMC Climate Action Cell (via OpenCity)",
        "open (per OpenCity dataset page)",
    ),
    "cgwb-yearbook-maharashtra": (
        "CGWB Ground Water Year Book of Maharashtra (2024-25 canonical; 2022-23 stitched for multi-year depth) + GW Quality trend report",
        "CGWB Central Region, Nagpur",
        "GoI publication, cited with attribution",
    ),
    "mahagr-wrd-resolutions": (
        "Maharashtra WRD Government Resolutions (via the orgpedia mahGRs mirror)",
        "Maharashtra WRD (via the orgpedia mahGRs mirror)",
        "government resolutions, mirrored openly",
    ),
    "mpcb-stp-inventory": (
        "MPCB per-STP inventory (STP_information_on_website_publication)",
        "Maharashtra Pollution Control Board",
        "government publication, cited with attribution",
    ),
    "wrd-pravah-dam-feed": (
        "Maharashtra WRD Pravah dam-safety daily bulletin (all-Maharashtra live-storage PDF, 139 dams)",
        "Maharashtra WRD (Pravah dam-safety portal)",
        "Maharashtra government public feed, no stated licence - cited with attribution",
    ),
    "bmc-dm-floodspots": (
        "BMC Disaster Management flood-spot register (floodSpot/loadAll API)",
        "BMC Disaster Management (dmwebtwo.mcgm.gov.in)",
        "BMC government portal API, no stated licence - cited with attribution",
    ),
    "cpcb-prs-report": (
        "CPCB Polluted River Stretches report, October 2025",
        "Central Pollution Control Board",
        "GoI publication, cited with attribution",
    ),
}


def reg(
    source_id: str,
    role: str | None = None,
    as_of: str | None = None,
    retrieved: str | None = None,
) -> dict:
    title, publisher, license_ = REG_IDS[source_id]
    s = {"id": source_id, "title": title, "publisher": publisher, "license": license_}
    if role:
        s["role"] = role
    if as_of:
        s["as_of"] = as_of
    if retrieved:
        s["retrieved"] = retrieved
    return s


# Cascade lineage per OUTPUT, read out of the pipeline's actual load() calls
# (round-2 review: the generic tanks+rivers list was only true for topology
# outputs). Path constants:
WB = "public/geojson/mumbai-water-bodies-current.geojson"
RIVERS = "public/geojson/mumbai-rivers.geojson"
CASCADE_NODES = "public/data/cascade/mumbai-cascade-nodes.geojson"
CASCADE_EDGES = "public/data/cascade/mumbai-cascade-edges.geojson"
CASCADE_OUTLETS = "public/data/cascade/mumbai-cascade-river-outlets.geojson"
CASCADE_DOWNSTREAM = "public/data/cascade/mumbai-catchment-downstream.json"
CASCADE_NOTE = (
    "Derived by the DISTRICT cascade pipeline (neer-vazhvu-api/app/cascade, "
    "d8_steepest_descent_v1 over FABDEM). Mumbai is "
    "reservoir-impounded, NOT tank-cascade geography - registered for the "
    "lake catchment atlas; the cascade overlay is suppressed when edge_count "
    "is negligible (see districts.py). Sentinel/OSM channel cross-checks are "
    "NotImplemented (P5) and the buildings/rainfall stages did not run for "
    "this district, so those upstreams are deliberately NOT listed. FABDEM "
    "input makes this family CC BY-NC-SA (non-commercial) encumbered."
)


# Only the outputs written via _build_meta carry this stamp (topology, stats,
# systems); catchments/lakes/catchment-quality have no _meta.
HASH_NOTE = " This file's _meta.inputs_hash records the input digests."


def cascade(
    produced_by: str, internal_inputs: list[str], note_suffix: str = ""
) -> dict:
    return {
        "method": "derived",
        "produced_by": produced_by,
        "internal_inputs": internal_inputs,
        "sources": [dict(FABDEM)],
        "note": CASCADE_NOTE + note_suffix,
    }


CASCADE_TOPOLOGY_BY = (
    "neer-vazhvu-api/app/cascade/publish.py write_geojson "
    "(topology.build_graph over the committed tanks + rivers layers)"
)
CASCADE_CATCHMENTS_BY = (
    "neer-vazhvu-api/app/cascade/catchments.py build_catchments "
    "(catchments_fabdem_wbt_v1 over the published nodes + tanks layers)"
)


# ---- per-dataset provenance map (the reviewable core) ----------------------

PROVENANCE: dict[str, dict] = {
    # cascade family (derived; FABDEM-encumbered). internal_inputs per output
    # follow the pipeline's ACTUAL load() calls (round-2 review):
    #   topology outputs read tanks + rivers; build_catchments reads the
    #   published nodes + tanks; write_stats_manifest reads the three
    #   published GeoJSONs; enrich_names additionally reads rivers and the
    #   per-lake downstream paths; _build_meta's inputs_hash reads tanks +
    #   rivers everywhere.
    "cascade/cascade-catchments": cascade(CASCADE_CATCHMENTS_BY, [CASCADE_NODES, WB]),
    "cascade/cascade-edges": cascade(CASCADE_TOPOLOGY_BY, [WB, RIVERS], HASH_NOTE),
    "cascade/cascade-lakes": {
        **cascade(
            CASCADE_CATCHMENTS_BY + " + enrich_names.enrich_cascade_lakes",
            [CASCADE_NODES, WB, RIVERS, CASCADE_DOWNSTREAM],
        ),
        "note": CASCADE_NOTE + " enrich_names snaps each river-terminal lake's "
        "traced downstream path (mumbai-catchment-downstream.json, a "
        "grandfathered naked map) to the named rivers layer - declared as "
        "lineage even though the naked map cannot itself carry an envelope.",
    },
    "cascade/cascade-nodes": {
        **cascade(CASCADE_TOPOLOGY_BY, [WB, RIVERS]),
        "note": CASCADE_NOTE + " build_catchments then extends this file IN "
        "PLACE with catchment_area_sqkm (reads the topology nodes, rewrites "
        "them enriched) - a same-file enrichment pass, not a second artifact."
        + HASH_NOTE,
    },
    "cascade/cascade-river-outlets": cascade(
        CASCADE_TOPOLOGY_BY, [WB, RIVERS], HASH_NOTE
    ),
    "cascade/cascade-stats": cascade(
        "neer-vazhvu-api/app/cascade/publish.py write_stats_manifest "
        "(reads the three published GeoJSONs from disk)",
        [CASCADE_NODES, CASCADE_EDGES, CASCADE_OUTLETS],
        HASH_NOTE,
    ),
    "cascade/cascade-systems": {
        **cascade(
            "neer-vazhvu-api/app/cascade/publish.py write_systems_manifest "
            "(run_cascade.py; Layer B curation.attach_named_cascades is "
            "NotImplemented - systems written empty)",
            [WB, RIVERS],
        ),
        "note": CASCADE_NOTE + " Layer B curation (named systems) is empty for "
        "Mumbai by design - no historical tank-cascade systems to name; the "
        "payload content is the empty manifest plus _meta, whose inputs_hash "
        "reads the tanks + rivers layers (hence the internal_inputs).",
    },
    "cascade/catchment-quality": cascade(
        CASCADE_CATCHMENTS_BY + " (QA summary)", [CASCADE_NODES, WB]
    ),
    # data-root
    "data-root/allocations": {
        "method": "manual",
        "sources": [
            reg("bmc-esr-annual"),
            reg("bmc-rti-manuals", as_of="2024-12"),
            reg("mahagr-wrd-resolutions"),
        ],
        "note": (
            "MMR bulk-water claim register - per-arrangement citations live in the "
            "legacy `sources` map (id-keyed source objects: STEM/DRA audit brief, "
            "MMRDA scheme pages, WRD GRs, dated press) and per-record `source` fields; "
            "an aggregate description is not an upstream source. unit_note declares "
            "the native-units discipline (MLD as published, entitlement vs drawal "
            "bases never mixed). Five self-supplied arrangements carry authority_id "
            "null (the corporation is its own authority) - an honest L3 gap shared "
            "with Bangalore and Delhi."
        ),
    },
    "data-root/commitments": {
        "method": "manual",
        "sources": [
            reg("bmc-climate-action-plan"),
            reg("bmc-esr-annual"),
        ],
        "note": (
            "Status changes only with a dated citation; per-commitment citations "
            "inline (commitment_source + status_history entries). sources_note names "
            "the verification calendar (Climate Budget commissioning table, ESR works "
            "chapters, NGT record, RTI manuals, MMRDA status pages) - which is why "
            "those registry entries carry this file in dependsOn."
        ),
    },
    "data-root/elevation-bands": {
        "method": "gee",
        "produced_by": "neer-vazhvu-api/scripts/build_elevation_bands.py",
        "internal_inputs": [],
        "sources": [dict(FABDEM)],
        "note": "Bands, not spot heights - see the legacy _provenance prose. CC BY-NC-SA encumbered via FABDEM.",
    },
    "data-root/facts": {
        "method": "manual",
        "sources": [
            reg("praja-civic-issues-mumbai", as_of="2024"),
            reg("cgwb-yearbook-maharashtra", as_of="2025"),
            reg("bmc-climate-action-plan", as_of="2025"),
            reg("cpcb-prs-report", as_of="2025-10"),
        ],
        "note": (
            "Hand-curated MMR fact register (v2, regionalised); every fact carries "
            "its own citation (source_label/source_url/data_date). The envelope lists "
            "the registered upstreams; one-off documents (India Water Portal/ATREE "
            "tariff analyses, the Chitale Committee, MMRDA scheme pages, court "
            "reporting) stay per-fact citations. Greater Mumbai (BMC) figures are "
            "flagged where city-specific; regional figures span the nine MMR "
            "corporations."
        ),
    },
    "data-root/flood-lines": {
        "method": "manual",
        "sources": [reg("wrd-flood-line-maps")],
        "note": (
            "Register of the WRD red/blue flood-line sheets covering the 6 MMR "
            "rivers (41 of 494 statewide); the sheets themselves are scanned PDF "
            "maps, not digitised geometry - this file records what exists, per "
            "river, with the legal meaning of the two lines. gaps_note carries the "
            "honest-gaps record."
        ),
    },
    "data-root/imd-rainfall-monthly": {
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/generate_imd_rainfall.py",
        "sources": [dict(IMD_GRID)],
        "note": (
            "Quarterly rebuild (imd-rainfall-refresh.yml); the generator writes "
            "through scripts/nvdm_write.py so this envelope survives regeneration. "
            "Grid-point selection notes in the legacy note key."
        ),
    },
    "data-root/industrial-sources": {
        "method": "manual",
        "sources": [
            reg("mpcb-stp-inventory"),
            reg("praja-civic-issues-mumbai", as_of="2024"),
            dict(
                OSM_SOURCE,
                title="OpenStreetMap plant locations (eastern-corridor STPs)",
            ),
        ],
        "note": (
            "MMR sewage-treatment points: capacities/utilisation from the MPCB "
            "per-STP inventory; the 9 BMC plants carry per-STP inlet/outlet BOD from "
            "Praja 2024 Table 13 (RTI series, 2020-2024); the 5 eastern-corridor "
            "plant locations are OSM. CAUTION: the top-level `sources` key is the "
            "facility payload, not citations - per-record `source` strings carry the "
            "per-claim citations."
        ),
    },
    "data-root/mmr-corporations-water": {
        "method": "manual",
        "produced_at": "2026-07-04",
        "sources": [
            reg("bmc-esr-annual"),
            reg("praja-civic-issues-mumbai", as_of="2024"),
        ],
        "note": (
            "MMR per-corporation water inventory; every figure carries source_refs "
            "into the legacy `sources` registry (praja-2021/2024, NMMC/TERI ESR, "
            "MMRDA WSRMC operator data, corporation documents - 3 adversarially-"
            "verified research passes, see _note). Nulls are genuine gaps, not "
            "zeros; vintages differ per record (`year`). The slum 45 vs non-slum "
            "150 LPCD norm distinction (praja-2021, citing MCGM's 24x7 White Paper) "
            "is data, never averaged away."
        ),
    },
    "data-root/mmr-dam-storage": {
        "method": "scrape",
        "produced_by": "neer-vazhvu-api/scripts/scrape_pravah_dams.py",
        "sources": [reg("wrd-pravah-dam-feed")],
        "note": (
            "Daily live storage for MMR source dams from the Pravah bulletin "
            "(pravah-dam-refresh.yml cron; the scraper writes through "
            "scripts/nvdm_write.py so this envelope survives the daily rewrite). "
            "BMC's 7 lakes flow through the separate BMC feed into Supabase; "
            "Morbe + Hetawane (CIDCO/NMMC-operated) are NOT in this feed - see "
            "the legacy _note."
        ),
        "conventions": {
            "dates": (
                "per-dam `date` is the dam's own reading timestamp; Pravah staggers "
                "readings by up to a day, so rows in one bulletin can carry two "
                "different dates (DB ingestion keys on the newest, see the scraper)"
            ),
        },
    },
    "data-root/cgwb-stations": {
        "method": "pdf-extract",
        "produced_by": "neer-vazhvu-api/scripts/build_mumbai_cgwb_stations.py",
        "sources": [
            reg("cgwb-yearbook-maharashtra", as_of="2025", retrieved="2026-07-26")
        ],
        "note": (
            "CGWB National Hydrograph Network wells in Mumbai City + Suburban, "
            "transcribed from the published Year Books (2024-25 canonical network, "
            "2022-23 stitched by site name) plus the GW Quality trend report "
            "chemistry. Mumbai is EXCLUDED from the CGWB Dynamic GWR Assessment "
            "(no block safe/critical class), so these wells - not a block "
            "choropleth - are the authoritative groundwater render; see _note and "
            "_citation_trace_2026_07_26."
        ),
        "conventions": {
            "sign": "depth metres below ground level (m bgl), positive down; four seasonal readings per Year Book edition",
        },
    },
    "data-root/flood-hotspots": {
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/scrape_bmc_flood_spots.py",
        "produced_at": "2026-07-27",
        "sources": [reg("bmc-dm-floodspots")],
        "note": (
            "BMC's own flood-spot register (~110 chronic/monitored spots with "
            "official names, wards, coordinates, AWS station ids), replacing the "
            "earlier hand-curated press layer. The FULL pre-monsoon list (496 "
            "spots in 2026) is not published with locations - a named gap. Weekly "
            "cron (bmc-floodspots-refresh.yml) writes through scripts/nvdm_write.py "
            "so this envelope survives the rewrite."
        ),
    },
    "data-root/supply-overview": {
        "method": "pdf-extract",
        "produced_at": "2026-07-04",
        "sources": [
            reg("bmc-rti-manuals", as_of="2024-12", retrieved="2026-07-04"),
            reg("bmc-esr-annual"),
            MCGM_HANDBOOK,
            WHITEPAPER_24X7,
        ],
        "note": (
            "Structural engineering-chain facts for Greater Mumbai (BMC) water "
            "supply, anchored on BMC's own Hydraulic Engineer RTI manuals (Dec "
            "2024) - Mumbai's equivalent of Chennai's ADB IEE - plus the MCGM O&M "
            "handbook, the 2018 24x7 White Paper and dated press for the expansion "
            "programme; per-section citations in the legacy _sources array. "
            "_view_overrides is a grandfathered UI hint (spec 6.4), "
            "config-migration follow-up on record."
        ),
    },
    "data-root/ward-water-praja": {
        "method": "pdf-extract",
        "produced_by": "manual",
        "sources": [
            reg("praja-civic-issues-mumbai", as_of="2024", retrieved="2026-07-21")
        ],
        "note": (
            "Ward-level water tables transcribed from Praja's May 2025 report "
            "(2024 data, RTI-sourced): Table 4 supply duration (287 zones), Table "
            "5 metered/unmetered connections (Mar 2025), Table 7 unfit-sample "
            "percentages (2020-2024). LICENCE FLAG: the report is (c) Praja - "
            "RTI-sourced tables via the OpenCity mirror, cited with attribution, "
            "NOT an open licence."
        ),
    },
    "data-root/restoration-priority": {
        "method": "derived",
        "produced_by": "scripts/compute-restoration-priority-mumbai.ts",
        "internal_inputs": ["public/data/water-bodies-flagship-mumbai.json"],
        "sources": [],
        "note": (
            "Flagship-register scoring (Madurai pattern): 16 hand-curated MMR "
            "bodies scored on status severity, cultural anchors, size and source "
            "confidence; algorithm identity in the payload weights/"
            "algorithm_version keys; every rationale quotes the recorded status it "
            "is grounded in. Supply reservoirs (Vihar, Tulsi) score low BY DESIGN. "
            "Derived entirely from a committed artifact whose citations travel "
            "with its own envelope - internal inputs are lineage, not sources. "
            "Masunda and Kacharali carry area_ha null (no reliable recorded area) "
            "- an honest L3 gap, not a number to invent."
        ),
    },
    "data-root/restoration-projects": {
        "method": "manual",
        "sources": [],
        "note": (
            "Curated compilation of MMR lake-restoration programmes and court/NGT "
            "orders - per-record `source` citations carry the accountability; an "
            "aggregate description is not an upstream source. The recurring "
            "pattern documented: cosmetic beautification substituting for "
            "water-quality restoration (see legacy note)."
        ),
    },
    "data-root/river-quality": {
        "method": "pdf-extract",
        "sources": [
            reg("mpcb-water-quality-reports", as_of="2024", retrieved="2026-07-05"),
            reg("praja-civic-issues-mumbai", as_of="2024"),
            MITHI_ACTION_PLAN,
            KALYAN_ESR_2005,
        ],
        "note": (
            "Split-vintage regional series: Greater Mumbai's Mithi carries real "
            "2018-2023 WQ (CPCB NWMP station series via Praja 2024 + the MPCB "
            "Mithi Action Plan); the eastern Ulhas corridor carries the 2004-05 "
            "MPCB Kalyan-Region ESR baseline and remains a CPCB "
            "priority/polluted stretch; the source rivers are context-only. "
            "_readings_status and _wqr_source carry the per-river population "
            "state; FC units are inconsistent across MPCB editions - directional "
            "only (registry note)."
        ),
        "conventions": {
            "comparability": (
                "data_year_range spans 2004-2023 with NON-comparable vintages per "
                "river (Mithi 2018-2023 vs Ulhas 2004-05 baseline) - never chart "
                "them as one series"
            ),
        },
    },
    "data-root/ward-risk": {
        "method": "derived",
        "produced_by": "scripts/compute-mumbai-ward-risk.py",
        "internal_inputs": [
            "public/geojson/mumbai-wards-2023.geojson",
            "public/data/mumbai-flood-hotspots.geojson",
            "public/geojson/mumbai-rivers.geojson",
        ],
        "sources": [
            reg("praja-civic-issues-mumbai", role="input", as_of="2024"),
            dict(DATAMEET, role="input"),
        ],
        "note": (
            "Equity-first composite for the 24 BMC admin wards (weights in the "
            "payload; _methodology carries the model prose): supply_deficit uses "
            "REAL per-ward supply hours (Praja 2024 Table 4, embedded in the "
            "producer), flood_exposure counts BMC's own register spots, "
            "river_burden counts Priority-I polyline vertices. Mumbai is excluded "
            "from the CGWB assessment, so no groundwater factor - by honesty, not "
            "omission. The DataMeet slum clusters (slum_area_share, context-only, "
            "unweighted) are fetched at build time and not committed - an external "
            "source, not an internal input."
        ),
    },
    "data-root/water-bodies-flagship": {
        "method": "manual",
        "sources": [],
        "note": (
            "Curated flagship register across the 9 MMR corporations - per-record "
            "`sources` citations carry the accountability. confidence grades "
            "V/N/C per the legacy note (C = sources conflict, both figures "
            "shown); areas in acres as reported, some estimates; Marathi names "
            "are transliterations unless a Marathi source confirmed them."
        ),
    },
    "data-root/water-bodies-lost": {
        "method": "manual",
        "sources": [],
        "note": (
            "Archival compilation - the legacy primary_source (Dwivedi & "
            "Mehrotra, Bombay: The Cities Within, 1995) / secondary_sources keys "
            "carry the citations; records are the documented island-era tanks "
            "filled after the piped supply arrived, many surviving only as place "
            "names. Coordinates are locality positions (_location_note); "
            "deliberately partial, not exhaustive."
        ),
    },
    # geojson layers
    "geojson-layers/coastal-transects": {
        "method": "gee",
        "produced_by": "neer-vazhvu-api/app/gee/coastline.py",
        "internal_inputs": ["public/geojson/mumbai-coastal-zones.geojson"],
        "sources": [SENTINEL2, LANDSAT],
        "note": (
            "COMPUTED shoreline-change rates: MNDWI on Landsat 5/7/8 + Sentinel-2 "
            "via GEE, 100 m transects, weighted linear regression over 10 epochs "
            "(1990-2026) - the same pipeline as Chennai, reading zone geometry "
            "from the seed layer (internal input). Mumbai is meso-to-macrotidal "
            "(~3-5 m springs), so positions carry more tidal noise than Chennai's "
            "microtidal coast - per-transect confidence flags it. Annual refresh "
            "(coastal-shoreline-refresh.yml)."
        ),
    },
    "geojson-layers/coastal-zones": {
        "method": "mixed",
        "produced_by": "scripts/build-mumbai-coastal-seed.py",
        "internal_inputs": [],
        "sources": [
            dict(
                OSM_SOURCE,
                title="OpenStreetMap coastline (Overpass extract, seaward face)",
                role="input",
            ),
            MSMP_2017,
            NCCR_2018,
        ],
        "note": (
            "Seed layer for /mumbai/shoreline: OSM coastline geometry (seaward "
            "face only, creek mouths chorded) carrying PUBLISHED classifications "
            "- MSMP 2017 beach risk grades, NCCR 1990-2016 district table, NCSCM "
            "class - with mean_erosion_m_yr null BY DESIGN: no public source "
            "gives per-zone rates for Mumbai and we don't fabricate numbers; "
            "rates come from the computed transect layer. Geometry is fetched "
            "live from Overpass, hence internal_inputs []."
        ),
    },
    "geojson-layers/corporations-2024": {
        "method": "api",
        "produced_by": "scripts/build-mmr-corporations.py",
        "sources": [
            dict(
                OSM_SOURCE,
                title="OpenStreetMap administrative boundaries (Overpass extract)",
            )
        ],
        "note": (
            "The 9 MMR municipal corporation boundaries (BMC, Thane, KDMC, NMMC, "
            "Mira-Bhayandar, Vasai-Virar, Ulhasnagar, Bhiwandi-Nizampur, "
            "Panvel) - OSM admin polygons; area_sqkm computed at build."
        ),
    },
    "geojson-layers/drainage": {
        "method": "api",
        "produced_by": "scripts/build-mumbai-drainage.py",
        "sources": [
            dict(
                OSM_SOURCE, title="OpenStreetMap drain/nalla network (Overpass extract)"
            )
        ],
        "note": (
            "waterway=drain/ditch plus named nallas tagged stream/canal; the 11 "
            "named rivers are excluded (rivers layer renders them). NOT an "
            "official BMC SWD survey - no public one exists."
        ),
        "conventions": {
            "coverage": "mapped lengths reflect what OSM mappers have traced - a floor, not the network total",
        },
    },
    "geojson-layers/flood-2005-hotspots": {
        "method": "manual",
        "produced_by": "manual",
        "produced_at": "2026-07",
        "sources": [CCC_2005, NIDM_2009, OECD_2010],
        "note": (
            "26 July 2005 deluge reference layer (closed series), compiled from "
            "the CCC 'Mumbai Marooned' enquiry (the richest location-level "
            "record), NIDM and OECD studies, and press retrospectives. Depth "
            "labels only where the record documents one (11 of 35 points). "
            "COORDINATES ARE ESTIMATED LOCALITY CENTROIDS (+/- ~500 m) - no "
            "reviewed source publishes coordinates and no official 26/7 GIS "
            "inundation extent is public (see _provenance)."
        ),
    },
    "geojson-layers/rivers": {
        "method": "api",
        "produced_by": "scripts/build-mumbai-rivers.py",
        "sources": [dict(OSM_SOURCE)],
        "note": (
            "One MultiLineString per river; river_id joins "
            "river-quality-mumbai.json. Covers Greater Mumbai's four (Mithi, "
            "Dahisar, Poisar, Oshiwara) plus the regional Ulhas system and "
            "source rivers."
        ),
    },
    "geojson-layers/wards-2023": {
        "method": "api",
        "produced_by": "scripts/build-mumbai-wards.py",
        "sources": [dict(DATAMEET, as_of="2023")],
        "note": (
            "24 BMC ADMINISTRATIVE wards (lettered A..T with splits), NOT the "
            "227 electoral wards (SEC PDFs only, no open geometry). DataMeet "
            "polygons normalised to the frontend ward schema with each ward's "
            "primary locality attached. LICENCE CORRECTION 2026-07-30: the "
            "legacy _provenance string says ODbL; the upstream Mumbai Readme "
            "states CC BY-SA 2.5 India - the registry entry and this envelope "
            "carry the verified licence (payload string left untouched by the "
            "migration; producer emits the corrected string on next run)."
        ),
    },
    "geojson-layers/water-bodies-current": {
        "method": "api",
        "produced_by": "scripts/build-mumbai-water-bodies.py",
        "sources": [dict(OSM_SOURCE)],
        "note": (
            "OSM water-body polygons across the urbanised MMR (sea/large-creek "
            "polygons dropped by area filter; one Uttan tidal polygon excluded "
            "by id - see the producer header) PLUS the 4 named supply reservoirs "
            "(Bhatsa, Tansa, Modak Sagar, Upper Vaitarna) fetched 90-130 km out "
            "and tagged supply_reservoir=true: they are Mumbai's actual tap, "
            "distinct from in-city lakes. name_mr per spec 7.2."
        ),
    },
    "geojson-layers/water-bodies-lost": {
        "method": "manual",
        "produced_by": "manual",
        "sources": [],
        "note": (
            "Archival companion layer to water-bodies-lost-mumbai.json: "
            "approximate footprint circles (approx_radius_m) for the documented "
            "lost talao, each feature carrying its own `source` field (Dwivedi & "
            "Mehrotra 1995 and companions). Positions are locality estimates, "
            "not survey extents."
        ),
    },
}

LEGACY_DATES = (
    "generated_at",
    "compiled_at",
    "computed_at",
    "updated",
    "last_updated",
    "fetched_at",
    "retrieved",
    "_fetched",
)
SKIP = {
    "cascade/catchment-downstream",  # naked indexed map (spec 6.1 grandfather)
    "cascade/catchment-streams",  # naked indexed map
    "data-root/rainfall-recent",  # producer-owned envelope (fetch_recent_rainfall.py, daily)
}


def produced_at_for(doc: dict, path: Path) -> str:
    for k in LEGACY_DATES:
        v = doc.get(k)
        if isinstance(v, str) and v[:4].isdigit():
            return v[:10]
    meta = doc.get("_meta", {})
    if isinstance(meta, dict):
        for k in ("generated_at", "compiled_at"):
            v = meta.get(k, "")
            if isinstance(v, str) and v[:4].isdigit():
                return v[:10]
    out = subprocess.run(
        ["git", "log", "-1", "--format=%cs", "--", str(path.relative_to(ROOT))],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    return out.stdout.strip() or "2026-07-30"


def dump(merged: dict, raw: str) -> str:
    """Preserve the artifact's storage style. One-line files stay one line
    with the producer's own separators (json.dump default spaced vs compact) -
    a 6 MB single-line GeoJSON must not become a pretty file, and a spaced
    file must not silently become compact or converter -> refresh loses
    byte-idempotency. Pretty files keep their stored indent: Mumbai has BOTH
    indent=1 (Node/scraper-written) and indent=2 artifacts."""
    if raw.count("\n") <= 3:
        head = raw[:100_000]
        compact = head.count('","') + head.count('":"') >= head.count(
            '", "'
        ) + head.count('": "')
        sep = (",", ":") if compact else (", ", ": ")
        return json.dumps(merged, ensure_ascii=False, separators=sep)
    second = raw.split("\n", 2)[1]
    indent = len(second) - len(second.lstrip(" ")) or 2
    return json.dumps(merged, indent=indent, ensure_ascii=False)


def main() -> int:
    cat = json.loads((ROOT / "docs/architecture/dataset-catalogue.json").read_text())
    done = skipped = 0
    refresh = "--refresh" in sys.argv
    for rec in cat["files"]:
        if rec["scope"] != "mumbai":
            continue
        ds = f"{rec['family']}/{rec['dataset']}"
        if ds in SKIP:
            skipped += 1
            continue
        spec = PROVENANCE.get(ds)
        if spec is None:
            print(
                f"NO PROVENANCE MAP for {ds} ({rec['path']}) - refusing to guess",
                file=sys.stderr,
            )
            return 1
        path = ROOT / rec["path"]
        raw = path.read_text()
        doc = json.loads(raw)
        if not isinstance(doc, dict) or ("nvdm" in doc and not refresh):
            skipped += 1
            continue
        # --refresh recomputes the envelope from the current provenance map but
        # PRESERVES the original produced_at (the artifact's data was not
        # regenerated; git dates now point at the envelope commit, not the data).
        prior_produced_at = (
            doc.get("provenance", {}).get("produced_at") if "nvdm" in doc else None
        )
        provenance = {
            "sources": spec["sources"],
            "method": spec["method"],
            "produced_at": prior_produced_at
            or spec.get("produced_at")
            or produced_at_for(doc, path),
        }
        if spec.get("internal_inputs") is not None:
            provenance["internal_inputs"] = spec["internal_inputs"]
        if spec.get("produced_by"):
            provenance["produced_by"] = spec["produced_by"]
        if spec.get("note"):
            provenance["note"] = spec["note"]
        if spec.get("conventions"):
            provenance["conventions"] = spec["conventions"]
        envelope = {
            "nvdm": "1.0",
            "dataset": ds,
            "scope": dict(SCOPE),
            "provenance": provenance,
        }
        merged = {**envelope, **{k: v for k, v in doc.items() if k not in envelope}}
        out = dump(merged, raw)
        path.write_text(out + ("\n" if raw.endswith("\n") else ""))
        done += 1
        print(f"enveloped {rec['path']}")
    print(f"\n{done} enveloped, {skipped} skipped (naked maps / producer-owned)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
