#!/usr/bin/env python3
"""Build public/data/delhi-cgwb-stations.json from the India-WRIS API.

Delhi's CGWB assessment resolves only to 11 districts, so /delhi/groundwater
and the my-ward groundwater card had no sub-district layer. India-WRIS exposes
the CGWB observation-well network as a queryable dataset, which gives Delhi
point-level depth-to-water instead - and, unlike the Year-Book transcriptions
used for Madurai and Mumbai, an actual time series.

API contract (discovered 2026-07-25, reachable from a non-India IP):
    POST https://indiawris.gov.in/Dataset/Ground%20Water%20Level?<params>
  ALL of stateName, districtName, agencyName, startdate, enddate, download,
  page, size are MANDATORY. A blank districtName or agencyName silently
  returns zero rows rather than "all" - the trap that makes this look dead.
  Paginate page=0,1,2... at size=9000 until a short page.

SIGN CONVENTION - the important part. WRIS returns depth-to-water with a sign
that depends on which programme installed the station, and Delhi carries three
station-code families:
    numeric (e.g. 282837077092201, lat/long-encoded NHN codes) - positive-down
    AAXI*                                                      - positive-down
    CGWBDL*                                                    - negative-down
Rather than trust that naming heuristic, the convention is derived PER STATION
from the median of its own raw readings, and the family agreement is asserted
afterwards as a check (it is currently 151/39/46 with zero disagreement).
A blanket abs() would be wrong twice over: it would erase genuine
water-above-datum readings in floodplain wells, and it would launder
sign-faulty sensors into plausible-looking data.

Known bad sensors are excluded, not silently averaged in:
    CGWBDL32  emits perfectly symmetric +/-26.10 m (sign fault)
    CGWBDL46  emits 660-890 m in a city whose deepest true well is ~68 m

NOT a live feed: telemetry across the network stops 2025-09-20.

Usage:  python scripts/build_delhi_cgwb_stations.py [--refresh]
"""

from __future__ import annotations

import argparse
import collections
import json
import ssl
import statistics as st
import time
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parent / ".cache" / "delhi-wris-gwl.jsonl"
OUT = REPO / "public/data/delhi-cgwb-stations.json"

BASE = "https://indiawris.gov.in/Dataset/Ground%20Water%20Level"
UA = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

DISTRICTS = [
    "CENTRAL",
    "EAST",
    "NEW DELHI",
    "NORTH",
    "NORTH EAST",
    "NORTH WEST",
    "SHAHDARA",
    "SOUTH",
    "SOUTH EAST",
    "SOUTH WEST",
    "WEST",
]
YEARS = range(2015, 2026)

SUSPECT = {
    "CGWBDL32": "emits perfectly symmetric +/-26.10 m readings (sensor sign fault)",
    "CGWBDL46": "emits 660-890 m depths; Delhi's deepest genuine well is ~68 m",
}
# Physically defensible envelope for Delhi depth-to-water. The ridge wells
# (Gadaipur, Sultanpur) genuinely reach ~68 m; nothing real sits past 100 m.
# Slightly negative is real (water above the sensor datum in floodplain wells).
DEPTH_MIN, DEPTH_MAX = -5.0, 100.0
# Classic no-data markers that sit INSIDE a plausible depth envelope and so
# survive the range check. Satbari Pz reports a single 99.00 against a fleet
# p99 of 67.12 m; without this it would render as Delhi's deepest well.
SENTINELS = {99.0, 999.0, 9999.0, -999.0}


def fetch(d, s, e, page=0, size=9000, tries=4):
    q = urllib.parse.urlencode(
        {
            "stateName": "DELHI",
            "districtName": d,
            "agencyName": "CGWB",
            "startdate": s,
            "enddate": e,
            "download": "false",
            "page": page,
            "size": size,
        }
    )
    req = urllib.request.Request(
        f"{BASE}?{q}",
        method="POST",
        headers={"User-Agent": UA, "Accept": "application/json"},
    )
    for a in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=120, context=CTX) as r:
                return json.loads(r.read().decode()).get("data") or []
        except Exception as exc:
            if a == tries - 1:
                print(f"    ! {d} {s[:4]} p{page}: {exc}", flush=True)
                return []
            time.sleep(3 + a * 4)
    return []


