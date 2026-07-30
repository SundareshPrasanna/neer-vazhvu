#!/usr/bin/env python3
"""Chennai NVDM migration: inject the v1 envelope into every envelope-capable
Chennai artifact (spec Part 9 - Chennai is city 2 of the legacy migration,
after the Madurai pilot whose injector this clones).

Everything here is ADDITIVE: envelope keys are inserted ahead of the existing
payload, no legacy key is removed or renamed, and no value is changed - shape
migration and value changes are separate commits by spec rule 9.4.

The per-dataset provenance map below is the reviewable heart of this script:
every source entry was verified against the file's own legacy keys, the
Headwaters registry, the generating pipeline's code, or the Chennai worklist
(docs/specs/nvdm-chennai-worklist.md, local). Where a fact could not be
verified it is NOT stated (no fabricated provenance).

Skipped on purpose:
  - catchment-basin / -downstream / -streams: naked indexed-collection maps,
    grandfathered (spec 6.1) - an envelope would change their shape.
  - chennai-localities.json / ward-names.json: bare arrays, poor
    wrap-to-value ratio today; tracked follow-up (wrap all cities together).
  - ward-profiles.json: wrapped by its producer (compute-ward-profiles.ts)
    in its own commit, like the Madurai pilot.
  - rainfall-recent-chennai.json: envelope OWNED BY ITS PRODUCER
    (fetch_recent_rainfall.py, daily) since the pilot.
  - chennai-wards-2022.geojson: BLOCKED - boundary geometry
    publisher/licence/retrieval still unrecorded (worklist 6.4 item 1).
    An envelope with invented provenance is worse than none.
  - chennai-reservoir-catchments.geojson: BLOCKED - keep-or-delete decision
    pending (zero consumers, self-declared ready_for_verification, MERIT
    licence chain unrecorded; worklist 6.4 item 5).

Formatting: files stored minified (single-line GeoJSON/maps) stay single-line
so the envelope does not multiply their size; pretty files stay indent=2.

Idempotent: files already carrying `nvdm` are left untouched (--refresh
recomputes the envelope but preserves the original produced_at).
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCOPE = {"kind": "city", "id": "chennai"}

# ---- source literals (verified) -------------------------------------------

FABDEM = {
    "id": "fabdem-dem",
    "title": "FABDEM v1-2 30 m bare-earth DEM",
    "publisher": "University of Bristol (Hawker et al.), via GEE sat-io",
    "license": "CC BY-NC-SA 4.0 (non-commercial)",
    "role": "input",
}
HYDROSHEDS = {
    "id": "hydrosheds-basins",
    "title": "HydroSHEDS basin boundaries",
    "publisher": "WWF / HydroSHEDS",
    "license": "HydroSHEDS licence (attribution required)",
    "role": "input",
}
OSM_TANKS = {
    "id": "osm-overpass",
    "title": "OpenStreetMap tank polygons / waterways (Overpass extract)",
    "publisher": "OpenStreetMap contributors",
    "license": "ODbL 1.0",
    "role": "input",
}
SENTINEL2 = {
    "id": "sentinel-2-l2a",
    "title": "Sentinel-2 L2A imagery (channel evidence)",
    "publisher": "ESA Copernicus",
    "license": "Copernicus free and open data, attribution required",
    "role": "input",
}
DYNAMIC_WORLD = {
    "id": "google-dynamic-world",
    "title": "Google Dynamic World built-up classification",
    "publisher": "Google / World Resources Institute",
    "license": "CC BY 4.0",
    "role": "input",
}
OVERTURE = {
    "id": "overture-buildings",
    "title": "Overture Maps building footprints",
    "publisher": "Overture Maps Foundation",
    "license": "CDLA-Permissive 2.0",
    "role": "input",
}
IMD_NORMALS = {
    "id": "imd-gridded-rain",
    "title": "IMD monthly rainfall normals (Chennai grid point, via imd-rainfall-monthly.json)",
    "publisher": "India Meteorological Department",
    "license": "GoI publication, cited with attribution",
    "role": "input",
}
OSM_SOURCE = {
    "id": "osm-overpass",
    "title": "OpenStreetMap (Overpass API extract)",
    "publisher": "OpenStreetMap contributors",
    "license": "ODbL 1.0",
}
WRIS_GW = {
    "id": "wris-live-services",
    "title": "India-WRIS Ground Water Level dataset (NWIC ArcGIS services)",
    "publisher": "CGWB / NWIC via India-WRIS",
    "license": "GoI open publication, cited with attribution",
}
LANDSAT = {
    "id": "usgs-landsat",
    "title": "Landsat 5/7/8 surface reflectance archive (GEE collections)",
    "publisher": "USGS / NASA (Landsat program)",
    "license": "USGS public domain, courtesy attribution",
    "role": "input",
}
JRC_GSW = {
    "id": "jrc-global-surface-water",
    "title": "JRC Global Surface Water v1.4 yearly history (JRC/GSW1_4/YearlyHistory)",
    "publisher": "European Commission JRC (Pekel et al.)",
    "license": "EC Open / public domain",
    "role": "input",
}
OPEN_BUILDINGS = {
    "id": "google-open-buildings",
    "title": "Google Open Buildings v3 polygons",
    "publisher": "Google Research",
    "license": "CC BY 4.0 / ODbL",
    "role": "input",
    "as_of": "2023",
}
TNSWA = {
    "id": "tnswa-ramsar-boundary",
    "title": "TNSWA gazetted Ramsar boundary (RamsarBoundary_2.js, feature 'Pallikaranai Marsh Reserve Forest')",
    "publisher": "Tamil Nadu State Wetland Authority",
    "license": "public data from a Tamil Nadu government portal, cited with attribution",
    "retrieved": "2026-05-17",
}
STUDY_2026 = {
    "title": "Anagha, Singh & Frappart 2026 - shoreline change along the Chennai coast (Environmental Challenges)",
    "publisher": "Environmental Challenges (Elsevier)",
    "license": "academic publication, cited with attribution",
    "closed": True,
    "as_of": "2026",
}
ADB_CCRWSSP_IEE = {
    "title": "ADB CCRWSSP Initial Environmental Examination - Chennai Ring Main System Subproject (Project 59311-001)",
    "publisher": "Asian Development Bank",
    "url": "https://www.adb.org/sites/default/files/project-documents/59311/59311-001-iee-en_0.pdf",
    "license": "ADB public project document, cited with attribution",
    "closed": True,
    "as_of": "2026-03",
    "retrieved": "2026-05-08",
}
JICA_DESAL = {
    "title": "JICA Chennai Seawater Desalination Preparatory Survey - Final Report",
    "publisher": "Japan International Cooperation Agency",
    "url": "https://openjicareport.jica.go.jp/pdf/12283743.pdf",
    "license": "JICA public survey report, cited with attribution",
    "closed": True,
    "as_of": "2017",
    "retrieved": "2026-05-08",
}
COOUM_STUDY = {
    "title": "Nethaji Mariappan et al. (2017), Water quality studies of Cooum sub basin, Nature Environment and Pollution Technology 16(3), 969-974",
    "publisher": "Nature Environment and Pollution Technology; original discharge data PWD Chennai",
    "url": "https://neptjournal.com/upload-images/NL-61-47-(45)B-3437.pdf",
    "license": "academic publication, cited with attribution",
    "closed": True,
    "as_of": "2017",
}
NIVAR_2020 = {
    "title": "OpenCity dataset chennai-floods-2020-data (Cyclone Nivar flooded neighbourhoods)",
    "publisher": "GCC / OpenCity",
    "url": "https://data.opencity.in/dataset/chennai-floods-2020-data",
    "license": "open (per OpenCity dataset page)",
    "closed": True,
    "as_of": "2020-11",
}

CASCADE_TOPO = [FABDEM, OSM_TANKS, HYDROSHEDS]
CASCADE_SCORED = CASCADE_TOPO + [SENTINEL2, DYNAMIC_WORLD]

CASCADE_NOTE = (
    "Derived by the cascade reconstruction pipeline (neer-vazhvu-api/app/cascade). "
    "FABDEM input makes this family CC BY-NC-SA (non-commercial) encumbered - "
    "recorded in the fabdem-dem registry entry, 2026-07-30."
)

REG_IDS = {
    "cmwssb-system-pages": ("CMWSSB water-supply system pages and board documents", "CMWSSB", "government publication, cited with attribution"),
    "maws-policy-note": ("TN MAWS Policy Note (annual, April budget session)", "TN Municipal Administration and Water Supply Department", "government publication, cited with attribution"),
    "cpcb-nwmp-annual": ("CPCB NWMP annual river water-quality reports (Chennai stations)", "Central Pollution Control Board", "GoI publication, cited with attribution"),
    "crrt-restoration-projects": ("Chennai Rivers Restoration Trust project pages", "Chennai Rivers Restoration Trust", "government publication, cited with attribution"),
    "ingres-gw-assessment-tn": ("IN-GRES dynamic groundwater assessment (Chennai-area blocks)", "CGWB / IIT-Hyderabad (IN-GRES)", "GoI publication, cited with attribution"),
    "opencity-chennai-flood": ("Chennai flooding data - NCCR C-FLOWS model outputs (via OpenCity)", "OpenCity / NCCR", "open (per OpenCity dataset page)"),
    "opencity-gcc-swd-survey": ("GCC 2023 storm-water-drain survey (via OpenCity)", "Greater Chennai Corporation (via OpenCity)", "open (per OpenCity dataset page)"),
    "opencity-cmwssb-sewerage": ("CMWSSB sewerage network datasets (via OpenCity)", "CMWSSB (via OpenCity)", "open (per OpenCity dataset page)"),
    "tngcc-ceew-basin-risk": ("Chennai Basin climate risk / water balance report (Feb 2026)", "CEEW + Tamil Nadu Climate Change Mission", "CC BY-NC 4.0"),
    "datagovin-waterbodies-census-tn": ("First Census of Water Bodies - Tamil Nadu state table", "Ministry of Jal Shakti (data.gov.in)", "Government Open Data License - India"),
    "chennai-reps-gcc-council": ("GCC Council list (councillor PDF)", "TN State Election Commission / GCC", "public election result, cited with attribution"),
    "chennai-reps-tn-assembly": ("TN Assembly 2026 results (Chennai constituencies)", "Election Commission of India / TN CEO", "public election result, cited with attribution"),
    "chennai-reps-lok-sabha": ("Lok Sabha 2024 results (Chennai constituencies)", "Election Commission of India", "public election result, cited with attribution"),
}


def reg(source_id: str, role: str | None = None, as_of: str | None = None) -> dict:
    title, publisher, license_ = REG_IDS[source_id]
    s = {"id": source_id, "title": title, "publisher": publisher, "license": license_}
    if role:
        s["role"] = role
    if as_of:
        s["as_of"] = as_of
    return s


def cascade(sources: list[dict]) -> dict:
    return {
        "method": "derived",
        "produced_by": "neer-vazhvu-api/app/cascade (scripts/run_cascade.py)",
        "sources": sources,
        "note": CASCADE_NOTE,
    }


# ---- per-dataset provenance map (the reviewable core) ----------------------

PROVENANCE: dict[str, dict] = {
    # cascade family (derived; FABDEM-encumbered)
    "cascade/cascade-catchments": cascade(CASCADE_TOPO),
    "cascade/cascade-edges": cascade(CASCADE_SCORED),
    "cascade/cascade-lakes": cascade(CASCADE_SCORED + [OVERTURE, IMD_NORMALS]),
    "cascade/cascade-nodes": cascade(CASCADE_SCORED),
    "cascade/cascade-river-outlets": cascade(CASCADE_TOPO),
    "cascade/cascade-sensitivity": cascade(CASCADE_TOPO),
    "cascade/cascade-stats": cascade(CASCADE_SCORED),
    "cascade/cascades-documented": {
        "method": "mixed",
        "sources": CASCADE_SCORED,
        "note": CASCADE_NOTE
        + " Layer B named-cascade documentation is internal Neer Vazhvu curation over the "
        "auto topology; its own _sources_of_truth key (CMDA Second Master Plan, Care Earth "
        "Trust, Citizen Matters, dated press) carries the per-cascade citations - "
        "lineage, not an upstream source.",
    },
    "cascade/cascades-health": {
        **cascade(CASCADE_SCORED),
        "produced_by": "neer-vazhvu-api/app/cascade/health.py",
    },
    "cascade/catchment-quality": cascade([FABDEM, OSM_TANKS]),
    # data-root
    "data-root/allocations": {
        "method": "manual",
        "sources": [reg("cmwssb-system-pages")],
        "note": (
            "Per-arrangement citations live in the legacy `sources` map (id-keyed source "
            "objects: CMWSSB system pages, DT Next, Telugu Ganga history, Perur project "
            "press) and per-record `source` fields. unit_note declares the native-units "
            "discipline (entitlements kept in cusecs/TMC/MLD as published)."
        ),
    },
    "data-root/supply-overview": {
        "method": "pdf-extract",
        "produced_at": "2026-05-08",
        "sources": [
            ADB_CCRWSSP_IEE,
            JICA_DESAL,
            reg("cmwssb-system-pages"),
            reg("maws-policy-note"),
        ],
        "note": (
            "Extraction detail and per-section citations in the legacy _note/_sources/"
            "_supply_total_note keys; produced_at is the extraction date the file itself "
            "asserts (_sources[].extracted 2026-05-08); later git touches were editorial. "
            "The ADB IEE is carried closed rather than registered: adb.org blocks "
            "automation (same TLS class as CEEW) and it is a single project document. "
            "_view_overrides is a grandfathered UI hint (spec 6.4), config-migration "
            "follow-up on record."
        ),
    },
    "data-root/commitments": {
        "method": "manual",
        "sources": [reg("maws-policy-note")],
        "note": (
            "Status changes only with a dated citation; per-commitment citations inline "
            "(commitment_source + status_history entries). update_model names the April "
            "MAWS Policy Note, ADB project documents and dated press as the re-check set."
        ),
    },
    "data-root/cooum-sewage-inlets": {
        "method": "pdf-extract",
        "sources": [COOUM_STUDY],
        "note": (
            "Single closed study (2017). Sewage inflow volumes measured pre-monsoon; "
            "coordinates converted from the paper's DMS listings; supplementary_ref "
            "carries the secondary citation. See the legacy note key."
        ),
    },
    "data-root/elevation-bands": {
        "method": "gee",
        "produced_by": "neer-vazhvu-api/scripts/build_elevation_bands.py",
        "sources": [FABDEM],
        "note": "Bands, not spot heights - see the legacy _provenance prose. CC BY-NC-SA encumbered via FABDEM.",
    },
    "data-root/gee-phase1-water-body-targets": {
        "method": "manual",
        "produced_by": "manual",
        "sources": [],
        "note": "Self-authored GEE target manifest - no external upstream exists; edition history = git.",
    },
    "data-root/gw-stations": {
        "method": "api",
        "produced_by": "scripts/fetch-wris-groundwater.ts",
        "sources": [dict(WRIS_GW, retrieved="2026-03-27")],
        "note": (
            "Stations and readings fetched from the arc.indiawris.gov.in NWIC ArcGIS "
            "services (GroundwaterLevel_Stations) - a continuous source, freshness-tracked "
            "not edition-tracked. NOT IN-GRES assessment data (the legacy `source` string "
            "'India WRIS / CGWB' is the accurate attribution)."
        ),
        "conventions": {
            "sign": "depth metres below ground level, positive down",
        },
    },
    "data-root/gwr-blocks": {
        "method": "api",
        "produced_by": "scripts/fetch-wris-groundwater.ts",
        "sources": [reg("ingres-gw-assessment-tn")],
        "note": (
            "Block-level dynamic groundwater assessment (GEC classes and stage-of-"
            "extraction), acquired via the WRIS NWIC GWR{year}_CGWB ArcGIS services."
        ),
        "conventions": {
            "comparability": (
                "CGWB assessment units can change between GEC editions (block/firka/"
                "village granularity shifts); year-on-year comparisons must check "
                "assessment-unit continuity before differencing."
            ),
        },
    },
    "data-root/imd-rainfall-monthly": {
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/generate_imd_rainfall.py",
        "sources": [
            {
                "id": "imd-gridded-rain",
                "title": "IMD gridded monthly rainfall (0.25 deg, Chennai grid point)",
                "publisher": "India Meteorological Department",
                "license": "GoI publication, cited with attribution",
            }
        ],
        "note": (
            "Nearest valid land grid point to Chennai (coastal cells classified as ocean "
            "by IMD) - see the legacy note key. Quarterly rebuild "
            "(imd-rainfall-refresh.yml); envelope re-emission by the generator is the "
            "tracked pipeline-rewiring follow-up."
        ),
    },
    "data-root/industrial-sources": {
        "method": "manual",
        "produced_by": "manual",
        "sources": [],
        "note": (
            "Curated compilation of facility records; the legacy `source` string names the "
            "seven upstreams (NGT Southern Bench orders, CPCB NWMP reports, TNPCB consent "
            "records, Global NEST Journal, Springer Nature, The Wire, Carbon Copy, "
            "Wikipedia). Which claim rests on which upstream is NOT recorded per record - "
            "per-record citation backfill is a tracked research task; quotable claims "
            "should be treated as reported, not verified. CAUTION: the top-level `sources` "
            "key is the facility payload, not citations. last_updated 2025-01 predates the "
            "repo (imported compilation)."
        ),
    },
    "data-root/restoration-priority": {
        "method": "derived",
        "produced_by": "scripts/compute-restoration-priority.ts",
        "sources": [
            dict(OSM_TANKS, title="OpenStreetMap water bodies + rivers (Overpass extracts)"),
            reg("datagovin-waterbodies-census-tn", role="input"),
        ],
        "note": (
            "Scored over OSM extracts, the First Census of Water Bodies table (Supabase "
            "water_bodies_census), and internal artifacts (river-quality.json, "
            "industrial-sources.json, chennai-water-bodies-lost.geojson) whose citations "
            "travel with their own envelopes - internal inputs are lineage, not sources. "
            "Algorithm identity in the payload `weights` key. March 2026 vintage; the GEE "
            "flagship scorer (neer-vazhvu-api/app/gee) READS this file for target "
            "selection, it does not produce it."
        ),
    },
    "data-root/restoration-projects": {
        "method": "manual",
        "sources": [reg("crrt-restoration-projects")],
        "note": "Project list and costs from CRRT project pages; claim dataset - per-record refs at L3 time.",
    },
    "data-root/river-quality": {
        "method": "pdf-extract",
        "produced_by": "manual",
        "produced_at": "2026-04-14",
        "sources": [reg("cpcb-nwmp-annual", as_of="2024")],
        "note": (
            "Extracted from CPCB 'Water Quality of River Data' annual PDFs, editions "
            "2020-2024. The legacy last_updated '2024' is the evidence vintage (newest "
            "report year), not a production date - produced_at is the git compile date. No "
            "known NWMP stations on the Kosasthalaiyar (the data gap is real, not an "
            "omission); see the legacy source prose."
        ),
        "conventions": {
            "aggregation": "each reading is the midpoint of the CPCB annual min-max range",
            "coordinates": "station coordinates approximated from CPCB station descriptions",
            "absence": "parameters absent from a year's report are null, never zero",
        },
    },
    "data-root/ward-representatives": {
        "method": "manual",
        "produced_at": "2026-07-25",
        "sources": [
            reg("chennai-reps-gcc-council"),
            reg("chennai-reps-tn-assembly"),
            reg("chennai-reps-lok-sabha"),
        ],
        "note": (
            "Councillor names/party/phones from the GCC Council PDF (2022-02 election); "
            "2022 result aggregation via oneindia; MLA constituency mapping via Wikipedia "
            "pending ECI cross-verification; MP results from results.eci.gov.in. Source "
            "URLs in meta.sources. Tamil-name backfill open (issue #182)."
        ),
    },
    # geojson layers
    "geojson-layers/coastal-hotspots": {
        "method": "manual",
        "produced_by": "scripts/build-chennai-coastal-seed.py",
        "sources": [STUDY_2026],
        "note": "SEED layer: named shoreline-change hotspots from the study (see legacy _note/_source).",
    },
    "geojson-layers/coastal-transects": {
        "method": "derived",
        "produced_by": "neer-vazhvu-api/app/gee/coastline.py (scripts/run_gee_coastline.py)",
        "sources": [
            LANDSAT,
            SENTINEL2,
            dict(STUDY_2026, role="methodology"),
        ],
        "note": (
            "Neer Vazhvu computation: MNDWI shoreline on Landsat 5/7/8 + Sentinel-2 via "
            "GEE, 100 m transects, weighted linear regression over 10 epochs (1990-2026); "
            "independent of the study's CoastSat+DSAS, cited as methodological "
            "corroboration. Quotable form: 'Neer Vazhvu analysis of Landsat/Sentinel-2 "
            "imagery'. Annual rebuild (coastal-shoreline-refresh.yml); envelope "
            "re-emission by the pipeline is the tracked follow-up."
        ),
    },
    "geojson-layers/coastal-zones": {
        "method": "mixed",
        "produced_by": "scripts/build-chennai-coastal-seed.py",
        "sources": [
            dict(STUDY_2026, role="asserts"),
            dict(OSM_SOURCE, title="OpenStreetMap coastline geometry (Overpass extract)", role="input"),
        ],
        "note": (
            "SEED layer: OSM coastline geometry carrying the study's per-zone rates; "
            "superseded by the computed transects layer when the GEE pipeline runs (see "
            "legacy _note) but still rendered by the coastal map."
        ),
    },
    "geojson-layers/drainage": {
        "method": "manual",
        "produced_by": "manual",
        "produced_at": "2026-03-27",
        "sources": [reg("opencity-gcc-swd-survey", as_of="2023")],
        "note": (
            "OpenCity/GCC KML download + Python conversion; the conversion run itself is "
            "unrecorded (docs name the method, not the artifact's producer script). 2023 "
            "GCC storm-water-drain survey, 10,308 segments incl. the Good/Bad condition "
            "field."
        ),
        "conventions": {
            "measurements": "depth/width attributes are nominal design values, not field measurements",
        },
    },
    "geojson-layers/flood-2015-hotspots": {
        "method": "manual",
        "sources": [reg("opencity-chennai-flood", as_of="2015-12")],
        "note": "December 2015 flood event layer (327 points), historical reference.",
    },
    "geojson-layers/flood-2020-hotspots": {
        "method": "manual",
        "sources": [NIVAR_2020],
        "note": (
            "53 Cyclone Nivar (Nov 2020) flooded neighbourhoods - historical event "
            "reference layer from the separate OpenCity chennai-floods-2020-data dataset "
            "(deliberately not watched by opencity-chennai-flood; map overlay only)."
        ),
    },
    "geojson-layers/flood-hazard-zones": {
        "method": "manual",
        "produced_by": "scripts/simplify-flood-geojson.ts",
        "sources": [reg("opencity-chennai-flood")],
        "note": "NCCR C-FLOWS model output (flood hazard zones) via OpenCity, simplified for serving.",
    },
    "geojson-layers/flood-inundation-depth": {
        "method": "manual",
        "sources": [reg("opencity-chennai-flood")],
        "note": "NCCR C-FLOWS inundation points with depth, via OpenCity.",
    },
    "geojson-layers/flood-return-periods": {
        "method": "manual",
        "produced_by": "scripts/simplify-flood-geojson.ts",
        "sources": [reg("opencity-chennai-flood", as_of="2019")],
        "note": "C-FLOWS 1.0 (2019) modelled flow extents, simplified for serving.",
        "conventions": {
            "return_periods": "5/10/25/50/100/200-year modelled return-period extents, not observed floods",
        },
    },
    "geojson-layers/gwr-blocks": {
        "method": "api",
        "produced_by": "scripts/fetch-wris-groundwater.ts",
        "sources": [reg("ingres-gw-assessment-tn")],
    },
    "geojson-layers/industrial-zones": {
        "method": "api",
        "produced_by": "scripts/fetch-industrial-zones-osm.ts",
        "sources": [dict(OSM_SOURCE)],
    },
    "geojson-layers/rivers": {
        "method": "api",
        "produced_by": "scripts/fetch-rivers-osm.ts",
        "sources": [dict(OSM_SOURCE)],
        "note": (
            "A byte-identical copy ships in the chennai-rivers basin pack "
            "(public/data/basins/chennai-rivers/rivers.geojson); the projection/copy "
            "declaration is due when that pack migrates."
        ),
    },
    "geojson-layers/sewerage": {
        "method": "manual",
        "produced_by": "scripts/convert-sewerage-kml.py",
        "sources": [reg("opencity-cmwssb-sewerage")],
        "note": (
            "Three OpenCity CMWSSB datasets (collection system, pumping network, "
            "treatment plants): 9 STPs, 349 SPS, 3,834 trunk mains - trunk-only subset, "
            "the full 237 MB street network is deliberately excluded. Capacities "
            "cross-checked against cmwssb.tn.gov.in/sewerage-system."
        ),
    },
    "geojson-layers/sub-basins-risk": {
        "method": "derived",
        "produced_by": "scripts/build_chennai_subbasin_risk.py",
        "sources": [
            dict(reg("tngcc-ceew-basin-risk", as_of="2026-02"), role="asserts"),
            HYDROSHEDS,
        ],
        "note": (
            "Indicator values asserted by the CEEW+TNGCC Feb 2026 report (6 sub-basins x "
            "33 indicators); the report publishes no boundaries, so the geometry is our "
            "HydroBASINS level-12 derivation (see data-sources.md, sub-basin geometry). "
            "LICENCE FLAG: CC BY-NC 4.0 input - this derived pair is NON-COMMERCIAL "
            "encumbered."
        ),
    },
    "geojson-layers/sub-basins-risk-geom": {
        "method": "derived",
        "produced_by": "scripts/derive_chennai_subbasins_hydrobasins.py",
        "sources": [
            HYDROSHEDS,
            dict(reg("tngcc-ceew-basin-risk", as_of="2026-02"), role="asserts"),
        ],
        "note": (
            "Sub-basin polygons derived from HydroBASINS level-12 clipped to the report's "
            "six named sub-basins (the report publishes no boundaries). CC BY-NC "
            "encumbrance travels with the risk layer it serves."
        ),
    },
    "geojson-layers/water-bodies-current": {
        "method": "api",
        "produced_by": "scripts/fetch-water-bodies-osm.ts",
        "sources": [dict(OSM_SOURCE)],
    },
    "geojson-layers/water-bodies-lost": {
        "method": "manual",
        "produced_by": "manual",
        "sources": [],
        "note": (
            "Archival register of lost water bodies curated from named per-feature "
            "sources (see each feature's properties) - per-record citations carry the "
            "accountability; an aggregate description is not an upstream source."
        ),
    },
    # rich-bodies data (produced_at from each file's own computed_at)
    "rich-bodies/jrc-water-trend": {
        "method": "gee",
        "produced_by": "scripts/verify_rich_body_water_trend.py",
        "sources": [JRC_GSW],
        "note": (
            "Zonal annual water-class statistics; JRC v1.4 cutoff is 2021 (no later "
            "years). Method, classes and known_limitations in the legacy data_source key."
        ),
    },
    "rich-bodies/dw-water-trend": {
        "method": "gee",
        "produced_by": "scripts/verify_rich_body_dw_water_trend.py",
        "sources": [DYNAMIC_WORLD],
        "note": (
            "Extends the JRC v1.4 water trend past its 2021 cutoff; spliced with JRC at "
            "2021/2022 in the panel chart. Method and known_limitations in the legacy "
            "data_source key."
        ),
    },
    "rich-bodies/dynamic-world-built-trend": {
        "method": "gee",
        "produced_by": "scripts/verify_rich_body_built_trend.py",
        "sources": [DYNAMIC_WORLD],
        "note": "Per-pixel annual MODE built-class statistics; known_limitations in the legacy data_source key.",
    },
    "rich-bodies/open-buildings-verification": {
        "method": "gee",
        "produced_by": "scripts/verify_rich_body_open_buildings.py",
        "sources": [OPEN_BUILDINGS],
        "note": "Building-count verification per zone; v3 reflects state around 2023. Limitations in the legacy data_source key.",
    },
    "rich-bodies/overture-buildings": {
        "method": "derived",
        "produced_by": "scripts/verify_rich_body_overture_buildings.py",
        "sources": [dict(OVERTURE, as_of="2026-06-17")],
        "note": (
            "Per-building polygon counts from the Overture 2026-06-17.0 release (the "
            "release id is the evidence vintage); independent comparison against Google "
            "Open Buildings by design."
        ),
    },
    "rich-bodies/imagery-manifest": {
        "method": "gee",
        "produced_by": "scripts/ingest_rich_body_imagery.py",
        "sources": [LANDSAT, SENTINEL2],
        "note": (
            "Manifest referencing binary imagery chips (the sanctioned pattern - NVDM "
            "governs the manifest, not the rasters). Per-mission licences in the legacy "
            "license key; NICFI (Planet Labs, reserved licence) applies only if NICFI "
            "chips are added."
        ),
    },
    "rich-bodies/boundary-analysis": {
        "method": "derived",
        "produced_by": "manual",
        "sources": [
            dict(TNSWA, role="input"),
            dict(OSM_SOURCE, title="OpenStreetMap marsh polygon (relation 15046539)", role="input"),
        ],
        "note": (
            "Shapely/pyproj set algebra over the TNSWA gazetted polygon and the OSM "
            "ecological polygon (see methodology key); the run itself was a one-off "
            "(no committed script). The 233.06 ha figure is land inside the TNSWA "
            "boundary but not mapped as OSM wetland - it cannot distinguish physical "
            "conversion from OSM under-mapping (see caveats)."
        ),
    },
    # rich-bodies geojson (defaults; pallikaranai overrides below)
    "geojson-layers/polygon": {
        "method": "api",
        "produced_by": "scripts/fetch-rich-body-polygon.ts",
        "sources": [dict(OSM_SOURCE, title="OpenStreetMap body polygon (Overpass relation/way extract)")],
    },
    "geojson-layers/buffer-1000m": {
        "method": "derived",
        "produced_by": "scripts/fetch-rich-body-polygon.ts",
        "sources": [dict(OSM_SOURCE, title="OpenStreetMap body polygon (Overpass relation/way extract)", role="input")],
        "note": "1 km Minkowski offset of the body polygon (@turf/buffer), not a circle from the centroid.",
    },
    "geojson-layers/osm-ecological": {
        "method": "api",
        "sources": [dict(OSM_SOURCE, title="OpenStreetMap marsh polygon (relation 15046539)")],
        "note": "OSM mapper's interpretation of current marsh extent (smaller than the gazetted boundary).",
    },
}

# Per-path overrides where one dataset id has per-body provenance differences:
# Pallikaranai's primary polygon is the TNSWA gazetted boundary, not OSM.
PATH_OVERRIDES: dict[str, dict] = {
    "public/geojson/rich-bodies/pallikaranai.geojson": {
        "method": "api",
        "produced_by": "scripts/fetch-tnswa-ramsar-polygon.ts",
        "sources": [dict(TNSWA)],
        "note": (
            "Gazetted Ramsar Site #2481 boundary from the TNSWA qgis2web export; matches "
            "the official RSIS area (1,247.54 ha) within 0.4%."
        ),
    },
    "public/geojson/rich-bodies/pallikaranai-buffer-1000m.geojson": {
        "method": "derived",
        "produced_by": "scripts/fetch-tnswa-ramsar-polygon.ts",
        "sources": [dict(TNSWA, role="input")],
        "note": (
            "1 km Minkowski offset of the TNSWA gazetted polygon (@turf/buffer) - the "
            "legal anchor is the NGT Sept 2025 construction-freeze order (1 km pending "
            "zone-of-influence mapping)."
        ),
    },
}

LEGACY_DATES = ("generated_at", "compiled_at", "computed_at", "updated", "last_updated", "fetched_at", "retrieved")
SKIP = {
    "cascade/catchment-basin",       # naked indexed map (spec 6.1 grandfather)
    "cascade/catchment-downstream",  # naked indexed map
    "cascade/catchment-streams",     # naked indexed map
    "data-root/localities",          # bare array, wrap follow-up
    "data-root/ward-names",          # bare array, wrap follow-up
    "data-root/ward-profiles",       # producer-owned wrap (compute-ward-profiles.ts), own commit
    "data-root/rainfall-recent",     # producer-owned envelope (fetch_recent_rainfall.py, daily)
}
SKIP_PATHS = {
    # BLOCKED - provenance unknown (worklist 6.4 item 1): boundary geometry
    # publisher/licence/retrieval unrecorded; enveloping would fabricate.
    "public/geojson/chennai-wards-2022.geojson",
    # BLOCKED - keep-or-delete decision pending (worklist 6.4 item 5).
    "public/geojson/chennai-reservoir-catchments.geojson",
}


def produced_at_for(doc: dict, path: Path) -> str:
    for k in LEGACY_DATES:
        v = doc.get(k)
        if isinstance(v, str) and v[:4].isdigit():
            return v[:10]
    meta = doc.get("_meta", {})
    if isinstance(meta, dict):
        v = meta.get("generated_at", "")
        if isinstance(v, str) and v[:4].isdigit():
            return v[:10]
    meta = doc.get("meta", {})
    if isinstance(meta, dict):
        v = meta.get("last_updated", "")
        if isinstance(v, str) and v[:4].isdigit():
            return v[:10]
    out = subprocess.run(
        ["git", "log", "-1", "--format=%cs", "--", str(path.relative_to(ROOT))],
        cwd=ROOT, capture_output=True, text=True,
    )
    return out.stdout.strip() or "2026-07-30"


def dump(merged: dict, raw: str) -> str:
    """Preserve the artifact's storage style: minified stays one line (a
    6 MB single-line FeatureCollection must not become a 40 MB pretty file),
    pretty stays indent=2 like the pilot."""
    if raw.count("\n") <= 3 and len(raw) > 100_000:
        return json.dumps(merged, ensure_ascii=False)
    return json.dumps(merged, indent=2, ensure_ascii=False)


def main() -> int:
    cat = json.loads((ROOT / "docs/architecture/dataset-catalogue.json").read_text())
    done = skipped = 0
    refresh = "--refresh" in sys.argv
    for rec in cat["files"]:
        if rec["scope"] != "chennai":
            continue
        ds = f"{rec['family']}/{rec['dataset']}"
        if ds in SKIP or rec["path"] in SKIP_PATHS:
            skipped += 1
            continue
        spec = PATH_OVERRIDES.get(rec["path"]) or PROVENANCE.get(ds)
        if spec is None:
            print(f"NO PROVENANCE MAP for {ds} ({rec['path']}) - refusing to guess", file=sys.stderr)
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
        prior_produced_at = doc.get("provenance", {}).get("produced_at") if "nvdm" in doc else None
        provenance = {
            "sources": spec["sources"],
            "method": spec["method"],
            "produced_at": prior_produced_at or spec.get("produced_at") or produced_at_for(doc, path),
        }
        if spec.get("produced_by"):
            provenance["produced_by"] = spec["produced_by"]
        if spec.get("note"):
            provenance["note"] = spec["note"]
        if spec.get("conventions"):
            provenance["conventions"] = spec["conventions"]
        envelope = {"nvdm": "1.0", "dataset": ds, "scope": dict(SCOPE), "provenance": provenance}
        merged = {**envelope, **{k: v for k, v in doc.items() if k not in envelope}}
        out = dump(merged, raw)
        path.write_text(out + ("\n" if raw.endswith("\n") else ""))
        done += 1
        print(f"enveloped {rec['path']}")
    print(f"\n{done} enveloped, {skipped} skipped (naked maps / bare arrays / producer-owned / blocked)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
