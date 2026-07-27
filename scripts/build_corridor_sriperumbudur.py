#!/usr/bin/env python3
"""Build the Sriperumbudur-Oragadam corridor data set (Milestone 1).

Outputs (public/data/corridors/sriperumbudur/):
  parks.geojson             SIPCOT park outer boundaries + Mahindra World City,
                            with per-park water-source citations (D7)
  assessment-firkas.geojson CGWB assessment-unit (firka) polygons with per-edition
                            category, joined by uuid (D2)
  assessment-taluks.geojson Taluk geometries dissolved from firkas, with
                            per-edition category + stage of extraction + trend
  assessment.json           Table data, edition metadata, firka-era context
                            numbers, and the full provenance block

Sources (all open, no auth; retrieval date stamped into outputs):
  - IN-GRES assessment API  https://ingres.iith.ac.in/api/gec/getBusinessDataForUserOpen
    (CGWB + TN SG&SWRDC Dynamic Ground Water Resource Assessment; the taluk
    series 2022-23+ is the national apportionment of TN's firka assessment)
  - IN-GRES GeoServer       https://ingres.iith.ac.in/geoserver/ows
    layer gec:indgec_vers_tamilnadu (CGWB's own firka geometry, 4 vintages)
  - SIPCOT GIS GeoServer    https://sipcotgis.tn.gov.in:8086/geoserver/cite/wfs
    layers cite:industrial_complex_boundary-<ParkKey> (outer boundaries only;
    the per-plot allottee layer is deliberately NOT fetched, per D4/D8)

Decision log: docs/corridors/sriperumbudur/DECISIONS.md (D1-D12).
Join rule (D2): the assessment API's reportSummary firka uuids match the
year=2022 polygon vintage, not year=2025. This script asserts that match and
fails loudly if it drifts.

Run: python3 scripts/build_corridor_sriperumbudur.py
Raw API responses are cached under .cache/corridor-sriperumbudur/ so re-runs
are offline; delete the cache to force a refetch.
"""

import json
import os
import re
import ssl
import sys
import urllib.parse
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public/data/corridors/sriperumbudur")
CACHE = os.path.join(ROOT, ".cache/corridor-sriperumbudur")

INGRES_API = "https://ingres.iith.ac.in/api/gec/getBusinessDataForUserOpen"
INGRES_WFS = "https://ingres.iith.ac.in/geoserver/ows"
SIPCOT_WFS = "https://sipcotgis.tn.gov.in:8086/geoserver/cite/wfs"

TN_UUID = "e98cd5b7-6556-4c0f-a778-3429e1c14a6b"
DISTRICTS = {
    "KANCHEEPURAM": "92e1051a-c7cb-4ebc-8722-97e3e8f0ecb2",
    "CHENGALPATTU": "70f2da31-929b-4977-8610-da37d3a3be73",
    "TIRUVALLUR": "2e628024-3969-42fc-bdbc-dc426c63176e",
}
# Portal year label -> published edition label used in the UI.
TALUK_EDITIONS = {"2022-2023": "2023", "2023-2024": "2024", "2024-2025": "2025"}
FIRKA_EDITIONS = {"2019-2020": "2020", "2021-2022": "2022"}

# Candidate functional-corridor taluks (D1, approved 2026-07-27); the spatial
# intersect below is authoritative and its result is logged for DECISIONS.md.
CANDIDATE_TALUKS = {
    "KANCHEEPURAM": ["SRIPERUMBUDUR", "KUNDRATHUR", "WALAJABAD", "KANCHEEPURAM"],
    "CHENGALPATTU": ["CHENGALPATTU", "TAMBARAM", "VANDALUR", "THIRUPPORUR"],
    "TIRUVALLUR": ["AVADI", "POONAMALLEE"],
}

