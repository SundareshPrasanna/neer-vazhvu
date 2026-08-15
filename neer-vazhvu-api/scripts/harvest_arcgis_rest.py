#!/usr/bin/env python3
"""
Harvest vector layers from an open ArcGIS REST service into GeoJSON.

WHY A NEW ADAPTER
-----------------
No existing adapter speaks ArcGIS REST. The platform's municipal-GIS prior art
is Surat's IGiS/MapServer portal, where WFS is disabled and only rendered tiles
plus GetFeatureInfo attributes are available - so the plan there was an
attribute harvester that reconstructs a table without geometry. GMDA OneMap is
the opposite and much better case: ArcGIS Server 11.2 with an open,
unauthenticated REST directory that serves `f=geojson` with real coordinates.

Written generic on purpose. ArcGIS Server is the dominant stack across Indian
state and municipal GIS, and this one host also carries FMDA (Faridabad),
HARSAC, HaryanaRoads, TCP_Haryana, HSVP and Gatishakti. The Gurugram layer set
below is a caller-side constant; the fetching, paging and conversion are not.

THE TLS QUIRK, AND WHY IT IS NOT `verify=False`
-----------------------------------------------
onemapdepts.gmda.gov.in does not implement RFC 5746 secure renegotiation, so
Python refuses it outright with UNSAFE_LEGACY_RENEGOTIATION_DISABLED while
curl (broader defaults) succeeds. The fix here is the narrowest one that
works: set OP_LEGACY_SERVER_CONNECT and leave certificate verification and
hostname checking fully ON (asserted at startup so a future refactor cannot
quietly widen it).

This is a DIFFERENT failure from the `insecureTLS` entries already in the
registry (cgwb.gov.in, which serves an incomplete cert chain). Do not conflate
them: that one weakens verification, this one does not.

PAGING, AND THE LAYER THAT REFUSES IT
-------------------------------------
maxRecordCount is 2000 on every layer harvested here and the largest is 824,
so paging never actually triggers today. It is still implemented, because a
layer that grew past the cap would otherwise truncate SILENTLY - the failure
mode is a smaller file that is still valid GeoJSON.

But paging support is PER LAYER on this server, not per service: the GMUC
drain-legs layer answers any request carrying `resultOffset` with
`{"error": {"code": 400, "message": "Pagination is not supported."}}`. So the
first page is requested WITHOUT resultOffset, and the parameter is only added
when a continuation is genuinely needed.

That quirk cost a real bug on first run and is why `_get` now inspects the
`error` key. ArcGIS returns its errors as HTTP 200 with an error body, so the
original code read the error document, found no `features`, and wrote a
zero-feature layer while reporting success. Three guards now stand between
that and the corpus: errors raise, an empty result raises, and every layer
with a known size asserts it.

Run
---
    cd neer-vazhvu-api
    python3 scripts/harvest_arcgis_rest.py --city gurugram
    python3 scripts/harvest_arcgis_rest.py --city gurugram --only wards
    python3 scripts/harvest_arcgis_rest.py --list
"""

from __future__ import annotations

import argparse
import json
import ssl
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from registry_license import registry_license  # noqa: E402
from nvdm_write import write_artifact  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]

GMDA_ONEMAP = "https://onemapdepts.gmda.gov.in/server/rest/services"
GMDA_SOURCE_ID = "gmda-onemap-arcgis"

