#!/usr/bin/env python3
"""Madurai NVDM pilot: inject the v1 envelope into every envelope-capable
Madurai artifact (spec Part 9 - Madurai is the first legacy city lifted to L2).

Everything here is ADDITIVE: envelope keys are inserted ahead of the existing
payload, no legacy key is removed or renamed, and no value is changed - shape
migration and value changes are separate commits by spec rule 9.4.

The per-dataset provenance map below is the reviewable heart of this script:
every source entry was verified against the file's own legacy keys, the
Headwaters registry, or the generating pipeline's code. Where a fact could not
be verified it is NOT stated (no fabricated provenance).

Skipped on purpose:
  - catchment-basin / catchment-downstream / catchment-streams: naked
    indexed-collection maps, grandfathered (spec 6.1) - an envelope would
    change their shape for consumers.
  - madurai-localities.json / madurai-ward-profiles.json: bare arrays.
    ward-profiles is wrapped in a separate commit (with its loader);
    localities stays bare, tracked as follow-up.

Idempotent: files already carrying `nvdm` are left untouched.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCOPE = {"kind": "city", "id": "madurai"}

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
WRIS_GW = {
    "id": "wris-live-services",
    "title": "India-WRIS Ground Water Level dataset (NWIC ArcGIS services)",
    "publisher": "CGWB / NWIC via India-WRIS",
    "license": "GoI open publication, cited with attribution",
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
    "title": "IMD monthly rainfall normals (Madurai grid point, via imd-rainfall-monthly-madurai.json)",
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
CASCADE_TOPO = [FABDEM, OSM_TANKS, HYDROSHEDS]
CASCADE_SCORED = CASCADE_TOPO + [SENTINEL2, DYNAMIC_WORLD]

CASCADE_NOTE = (
    "Derived by the cascade reconstruction pipeline (neer-vazhvu-api/app/cascade). "
    "FABDEM input makes this family CC BY-NC-SA (non-commercial) encumbered - "
    "recorded in the fabdem-dem registry entry, 2026-07-30."
)

REG_IDS = {
    "adb-tnufip-iee": ("ADB TNUFIP IEE documents (Madurai tranches)", "Asian Development Bank", "ADB public project documents"),
    "wrd-policy-note-tn": ("TN Water Resources Department policy notes", "Government of Tamil Nadu WRD", "GoTN publication, cited with attribution"),
    "madurai-corp-projects": ("Madurai Municipal Corporation project/supply pages", "Madurai Municipal Corporation", "public government pages, cited with attribution"),
    "cgwb-yearbook-tn": ("CGWB Ground Water Year Book, Tamil Nadu & Puducherry", "Central Ground Water Board", "GoI publication, cited with attribution"),
    "ingres-gw-assessment-madurai": ("IN-GRES dynamic groundwater assessment (Madurai firkas)", "CGWB / IN-GRES", "GoI publication, cited with attribution"),
    "cpcb-nwmp-annual": ("CPCB NWMP water-quality monitoring (Vaigai stations)", "Central Pollution Control Board", "GoI publication, cited with attribution"),
    "tnpcb-prs-vaigai": ("TNPCB polluted river stretches - Vaigai", "Tamil Nadu Pollution Control Board", "GoTN publication, cited with attribution"),
}


def reg(source_id: str, role: str | None = None) -> dict:
    title, publisher, license_ = REG_IDS[source_id]
    s = {"id": source_id, "title": title, "publisher": publisher, "license": license_}
    if role:
        s["role"] = role
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
        + " Layer B named-cascade documentation is internal Neer Vazhvu curation "
        "(per-cascade references inline; edition history = git) - lineage, not an upstream source.",
    },
    "cascade/cascades-health": cascade(CASCADE_SCORED),
    "cascade/catchment-quality": cascade([FABDEM, OSM_TANKS]),
    # data-root
    "data-root/allocations": {
        "method": "manual",
        "sources": [
            reg("adb-tnufip-iee"),
            reg("wrd-policy-note-tn"),
            {
                "title": "TN PWD letter Lr. No. DB/JD01/384/C.10(P)/2018 (26 Dec 2018), via ADB TNUFIP Tranche-2 IEE Appendix 14",
                "publisher": "TN PWD / ADB",
                "license": "GoTN correspondence, cited from ADB IEE Appendix 14 (public project document)",
                "closed": True,
                "as_of": "2018-12-26",
            },
        ],
        "note": "Per-arrangement citations in the legacy `sources` map and per-record `source` fields.",
    },
    "data-root/cgwb-stations": {
        "method": "api",
        "sources": [reg("cgwb-yearbook-tn"), dict(WRIS_GW)],
        "note": (
            "Well series fetched from the India-WRIS Ground Water Level dataset "
            "(declared continuous - freshness-tracked, not edition-tracked); year-book "
            "summaries covered by the cgwb-yearbook-tn registry entry."
        ),
        "conventions": {
            "sign": "depth metres below ground level, positive down",
            "aggregation": "readings as published by WRIS; see _note for granularity caveats",
        },
    },
    "data-root/commitments": {
        "method": "manual",
        "sources": [reg("madurai-corp-projects"), reg("wrd-policy-note-tn")],
        "note": "Status changes only with a dated citation; per-commitment citations inline (update_model).",
    },
    "data-root/elevation-bands": {
        "method": "gee",
        "produced_by": "neer-vazhvu-api/scripts/build_elevation_bands.py",
        "sources": [FABDEM],
    },
    "data-root/facts": {
        "method": "mixed",
        "produced_by": "scripts/compute-madurai-derived-facts.ts (derived facts) + manual curation",
        "sources": [
            reg("cgwb-yearbook-tn"),
            reg("ingres-gw-assessment-madurai"),
            reg("cpcb-nwmp-annual"),
            reg("madurai-corp-projects"),
        ],
        "note": (
            "Envelope lists the registered upstreams; every fact carries its own citation "
            "(source_label/source_url/data_date, migrated to per-record sources), including "
            "one-off documents (1886 lease indenture, court reports) not registrable as living sources."
        ),
    },
    "data-root/gee-phase1-water-body-targets": {
        "method": "manual",
        "produced_by": "manual",
        "sources": [],
        "note": "Self-authored target manifest - no external upstream exists; edition history = git.",
    },
    "data-root/gw-stations": {
        "method": "api",
        "produced_by": "scripts/fetch-wris-groundwater-madurai.ts",
        "sources": [dict(WRIS_GW)],
        "note": (
            "Stations fetched directly from arc.indiawris.gov.in NWIC services "
            "(GroundwaterLevel_Stations) - NOT from IN-GRES; review 2026-07-30 "
            "corrected an earlier misattribution."
        ),
    },
    "data-root/gwr-blocks": {
        "method": "api",
        "sources": [reg("ingres-gw-assessment-madurai")],
    },
    "data-root/imd-rainfall-monthly": {
        "method": "api",
        "sources": [{"id": "imd-gridded-rain", "title": "IMD gridded monthly rainfall (city grid point)", "publisher": "India Meteorological Department", "license": "GoI publication, cited with attribution"}],
    },
    "data-root/industrial-sources": {
        "method": "manual",
        "sources": [
            {
                "title": "Columbia GSAPP 'Water Urbanism: Madurai' studio book (qualitative use only)",
                "publisher": "Columbia GSAPP",
                "url": "https://www.arch.columbia.edu/books/reader/192-water-urbanism-madurai-india",
                "license": "academic publication, cited with attribution (qualitative use only)",
                "closed": True,
                "as_of": "2016",
            }
        ],
        "note": "Spring-2016 studio book. See _source_caveats: its statistics failed adversarial checks; locations retained as qualitative evidence only.",
    },
    # data-root/rainfall-recent: envelope OWNED BY ITS PRODUCER
    # (fetch_recent_rainfall.py) - the daily rewrite would strip anything the
    # injector added, and the producer's IMD + Open-Meteo source split is the
    # accurate one. Listed in SKIP below.
    "data-root/restoration-priority": {
        "method": "derived",
        "produced_by": "neer-vazhvu-api/app/gee/cities.py (flagship scorer)",
        "sources": [OSM_TANKS, SENTINEL2],
    },
    "data-root/restoration-priority-legacy": {
        "method": "derived",
        "produced_by": "scripts/compute-restoration-priority-madurai.ts",
        "sources": [OSM_TANKS],
        "note": "Superseded by restoration-priority-madurai.json; retained pending consumer audit (follow-up: delete).",
    },
    "data-root/restoration-projects": {
        "method": "manual",
        "sources": [],
        "note": "Curated compilation - per-record `sources` citations (Madras HC Madurai Bench, MMC, press) carry the accountability; an aggregate description is not an upstream source.",
    },
    "data-root/river-events": {
        "method": "manual",
        "sources": [],
        "note": "Curated event timeline - per-record url citations carry the accountability.",
    },
    "data-root/river-quality": {
        "method": "scrape",
        "produced_by": "neer-vazhvu-api/scripts/scrape_cpcb_nwmp_vaigai.py",
        "sources": [reg("cpcb-nwmp-annual"), reg("tnpcb-prs-vaigai")],
    },
    "data-root/supply-overview": {
        "method": "pdf-extract",
        "sources": [reg("adb-tnufip-iee"), reg("madurai-corp-projects")],
        "note": "Extraction detail and per-section citations in the legacy _note/_sources keys.",
    },
    "data-root/ward-risk": {
        "method": "derived",
        "produced_by": "scripts/compute-madurai-ward-risk.ts",
        "sources": [
            {"title": "Madurai ward boundaries 2022 (delimitation KML)", "publisher": "GoTN / Madurai Municipal Corporation", "license": "GoTN delimitation record, cited with attribution", "role": "input", "closed": True, "as_of": "2022"},
            OSM_TANKS,
        ],
    },
    "data-root/water-bodies-flagship": {
        "method": "manual",
        "sources": [],
        "note": "Curated flagship register - per-record `sources` citations (DHAN, MMC, press) carry the accountability.",
    },
    "data-root/water-bodies-lost": {
        "method": "manual",
        "sources": [],
        "note": "Archival compilation - the legacy primary_source / secondary_sources keys and per-record notes carry the citations.",
    },
    # geojson layers
    "geojson-layers/gwr-blocks": {
        "method": "api",
        "sources": [reg("ingres-gw-assessment-madurai")],
    },
    "geojson-layers/rivers": {
        "method": "api",
        "produced_by": "scripts/fetch-rivers-osm-madurai.ts",
        "sources": [dict(OSM_SOURCE)],
    },
    "geojson-layers/wards-2022": {
        "method": "manual",
        "produced_by": "scripts/convert-madurai-wards-kml.py",
        "sources": [
            {"title": "Madurai Corporation ward boundaries, 2022 delimitation (KML)", "publisher": "GoTN / Madurai Municipal Corporation", "license": "GoTN delimitation record, cited with attribution", "closed": True, "as_of": "2022"}
        ],
    },
    "geojson-layers/water-bodies-current": {
        "method": "api",
        "produced_by": "scripts/fetch-water-bodies-osm-madurai.ts",
        "sources": [dict(OSM_SOURCE)],
        "note": "Named via name-madurai-water-bodies.ts joins; name_derived marks derived names.",
    },
    "geojson-layers/water-bodies-lost": {
        "method": "derived",
        "produced_by": "scripts/build-madurai-lost-bodies-geojson.ts",
        "sources": [],
        "note": "Derived from water-bodies-lost-madurai.json (itself enveloped, citations there) - internal lineage, not an upstream source.",
    },
}

LEGACY_DATES = ("generated_at", "compiled_at", "computed_at", "updated", "last_updated", "fetched_at", "retrieved")
SKIP = {
    "cascade/catchment-basin",
    "cascade/catchment-downstream",
    "cascade/catchment-streams",
    "data-root/localities",
    "data-root/ward-profiles",   # producer-owned envelope (compute-madurai-ward-profiles.ts)
    "data-root/rainfall-recent", # producer-owned envelope (fetch_recent_rainfall.py, daily)
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
    out = subprocess.run(
        ["git", "log", "-1", "--format=%cs", "--", str(path.relative_to(ROOT))],
        cwd=ROOT, capture_output=True, text=True,
    )
    return out.stdout.strip() or "2026-07-30"


def main() -> int:
    cat = json.loads((ROOT / "docs/architecture/dataset-catalogue.json").read_text())
    done = skipped = 0
    for rec in cat["files"]:
        if rec["scope"] != "madurai":
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
        refresh = "--refresh" in sys.argv
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
            "produced_at": prior_produced_at or produced_at_for(doc, path),
        }
        if spec.get("produced_by"):
            provenance["produced_by"] = spec["produced_by"]
        if spec.get("note"):
            provenance["note"] = spec["note"]
        if spec.get("conventions"):
            provenance["conventions"] = spec["conventions"]
        envelope = {"nvdm": "1.0", "dataset": ds, "scope": dict(SCOPE), "provenance": provenance}
        merged = {**envelope, **{k: v for k, v in doc.items() if k not in envelope}}
        out = json.dumps(merged, indent=2, ensure_ascii=False)
        path.write_text(out + ("\n" if raw.endswith("\n") else ""))
        done += 1
        print(f"enveloped {rec['path']}")
    print(f"\n{done} enveloped, {skipped} skipped (naked maps / bare arrays / already done)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