# Park registry. Water-source citations are per park (D7): only what that
# park's own public document states, with the document identified. Parks with
# no fetched statement carry source_note null and the UI renders the honest gap.
PARKS = [
    {
        "id": "sipcot-sriperumbudur",
        "wfs_key": "Sriperumbudur",
        "name": "SIPCOT Sriperumbudur",
        "operator": "SIPCOT",
        "water_note": "CMWSSB tertiary treated (TTRO) water is piped to SIPCOT industries in Irungattukottai, Sriperumbudur and Oragadam from the Koyambedu and Kodungaiyur 45 MLD plants.",
        "water_source_label": "HUDCO Best Practices Awards 2021, pp. 82-83",
        "water_source_url": "https://hudco.org.in/writereaddata/EB/HUDCO-BPA21/files/basic-html/page83.html",
    },
    {
        "id": "sipcot-oragadam-dta",
        "wfs_key": "Oragadam_DTA",
        "name": "SIPCOT Oragadam (DTA)",
        "operator": "SIPCOT",
        "water_note": "CMWSSB tertiary treated (TTRO) water is piped to SIPCOT industries in Irungattukottai, Sriperumbudur and Oragadam from the Koyambedu and Kodungaiyur 45 MLD plants.",
        "water_source_label": "HUDCO Best Practices Awards 2021, pp. 82-83",
        "water_source_url": "https://hudco.org.in/writereaddata/EB/HUDCO-BPA21/files/basic-html/page83.html",
    },
    {
        "id": "sipcot-oragadam-sez",
        "wfs_key": "Oragadam_SEZ",
        "name": "SIPCOT Oragadam (SEZ)",
        "operator": "SIPCOT",
        "water_note": None,
        "water_source_label": None,
        "water_source_url": None,
    },
    {
        "id": "sipcot-oragadam-mdp",
        "wfs_key": "Oragadam_Medical_Devices_Park",
        "name": "SIPCOT Medical Devices Park, Oragadam",
        "operator": "SIPCOT",
        "water_note": None,
        "water_source_label": None,
        "water_source_url": None,
    },
    {
        "id": "sipcot-irungattukottai",
        "wfs_key": "Irungattukottai",
        "name": "SIPCOT Irungattukottai",
        "operator": "SIPCOT",
        "water_note": "CMWSSB tertiary treated (TTRO) water is piped to SIPCOT industries in Irungattukottai, Sriperumbudur and Oragadam from the Koyambedu and Kodungaiyur 45 MLD plants.",
        "water_source_label": "HUDCO Best Practices Awards 2021, pp. 82-83",
        "water_source_url": "https://hudco.org.in/writereaddata/EB/HUDCO-BPA21/files/basic-html/page83.html",
    },
    {
        "id": "sipcot-irungattukottai-apparel",
        "wfs_key": "Irungattukottai_Apparel_Park",
        "name": "SIPCOT Apparel Park, Irungattukottai",
        "operator": "SIPCOT",
        "water_note": None,
        "water_source_label": None,
        "water_source_url": None,
    },
    {
        "id": "sipcot-vallam-vadagal-1",
        "wfs_key": "Vallam_Phase1",
        "name": "SIPCOT Vallam Vadagal Phase I",
        "operator": "SIPCOT",
        "water_note": "EIA executive summary declares about 2 MLD via CMWSSB (Chembarambakkam) and TTRO: roughly 1.7 MLD non-potable plus 0.3 MLD potable.",
        "water_source_label": "SIPCOT Vallam A/B EIA executive summary (environmentclearance.nic.in)",
        "water_source_url": "https://environmentclearance.nic.in/",
    },
    {
        "id": "sipcot-vallam-vadagal-2",
        "wfs_key": "Vallam_Phase2",
        "name": "SIPCOT Vallam Vadagal Phase II",
        "operator": "SIPCOT",
        "water_note": None,
        "water_source_label": None,
        "water_source_url": None,
    },
    {
        "id": "sipcot-vallam-aerospace",
        "wfs_key": "Vallam_Aerospace_Park",
        "name": "SIPCOT Aerospace Park, Vallam Vadagal",
        "operator": "SIPCOT",
        "water_note": None,
        "water_source_label": None,
        "water_source_url": None,
    },
    {
        "id": "sipcot-pillaipakkam",
        "wfs_key": "Pillaipakkam",
        "name": "SIPCOT Pillaipakkam",
        "operator": "SIPCOT",
        "water_note": "Half-yearly EC compliance report (EC ID EC22B039TN146946, June 2026): water requirement 1 MGD, source CMWSSB (Chembarambakkam Lake and TTRO water); no groundwater drawl is permitted under the EC.",
        "water_source_label": "SIPCOT half-yearly EC compliance report, Pillaipakkam (June 2026)",
        "water_source_url": "https://sipcotweb.tn.gov.in/Compliance_Report",
    },
    {
        "id": "sipcot-pillaipakkam-emc",
        "wfs_key": "Pillaipakkam_EMC",
        "name": "SIPCOT EMC Cluster, Pillaipakkam",
        "operator": "SIPCOT",
        "water_note": None,
        "water_source_label": None,
        "water_source_url": None,
    },
    {
        "id": "sipcot-mambakkam",
        "wfs_key": "Mambakkam",
        "name": "SIPCOT Mambakkam",
        "operator": "SIPCOT",
        "water_note": None,
        "water_source_label": None,
        "water_source_url": None,
    },
    {
        "id": "mahindra-world-city",
        "wfs_key": "Mahindra",
        "name": "Mahindra World City",
        "operator": "Mahindra (private)",
        "water_note": None,
        "water_source_label": None,
        "water_source_url": None,
    },
]