# Only layers with an EXISTING reader in this repo are harvested. The service
# carries much more (524 tubewells, the 122-segment supply network, WTP/STP
# footprints with capacities, the MCG limit vintages 1985-2020); each lands
# when the surface that consumes it is built, so the corpus does not
# accumulate files nothing renders.
LAYERS: dict[str, list[dict]] = {
    "gurugram": [
        {
            "key": "wards",
            "service": "flood_survey_2/MapServer/4",
            "out": "public/geojson/gurugram-wards-2026.geojson",
            "expect": 36,
            # `w` is the MCG zone code (NW/SW/...); `ward_no` is 1..36.
            "fields": ["ward_no", "w"],
            "rename": {"ward_no": "ward_no", "w": "zone_code"},
            "note": "MCG's 36-ward delimitation as published on GMDA OneMap. Carries ward number and zone code only - no ward NAME is published in this layer.",
        },
        {
            "key": "water-bodies",
            "service": "Wet_Infrastructure_caching/MapServer/12",
            "out": "public/geojson/gurugram-water-bodies-current.geojson",
            "expect": 824,
            "fields": [
                "waterbody",
                "tehsil_nam",
                "village_na",
                "area__acre",
                "ownershi_1",
                "final_rema",
                "mcg_bounda",
                "gmda_bound",
                "ror",
                "soi",
                "wv_12",
                "drone",
                "ge",
            ],
            "rename": {
                "waterbody": "wb_id",
                "tehsil_nam": "tehsil",
                "village_na": "village",
                "area__acre": "area_acre",
                "ownershi_1": "ownership",
                "final_rema": "remark",
                "mcg_bounda": "in_mcg",
                "gmda_bound": "in_gmda",
                "ror": "in_ror_1956",
                "soi": "in_soi_1976",
                "wv_12": "in_worldview_2012",
                "drone": "in_drone",
                "ge": "in_google_earth",
            },
            "note": "GMDA's own NGT-facing water-body register. The five in_* flags are GMDA'S OWN cross-survey attribution, not our spatial join, which is what makes a presence comparison defensible. Read them carefully: this layer is the 2012-known population, so a body that existed in the 1956 revenue record and had vanished by 2012 is NOT a row here - it is in the separate WB 1956 (ROR) layer. in_ror_1956=0 therefore means 'not matched to a revenue-record plot', never 'did not exist in 1956'.",
        },
        {
            "key": "drainage",
            "service": "GMDA/water_logging_under_gmuc_area/MapServer/5",
            "out": "public/geojson/gurugram-drainage.geojson",
            "expect": 3,
            "fields": ["Id", "Name", "length", "Discharge"],
            "rename": {
                "Id": "drain_id",
                "Name": "name",
                "length": "length_m",
                "Discharge": "discharge",
            },
            "note": "GMDA's drain legs under the GMUC area. Gurugram has no river, so this network plus the Najafgarh outfall IS the city's surface drainage.",
        },
    ],
}

# Full certificate verification stays on; only legacy renegotiation is allowed.
# See the module docstring.
_CTX = ssl.create_default_context()
_CTX.options |= getattr(ssl, "OP_LEGACY_SERVER_CONNECT", 0x4)
assert _CTX.verify_mode == ssl.CERT_REQUIRED, "certificate verification must stay on"
assert _CTX.check_hostname, "hostname checking must stay on"


def _get(url: str, timeout: int = 120) -> dict:
    """Fetch and decode, raising on ArcGIS's in-band errors.

    ArcGIS reports failures as HTTP 200 with an `error` object in the body, so
    the status code alone tells you nothing. Without this check an error
    document reads as a page with no features.
    """
    req = urllib.request.Request(
        url, headers={"User-Agent": "neervazhvu-arcgis-harvest"}
    )
    with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as resp:
        doc = json.loads(resp.read())
    if isinstance(doc, dict) and doc.get("error"):
        err = doc["error"]
        raise RuntimeError(f"ArcGIS error {err.get('code')}: {err.get('message')}")
    return doc


def fetch_layer(base: str, service: str, fields: list[str]) -> list[dict]:
    """Page a layer out as GeoJSON features.

    `f=geojson` is used rather than `f=json` plus a converter: the server
    already emits RFC 7946 with lon/lat ordering, so hand-converting Esri
    geometry would only add a place for a winding-order or axis-order bug.
    """
    base_params = {
        "where": "1=1",
        "outFields": ",".join(fields),
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    }
    out: list[dict] = []
    while True:
        params = dict(base_params)
        if out:
            # Only ask for a continuation once one is actually needed - some
            # layers reject resultOffset outright (see the module docstring).
            params["resultOffset"] = len(out)
        page = _get(f"{base}/{service}/query?{urllib.parse.urlencode(params)}")
        feats = page.get("features") or []
        out.extend(feats)
        # `exceededTransferLimit` is absent rather than false on a final page.
        if not feats or not page.get("exceededTransferLimit"):
            break
    if not out:
        # Never write an empty layer. A zero-feature file is valid GeoJSON and
        # would pass every downstream check while showing an empty map.
        raise RuntimeError("returned zero features")
    return out