def download_raw() -> list[dict]:
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    with CACHE.open("w") as fh:
        for year in YEARS:
            n = 0
            for d in DISTRICTS:
                for p in range(20):
                    got = fetch(d, f"{year}-01-01", f"{year}-12-31", page=p)
                    for r in got:
                        if r.get("dataValue") is None:
                            continue
                        rec = {
                            k: r.get(k)
                            for k in (
                                "stationCode",
                                "stationName",
                                "district",
                                "tehsil",
                                "latitude",
                                "longitude",
                                "dataValue",
                                "dataTime",
                                "dataAcquisitionMode",
                                "stationStatus",
                            )
                        }
                        rows.append(rec)
                        fh.write(json.dumps(rec) + "\n")
                    n += len(got)
                    if len(got) < 9000:
                        break
                time.sleep(0.4)
            print(f"  {year}: {n:7d} rows", flush=True)
    return rows


def load_raw(refresh: bool) -> list[dict]:
    if CACHE.exists() and not refresh:
        print(f"using cached raw rows: {CACHE.relative_to(REPO)}")
        return [
            json.loads(line) for line in CACHE.read_text().splitlines() if line.strip()
        ]
    return download_raw()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="re-download from WRIS")
    args = ap.parse_args()

    rows = load_raw(args.refresh)
    print(f"raw readings: {len(rows):,}")

    meta, by_station = {}, collections.defaultdict(list)
    for r in rows:
        meta.setdefault(r["stationCode"], r)
        by_station[r["stationCode"]].append(r)

    # --- derive the sign convention per station, empirically -----------------
    # Known-faulty sensors are excluded from this pass. CGWBDL32 emits
    # sign-flipped duplicates (+/-26.20 m, 2746 positive vs 320 negative), so
    # its median reads positive and it would both mis-set its own convention
    # and trip the family assertion below on a fault we have already
    # diagnosed. A broken sensor must not get a vote on what the fleet means.
    convention, families = {}, collections.defaultdict(collections.Counter)
    for code, rs in by_station.items():
        if code in SUSPECT:
            continue
        median_raw = st.median([r["dataValue"] for r in rs])
        convention[code] = "negative-down" if median_raw < 0 else "positive-down"
        fam = (
            "AAXI"
            if code.startswith("AAXI")
            else "CGWBDL"
            if code.startswith("CGWB")
            else "numeric"
        )
        families[fam][convention[code]] += 1
    print("sign convention by station-code family (suspect sensors excluded):")
    for fam, counts in sorted(families.items()):
        print(f"  {fam:8s} {dict(counts)}")
        # Guard, not decoration: this is what caught CGWBDL32 as an outlier
        # rather than letting it quietly corrupt the transform.
        assert len(counts) == 1, (
            f"family {fam} disagrees on sign convention: {dict(counts)}"
        )

    # --- aggregate to monthly means -----------------------------------------
    monthly = collections.defaultdict(list)
    dropped = collections.Counter()
    for code, rs in by_station.items():
        if code in SUSPECT:
            dropped["suspect_station"] += len(rs)
            continue
        flip = convention[code] == "negative-down"
        for r in rs:
            if abs(r["dataValue"]) in SENTINELS:
                dropped["sentinel_value"] += 1
                continue
            depth = -r["dataValue"] if flip else r["dataValue"]
            if not (DEPTH_MIN <= depth <= DEPTH_MAX):
                dropped["out_of_envelope"] += 1
                continue
            t = r["dataTime"]
            monthly[(code, int(t[:4]), int(t[5:7]))].append(depth)

    wells = []
    for code, m in sorted(meta.items()):
        readings = [
            {
                "year": y,
                "month": mo,
                "depth_m_bgl": round(st.mean(v), 2),
                "n_obs": len(v),
            }
            for (c, y, mo), v in sorted(monthly.items())
            if c == code
        ]
        w = {
            "name": m["stationName"],
            "station_code": code,
            # `block` is what CgwbStation in src/types/groundwater.ts reads;
            # Delhi's CGWB assessment unit is the district, which is why the
            # file also sets unit_label: "district".
            "block": m.get("district"),
            "district": m.get("district"),
            "tehsil": m.get("tehsil"),
            "lat": m["latitude"],
            "lng": m["longitude"],
            "acquisition": m.get("dataAcquisitionMode"),
            "status": m.get("stationStatus"),
            "sign_convention": convention.get(code),
            "readings": readings,
        }
        if readings:
            ds = [r["depth_m_bgl"] for r in readings]
            w.update(
                depth_min_m_bgl=min(ds),
                depth_max_m_bgl=max(ds),
                depth_latest_m_bgl=readings[-1]["depth_m_bgl"],
                latest_reading=f"{readings[-1]['year']}-{readings[-1]['month']:02d}",
            )
        if code in SUSPECT:
            w["_data_status"] = "suspect"
            w["_data_status_reason"] = SUSPECT[code]
        wells.append(w)

    withr = [w for w in wells if w.get("readings")]
    depths = [r["depth_m_bgl"] for w in withr for r in w["readings"]]

    doc = {
        "_note": (
            "CGWB observation wells across all 11 Delhi districts, from the India-WRIS "
            "'Ground Water Level' dataset. This is the sub-district groundwater layer "
            "Delhi previously lacked: the CGWB assessment choropleth resolves only to 11 "
            "districts, these resolve to points. Later years are 6-hourly telemetric "
            "(DWLR) readings; earlier years are periodic manual observations. Published "
            "here as monthly means."
        ),
        "district": "Delhi NCT (all 11 districts)",
        "well_type": "Observation well / piezometer (manual + telemetric DWLR)",
        "aquifer": "Alluvial (Yamuna floodplain, Najafgarh depression) and quartzite ridge",
        "depth_unit": "m_bgl",
        "source_label": "Central Ground Water Board, via India-WRIS Ground Water Level dataset",
        "source_url": "https://indiawris.gov.in/wris/",
        # Consumed by CgwbStationPanel. Delhi's series is NOT a Year Book
        # transcription, and its wells are not manually-read dug wells, so
        # both the provenance line and the cadence line are overridden
        # rather than inheriting the Tamil Nadu defaults.
        "series_label": "CGWB via India-WRIS",
        "unit_label": "district",
        "reading_kind": "monthly means",
        "cadence_note": (
            "Telemetric digital water-level recorders and manual observation wells, "
            "published here as monthly means. Telemetry stops 2025-09-20."
        ),
        "retrieved": "2026-07-25",
        "coverage": {
            "period": f"{min(YEARS)} to 2025",
            "cadence_raw": "6-hourly (telemetric) / periodic (manual)",
            "cadence_published_here": "monthly mean",
        },
        "_feed_status": (
            "NOT a live feed. Telemetry across the Delhi network stops on 2025-09-20, the "
            "same month BBMB's public reservoir page froze (04.09.2025). Treated as a "
            "historical series, not an ingestion source."
        ),
        "_sign_convention": (
            "WRIS returns depth-to-water with a programme-dependent sign. Delhi has three "
            "station-code families: numeric NHN codes and AAXI* report positive-down, "
            "CGWBDL* reports negative-down. The convention is derived per station from the "
            "median of its own readings (family agreement asserted at build time), never by "
            "abs() - which would erase real water-above-datum readings in floodplain wells "
            "and would launder sign-faulty sensors into plausible data."
        ),
        "_excluded": {
            "suspect_stations": SUSPECT,
            "depth_envelope_m_bgl": [DEPTH_MIN, DEPTH_MAX],
            "readings_dropped": dict(dropped),
        },
        "_api_contract": {
            "method": "POST",
            "url": BASE,
            "mandatory_params": [
                "stateName",
                "districtName",
                "agencyName",
                "startdate",
                "enddate",
                "download",
                "page",
                "size",
            ],
            "gotcha": "blank districtName or agencyName returns zero rows, not all rows",
            "pagination": "page=0,1,2... at size=9000 until a short page",
        },
        "summary": {
            "stations": len(wells),
            "stations_with_readings": len(withr),
            "monthly_readings": len(depths),
            "depth_median_m_bgl": round(st.median(depths), 2) if depths else None,
            "depth_min_m_bgl": round(min(depths), 2) if depths else None,
            "depth_max_m_bgl": round(max(depths), 2) if depths else None,
        },
        "wells": wells,
    }
    OUT.write_text(json.dumps(doc, indent=2) + "\n")

    s = doc["summary"]
    print(f"\nwrote {OUT.relative_to(REPO)}")
    print(f"  stations {s['stations']} ({s['stations_with_readings']} with readings)")
    print(f"  monthly readings {s['monthly_readings']:,}")
    print(
        f"  depth median {s['depth_median_m_bgl']} m, range {s['depth_min_m_bgl']}..{s['depth_max_m_bgl']} m"
    )
    print(f"  dropped {dict(dropped)}")


if __name__ == "__main__":
    main()
