#!/usr/bin/env python3
"""Bangalore NVDM migration: inject the v1 envelope into every envelope-capable
Bangalore artifact (spec Part 9 - Bangalore is city 3 of the legacy migration,
after the Madurai pilot and Chennai, whose injectors this clones).

Everything here is ADDITIVE: envelope keys are inserted ahead of the existing
payload, no legacy key is removed or renamed, and no value is changed - shape
migration and value changes are separate commits by spec rule 9.4.

The per-dataset provenance map below is the reviewable heart of this script:
every source entry was verified against the file's own legacy keys
(_meta/_source/_sources/source/primary_source), the Headwaters registry, the
generating pipeline's code, or the live OpenCity CKAN API (licences and
metadata_modified re-checked 2026-07-30). Where a fact could not be verified
it is NOT stated (no fabricated provenance).

Bangalore-specific verifications on record:
  - opencity-bengaluru-tanker-survey licence is CC BY-NC-SA 4.0 (resource pages;
    cc-nc) - the registry's earlier "CC BY" was corrected in the same
    migration; the tanker survey summary is NON-COMMERCIAL encumbered.
  - The BBMP lake masterlist KML is a RESOURCE of the same OpenCity dataset
    as the ATREE-CSEI KMZ (map-lakes-streams-bengaluru-urban-within-bbmp-area,
    verified via package_show), so both name-join sources share the
    atree-opencity-lakes-bengaluru registry id.
  - compute-bangalore-ward-risk.py reads ONLY wards-2025 + ward-profiles +
    water-bodies-current (its header mentions the 13 CGWB stations; the code
    never reads them - internal_inputs lists what the code reads).

Skipped on purpose:
  - catchment-basin / -downstream / -streams: naked indexed-collection maps,
    grandfathered (spec 6.1) - an envelope would change their shape.
  - bangalore-localities.json: bare array, poor wrap-to-value ratio today;
    tracked follow-up (wrap all cities together).
  - bangalore-ward-profiles.json: wrapped by its producer
    (compute-bangalore-ward-profiles.ts) in its own commit, like the pilot.
  - rainfall-recent-bangalore.json: envelope OWNED BY ITS PRODUCER
    (fetch_recent_rainfall.py, daily) since the pilot.

Citation debt carried honestly (enveloped, but flagged):
  - restoration-priority-bangalore.json is derived output of a one-off
    scoring run with NO committed producer script; its internal lineage is
    deliberately NOT declared (declaring unverifiable inputs would be
    fabrication) - the validator's conservative taint keeps it below L3
    until the scorer is committed.

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
SCOPE = {"kind": "city", "id": "bangalore"}

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
    "title": "IMD monthly rainfall normals (Bangalore grid point, via imd-rainfall-monthly-bangalore.json)",
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
WELL_LABS = {
    "title": "WELL Labs Bengaluru Urban Water Balance Report (data year 2021; infrastructure baseline Jan 2024)",
    "publisher": "WELL Labs (IFMR Society / Krea University)",
    "url": "https://welllabs.org/bengaluru-urban-water-balance-report-well-labs/",
    "license": "published report, registration-gated download, cited with attribution",
    "closed": True,
    "as_of": "2024-01",
}
ISEC_WP505 = {
    "title": "ISEC Working Paper 505 - Kavyashree & Krishna Raj, 'Performance of BWSSB' (NRW audit from official BWSSB data)",
    "publisher": "Institute for Social and Economic Change, Bengaluru",
    "license": "academic working paper, cited with attribution",
    "closed": True,
    "as_of": "2023",
}

CASCADE_TOPO = [FABDEM, OSM_TANKS, HYDROSHEDS]
CASCADE_SCORED = CASCADE_TOPO + [SENTINEL2, DYNAMIC_WORLD]

CASCADE_NOTE = (
    "Derived by the cascade reconstruction pipeline (neer-vazhvu-api/app/cascade). "
    "FABDEM input makes this family CC BY-NC-SA (non-commercial) encumbered - "
    "recorded in the fabdem-dem registry entry, 2026-07-30."
)

REG_IDS = {
    "opencity-gba-wards-2025": ("GBA 369-ward delimitation 2025 (Dec 2025 KML incl. 01.12.2025 name changes, via OpenCity)", "GBA / GoK Urban Development Department (via OpenCity)", "Other (Public Domain) (per OpenCity dataset page)"),
    "opencity-gba-corporations-2025": ("GBA 5-corporation boundaries, September 2025 KML (via OpenCity)", "GBA / GoK Urban Development Department (via OpenCity)", "Other (Public Domain) (per OpenCity dataset page)"),
    "opencity-bwssb-stps": ("BWSSB Sewage Treatment Plant locations (CSV + KML, via OpenCity)", "BWSSB (via OpenCity)", "Other (Public Domain) (per OpenCity dataset page)"),
    "opencity-bwssb-sewerage": ("BWSSB sewerage line maps - >=300mm trunk KML (via OpenCity)", "BWSSB (via OpenCity)", "Other (Public Domain) (per OpenCity dataset page)"),
    "opencity-bwssb-cauvery-stage-areas": ("BWSSB stage-wise Cauvery water-supply areas CSV (via OpenCity)", "BWSSB (via OpenCity)", "Other (Public Domain) (per OpenCity dataset page)"),
    "kwris-mi-tanks": ("Karnataka WRIS Minor Irrigation tank register (GeoServer layer KA:MI_Tanks)", "Karnataka WRD (KWRIS)", "public Karnataka government data, open WFS, cited with attribution"),
    "atree-opencity-lakes-bengaluru": ("ATREE-CSEI 'Map of Lakes in Bengaluru Urban and Rural Districts' KMZ (via OpenCity)", "ATREE-CSEI (via OpenCity)", "Creative Commons Attribution (per OpenCity dataset page, verified 2026-07-30)"),
    "opencity-bengaluru-tanker-survey": ("OpenCity Bengaluru Tanker Water surveys (2015, 2019, 2024 rounds)", "OpenCity (Bengaluru Tanker Water Survey)", "CC BY-NC-SA 4.0 (resource pages state the specific licence; the dataset-level label is the generic 'Creative Commons Non-Commercial (Any)'; verified 2026-07-30)"),
    "iisc-groundwater-outlook": ("IISc Groundwater Outlook of Bengaluru City - Interim Report II (Jan 2025, via OpenCity mirror)", "IISc Bengaluru (Prof. Lakshminarayana & Prof. Sekhar Muddu), via OpenCity", "open (per OpenCity dataset page)"),
    "kspcb-monthly-wq": ("KSPCB monthly/quarterly water-quality reports (RWQ/GEMS/MINAR series)", "Karnataka State Pollution Control Board", "government publication, cited with attribution"),
    "ingres-gw-assessment-ka": ("IN-GRES dynamic groundwater assessment (Bangalore Urban assessment units)", "CGWB / IIT-Hyderabad (IN-GRES)", "GoI publication, cited with attribution"),
    "bwssb-jica-supply-baseline": ("JICA Bengaluru Water Supply and Sewerage Project Phase 3 Final + Supporting Reports, Nov 2017 (via OpenCity mirror)", "JICA / BWSSB (via OpenCity)", "open (per OpenCity dataset page)"),
    "cpcb-nwmp-annual": ("CPCB NWMP annual river water-quality reports (Bengaluru stations)", "Central Pollution Control Board", "GoI publication, cited with attribution"),
    "cpcb-prs-report": ("CPCB Polluted River Stretches report, October 2025", "Central Pollution Control Board", "GoI publication, cited with attribution"),
    "opencity-bengaluru-flood": ("KSRSAC Bengaluru Urban flooding locations - 3 KSRSAC datasets (via OpenCity)", "KSRSAC / BBMP (via OpenCity)", "CC-Public-Domain (per OpenCity dataset page)"),
    "opencity-bengaluru-swd": ("BBMP primary + secondary stormwater drains - rajakaluves (via OpenCity)", "BBMP (via OpenCity)", "CC-Public-Domain (per OpenCity dataset page)"),
    "opencity-bengaluru-waterbodies-census": ("First Census of Water Bodies - Bengaluru Urban district KML (Jal Dharohar, via OpenCity)", "Ministry of Jal Shakti / Jal Dharohar (via OpenCity)", "open (per OpenCity dataset page)"),
    "bcap-commitments-calendar": ("BBMP Climate Action and Resilience Plan (BCAP) sector actions (via OpenCity)", "BBMP Climate Action Cell (via OpenCity)", "open (per OpenCity dataset page)"),
}


def reg(source_id: str, role: str | None = None, as_of: str | None = None, title: str | None = None) -> dict:
    title_, publisher, license_ = REG_IDS[source_id]
    s = {"id": source_id, "title": title or title_, "publisher": publisher, "license": license_}
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
        "produced_by": "neer-vazhvu-api/app/cascade/health.py",
        "sources": CASCADE_SCORED,
        "note": CASCADE_NOTE
        + " Layer B named-cascade documentation is internal Neer Vazhvu curation over the "
        "auto topology; its own _sources_of_truth key (Nagendra OUP 2016, IISc CES 105-lake "
        "survey, NGT Forward Foundation OA 222/2014, JICA Phase 3, BWSSB historical "
        "records) carries the per-cascade citations - lineage, not an upstream source.",
    },
    "cascade/cascades-health": {
        **cascade(CASCADE_SCORED),
        "produced_by": "neer-vazhvu-api/app/cascade/health.py",
    },
    "cascade/catchment-quality": cascade([FABDEM, OSM_TANKS]),
    # data-root
    "data-root/allocations": {
        "method": "manual",
        "sources": [],
        "note": (
            "Claim register - per-arrangement citations live in the legacy `sources` map "
            "(id-keyed source objects: BWSSB 'About' page, JICA Phase 3 appraisal, SANDRP "
            "and SC-verdict analyses, dated press) and per-record `source` fields; an "
            "aggregate description is not an upstream source. unit_note declares the "
            "native-units discipline (TMC/yr entitlements never silently converted to MLD; "
            "consumptive earmark vs gross-drawal bases both shown, never mixed)."
        ),
    },
    "data-root/cauvery-stage-areas": {
        "method": "manual",
        "produced_by": "scripts/convert-bangalore-cauvery-stage-areas.py",
        "sources": [reg("opencity-bwssb-cauvery-stage-areas")],
        "note": (
            "BBMP-area name lists served by each Cauvery supply stage (Stages 1 - 4 Ph 2), "
            "converted from the OpenCity CSV (Windows-1252 source read latin-1, emitted "
            "UTF-8). Stage V (commissioned Oct 2024, the 110 added villages) is NOT in the "
            "upstream dataset yet - ingest when OpenCity publishes it (the registry entry "
            "watches for exactly that)."
        ),
    },
    "data-root/cgwb-stations": {
        "method": "api",
        "sources": [dict(WRIS_GW)],
        "note": (
            "Station inventory from a single-day India-WRIS API probe (May 2026), CGWB "
            "DWLR/telemetric stations across Bangalore Urban district; live readings flow "
            "daily via neer-vazhvu-api/scripts/scrape_wris_bangalore.py into Supabase "
            "groundwater_wris, not this file. `readings` arrays are EMPTY - the CGWB Year "
            "Book per-station hydrograph for Bengaluru is not yet transcribed (tracked "
            "follow-up in the legacy _note). WRIS is a continuous source: "
            "freshness-tracked, not edition-tracked."
        ),
        "conventions": {
            "sign": "depth metres below ground level, positive down",
        },
    },
    "data-root/commitments": {
        "method": "manual",
        "sources": [reg("bcap-commitments-calendar")],
        "note": (
            "Status changes only with a dated citation; per-commitment citations inline "
            "(sources arrays on each commitment + status_history entries). The registered "
            "BCAP entry covers the dated water targets leg; NGT orders, JICA press "
            "releases, cabinet approvals and dated press carry the rest per record "
            "(sources_note + _citation_trace_ngt_2018 document the re-sourcing audit)."
        ),
    },
    "data-root/elevation-bands": {
        "method": "gee",
        "produced_by": "neer-vazhvu-api/scripts/build_elevation_bands.py",
        "sources": [FABDEM],
        "note": "Bands, not spot heights - see the legacy _provenance prose. CC BY-NC-SA encumbered via FABDEM.",
    },
    "data-root/facts": {
        "method": "manual",
        "sources": [
            reg("bwssb-jica-supply-baseline"),
            reg("iisc-groundwater-outlook", as_of="2025-01"),
            reg("opencity-bengaluru-tanker-survey"),
        ],
        "note": (
            "Hand-curated fact register (no derived-facts script for Bangalore yet); every "
            "fact carries its own citation (source_label/source_url/data_date). The "
            "envelope lists the registered upstreams; the remaining anchors named in the "
            "legacy note (CGWB GWR round-11 extract - travels with gwr-blocks-bangalore's "
            "envelope - WELL Labs Urban Water Balance, NGT Forward Foundation OA 222/2014) "
            "are cited per fact."
        ),
    },
    "data-root/flood-hotspots": {
        "method": "manual",
        "produced_by": "manual",
        "sources": [reg("opencity-bengaluru-flood", as_of="2025-11-27")],
        "note": (
            "KSRSAC KML download + conversion; the conversion run itself is unrecorded "
            "(the _meta block, not a committed script, is the production record). Three "
            "KSRSAC categories - 70 named flood-prone, 194 unnamed vulnerability points, "
            "128 named low-lying areas; see _meta.categories for the distinctions and the "
            "named-locality RTI follow-up."
        ),
    },
    "data-root/gwr-blocks": {
        "method": "api",
        "produced_by": "scripts/fetch-wris-groundwater-bangalore.ts",
        "sources": [reg("ingres-gw-assessment-ka")],
        "note": (
            "Block-level dynamic groundwater assessment (GEC classes and stage-of-"
            "extraction) for Bangalore Urban's 5 assessment units, acquired via the WRIS "
            "NWIC GWR{year}_CGWB ArcGIS services, vintages 2011-2024."
        ),
        "conventions": {
            "comparability": (
                "CGWB assessment units can change between GEC editions (WRIS also respells "
                "the district 'Bangalore Urban'/'Bengaluru Urban' across vintages); "
                "year-on-year comparisons must check assessment-unit continuity before "
                "differencing."
            ),
        },
    },
    "data-root/iisc-stress-wards-2025": {
        "method": "pdf-extract",
        "sources": [reg("iisc-groundwater-outlook", as_of="2025-01")],
        "note": (
            "80 critical BBMP wards from IISc Interim Report II Table 1 (some press cites "
            "'65' from a later summary - the PDF lists 80). Ward numbers are on the legacy "
            "BBMP 198-ward grid; each BBMP ward centroid was spatial-joined to its "
            "containing GBA 2025 ward for rendering on the 369-ward map (see _note)."
        ),
    },
    "data-root/imd-rainfall-monthly": {
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/generate_imd_rainfall.py",
        "sources": [
            {
                "id": "imd-gridded-rain",
                "title": "IMD gridded monthly rainfall (0.25 deg, Bangalore grid point)",
                "publisher": "India Meteorological Department",
                "license": "GoI publication, cited with attribution",
            }
        ],
        "note": (
            "Quarterly rebuild (imd-rainfall-refresh.yml); the generator writes through "
            "scripts/nvdm_write.py so this envelope survives regeneration. Grid-point "
            "selection notes in the legacy note key."
        ),
    },
    "data-root/industrial-sources": {
        "method": "manual",
        "produced_by": "manual",
        "sources": [],
        "note": (
            "Curated compilation of cluster-level records; the legacy `source` string "
            "names the upstreams (KSPCB industries directory via OpenCity, Citizen "
            "Matters, WELL Labs Urban Water Balance, Forward Foundation v Karnataka NGT "
            "filings, IISc CES wetlands studies) and each entry cites the most specific "
            "source for its pollution claim. Coordinates are industrial-cluster centroids "
            "per KSPCB boundary maps, deliberately NOT single facilities - see _note."
        ),
    },
    # data-root/rainfall-recent: envelope OWNED BY ITS PRODUCER
    # (fetch_recent_rainfall.py, daily) - listed in SKIP below.
    "data-root/restoration-priority": {
        "method": "derived",
        "produced_by": "manual",
        "sources": [OSM_TANKS],
        "note": (
            "CITATION DEBT (on record since 2026-07-30): scored by a one-off run with NO "
            "committed producer script (algorithm_version bangalore-flagship-v0; weights "
            "in the payload). The 17-kere flagship set is curated; polygon identity/"
            "centroids trace to the OSM extract (osm_id per body; fully-lost bodies "
            "carry osm_id null). internal_inputs is deliberately NOT declared - the "
            "producer code does not exist to verify against, and the validator's "
            "conservative lineage taint correctly holds this artifact below L3 until "
            "the scorer is committed."
        ),
    },
    "data-root/river-events": {
        "method": "manual",
        "sources": [],
        "note": (
            "Curated event timeline (court orders + named events on the Vrishabhavathi, "
            "Arkavati and Dakshina Pinakini) - per-record url citations carry the "
            "accountability. Compile pattern matches river-events-madurai.json."
        ),
    },
    "data-root/river-quality": {
        "method": "pdf-extract",
        "sources": [
            reg("cpcb-nwmp-annual", as_of="2024"),
            reg("kspcb-monthly-wq"),
            reg("cpcb-prs-report", as_of="2025-10"),
        ],
        "note": (
            "Split-source series (2020-2024): CPCB NWMP annual reports AND KSPCB monthly "
            "water-quality reports; where the two differ at a station this file uses "
            "CPCB's annual mean (platform-wide convention). Station coordinates are "
            "government-record GPS locations, field-verified with Paani Earth against the "
            "KSPCB station register (Jul 2026). All three rivers are CPCB Priority I "
            "polluted stretches (October 2025 PRS report, mirrored under /docs)."
        ),
        "conventions": {
            "aggregation": "readings are annual means; dry-season/monsoon variance is large (see _note)",
            "coordinates": (
                "stations within 5 km of the OSM river polyline are snapped to it "
                "(lat_original/lng_original preserved); farther stations carry "
                "off_osm_river_polyline + osm_coverage_caveat - see _osm_coverage_note"
            ),
        },
    },
    "data-root/supply-overview": {
        "method": "pdf-extract",
        "sources": [
            reg("bwssb-jica-supply-baseline", as_of="2017-11"),
            reg("iisc-groundwater-outlook", as_of="2025-01"),
            reg("opencity-bengaluru-tanker-survey"),
            WELL_LABS,
            ISEC_WP505,
        ],
        "note": (
            "Anchored on the JICA Phase 3 Final Report (Nov 2017) - Bangalore's "
            "equivalent of Chennai's ADB CCRWSSP IEE; supply/connection/population "
            "figures refreshed June 2026 to BWSSB-official 2026 sources (dated citations "
            "in the legacy _sources array, 13 entries incl. BWSSB About page, Elets eGov "
            "Chairman interview, The Ken, World Bank). _data_provenance_caveats carries "
            "the honest-gaps record (three NON-comparable groundwater estimates; NRW "
            "36.35% audited vs weakly-sourced lower claims). _view_overrides is a "
            "grandfathered UI hint (spec 6.4), config-migration follow-up on record."
        ),
    },
    "data-root/tanker-context": {
        "method": "manual",
        "sources": [
            reg("opencity-bengaluru-tanker-survey"),
            reg("iisc-groundwater-outlook", as_of="2025-01"),
        ],
        "note": (
            "Curated supplementary context for /bangalore/tanker, layered on the "
            "longitudinal survey summary (bangalore-tanker-survey.json). Every claim has "
            "at least one citation in the legacy `sources` map (Citizen Matters, WELL "
            "Labs, Down To Earth, Newslaundry and others); the envelope lists the two "
            "registered upstreams whose editions should trigger a re-check. "
            "_citation_trace_newslaundry records the link-sweep false-positive audit."
        ),
    },
    "data-root/tanker-survey": {
        "method": "derived",
        "produced_by": "scripts/build-bangalore-tanker-summary.py",
        "internal_inputs": [],
        "sources": [reg("opencity-bengaluru-tanker-survey", role="input", as_of="2024")],
        "note": (
            "Longitudinal medians/counts computed from the raw survey CSVs (2015, 2019, "
            "2024) committed under scripts/data-raw/bangalore/ - raw inputs are not "
            "served artifacts, hence internal_inputs []. Schemas differ by round (n= "
            "sample sizes on every stat); 2025 round carried as _2025_context prose. "
            "LICENCE FLAG: CC BY-NC-SA 4.0 upstream - this summary is NON-COMMERCIAL and SHARE-ALIKE "
            "encumbered (registry licence corrected 2026-07-30)."
        ),
    },
    "data-root/ward-risk": {
        "method": "derived",
        "produced_by": "scripts/compute-bangalore-ward-risk.py",
        "internal_inputs": [
            "public/geojson/bangalore-wards-2025.geojson",
            "public/data/bangalore-ward-profiles.json",
            "public/geojson/bangalore-water-bodies-current.geojson",
        ],
        "sources": [
            reg("opencity-gba-wards-2025", role="input", as_of="2025-12"),
            OSM_TANKS,
        ],
        "note": (
            "V0 composite (population density 0.5, inverted water-body density 0.3, "
            "inverted flagship health 0.2; algorithm identity in the payload weights "
            "key). NO groundwater input today: gw_depth_m is null for every ward - the "
            "script header mentions the 13 CGWB stations but the code does not read "
            "them, and internal_inputs lists what the code reads."
        ),
    },
    "data-root/water-bodies-lost": {
        "method": "manual",
        "sources": [],
        "note": (
            "Archival compilation - the legacy primary_source (Nagendra, Nature in the "
            "City, OUP 2016) / secondary_sources keys and per-record notes carry the "
            "citations. Conservative V0: only named cases with unambiguous documented "
            "conversion; see summary._estimate_notes for the ~280-kere gazetteer context."
        ),
    },
    # geojson layers
    "geojson-layers/corporations-2025": {
        "method": "manual",
        "produced_by": "scripts/convert-bangalore-corporations-kml.py",
        "sources": [reg("opencity-gba-corporations-2025", as_of="2025-09")],
        "note": (
            "5 GBA corporation boundaries (Karnataka Act 36 of 2025); truncated KML "
            "'corporatio' names expanded and joined with the Kannada names used by the "
            "ward layer (name_kn convention, spec 7.2)."
        ),
    },
    "geojson-layers/gwr-blocks": {
        "method": "api",
        "produced_by": "scripts/fetch-wris-groundwater-bangalore.ts",
        "sources": [reg("ingres-gw-assessment-ka")],
    },
    "geojson-layers/rivers": {
        "method": "api",
        "produced_by": "scripts/fetch-rivers-osm-bangalore.ts",
        "sources": [dict(OSM_SOURCE)],
        "note": (
            "Vrishabhavathi (OSM spelling variants collapsed), Arkavati and Dakshina "
            "Pinakini reaches; bbox extends past GBA to Nandi Hills headwaters and the "
            "Byramangala discharge."
        ),
    },
    "geojson-layers/sewerage-trunks": {
        "method": "manual",
        "produced_by": "scripts/convert-bangalore-sewerage-trunks-kml.py",
        "sources": [reg("opencity-bwssb-sewerage")],
        "note": (
            ">=300mm trunk mains only (16,403 LineStrings) - the <300mm collector files "
            "of the same OpenCity dataset are deliberately not ingested (see the "
            "converter header)."
        ),
    },
    "geojson-layers/stps": {
        "method": "manual",
        "produced_by": "scripts/convert-bangalore-stps-kml.py",
        "sources": [reg("opencity-bwssb-stps")],
        "note": (
            "39 STPs, ~1,371 MLD design capacity. The upstream CSV is authoritative for "
            "the Status/active flag (the KML ships empty Status fields); KML used as a "
            "lat/lng cross-check - see the converter header."
        ),
    },
    "geojson-layers/swd-primary": {
        "method": "manual",
        "produced_by": "manual",
        "sources": [reg("opencity-bengaluru-swd", as_of="2025-11-27")],
        "note": (
            "Primary stormwater drains (rajakaluves), KSRSAC via OpenCity; the KML "
            "conversion run itself is unrecorded (the _meta block is the production "
            "record)."
        ),
    },
    "geojson-layers/swd-secondary": {
        "method": "manual",
        "produced_by": "manual",
        "sources": [reg("opencity-bengaluru-swd", as_of="2025-11-27")],
        "note": (
            "Secondary stormwater drains, KSRSAC via OpenCity; conversion run "
            "unrecorded (the _meta block is the production record)."
        ),
    },
    "geojson-layers/wards-2025": {
        "method": "manual",
        "produced_by": "scripts/convert-bangalore-wards-kml.py",
        "sources": [reg("opencity-gba-wards-2025", as_of="2025-12")],
        "note": (
            "369 GBA wards (delimitation notified 19 Nov 2025; Dec 2025 KML incl. the "
            "01.12.2025 name changes). ward_no is the global 1..369 ordinal; the same "
            "conversion emits the admin fields of bangalore-ward-profiles.json."
        ),
    },
    "geojson-layers/water-bodies-census": {
        "method": "manual",
        "produced_by": "scripts/convert-bangalore-water-bodies-census-kml.py",
        "sources": [reg("opencity-bengaluru-waterbodies-census", as_of="2023")],
        "note": (
            "First Census of Water Bodies (Jal Dharohar; survey 2018-19, release 2023), "
            "Bangalore Urban district = 718 Point features incl. Anekal taluk beyond GBA. "
            "Carries fields OSM lacks (ownership, encroachment, storage capacity); no "
            "name field - names live on the polygon layer via the ATREE join."
        ),
    },
    "geojson-layers/water-bodies-current": {
        "method": "mixed",
        "produced_by": "scripts/fetch-water-bodies-osm-bangalore.ts + scripts/name-bangalore-water-bodies.py",
        "internal_inputs": [],
        "sources": [
            dict(OSM_SOURCE, title="OpenStreetMap water-body polygons (Overpass extract, osmtogeojson assembly)"),
            reg("atree-opencity-lakes-bengaluru"),
            reg(
                "atree-opencity-lakes-bengaluru",
                title="BBMP lake masterlist KML - 'Map of Lakes in Bengaluru Urban within BBMP Area' resource of the same OpenCity dataset (181 named polygons)",
            ),
            reg("kwris-mi-tanks"),
        ],
        "note": (
            "OSM geometry (incl. name_kn) with real lake names backfilled by "
            "priority-ordered spatial join - ATREE-CSEI KMZ, BBMP masterlist, KWRIS "
            "MI_Tanks points (snapshot 2026-07-09) - onto unnamed polygons; each "
            "backfilled feature carries name_source + name_match_iou/name_match_m and "
            "OSM-native names are never overwritten. Both polygon name sources are "
            "resources of the one registered OpenCity dataset (verified via CKAN "
            "package_show, 2026-07-30). Name-join inputs are raw files under "
            "scripts/data-raw/, hence internal_inputs []."
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
            "license key."
        ),
    },
    # rich-bodies geojson (all Bangalore bodies are OSM-sourced; no gazetted
    # boundary overrides like Chennai's Pallikaranai)
    "geojson-layers/polygon": {
        "method": "api",
        "produced_by": "scripts/fetch-rich-body-polygon.ts",
        "sources": [dict(OSM_SOURCE, title="OpenStreetMap body polygon (Overpass relation/way extract)")],
    },
    "geojson-layers/buffer-1000m": {
        "method": "derived",
        "produced_by": "scripts/fetch-rich-body-polygon.ts",
        "internal_inputs": [],
        "sources": [dict(OSM_SOURCE, title="OpenStreetMap body polygon (Overpass relation/way extract)", role="input")],
        "note": (
            "1 km Minkowski offset of the body polygon (@turf/buffer), not a circle from "
            "the centroid; derived in-memory from the same Overpass fetch, hence "
            "internal_inputs []."
        ),
    },
}

LEGACY_DATES = ("generated_at", "compiled_at", "computed_at", "updated", "last_updated", "fetched_at", "retrieved")
SKIP = {
    "cascade/catchment-basin",       # naked indexed map (spec 6.1 grandfather)
    "cascade/catchment-downstream",  # naked indexed map
    "cascade/catchment-streams",     # naked indexed map
    "data-root/localities",          # bare array, wrap follow-up (all cities together)
    "data-root/ward-profiles",
    "data-root/ward-admin",       # producer-owned wrap (convert-bangalore-wards-kml.py), own commit
    "data-root/rainfall-recent",     # producer-owned envelope (fetch_recent_rainfall.py, daily)
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
        cwd=ROOT, capture_output=True, text=True,
    )
    return out.stdout.strip() or "2026-07-30"


def dump(merged: dict, raw: str) -> str:
    """Preserve the artifact's storage style: minified stays one line (a
    9 MB single-line FeatureCollection must not become a 60 MB pretty file),
    pretty stays indent=2 like the pilot. Within the one-line style, match
    the producer's separators so converter -> refresh is byte-idempotent."""
    if raw.count("\n") <= 3 and len(raw) > 100_000:
        head = raw[:100_000]
        compact = (head.count('","') + head.count('":"')
                   >= head.count('", "') + head.count('": "'))
        sep = (",", ":") if compact else (", ", ": ")
        return json.dumps(merged, ensure_ascii=False, separators=sep)
    return json.dumps(merged, indent=2, ensure_ascii=False)


def main() -> int:
    cat = json.loads((ROOT / "docs/architecture/dataset-catalogue.json").read_text())
    done = skipped = 0
    refresh = "--refresh" in sys.argv
    for rec in cat["files"]:
        if rec["scope"] != "bangalore":
            continue
        ds = f"{rec['family']}/{rec['dataset']}"
        if ds in SKIP:
            skipped += 1
            continue
        spec = PROVENANCE.get(ds)
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
        if spec.get("internal_inputs") is not None:
            provenance["internal_inputs"] = spec["internal_inputs"]
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
    print(f"\n{done} enveloped, {skipped} skipped (naked maps / bare arrays / producer-owned)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
