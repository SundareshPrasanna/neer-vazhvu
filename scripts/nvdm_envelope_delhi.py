#!/usr/bin/env python3
"""Delhi NVDM migration: inject the v1 envelope into every envelope-capable
Delhi artifact (spec Part 9 - Delhi is city 4 of the legacy migration, after
the Madurai pilot and Chennai, whose injectors this clones).

Everything here is ADDITIVE: envelope keys are inserted ahead of the existing
payload, no legacy key is removed or renamed, and no value is changed - shape
migration and value changes are separate commits by spec rule 9.4.

The per-dataset provenance map below is the reviewable heart of this script:
every source entry was verified against the file's own legacy keys
(_note/_extraction/source/_sources/metadata), the Headwaters registry
(scripts/source-registry/delhi.json + platform.json), or the generating
pipeline's code (neer-vazhvu-api/scripts/build_delhi_*.py and the root
scripts/*-delhi.ts). internal_inputs lists were read out of the producers'
actual load() calls, not their comments. Where a fact could not be verified
it is NOT stated (no fabricated provenance).

Skipped on purpose:
  - delhi-localities.json: bare array, poor wrap-to-value ratio today;
    tracked follow-up (wrap all cities' localities together).
  - delhi-ward-profiles.json: wrapped by its producer
    (neer-vazhvu-api/scripts/build_delhi_ward_profiles.py) in its own
    commit, like the Madurai pilot and Chennai.
  - rainfall-recent-delhi.json: envelope OWNED BY ITS PRODUCER
    (fetch_recent_rainfall.py, daily) since the pilot.

Formatting: files stored minified (single-line GeoJSON) stay single-line so
the envelope does not multiply their size; pretty files stay indent=2.

Idempotent: files already carrying `nvdm` are left untouched (--refresh
recomputes the envelope but preserves the original produced_at).
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

sys.path.insert(0, str(Path(__file__).resolve().parent))
from registry_license import registry_license  # noqa: E402
SCOPE = {"kind": "city", "id": "delhi"}

# ---- source literals (verified) -------------------------------------------

FABDEM = {
    "id": "fabdem-dem",
    "title": "FABDEM v1-2 30 m bare-earth DEM",
    "publisher": "University of Bristol (Hawker et al.), via GEE sat-io",
    "license": registry_license("fabdem-dem"),
    "role": "input",
}
OSM_SOURCE = {
    "id": "osm-overpass",
    "title": "OpenStreetMap (Overpass API extract)",
    "publisher": "OpenStreetMap contributors",
    "license": registry_license("osm-overpass"),
}
WRIS_GWL = {
    "id": "wris-live-services",
    "title": "India-WRIS 'Ground Water Level' dataset (POST API, indiawris.gov.in - CGWB observation wells)",
    "publisher": "CGWB / NWIC via India-WRIS",
    "license": registry_license("wris-live-services"),
    "retrieved": "2026-07-25",
}
IMD_GRID = {
    "id": "imd-gridded-rain",
    "title": "IMD gridded monthly rainfall (0.25 deg, NCT Delhi grid point)",
    "publisher": "India Meteorological Department",
    "license": registry_license("imd-gridded-rain"),
}
MOU_1994 = {
    "title": "MoU between Himachal Pradesh, Haryana, UP, Rajasthan and NCT Delhi regarding upper Yamuna waters (12 May 1994)",
    "publisher": "Upper Yamuna River Board / Ministry of Jal Shakti",
    "url": "https://cdnbbsr.s3waas.gov.in/s3a70dc40477bc2adceef4d2c90f47eb82/uploads/2024/08/20240814107157797.pdf",
    "license": "GoI public document, cited with attribution",
    "closed": True,
    "as_of": "1994-05-12",
}
MPD_2041 = {
    "title": "Draft Master Plan for Delhi 2041 - water targets (via Down to Earth analysis and the PRS summary)",
    "publisher": "Delhi Development Authority (draft), via Down to Earth / PRS Legislative Research",
    "url": "https://prsindia.org/files/parliamentry-announcement/2021-07-23/Master%20Plan%20for%20Delhi%202041.pdf",
    "license": "public policy document, cited with attribution",
    "closed": True,
    "as_of": "2021",
}

REG_IDS = {
    "dpcc-monthly-analysis-delhi": (
        "DPCC monthly analysis reports (river Yamuna, drains, STPs)",
        "Delhi Pollution Control Committee (I/C Water Laboratory)",
        "GNCTD publication, cited with attribution",
    ),
    "cgwb-dynamic-gwr-delhi": (
        "CGWB Dynamic Ground Water Resources - Delhi district assessments (via OpenCity national compilations)",
        "CGWB + state GW departments (via OpenCity)",
        "open (per OpenCity dataset page); underlying assessment GoI publication, cited with attribution",
    ),
    "cag-djb-audit": (
        "CAG Performance Audit of the Delhi Jal Board, Report No. 3 of 2025 (tabled 2026-03-23)",
        "Comptroller and Auditor General of India",
        "GoI publication, cited with attribution",
    ),
    "delhi-economic-survey-water": (
        "Delhi Economic Survey 2023-24, Chapter 13 (Water Supply and Sewerage)",
        "Planning Department, GNCTD",
        "GNCTD publication, cited with attribution",
    ),
    "dpcc-cetp-monthly-delhi": (
        "DPCC CETP monthly analysis bundles 2019-2024 (via OpenCity)",
        "Delhi Pollution Control Committee (via OpenCity)",
        "open (per OpenCity dataset page)",
    ),
    "dusib-jj-bastis": (
        "DUSIB JJ basti roster and coordinate PDFs",
        "Delhi Urban Shelter Improvement Board",
        "GNCTD publication, cited with attribution",
    ),
    "opencity-delhi-waterbodies-census": (
        "1st Census of Water Bodies / Jal Dharohar, NCT Delhi (via OpenCity)",
        "GNCTD / Ministry of Jal Shakti (via OpenCity)",
        "open (per OpenCity dataset page)",
    ),
    "ingres-gw-assessment-delhi": (
        "IN-GRES dynamic groundwater assessment, Delhi districts (2022-23 cycle)",
        "CGWB / IIT-Hyderabad (IN-GRES)",
        "GoI publication, cited with attribution",
    ),
    "delhi-reps-mcd": (
        "MCD general election 2022 results, 250 wards (via OpenCity)",
        "State Election Commission, NCT of Delhi (via OpenCity)",
        "open (per OpenCity dataset page)",
    ),
    "opencity-delhi-mcd-wards": (
        "SEC Delhi Delimitation Order 2022 ward geometry (via OpenCity; delisted, archive-verified copy)",
        "State Election Commission, NCT of Delhi (digitized by OpenCity)",
        "open (per OpenCity dataset page)",
    ),
    "djb-water-pages": (
        "DJB About Us page - WTP roster, capacities, raw-water sources (~900 MGD)",
        "Delhi Jal Board",
        "GNCTD publication, cited with attribution",
    ),
}


def reg(source_id: str, role: str | None = None, as_of: str | None = None,
        retrieved: str | None = None) -> dict:
    title, publisher, _legacy_license = REG_IDS[source_id]
    # The third element of the REG_IDS tuple is legacy: the REGISTRY owns a
    # registered source's licence, and validate_nvdm.py fails the build if an
    # envelope disagrees with it. Reading it from the table is how the two
    # drifted apart in the first place.
    s = {"id": source_id, "title": title, "publisher": publisher,
         "license": registry_license(source_id)}
    if role:
        s["role"] = role
    if as_of:
        s["as_of"] = as_of
    if retrieved:
        s["retrieved"] = retrieved
    return s


# ---- per-dataset provenance map (the reviewable core) ----------------------

PROVENANCE: dict[str, dict] = {
    # data-root
    "data-root/allocations": {
        "method": "manual",
        "sources": [
            MOU_1994,
            reg("cag-djb-audit", as_of="2026-03", retrieved="2026-07-20"),
            reg("delhi-economic-survey-water", as_of="2024", retrieved="2026-07-20"),
            reg("djb-water-pages", retrieved="2026-07-20"),
        ],
        "note": (
            "Per-arrangement citations live in the legacy `sources` map (id-keyed source "
            "objects: the 1994 MoU full text, UYRB pages, BBMB daily reservoir data, the "
            "THDC Tehri FAQ, Munak canal history via Wikipedia) and per-record `source` "
            "fields; those living pages stay per-record citations, not envelope sources. "
            "unit_note declares the native-units discipline (MGD/cusecs as published)."
        ),
    },
    "data-root/cag-djb-audit-2025": {
        "method": "pdf-extract",
        "produced_by": "manual",
        "produced_at": "2026-07-20",
        "sources": [reg("cag-djb-audit", as_of="2026-03", retrieved="2026-07-20")],
        "note": (
            "Headline findings extracted verbatim-faithfully from the CAG's own press "
            "release (2026-03-24, ref BSC/SS/RK/IK/15-26); audit period FY2017-18 to "
            "FY2021-22. Chapter/page-level citations from the full report PDF are the "
            "named deepening step - see the legacy _note."
        ),
    },
    "data-root/commitments": {
        "method": "manual",
        "sources": [
            reg("cag-djb-audit", as_of="2026-03", retrieved="2026-07-20"),
            reg("dpcc-monthly-analysis-delhi"),
            reg("delhi-economic-survey-water", as_of="2024", retrieved="2026-07-20"),
        ],
        "note": (
            "Status changes only with a dated citation; per-commitment citations inline "
            "(commitment_source + status_history entries). update_model names the "
            "verification calendar: DPCC monthly Yamuna report for river/drain outcomes, "
            "the Economic Survey and DJB budget for spending claims, the June Flood "
            "Control Order, Chhath season, and CAG follow-ups - which is why those "
            "registry entries carry this file in dependsOn."
        ),
    },
    "data-root/cetp-flows": {
        "method": "pdf-extract",
        "produced_by": "neer-vazhvu-api/scripts/extract_delhi_cetp_flows.py",
        "produced_at": "2026-07-26",
        "internal_inputs": ["public/data/delhi-cetp-monthly-index.json"],
        "sources": [reg("dpcc-cetp-monthly-delhi", as_of="2024-11", retrieved="2026-07-26")],
        "note": (
            "OCR extraction from image-scan PDFs: plant, design capacity, month, sampling "
            "date, measured flow, OLMS remark only - the 23-parameter inlet/outlet grid "
            "OCRs badly and is deliberately NOT extracted (see _extraction). Validated "
            "against the hand-transcribed Wazirpur page in the index file, which is why "
            "that file is an internal input."
        ),
        "conventions": {
            "series_end": "NOT a live feed: the DPCC CETP series ends 2024-11; surfaces showing these numbers must say so (_archival discipline)",
        },
    },
    "data-root/cetp-monthly-index": {
        "method": "manual",
        "produced_at": "2026-07-20",
        "sources": [reg("dpcc-cetp-monthly-delhi", as_of="2024-11", retrieved="2026-07-20")],
        "note": (
            "Acquisition index for the 62 monthly PDF bundles (2019-2024) plus one page "
            "hand-transcribed 2026-07-20 as the schema sample. Attribute DPCC (analysis) "
            "+ OpenCity (hosting)."
        ),
    },
    "data-root/cgwb-stations": {
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/build_delhi_cgwb_stations.py",
        "sources": [dict(WRIS_GWL)],
        "note": (
            "CGWB observation wells across all 11 Delhi districts from the India-WRIS "
            "'Ground Water Level' dataset (POST API with mandatory state/district/agency "
            "params - see _api_contract). A continuous source, freshness-tracked not "
            "edition-tracked. Known-bad sensors are excluded, not averaged in (_excluded)."
        ),
        "conventions": {
            "sign": (
                "WRIS returns depth-to-water with a programme-dependent sign across three "
                "Delhi station-code families (numeric NHN and AAXI* positive-down, CGWBDL* "
                "negative-down). The convention is derived PER STATION from the median of "
                "its own readings, never by abs() - which would erase real water-above-"
                "datum readings in floodplain wells and launder sign-faulty sensors."
            ),
            "feed_status": (
                "Frozen telemetry: DWLR reporting across the Delhi network stops "
                "2025-09-20 (_feed_status). This is a historical series, not a live feed; "
                "resumption is a freshness (P5-1) question and cannot be expressed as a "
                "registry edition watch (the dormant endpoint returns an empty array)."
            ),
            "aggregation": "published as monthly means; later years 6-hourly DWLR telemetry, earlier years periodic manual observations",
        },
    },
    "data-root/drain-quality": {
        "method": "pdf-extract",
        "produced_by": "neer-vazhvu-api/scripts/extract_delhi_drain_quality.py",
        "produced_at": "2026-07-26",
        "internal_inputs": ["public/data/dpcc-monthly-wq-delhi.json"],
        "sources": [reg("dpcc-monthly-analysis-delhi", retrieved="2026-07-26")],
        "note": (
            "Parsed from the embedded text layer of DPCC's analysis-report PDFs "
            "(scanner-quality text, records reconstructed from word positions - see "
            "_extraction; implausible values dropped rather than published). The parser "
            "validates against the hand-transcribed months in dpcc-monthly-wq-delhi.json, "
            "hence the internal input."
        ),
        "conventions": {
            "no_flow": (
                "A trapped drain reads NO FLOW, captured as `no_flow` rather than as a "
                "missing value - it is the verification signal for the 39-drain trapping "
                "commitment, not absent data"
            ),
            "coverage": (
                "DPCC's listing is a rolling ~3-month window with NO archive anywhere "
                "(_coverage_limit); the series grows forward one month at a time and "
                "missed months are unrecoverable"
            ),
        },
    },
    "data-root/flood-hotspots": {
        "method": "manual",
        "produced_by": "manual",
        "sources": [],
        "note": (
            "Curated waterlogging register (the Mumbai chronic-spots pattern): Delhi "
            "publishes no machine-readable hotspot list, so this carries the named "
            "perennial sites with landmark coordinates and keeps the full official lists "
            "(169 identified locations 2025; 448 traffic-police-mapped points) as a named "
            "gap. Per-entry press/reporting citations and summary.sources carry the "
            "accountability; location_basis per entry marks landmark, not survey, "
            "positions."
        ),
    },
    "data-root/jj-bastis-geo": {
        "method": "pdf-extract",
        "produced_by": "neer-vazhvu-api/scripts/build_delhi_jj_bastis_geo.py",
        "produced_at": "2026-07-20",
        "internal_inputs": ["public/data/dusib-jj-bastis.json"],
        "sources": [reg("dusib-jj-bastis", as_of="2022-09-16", retrieved="2026-07-20")],
        "note": (
            "DUSIB's 675 JJ bastis as points from the Board's own coordinates PDF "
            "(sha256-pinned; the builder aborts on mismatch), joined to the household "
            "roster in dusib-jj-bastis.json on normalised location text."
        ),
        "conventions": {
            "join": (
                "match_method per cluster is exact / fuzzy (difflib >= 0.90, score "
                "recorded) / unmatched; unmatched points keep coordinates but carry NO "
                "household count rather than an inferred one"
            ),
        },
    },
    "data-root/supply-overview": {
        "method": "pdf-extract",
        "produced_at": "2026-07-20",
        "sources": [
            reg("cag-djb-audit", as_of="2026-03", retrieved="2026-07-20"),
            reg("delhi-economic-survey-water", as_of="2024", retrieved="2026-07-20"),
            reg("djb-water-pages", retrieved="2026-07-20"),
            MPD_2041,
        ],
        "note": (
            "Anchored on the CAG audit (production ~960 MGD, NRW), the Economic Survey "
            "Ch. 13 source-wise raw-water split, DJB's own water page (WTP roster) and "
            "the draft MPD-2041 targets - per-section citations in the legacy "
            "_note/_sources keys. produced_at is the extraction date the file itself "
            "asserts (_sources[].extracted 2026-07-20). _view_overrides/hero_copy are "
            "grandfathered UI hints (spec 6.4), config-migration follow-up on record."
        ),
    },
    "data-root/ward-representatives": {
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/build_delhi_ward_reps.py",
        "sources": [reg("delhi-reps-mcd", as_of="2022-12-04", retrieved="2026-07-25")],
        "note": (
            "Winners of the 4 Dec 2022 MCD general election (first post-unification, 250 "
            "wards), digitized in the TCPD-style schema and hosted by OpenCity. "
            "By-elections/defections since are NOT reflected; MLA/MP columns join once "
            "the AC mapping is restored. The registry watch is term-expiry "
            "(termEndsOn 2027-12-04)."
        ),
    },
    "data-root/dpcc-monthly-wq": {
        "method": "manual",
        "produced_by": "manual",
        "sources": [reg("dpcc-monthly-analysis-delhi", retrieved="2026-07-20")],
        "note": (
            "Visual transcription from DPCC's scanned monthly PDFs (@200dpi, values "
            "cross-checked against column standards - see the legacy source key); "
            "neer-vazhvu-api/scripts/fetch_dpcc_monthly_delhi.py archives the PDFs "
            "monthly, and the drain tables are machine-parsed separately into "
            "delhi-drain-quality.json. 2026 river series backfilled from the archive "
            "pages; Feb 2026 is a DPCC publication gap, not a scrape failure "
            "(series_note)."
        ),
        "conventions": {
            "no_flow": "NO FLOW entries preserved verbatim - drain-trapping evidence, not missing data",
        },
    },
    "data-root/dusib-jj-bastis": {
        "method": "pdf-extract",
        "produced_by": "neer-vazhvu-api/scripts/build_delhi_jj_bastis.py",
        "produced_at": "2026-07-20",
        "sources": [reg("dusib-jj-bastis", as_of="2019", retrieved="2026-07-20")],
        "note": (
            "DUSIB's public roster parsed from the Board's own two PDFs (2019 list "
            "joined with the 2015 list's land-area/constituency/district columns on "
            "cluster code). No lat/lon exists in either PDF - the geocoded layer is "
            "delhi-jj-bastis-geo.json."
        ),
        "conventions": {
            "ward_numbering": (
                "ward_no_pre2022 uses PRE-unification ward numbering - do not join to "
                "the 2022 250-ward geometry without the SEC crosswalk"
            ),
        },
    },
    "data-root/elevation-bands": {
        "method": "gee",
        "produced_by": "neer-vazhvu-api/scripts/build_elevation_bands.py",
        "internal_inputs": [],
        "sources": [FABDEM],
        "note": "Bands, not spot heights - see the legacy _provenance prose. CC BY-NC-SA encumbered via FABDEM.",
    },
    "data-root/facts": {
        "method": "manual",
        "produced_at": "2026-07-20",
        "sources": [
            reg("cag-djb-audit", as_of="2026-03", retrieved="2026-07-20"),
            reg("delhi-economic-survey-water", as_of="2024", retrieved="2026-07-20"),
            reg("cgwb-dynamic-gwr-delhi", as_of="2025", retrieved="2026-07-25"),
            reg("dusib-jj-bastis", as_of="2019", retrieved="2026-07-20"),
        ],
        "note": (
            "Envelope lists the registered upstreams; every fact carries its own citation "
            "(source_label/source_url/data_date), including one-off documents (ASI "
            "monuments, the 1994 MoU, CWC case studies, court reporting) not registrable "
            "as living sources. The contested Sept-2025 Hathnikund peak is deliberately "
            "EXCLUDED pending resolution (see legacy note)."
        ),
    },
    "data-root/gwr-blocks": {
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/build_delhi_gwr_blocks.py",
        "internal_inputs": ["public/data/ingres/delhi-2022-2023.json"],
        "sources": [reg("cgwb-dynamic-gwr-delhi", as_of="2025", retrieved="2026-07-25")],
        "note": (
            "District assessment series 2022/2023/2024/2025: the 2022/2024/2025 cycles "
            "from the OpenCity-hosted national-compilation CSVs, the 2023 (2022-23) "
            "cycle from the IN-GRES portal snapshot committed as "
            "public/data/ingres/delhi-2022-2023.json - two acquisition routes, two "
            "registry watches (see the cgwb-dynamic-gwr-delhi and "
            "ingres-gw-assessment-delhi entries)."
        ),
        "conventions": {
            "units": "assessment values are hectare-metres; the source CSV's '(bcm)' headers are mislabeled (its own Total(Ham) row confirms)",
            "non_spatial": "'Nazul Land' is a non-spatial assessment unit (government estate lands) - in this file, absent from the map layer",
        },
    },
    "data-root/imd-rainfall-monthly": {
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/generate_imd_rainfall.py",
        "sources": [dict(IMD_GRID)],
        "note": (
            "NCT grid point: 28.5/77.25 sits on the urban plain south of the Ridge, "
            "inside the 0.25-deg cell covering most of the MCD area (legacy note). "
            "Quarterly rebuild (imd-rainfall-refresh.yml); the generator writes through "
            "scripts/nvdm_write.py, so the envelope survives regeneration."
        ),
    },
    "data-root/industrial-sources": {
        "method": "mixed",
        "produced_by": "neer-vazhvu-api/scripts/build_delhi_industrial_sources.py",
        "internal_inputs": ["public/data/delhi-cetp-flows.json"],
        "sources": [
            reg("dpcc-cetp-monthly-delhi", as_of="2024-11", retrieved="2026-07-26"),
            dict(OSM_SOURCE, title="OpenStreetMap industrial-area/locality positions (Overpass)", role="input"),
        ],
        "note": (
            "Two record types by design: named industrial estates (zone_count comparable "
            "to other cities) and the 13 CETPs carrying DPCC's design-capacity vs "
            "measured-inflow evidence via delhi-cetp-flows.json. Delhi has no current "
            "per-unit polluter register (DPCC's public consent list ends July 2002) - "
            "this layer measures the treatment gap, not individual dischargers. CAUTION: "
            "the top-level `sources` key is the facility payload, not citations."
        ),
        "conventions": {
            "series_end": "CETP flow series ends 2024-11 and is not live (_archival) - surfaces must say so next to the figures",
            "coordinates": (
                "no CETP is mapped in OSM; markers sit on the industrial area or "
                "locality each plant serves, never a surveyed plant position "
                "(location_precision per entry; SMA CETP has no coordinate and is "
                "excluded from the map)"
            ),
        },
    },
    "data-root/restoration-priority": {
        "method": "derived",
        "produced_by": "scripts/compute-restoration-priority-delhi.ts",
        "internal_inputs": [
            "public/data/water-bodies-flagship-delhi.json",
            "public/geojson/delhi-water-bodies-current.geojson",
        ],
        "sources": [],
        "note": (
            "Flagship-register scoring (Madurai pattern): 12 hand-curated bodies scored "
            "on status severity, cultural/court anchors, size and source confidence; "
            "algorithm identity in the payload weights/algorithm_version keys. Derived "
            "entirely from committed artifacts whose citations travel with their own "
            "envelopes - internal inputs are lineage, not sources."
        ),
    },
    "data-root/restoration-projects": {
        "method": "manual",
        "sources": [],
        "note": (
            "Curated compilation of restoration programmes and court/NGT orders - "
            "per-record `source` citations (URLs verified live 2026-07-20 unless marked "
            "bot-blocked) carry the accountability; an aggregate description is not an "
            "upstream source. Cross-referenced with commitments-delhi.json by id."
        ),
    },
    "data-root/river-events": {
        "method": "manual",
        "sources": [],
        "note": (
            "Curated Yamuna timeline - per-record url citations carry the "
            "accountability (URLs verified live 2026-07-20 unless noted bot-blocked). "
            "The contested Sept-2025 Hathnikund peak figure is referenced without a "
            "number pending resolution."
        ),
    },
    "data-root/river-quality": {
        "method": "derived",
        "produced_by": "scripts/build-delhi-river-quality.ts",
        "internal_inputs": ["public/data/dpcc-monthly-wq-delhi.json"],
        "sources": [reg("dpcc-monthly-analysis-delhi", role="input")],
        "note": (
            "Values are DPCC's measurements transported unchanged from "
            "dpcc-monthly-wq-delhi.json; 'derived' refers to the shaping (yearly rows "
            "show the latest available month of that year), not the numbers. The full "
            "monthly series including the drain network lives in the input file."
        ),
        "conventions": {
            "yearly_basis": "yearly rows are the latest available month of that year, not annual means",
            "do_nil": "DO of 0 renders DPCC's 'NIL'",
        },
    },
    "data-root/ward-risk": {
        "method": "derived",
        "produced_by": "scripts/compute-delhi-ward-risk.py",
        "internal_inputs": [
            "public/geojson/delhi-wards-2022.geojson",
            "public/data/delhi-ward-profiles.json",
            "public/data/delhi-cgwb-stations.json",
        ],
        "sources": [],
        "note": (
            "Per-ward composite over committed artifacts only (the legacy `sources` key "
            "names the lineage; JJ-basti, flood and water-body factors arrive via the "
            "ward profiles). Citations travel with the inputs' own envelopes. Algorithm "
            "identity in the payload weights/algorithm_version keys."
        ),
        "conventions": {
            "gw_depth": (
                "gw_depth_m is MEASURED: mean latest depth-to-water of CGWB wells within "
                "4 km of the ward centroid; wards with no well in range keep null and "
                "are scored on the remaining factors renormalised, never on an imputed "
                "depth"
            ),
            "coverage": "NDMC and Delhi Cantonment are outside the 250-ward MCD delimitation and are not scored",
        },
    },
    "data-root/water-bodies-flagship": {
        "method": "manual",
        "produced_at": "2026-07-20",
        "sources": [],
        "note": (
            "Curated flagship register (hauz/baoli/cistern chain + modern lakes) - "
            "per-record `sources` citations (ASI, DDA, INTACH, press) carry the "
            "accountability. Coordinates are monument/landmark positions, not "
            "survey-grade; confidence grades A/B/C per the legacy note. Link integrity "
            "audited 2026-07-26 (_citation_audit)."
        ),
    },
    "data-root/water-bodies-lost": {
        "method": "manual",
        "produced_at": "2026-07-20",
        "sources": [],
        "note": (
            "Archival compilation - the legacy primary_source (Sahapedia + INTACH "
            "documentation) / secondary_sources keys and per-record `sources` citations "
            "carry the accountability. Points mark documented historic sites, not "
            "mappable extents (_location_note); the Najafgarh Jheel historic-extent "
            "polygon is a planned reconstruction task."
        ),
    },
    # ingres snapshot
    "ingres/2022-2023": {
        "method": "scrape",
        "produced_by": "manual",
        "produced_at": "2026-07-24",
        "sources": [reg("ingres-gw-assessment-delhi", as_of="2023", retrieved="2026-07-24")],
        "note": (
            "2022-23 assessment cycle (as_of 2023 = cycle end year), acquired by "
            "headless-Chrome render of the IN-GRES portal UI + DOM table parse - no "
            "OpenCity mirror exists for this cycle and the open API's POST contract is "
            "uncaptured (the most fragile acquisition on the platform; full detail in "
            "the legacy _provenance key, incl. the Delhi state uuid)."
        ),
    },
    # geojson layers
    "geojson-layers/drainage": {
        "method": "api",
        "produced_by": "scripts/fetch-drainage-osm-delhi.ts",
        "produced_at": "2026-07-24",
        "sources": [dict(OSM_SOURCE, title="OpenStreetMap drain network, waterway=drain (Overpass extract)")],
        "note": (
            "Best available Delhi drain-network geometry: no official drain GIS is "
            "public (the IFC 2018 Drainage Master Plan's 3,737 km across 11 agencies "
            "exists only as PDF maps). OSM coverage is partial and skews toward large "
            "open channels."
        ),
        "conventions": {
            "coverage": "mapped lengths are a floor, not the network total",
        },
    },
    "geojson-layers/gwr-blocks": {
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/build_delhi_gwr_blocks.py",
        "produced_at": "2026-07-25",
        "sources": [reg("cgwb-dynamic-gwr-delhi", as_of="2025", retrieved="2026-07-25")],
        "note": (
            "2025 assessment values on the Delhi Districts Map polygons, both via "
            "OpenCity (Delhi assesses by district, not block; the WRIS ArcGIS polygon "
            "service is NICNET-gated)."
        ),
        "conventions": {
            "units": "values are hectare-metres despite the source CSV's '(bcm)' headers",
            "non_spatial": "'Nazul Land' is assessed but non-spatial - present in gwr-blocks-delhi.json, absent here",
        },
    },
    "geojson-layers/rivers": {
        "method": "api",
        "produced_by": "scripts/fetch-rivers-osm-delhi.ts",
        "sources": [dict(OSM_SOURCE)],
    },
    "geojson-layers/wards-2022": {
        "method": "manual",
        "produced_by": "neer-vazhvu-api/scripts/convert_delhi_wards_kml.py",
        "sources": [reg("opencity-delhi-mcd-wards", as_of="2022")],
        "note": (
            "The 250-ward SEC Delimitation Order 2022 geometry. OpenCity DELISTED the "
            "source dataset; this copy survives because it was verified byte-identical "
            "against an Internet Archive capture over its full extent (metadata.recovery) "
            "- there is no second copy upstream."
        ),
    },
    "geojson-layers/water-bodies-census": {
        "method": "mixed",
        "produced_by": "neer-vazhvu-api/scripts/join_delhi_census_water_bodies.py",
        "produced_at": "2026-07-20",
        "internal_inputs": ["public/geojson/delhi-water-bodies-current.geojson"],
        "sources": [reg("opencity-delhi-waterbodies-census", as_of="2023", retrieved="2026-07-20")],
        "note": (
            "893 census points (enumeration 2022, map released 2023) joined against the "
            "OSM polygon layer - point-in-polygon, else nearest vertex within 150 m. The "
            "join is honest about its own weakness (inside 31 / near 203 / unmatched "
            "659): the census enumerates recharge pits and seasonal johads too small/dry "
            "for OSM polygons."
        ),
    },
    "geojson-layers/water-bodies-current": {
        "method": "api",
        "produced_by": "scripts/fetch-water-bodies-osm-delhi.ts",
        "sources": [dict(OSM_SOURCE)],
    },
}

LEGACY_DATES = ("generated_at", "compiled_at", "computed_at", "updated", "last_updated", "fetched_at", "retrieved")
SKIP = {
    "data-root/localities",       # bare array, wrap follow-up (all cities together)
    "data-root/ward-profiles",    # producer-owned wrap (build_delhi_ward_profiles.py), own commit
    "data-root/rainfall-recent",  # producer-owned envelope (fetch_recent_rainfall.py, daily)
}


def produced_at_for(doc: dict, path: Path) -> str:
    for k in LEGACY_DATES:
        v = doc.get(k)
        if isinstance(v, str) and v[:4].isdigit():
            return v[:10]
    meta = doc.get("metadata", {})
    if isinstance(meta, dict):
        for k in ("fetched", "built", "retrieved"):
            v = meta.get(k, "")
            if isinstance(v, str) and v[:4].isdigit():
                return v[:10]
    out = subprocess.run(
        ["git", "log", "-1", "--format=%cs", "--", str(path.relative_to(ROOT))],
        cwd=ROOT, capture_output=True, text=True,
    )
    return out.stdout.strip() or "2026-07-30"


def dump(merged: dict, raw: str) -> str:
    """Preserve the artifact's storage style: minified stays one line (the
    7 MB single-line ward geometry must not become a 50 MB pretty file),
    pretty stays indent=2 like the pilot."""
    if raw.count("\n") <= 3 and len(raw) > 100_000:
        return json.dumps(merged, ensure_ascii=False)
    return json.dumps(merged, indent=2, ensure_ascii=False)


def main() -> int:
    cat = json.loads((ROOT / "docs/architecture/dataset-catalogue.json").read_text())
    done = skipped = 0
    refresh = "--refresh" in sys.argv
    for rec in cat["files"]:
        if rec["scope"] != "delhi":
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
    print(f"\n{done} enveloped, {skipped} skipped (bare array / producer-owned)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