RETRIEVED = date.today().isoformat()


def _fetch(url, data=None, headers=None, cache_key=None, timeout=120):
    """GET/POST with a file cache so re-runs are reproducible offline."""
    os.makedirs(CACHE, exist_ok=True)
    if cache_key:
        path = os.path.join(CACHE, cache_key)
        if os.path.exists(path):
            with open(path, "rb") as f:
                return f.read()
    req = urllib.request.Request(url, data=data, headers=headers or {})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        body = resp.read()
    if cache_key:
        with open(os.path.join(CACHE, cache_key), "wb") as f:
            f.write(body)
    return body


def ingres_api(locname, loctype, locuuid, parentuuid, year):
    payload = {
        "parentLocName": "INDIA", "locname": locname, "loctype": loctype,
        "view": "admin", "locuuid": locuuid, "year": year,
        "computationType": "normal", "component": "recharge",
        "period": "annual", "category": "safe", "mapOnClickParams": "true",
        "login": "true", "stateuuid": None, "verificationStatus": 1,
        "approvalLevel": 1, "parentuuid": parentuuid,
    }
    key = f"api-{locname}-{year}.json".replace(" ", "_")
    body = _fetch(
        INGRES_API, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"}, cache_key=key,
    )
    return json.loads(body)


def ingres_firka_polygons(year):
    """All TN firka polygons for one vintage, corridor bbox (lat-first BBOX)."""
    cql = f"year={year} AND BBOX(geom,12.4,79.4,13.4,80.3)"
    qs = urllib.parse.urlencode({
        "service": "WFS", "version": "2.0.0", "request": "GetFeature",
        "typeNames": "gec:indgec_vers_tamilnadu",
        "outputFormat": "application/json", "srsName": "EPSG:4326",
        "CQL_FILTER": cql,
    })
    body = _fetch(f"{INGRES_WFS}?{qs}", cache_key=f"firkas-{year}.json")
    return json.loads(body)["features"]


def sipcot_boundary(park_key):
    qs = urllib.parse.urlencode({
        "service": "WFS", "version": "1.0.0", "request": "GetFeature",
        "typeName": f"cite:industrial_complex_boundary-{park_key}",
        "outputFormat": "application/json", "srsName": "EPSG:4326",
    })
    body = _fetch(f"{SIPCOT_WFS}?{qs}", cache_key=f"sipcot-{park_key}.json")
    return json.loads(body)["features"]


def norm(name):
    """Normalize unit names across IN-GRES API / GeoServer spellings."""
    return re.sub(r"[^A-Z0-9]", "", (name or "").upper())


