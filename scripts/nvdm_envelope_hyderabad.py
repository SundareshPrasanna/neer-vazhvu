#!/usr/bin/env python3
"""Hyderabad NVDM migration: inject the v1 envelope into every envelope-capable
Hyderabad artifact (spec Part 9 - city 6, cloning the Delhi injector).

Unlike cities 1-5 this is not a legacy migration. Every artifact here is NEW to
main, so the L2 gate is ENFORCING on all of them: an unenveloped Hyderabad
artifact fails the PR rather than being grandfathered.

Everything is ADDITIVE: envelope keys go in ahead of the existing payload, no
legacy key is removed or renamed, no value changes - shape migration and value
changes are separate commits by spec rule 9.4.

The provenance map below is the reviewable heart of this script. Every source
entry was verified against three things and not guessed: the artifact's own
legacy keys (_source/_source_url/_licence/_note/source_label), the Headwaters
registry (scripts/source-registry/hyderabad.json + platform.json), and the
producer named in produced_by. internal_inputs was read out of the producers'
actual load paths, not their comments. Licence strings are never written here -
registry_license() reads them from the registry, which owns them.

Skipped on purpose:
  - data-root/rainfall-recent: envelope OWNED BY ITS PRODUCER
    (fetch_recent_rainfall.py, daily) since the Madurai pilot.

NOT skipped, unlike every earlier city: cascade/catchment-downstream and
cascade/catchment-streams. Those are naked indexed maps and the other five
cities grandfather them under spec 6.1, but that grandfathering is a legacy
allowance - Hyderabad's are new files, so the L2 gate selects them and they
should meet the current standard rather than inherit an exemption they were
never covered by. Enveloping them is safe: the only consumer,
src/app/api/cascade/[cityId]/catchment/route.ts, looks a single numeric osmId
up by key, so the four envelope keys can never collide with a record.

Formatting: files stored minified (single-line GeoJSON) stay single-line so the
envelope does not multiply their size; pretty files stay indent=2.

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

SCOPE = {"kind": "city", "id": "hyderabad"}

SKIP = {
    "data-root/rainfall-recent",  # producer-owned envelope (fetch_recent_rainfall.py, daily)
}

# ---- source literals (verified against the registry and the artifacts) ------

HMDA_LAKES = {
    "id": "hmda-lakes-register",
    "title": "HMDA Lake Protection Committee gazetted lake register (FTL preliminary and final notifications)",
    "publisher": "HMDA (Lake Protection Committee)",
    "license": registry_license("hmda-lakes-register"),
}
OPENCITY_TANKERS = {
    "id": "opencity-hyderabad-tankers",
    "title": "HMWSSB tanker bookings and deliveries per division and section, via OpenCity",
    "publisher": "HMWSSB via OpenCity Urban Data Portal",
    "license": registry_license("opencity-hyderabad-tankers"),
}
OPENCITY_GHMC = {
    "id": "opencity-ghmc-drainage-layers",
    "title": "GHMC nala, canal/drain, tank and water-logging layers, via OpenCity",
    "publisher": "GHMC via OpenCity Urban Data Portal",
    "license": registry_license("opencity-ghmc-drainage-layers"),
}
OPENCITY_JAL = {
    "id": "opencity-jal-dharohar-hyderabad",
    "title": "1st Census of Water Bodies (Jal Dharohar) 2023, Telangana cut, via OpenCity",
    "publisher": "Jal Dharohar / NWIC Minor Irrigation census, via OpenCity",
    "license": registry_license("opencity-jal-dharohar-hyderabad"),
}
CGWB_GWR_TG = {
    "id": "cgwb-dynamic-gwr-telangana",
    "title": "CGWB Dynamic Ground Water Resources, Telangana district assessments (2022, 2024, 2025 editions)",
    "publisher": "CGWB / IN-GRES (via OpenCity national compilations)",
    "license": registry_license("cgwb-dynamic-gwr-telangana"),
}
WRIS_GWL_HYD = {
    "id": "wris-gwl-hyderabad",
    "title": "India-WRIS 'Ground Water Level' dataset, CGWB observation wells across the Hyderabad metro districts",
    "publisher": "India-WRIS / CGWB",
    "license": registry_license("wris-gwl-hyderabad"),
}
TGDPS_AWS = {
    "id": "tgdps-aws-stations",
    "title": "TGDPS automatic weather stations inside GHMC/CMC/MMC, with coordinates",
    "publisher": "Telangana Development Planning Society (TGDPS)",
    "license": registry_license("tgdps-aws-stations"),
}
TG_BILLING = {
    "id": "tg-opendata-hmwssb-billing",
    "title": "HMWSSB monthly billing, collection and connection counts by division and section, 2022-2026",
    "publisher": "HMWSSB via data.telangana.gov.in (Telangana Open Data Portal)",
    "license": registry_license("tg-opendata-hmwssb-billing"),
}
TG_STP = {
    "id": "tg-opendata-tgpcb-stp",
    "title": "TGPCB sewage treatment plant monitoring: per-plant capacity in MLD and monthly effluent quality",
    "publisher": "TGPCB via data.telangana.gov.in (Telangana Open Data Portal)",
    "license": registry_license("tg-opendata-tgpcb-stp"),
}
TG_IRR = {
    "id": "tg-opendata-irrigation-reservoirs",
    "title": "Telangana Irrigation & CAD Department daily reservoir storage levels",
    "publisher": "Telangana Irrigation & CAD Department via data.telangana.gov.in",
    "license": registry_license("tg-opendata-irrigation-reservoirs"),
}
CPCB_NWMP = {
    "id": "cpcb-nwmp-hyderabad",
    "title": "CPCB National Water Quality Monitoring Programme annual river data, editions 2019-2024 (Musi stations)",
    "publisher": "CPCB (National Water Quality Monitoring Programme)",
    "license": registry_license("cpcb-nwmp-hyderabad"),
}
TGPCB_NGT = {
    "id": "tgpcb-ngt-oa606-musi",
    "title": "TGPCB monthly Musi figures, Annexure-VIII of its NGT OA 606 of 2018 return (cross-check only)",
    "publisher": "TGPCB (Telangana Pollution Control Board)",
    "license": registry_license("tgpcb-ngt-oa606-musi"),
    "role": "methodology",
}
HMWSSB_RES = {
    "id": "hmwssb-daily-reservoir-statement",
    "title": "HMWSSB daily reservoir statement: level, storage, draw-off in MLD and inflow per source",
    "publisher": "HMWSSB (Hyderabad Metropolitan Water Supply and Sewerage Board)",
    "license": registry_license("hmwssb-daily-reservoir-statement"),
}
IMD_GRID = {
    "id": "imd-gridded-rain",
    "title": "IMD gridded monthly rainfall (0.25 deg, Hyderabad grid point)",
    "publisher": "India Meteorological Department",
    "license": registry_license("imd-gridded-rain"),
}
OSM = {
    "id": "osm-overpass",
    "title": "OpenStreetMap tank polygons / waterways (Overpass extract)",
    "publisher": "OpenStreetMap contributors",
    "license": registry_license("osm-overpass"),
}
FABDEM = {
    "id": "fabdem-dem",
    "title": "FABDEM v1-2 30 m bare-earth DEM",
    "publisher": "University of Bristol (Hawker et al.), via GEE sat-io",
    "license": registry_license("fabdem-dem"),
    "role": "input",
}
HYDROSHEDS = {
    "id": "hydrosheds-basins",
    "title": "HydroSHEDS basin boundaries",
    "publisher": "WWF / HydroSHEDS",
    "license": registry_license("hydrosheds-basins"),
    "role": "input",
}
SENTINEL = {
    "id": "sentinel-2-l2a",
    "title": "Sentinel-2 L2A imagery (channel evidence)",
    "publisher": "ESA Copernicus",
    "license": registry_license("sentinel-2-l2a"),
    "role": "input",
}
DYNAMIC_WORLD = {
    "id": "google-dynamic-world",
    "title": "Google Dynamic World built-up classification",
    "publisher": "Google / World Resources Institute",
    "license": registry_license("google-dynamic-world"),
    "role": "input",
}
OVERTURE = {
    "id": "overture-buildings",
    "title": "Overture Maps building footprints",
    "publisher": "Overture Maps Foundation",
    "license": registry_license("overture-buildings"),
    "role": "input",
}
OSM_INPUT = {**OSM, "role": "input"}

# One-time report, will not publish again, so it carries `closed` + `as_of`
# instead of a registry id (envelope schema, source.closed). The GEOMETRY behind
# it is NOT in this repo and must not be: tgrac.telangana.gov.in is login-gated,
# publishes no download, and states "all rights reserved". Only the report's
# published figures are used, and only on the facts page. See
# docs/cities/hyderabad/data-sources.md.
TGRAC_ORR = {
    "title": "Report on encroachment of water bodies within the Outer Ring Road from 2014 onwards, submitted to the Deputy Chief Minister",
    "publisher": "Telangana Remote Sensing Applications Centre (TGRAC), Planning Department",
    "url": "https://tgrac.telangana.gov.in/trac/water-project.php",
    "license": "Telangana government report, figures cited with attribution; underlying spatial layer is not published",
    "closed": True,
    "as_of": "2024-08",
}

CASCADE_NOTE = (
    "Derived by the cascade reconstruction pipeline (neer-vazhvu-api/app/cascade). "
    "FABDEM input makes this family CC BY-NC-SA encumbered; see DATA-LICENSE.md."
)
CASCADE_BY = "neer-vazhvu-api/app/cascade (scripts/run_cascade.py)"

# ---- per-dataset provenance ------------------------------------------------

PROVENANCE: dict[str, dict] = {
    # --- registered upstreams, one producer each ---------------------------
    "data-root/lake-register": {
        "sources": [HMDA_LAKES],
        "method": "scrape",
        "produced_by": "neer-vazhvu-api/scripts/fetch_hmda_lake_register.py",
        "note": (
            "FTL is the gazetted boundary of a lake. Every lake gets a PRELIMINARY notification, "
            "then a FINAL one after objections are heard; only the final one is legally defensible."
        ),
    },
    "data-root/tankers": {
        "sources": [OPENCITY_TANKERS],
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/build_hyderabad_tankers.py",
        "note": (
            "Monthly bookings AND deliveries per HMWSSB division and section. Series runs "
            "Jan 2022 to Feb 2024; no known public release after that, which the artifact "
            "records in _coverage_gap."
        ),
    },
    "data-root/billing": {
        "sources": [TG_BILLING],
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/build_hyderabad_billing.py",
        "note": "Keys on the SAME division/section units as the tanker ledger, so billed demand and tanker demand join.",
    },
    "data-root/stps": {
        "sources": [TG_STP],
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/build_hyderabad_stps.py",
    },
    "data-root/irrigation-reservoirs": {
        "sources": [TG_IRR],
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/build_hyderabad_irrigation_reservoirs.py",
        "note": (
            "An INDEPENDENT second publisher for five of the eight reservoirs the dashboard "
            "tracks, so the headline capacities no longer rest on HMWSSB alone."
        ),
    },
    "data-root/aws-stations": {
        "sources": [TGDPS_AWS],
        "method": "scrape",
        "produced_by": "neer-vazhvu-api/scripts/fetch_tgdps_stations.py",
    },
    "data-root/cgwb-stations": {
        "sources": [WRIS_GWL_HYD],
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/build_hyderabad_cgwb_stations.py",
    },
    "data-root/gwr-blocks": {
        "sources": [CGWB_GWR_TG],
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/build_hyderabad_gwr_blocks.py",
        "note": "The 2025 Telangana CSV is mislabelled 'Tamil Nadu' on OpenCity; the producer selects on content, not title.",
    },
    "geojson-layers/gwr-blocks": {
        "sources": [CGWB_GWR_TG],
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/build_hyderabad_gwr_blocks.py",
    },
    "data-root/imd-rainfall-monthly": {
        "sources": [IMD_GRID],
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/generate_imd_rainfall.py",
    },
    "data-root/river-quality": {
        "sources": [CPCB_NWMP, TGPCB_NGT],
        "method": "pdf-extract",
        "produced_by": "neer-vazhvu-api/scripts/build_hyderabad_river_quality.py",
        "note": (
            "Parsed from the text layer of CPCB's annual PDFs, no OCR. TGPCB's NGT OA 606 return "
            "is carried as a methodology source because it was used only to cross-check the CPCB "
            "annual ranges, not to supply values. Read low DO figures as a reporting floor: in 9 "
            "of 51 station-years the annual minimum equals the annual maximum."
        ),
    },
    # --- OpenCity GHMC layers ----------------------------------------------
    "geojson-layers/nalas": {
        "sources": [OPENCITY_GHMC],
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/build_hyderabad_opencity_layers.py",
        "note": (
            "GHMC defines five encroachment fields on this layer and publishes all five as zero "
            "for all 96 nalas. The producer STRIPS them rather than shipping a published-schema "
            "zero that would render as 'no encroachments'."
        ),
    },
    "geojson-layers/canals-drains": {
        "sources": [OPENCITY_GHMC],
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/build_hyderabad_opencity_layers.py",
    },
    "geojson-layers/tanks-opencity": {
        "sources": [OPENCITY_GHMC],
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/build_hyderabad_opencity_layers.py",
    },
    "geojson-layers/waterlogging": {
        "sources": [OPENCITY_GHMC],
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/build_hyderabad_opencity_layers.py",
    },
    "geojson-layers/water-census": {
        "sources": [OPENCITY_JAL],
        "method": "api",
        "produced_by": "neer-vazhvu-api/scripts/build_hyderabad_opencity_layers.py",
        "note": "water_body_type is a CODED value (01, 02, ...) carried unresolved; the code list was not published with the cut.",
    },
    # --- OSM extracts -------------------------------------------------------
    "geojson-layers/rivers": {
        "sources": [OSM],
        "method": "api",
        "produced_by": "scripts/fetch-rivers-osm-hyderabad.ts",
        "note": "The Esi's 10 km is an OSM mapping gap, not a fact about the river; the page states this rather than implying a short river.",
    },
    "geojson-layers/water-bodies-current": {
        "sources": [OSM],
        "method": "api",
        "produced_by": "scripts/fetch-water-bodies-osm-hyderabad.ts",
    },
    # --- derived ------------------------------------------------------------
    "data-root/restoration-priority": {
        "sources": [OSM_INPUT, HMDA_LAKES],
        "method": "derived",
        "produced_by": "scripts/compute-restoration-priority-hyderabad.ts",
        "internal_inputs": [
            "public/geojson/hyderabad-water-bodies-current.geojson",
            "public/data/water-bodies-flagship-hyderabad.json",
            "public/data/hyderabad-lake-register.json",
        ],
        "note": (
            "Scored by a Hyderabad-specific algorithm whose lead component is LEGAL EXPOSURE, "
            "read off the HMDA register's final-notification status. No other city on the "
            "platform has a gazetted register to compute it from."
        ),
    },
    # --- hand-compiled registers -------------------------------------------
    "data-root/allocations": {
        "sources": [HMWSSB_RES],
        "method": "manual",
        "note": (
            "Claim register - per-arrangement citations live in the file's own `sources` map. "
            "Hyderabad inverts the primitive the other cities use: receipts are measured daily "
            "from the HMWSSB statement while entitlements are the blank column."
        ),
    },
    "data-root/commitments": {
        "sources": [],
        "method": "manual",
        "note": (
            "Curated commitment register - per-entry dated citations carry the accountability. "
            "Five of seven entries are marked unverifiable because the promise was announced "
            "without a dated deliverable, which is the finding rather than a gap in the data."
        ),
    },
    "data-root/restoration-projects": {
        "sources": [],
        "method": "manual",
        "note": "Curated compilation - per-record citations (HYDRAA, HMDA, MRDCL, dated press) carry the accountability.",
    },
    "data-root/water-bodies-flagship": {
        "sources": [HMDA_LAKES],
        "method": "manual",
        "note": "Curated flagship register; the HMDA register supplies each body's gazetted notification status.",
    },
    "data-root/facts": {
        "sources": [
            HMWSSB_RES,
            HMDA_LAKES,
            OPENCITY_TANKERS,
            CGWB_GWR_TG,
            OPENCITY_GHMC,
            TG_STP,
            TG_BILLING,
            CPCB_NWMP,
            TGRAC_ORR,
        ],
        "method": "manual",
        "note": (
            "Envelope lists the upstreams the facts draw on; every fact additionally carries its "
            "own citation (source_label / source_url / data_date). The TGRAC entry is a closed "
            "one-time report: its published figures are used, its spatial layer is not in this "
            "repo and must not be - see docs/cities/hyderabad/data-sources.md."
        ),
    },
}

# Cascade family: same pipeline and same input set as the other cascade cities.
# Hyderabad's run used the district config in neer-vazhvu-api/app/cascade/districts.py
# (tank polygons + rivers from OSM, IMD monthly rainfall, FABDEM terrain).
_CASCADE = {
    "cascade/cascade-nodes": [FABDEM, OSM_INPUT, HYDROSHEDS, SENTINEL, DYNAMIC_WORLD],
    "cascade/cascade-edges": [FABDEM, OSM_INPUT, HYDROSHEDS, SENTINEL, DYNAMIC_WORLD],
    "cascade/cascade-catchments": [FABDEM, OSM_INPUT, HYDROSHEDS],
    "cascade/cascade-river-outlets": [FABDEM, OSM_INPUT, HYDROSHEDS],
    "cascade/cascade-stats": [FABDEM, OSM_INPUT, HYDROSHEDS, SENTINEL, DYNAMIC_WORLD],
    "cascade/cascade-systems": [FABDEM, OSM_INPUT, HYDROSHEDS],
    "cascade/cascade-lakes": [
        FABDEM, OSM_INPUT, HYDROSHEDS, SENTINEL, DYNAMIC_WORLD, OVERTURE, IMD_GRID,
    ],
    "cascade/catchment-quality": [FABDEM, OSM_INPUT],
    "cascade/catchment-downstream": [FABDEM, OSM_INPUT, HYDROSHEDS],
    "cascade/catchment-streams": [FABDEM, OSM_INPUT, HYDROSHEDS],
}
for _ds, _srcs in _CASCADE.items():
    PROVENANCE[_ds] = {
        "sources": _srcs,
        "method": "derived",
        "produced_by": CASCADE_BY,
        "note": CASCADE_NOTE,
    }


def produced_at_for(doc: dict, path: Path) -> str:
    for key in ("_fetched", "generated_at", "updated", "last_updated", "_generated"):
        v = doc.get(key)
        if isinstance(v, str) and v[:4].isdigit():
            return v[:10]
    meta = doc.get("metadata")
    if isinstance(meta, dict):
        for k in ("fetched", "built", "retrieved"):
            v = meta.get(k, "")
            if isinstance(v, str) and v[:4].isdigit():
                return v[:10]
    out = subprocess.run(
        ["git", "log", "-1", "--format=%cs", "--", str(path.relative_to(ROOT))],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    return out.stdout.strip() or "2026-08-14"


def dump(merged: dict, raw: str) -> str:
    """Preserve the artifact's storage style: minified stays one line, pretty
    stays indent=2 like the pilot."""
    if raw.count("\n") <= 3 and len(raw) > 100_000:
        return json.dumps(merged, ensure_ascii=False)
    return json.dumps(merged, indent=2, ensure_ascii=False)


def main() -> int:
    cat = json.loads((ROOT / "docs/architecture/dataset-catalogue.json").read_text())
    done = skipped = 0
    refresh = "--refresh" in sys.argv
    for rec in cat["files"]:
        if rec["scope"] != "hyderabad":
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
        envelope = {
            "nvdm": "1.0",
            "dataset": ds,
            "scope": dict(SCOPE),
            "provenance": provenance,
        }
        merged = {**envelope, **{k: v for k, v in doc.items() if k not in envelope}}
        path.write_text(dump(merged, raw) + ("\n" if raw.endswith("\n") else ""))
        done += 1
        print(f"enveloped {rec['path']}")
    print(f"\n{done} enveloped, {skipped} skipped (producer-owned envelope)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