def harvest(city: str, only: str | None) -> int:
    specs = LAYERS[city]
    if only:
        specs = [s for s in specs if s["key"] == only]
        if not specs:
            print(f"no layer '{only}' for {city}", file=sys.stderr)
            return 1

    failures = 0
    for spec in specs:
        try:
            feats = fetch_layer(GMDA_ONEMAP, spec["service"], spec["fields"])
        except Exception as exc:  # noqa: BLE001 - one dead layer must not kill the run
            print(f"  {spec['key']}: FAILED ({exc})", file=sys.stderr)
            failures += 1
            continue

        expect = spec.get("expect")
        if expect is not None and len(feats) != expect:
            # A silent count change is the failure mode that matters here: the
            # file would still be valid GeoJSON. Refuse rather than overwrite.
            print(
                f"  {spec['key']}: FAILED - expected {expect} features, got {len(feats)}. "
                f"Upstream changed; re-verify before bumping `expect`.",
                file=sys.stderr,
            )
            failures += 1
            continue

        rename = spec.get("rename", {})
        for f in feats:
            props = f.get("properties") or {}
            f["properties"] = {
                rename.get(k, k): (v.strip() if isinstance(v, str) else v)
                for k, v in props.items()
            }

        payload = {
            "type": "FeatureCollection",
            "_source": "GMDA OneMap (ArcGIS REST)",
            "_source_url": f"{GMDA_ONEMAP}/{spec['service']}",
            "_licence": registry_license(GMDA_SOURCE_ID),
            "_fetched": date.today().isoformat(),
            "_note": spec["note"],
            "features": feats,
        }
        envelope = {
            "nvdm": "1.0",
            "dataset": f"geojson-layers/{Path(spec['out']).stem.split(city + '-', 1)[-1]}",
            "scope": {"kind": "city", "id": city},
            "provenance": {
                "sources": [
                    {
                        "id": GMDA_SOURCE_ID,
                        "title": f"GMDA OneMap layer {spec['service']}",
                        "publisher": "Gurugram Metropolitan Development Authority (OneMap GGM)",
                        "license": registry_license(GMDA_SOURCE_ID),
                    }
                ],
                "method": "api",
                "produced_at": date.today().isoformat(),
                "produced_by": "neer-vazhvu-api/scripts/harvest_arcgis_rest.py",
                "note": (
                    "Geometry and a selected attribute subset, fetched as GeoJSON from an open "
                    "unauthenticated ArcGIS REST service. Feature count is asserted against a "
                    "pinned expectation so an upstream change fails the run instead of silently "
                    "rewriting the layer."
                ),
            },
        }
        path = ROOT / spec["out"]
        write_artifact(path, {**envelope, **payload}, compact=True)
        print(
            f"  {spec['key']}: {len(feats)} features -> {spec['out']}", file=sys.stderr
        )

    return 1 if failures else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--city", choices=sorted(LAYERS), help="city whose layer set to harvest"
    )
    ap.add_argument("--only", help="harvest a single layer by key")
    ap.add_argument(
        "--list", action="store_true", help="list configured layers and exit"
    )
    args = ap.parse_args()

    if args.list:
        for city, specs in LAYERS.items():
            for s in specs:
                print(f"{city:10s} {s['key']:14s} {s['service']:48s} -> {s['out']}")
        return 0
    if not args.city:
        ap.error("--city is required unless --list")
    return harvest(args.city, args.only)


if __name__ == "__main__":
    raise SystemExit(main())