def unit_row(rec):
    cat = rec.get("category")
    cat = cat.get("total") if isinstance(cat, dict) else cat
    st = rec.get("stageOfExtraction")
    st = st.get("total") if isinstance(st, dict) else st
    rain = rec.get("rainfall")
    rain = rain.get("total") if isinstance(rain, dict) else None
    return {
        "name": rec.get("locationName"),
        "category": cat,
        "stage_pct": round(st, 1) if isinstance(st, (int, float)) else None,
        "rainfall_mm": round(rain, 1) if isinstance(rain, (int, float)) else None,
        "report_summary": rec.get("reportSummary"),
    }


def main():
    from shapely.geometry import shape, mapping  # heavy import kept local
    from shapely.ops import unary_union

    os.makedirs(OUT_DIR, exist_ok=True)

    # ---- 1. Parks -----------------------------------------------------------
    park_features, park_shapes = [], {}
    for park in PARKS:
        feats = sipcot_boundary(park["wfs_key"])
        geoms = [shape(f["geometry"]) for f in feats]
        merged = unary_union(geoms)
        park_shapes[park["id"]] = merged
        attrs = feats[0].get("properties", {}) if feats else {}
        park_features.append({
            "type": "Feature",
            "geometry": mapping(merged),
            "properties": {
                "id": park["id"],
                "name": park["name"],
                "operator": park["operator"],
                "sipcot_name": attrs.get("ind_cmplx_name"),
                "notified_area_acre": attrs.get("ind_cmplx_area_acre"),
                "boundary_source": "SIPCOT GIS (sipcotgis.tn.gov.in), Government of Tamil Nadu",
                "boundary_note": "Outer boundary as mapped in the SIPCOT GIS; the mapped extent can exceed the notified saleable area recorded in the attribute.",
                "water_note": park["water_note"],
                "water_source_label": park["water_source_label"],
                "water_source_url": park["water_source_url"],
                "retrieved": RETRIEVED,
            },
        })
    print(f"parks: {len(park_features)} boundaries fetched")

    # ---- 2. Firka polygons (canonical uuid vintage year=2022) ---------------
    firkas_2022 = ingres_firka_polygons(2022)
    by_uuid = {f["properties"]["uuid"]: f for f in firkas_2022}
    print(f"firka polygons (year=2022 vintage, wide bbox): {len(firkas_2022)}")

    # ---- 3. Assessment pulls ------------------------------------------------
    taluks = {}   # norm(taluk) -> {name, district, editions: {ed: row}}
    firka_cats = {}  # firka uuid -> {ed: category}
    for dist, duuid in DISTRICTS.items():
        for portal_year, ed in TALUK_EDITIONS.items():
            rows = ingres_api(dist, "DISTRICT", duuid, TN_UUID, portal_year)
            for rec in rows:
                nm = rec.get("locationName")
                if not nm or nm.lower() == "total":
                    continue
                row = unit_row(rec)
                t = taluks.setdefault(norm(nm), {"name": nm, "district": dist, "editions": {}})
                t["editions"][ed] = {k: row[k] for k in ("category", "stage_pct", "rainfall_mm")}
                rs = row["report_summary"] or {}
                for uuid_key, v in rs.items():
                    if uuid_key == "total" or not isinstance(v, dict):
                        continue
                    fk = v.get("FIRKA")
                    if isinstance(fk, dict) and len(fk) == 1:
                        firka_cats.setdefault(uuid_key, {})[ed] = next(iter(fk))

    firka_era = {}  # district -> edition -> [unit rows] (context, D12b: prose only)
    for dist, duuid in DISTRICTS.items():
        for portal_year, ed in FIRKA_EDITIONS.items():
            rows = ingres_api(dist, "DISTRICT", duuid, TN_UUID, portal_year)
            units = [unit_row(r) for r in rows
                     if r.get("locationName") and r.get("locationName").lower() != "total"]
            for u in units:
                u.pop("report_summary", None)
            firka_era.setdefault(dist, {})[ed] = units

    # ---- 4. Corridor taluk set via park intersect (D1) ----------------------
    corridor_taluks = set()
    for pid, geom in park_shapes.items():
        for f in firkas_2022:
            if shape(f["geometry"]).intersects(geom):
                corridor_taluks.add(norm(f["properties"]["parent_name"]))
    candidate = {norm(t) for lst in CANDIDATE_TALUKS.values() for t in lst}
    intersect_only = sorted(corridor_taluks - candidate)
    candidate_only = sorted(candidate - corridor_taluks)
    final_taluks = corridor_taluks | candidate
    print(f"D1 intersect: parks touch taluks {sorted(corridor_taluks)}")
    print(f"D1 delta vs candidate list: intersect-added={intersect_only} candidate-kept={candidate_only}")

    # ---- 5. D2 assertion, scoped to the corridor: every firka polygon inside
    # a corridor taluk must carry a category from the API's reportSummary
    # (the uuid join rule: reportSummary uuids match the year=2022 vintage).
    unjoined = [
        (f["properties"]["name"], f["properties"]["parent_name"])
        for f in firkas_2022
        if norm(f["properties"].get("parent_name")) in final_taluks
        and f["properties"]["uuid"] not in firka_cats
    ]
    if unjoined:
        sys.exit(
            f"D2 JOIN FAILURE: {len(unjoined)} corridor firka polygons have no "
            f"category via the uuid join (e.g. {unjoined[:4]}). "
            "The year=2022 uuid rule has drifted; do not publish."
        )
    outside = sum(1 for u in firka_cats if u not in by_uuid)
    print(f"D2 join check: all corridor firka polygons joined; "
          f"{outside} reportSummary uuids fall outside the polygon bbox (non-corridor taluks, ignored)")

    # ---- 6. Emit firka layer ------------------------------------------------
    # Firka stage %: single-publication value from the state report annexure,
    # extracted by scripts/extract_corridor_firka_stages.py. The extraction's
    # category is a third publication of the classification and must agree
    # with the API category for every firka (hard fail otherwise).
    stages_path = os.path.join(OUT_DIR, "firka-stages-2025.json")
    firka_stages = {}
    if os.path.exists(stages_path):
        firka_stages = json.load(open(stages_path)).get("firkas_by_uuid", {})
        print(f"firka stages: merging {len(firka_stages)} from the state annexure extraction")
    else:
        print("firka stages: no extraction file; layer ships classification-only")

    latest_ed = list(TALUK_EDITIONS.values())[-1]
    district_of = {norm(t): d.title() for d, lst in CANDIDATE_TALUKS.items() for t in lst}
    firka_features = []
    for f in firkas_2022:
        p = f["properties"]
        if norm(p.get("parent_name")) not in final_taluks:
            continue
        cats = firka_cats.get(p["uuid"], {})
        stage_row = firka_stages.get(p["uuid"])
        if stage_row and cats.get(latest_ed) and stage_row["category"] != cats.get(latest_ed):
            sys.exit(
                f"CATEGORY DISAGREEMENT for firka {p.get('name')}: annexure says "
                f"{stage_row['category']}, API says {cats.get(latest_ed)}. "
                "Show both, do not publish silently."
            )
        firka_features.append({
            "type": "Feature",
            "geometry": f["geometry"],
            "properties": {
                "firka": p.get("name"),
                "uuid": p.get("uuid"),
                "taluk": p.get("parent_name"),
                "district": district_of.get(norm(p.get("parent_name"))),
                "ur_type": p.get("ur_type"),
                "ext_id": p.get("ext_id"),
                **{f"category_{ed}": cats.get(ed) for ed in TALUK_EDITIONS.values()},
                "stage_pct_2025": stage_row["stage_pct"] if stage_row else None,
                "stage_source": "state-annexure" if stage_row else None,
                "geometry_vintage": 2022,
            },
        })
    print(f"firka layer: {len(firka_features)} features in the corridor")

    # ---- 7. Emit taluk layer (dissolved) + table ----------------------------
    taluk_features, table_rows = [], []
    for key in sorted(final_taluks):
        t = taluks.get(key)
        parts = [shape(f["geometry"]) for f in firka_features
                 if norm(f["properties"]["taluk"]) == key]
        if not t or not parts:
            print(f"  WARNING: taluk {key} missing "
                  f"{'assessment rows' if not t else 'polygons'}; skipped")
            continue
        eds = t["editions"]
        cat25, cat24 = (eds.get("2025", {}).get("category"), eds.get("2024", {}).get("category"))
        # Trend rule (D13, stated in the page methodology): net change across
        # the three comparable editions; flat within +/-2 percentage points
        # net; otherwise rising/falling only if BOTH inter-edition intervals
        # move in the net direction, else mixed.
        s23, s24, s25 = (eds.get("2023", {}).get("stage_pct"),
                         eds.get("2024", {}).get("stage_pct"),
                         eds.get("2025", {}).get("stage_pct"))
        trend = None
        if s23 is not None and s24 is not None and s25 is not None:
            net = s25 - s23
            if abs(net) <= 2:
                trend = "flat"
            else:
                d1, d2 = s24 - s23, s25 - s24
                same_dir = (d1 > 0 and d2 > 0 and net > 0) or (d1 < 0 and d2 < 0 and net < 0)
                trend = ("up" if net > 0 else "down") if same_dir else "mixed"
        row = {
            "taluk": t["name"], "district": t["district"].title(),
            "editions": eds, "category_change": None if cat25 == cat24 else f"{cat24} -> {cat25}",
            "stage_trend": trend,
            "firka_categories_2025": sorted(
                (f["properties"]["firka"], f["properties"]["category_2025"],
                 f["properties"]["stage_pct_2025"])
                for f in firka_features if norm(f["properties"]["taluk"]) == key),
        }
        table_rows.append(row)
        taluk_features.append({
            "type": "Feature",
            "geometry": mapping(unary_union(parts)),
            "properties": {
                "taluk": t["name"], "district": t["district"].title(),
                **{f"category_{ed}": eds.get(ed, {}).get("category") for ed in TALUK_EDITIONS.values()},
                **{f"stage_pct_{ed}": eds.get(ed, {}).get("stage_pct") for ed in TALUK_EDITIONS.values()},
                "stage_trend": trend,
            },
        })

    provenance = {
        "assessment_source": "Dynamic Ground Water Resource Assessment (CGWB and TN SG&SWRDC), served by IN-GRES",
        "assessment_api": INGRES_API,
        "geometry_source": "IN-GRES GeoServer layer gec:indgec_vers_tamilnadu (CGWB assessment-unit geometry, year=2022 vintage)",
        "geometry_api": INGRES_WFS,
        "parks_source": "SIPCOT GIS (sipcotgis.tn.gov.in), Government of Tamil Nadu; outer boundaries only",
        "editions": {"taluk_series": TALUK_EDITIONS, "firka_context_series": FIRKA_EDITIONS},
        "unit_note": ("Tamil Nadu assesses at revenue-firka level in every state edition; "
                      "the taluk series from edition 2023 onward is the national apportionment. "
                      "Trend arrows are computed only across editions 2023-2025 (identical units, D3)."),
        "retrieved": RETRIEVED,
        "method": "scripts/build_corridor_sriperumbudur.py",
        "decision_log": "docs/corridors/sriperumbudur/DECISIONS.md",
    }

    def dump(name, obj):
        with open(os.path.join(OUT_DIR, name), "w") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        print(f"wrote {name}")

    dump("parks.geojson", {"type": "FeatureCollection", "_provenance": provenance,
                           "features": park_features})
    dump("assessment-firkas.geojson", {"type": "FeatureCollection", "_provenance": provenance,
                                       "features": firka_features})
    dump("assessment-taluks.geojson", {"type": "FeatureCollection", "_provenance": provenance,
                                       "features": taluk_features})
    dump("assessment.json", {
        "_provenance": provenance,
        "corridor_taluks_from_intersect": sorted(corridor_taluks),
        "corridor_taluks_final": sorted(final_taluks),
        "d1_intersect_added": intersect_only,
        "d1_candidate_only": candidate_only,
        "table": table_rows,
        "firka_era_context": firka_era,
    })


if __name__ == "__main__":
    main()
