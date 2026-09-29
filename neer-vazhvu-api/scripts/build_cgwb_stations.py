#!/usr/bin/env python3
"""
CGWB groundwater observation wells from the India-WRIS Ground Water Level API.

One script for every city; per-city knowledge lives in CITIES as data.

    POST https://indiawris.gov.in/Dataset/Ground%20Water%20Level?<params>

TWO TRAPS, BOTH RECORDED IN THE PLAYBOOK AND BOTH RE-CONFIRMED FOR KOLKATA:

1. A blank districtName or agencyName returns ZERO rows, not all rows. Every
   parameter below is mandatory.

2. A too-narrow date window is indistinguishable from "no stations", AND the
   page-size cap silently truncates the station list. Both bite here:
     - Kolkata over 2024-2025 -> 7,579 rows but only **3 stations**
     - Kolkata over 2010-2026, page 0 only -> 9,000 rows, still **3 stations**
     - Kolkata over 2010-2026, paged to exhaustion -> 10,593 rows, **23 stations**
   The first page is dominated by a handful of high-frequency telemetric wells,
   so stopping at page 0 hides 20 of the 23. Probe WIDE, then page to
   exhaustion, then narrow.

KOLKATA INVERTS THE STARTING ASSUMPTION. It is not the groundwater-poor city:
23 stations in Kolkata district and 667 across the six KMA districts, denser
than Delhi's 237-well network. But Howrah has been silent since Apr 2023 and
Hooghly since Nov 2022 - those render as STALE, never interpolated over.
Liveness is itself a reportable finding, so per-district recency is emitted.

DELHI AND HYDERABAD keep the recipe they were first built with (their CITIES
entries carry `years`): yearly windows cached to .cache/<city>-wris-gwl.jsonl
(Delhi's is ~40 min to download; --refresh re-fetches), the sign convention
taken from the median of each station's own readings with per-family
agreement asserted, a depth envelope that keeps slightly negative readings
(water above the sensor datum), known-bad sensors listed rather than averaged
in, and their own output shape. Delhi carries three code families: numeric
NHN codes and AAXI* read positive-down, CGWBDL* negative-down, with no
disagreement. Delhi telemetry stops 2025-09-20; Hyderabad's is live.
Telangana trap: WRIS keeps a partly PRE-2016 district set, so Ranga Reddy,
Medak, Siddipet and Vikarabad return data while the post-2016 names return
"No data found". Enumerate spellings empirically, never from the current list.

Run:
  python3 neer-vazhvu-api/scripts/build_cgwb_stations.py --city kolkata
  python3 neer-vazhvu-api/scripts/build_cgwb_stations.py --city kolkata --kma
  python3 neer-vazhvu-api/scripts/build_cgwb_stations.py --city delhi [--refresh]
"""

import argparse
import json
import re
import ssl
import statistics as st
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
# Every producer writing under public/ goes through the envelope-preserving
# writer: a scheduled rewrite must not strip the NVDM envelope it finds.
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402

DATA_DIR = REPO_ROOT / "public" / "data"
CACHE_DIR = Path(__file__).resolve().parent / ".cache"

BASE = "https://indiawris.gov.in/Dataset/Ground%20Water%20Level"
UA = "Mozilla/5.0 (neer-vazhvu civic water dashboard)"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

START, END = "2010-01-01", date.today().isoformat()

CITIES = {
    "surat": {
        "state": "GUJARAT",
        "core_districts": ["SURAT"],
        # Surat has no metropolitan grouping to widen into; the district IS the
        # scope the groundwater surface claims, and it already reaches past the
        # municipal line to Olpad, Choryasi and the Hazira coast where the
        # salinity story lives.
        "kma_districts": ["SURAT"],
    },
    "kolkata": {
        "state": "WEST BENGAL",
        # The city's own district first; the rest of KMA gives the regional
        # picture the region scope promises.
        "core_districts": ["KOLKATA"],
        "kma_districts": [
            "KOLKATA",
            "NORTH 24 PARGANAS",
            "SOUTH 24 PARGANAS",
            "HOWRAH",
            "HOOGHLY",
            "NADIA",
        ],
    },
    "delhi": {
        "state": "DELHI",
        "districts": [
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
        ],
        "years": range(2015, 2026),
        "suspect": {
            "CGWBDL32": "emits perfectly symmetric +/-26.10 m readings (sensor sign fault)",
            "CGWBDL46": "emits 660-890 m depths; Delhi's deepest genuine well is ~68 m",
        },
        # Ridge wells (Gadaipur, Sultanpur) genuinely reach ~68 m; nothing real sits past 100 m.
        "depth_envelope": [-5.0, 100.0],
        "doc": {
            "_note": (
                "CGWB observation wells across all 11 Delhi districts, from the India-WRIS "
                "'Ground Water Level' dataset. This is the sub-district groundwater layer "
                "Delhi previously lacked: the CGWB assessment choropleth resolves only to 11 "
                "districts, these resolve to points. Later years are 6-hourly telemetric "
                "(DWLR) readings; earlier years are periodic manual observations. Published "
                "here as monthly means."
            ),
            "district": "Delhi NCT (all 11 districts)",
            "aquifer": "Alluvial (Yamuna floodplain, Najafgarh depression) and quartzite ridge",
            "cadence_note": (
                "Telemetric digital water-level recorders and manual observation wells, "
                "published here as monthly means. Telemetry stops 2025-09-20."
            ),
            "retrieved": "2026-07-25",
            "period": "2015 to 2025",
            "extra": {
                "_feed_status": (
                    "NOT a live feed. Telemetry across the Delhi network stops on 2025-09-20, the "
                    "same month BBMB's public reservoir page froze (04.09.2025). Treated as a "
                    "historical series, not an ingestion source."
                ),
            },
        },
    },
    "hyderabad": {
        "state": "Telangana",
        # Legacy (pre-2016) spellings verified to return rows; the metro core plus the CUR ring.
        "districts": ["Hyderabad", "Ranga Reddy", "Medak", "Siddipet", "Vikarabad"],
        "years": range(2015, 2027),
        # A suspect-sensor list is a per-network finding; none found here yet.
        "suspect": {},
        # Deccan hard rock: bores chase fractures past 70 m; 120 m still catches decimal slips.
        "depth_envelope": [-5.0, 120.0],
        "doc": {
            "_note": (
                "CGWB observation wells across the Hyderabad metro districts, from the "
                "India-WRIS 'Ground Water Level' dataset. This is the sub-district "
                "groundwater layer Hyderabad otherwise lacks: the CGWB assessment resolves "
                "to mandal/district units, these resolve to points. Later years are 6-hourly "
                "telemetric (DWLR) readings; earlier years are periodic manual observations. "
                "Published here as monthly means."
            ),
            "district": "Hyderabad metro (Hyderabad, Ranga Reddy, Medak, Siddipet, Vikarabad)",
            "aquifer": (
                "Deccan hard rock - granite and gneiss, with weathered-zone and "
                "fracture aquifers rather than a continuous alluvial water table"
            ),
            "cadence_note": (
                "Telemetric digital water-level recorders and manual observation wells, "
                "published here as monthly means."
            ),
            "retrieved": None,  # the build date
            "period": "2015 to 2025",
            "extra": {
                "_feed_status": (
                    "LIVE - telemetric readings run to 2026-06-04 as of the 2026-07-26 build, "
                    "unlike Delhi's network which stopped 2025-09-20. Re-check liveness on each "
                    "rebuild rather than assuming it."
                ),
                # Probed: statusCode 500 / "No data found" for any window.
                "_districts_not_in_wris": [
                    "Medchal-Malkajgiri",
                    "Sangareddy",
                    "Yadadri Bhuvanagiri",
                ],
                "_district_vocabulary_note": (
                    "India-WRIS carries a partly PRE-2016 Telangana district set. Telangana "
                    "reorganised from 10 districts to 33 in Oct 2016 and WRIS did not fully "
                    "follow, so Medchal-Malkajgiri, Sangareddy and Yadadri Bhuvanagiri return "
                    "zero rows for any window while the legacy names return data. Enumerate "
                    "spellings empirically; do not derive them from the current district list."
                ),
            },
        },
    },
}

# Values that are placeholders rather than measurements.
SENTINELS = {99.0, 999.0, 9999.0, -999.0}
# A well deeper than this in the Gangetic delta is a data error, not a reading.
MAX_PLAUSIBLE_DEPTH_M = 120.0

# SIGN CONVENTION IS PER STATION, AND GETTING THIS WRONG SILENTLY KILLS A CITY.
# WRIS mixes two conventions in one district: manual wells report depth below
# ground as POSITIVE metres, while telemetric piezometers report it as NEGATIVE
# (depth below a datum). Kolkata's only two live wells - Jadavpur_1 and
# Salt Lake Pz_1, both telemetric - report -22.06 to -8.70 m. A naive `v < 0`
# reject drops all 9,115 of their post-2024 readings, and the city then reads
# as STALE SINCE MAY 2023 when it is in fact live to June 2026. Derive the
# convention per station from the sign of its own readings, never globally.


def negative_down(vals) -> bool:
    """A station is on the negative convention when its readings are overwhelmingly negative."""
    return sum(1 for v in vals if v < 0) > 0.9 * len(vals)


def fetch(state, district, page, size=9000, tries=4, start=START, end=END):
    q = urllib.parse.urlencode(
        {
            "stateName": state,
            "districtName": district,
            "agencyName": "CGWB",
            "startdate": start,
            "enddate": end,
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
            with urllib.request.urlopen(req, timeout=180, context=CTX) as r:
                return json.loads(r.read().decode()).get("data") or []
        except Exception as exc:
            if a == tries - 1:
                print(f"    ! {district} p{page}: {exc}", file=sys.stderr)
                return []
            time.sleep(3 + a * 4)
    return []


def collect(state, districts, max_pages=25):
    """Page to exhaustion. See trap 2 in the module docstring."""
    rows = []
    for d in districts:
        got_d = 0
        for p in range(max_pages):
            batch = fetch(state, d, p)
            if not batch:
                break
            rows.extend(batch)
            got_d += len(batch)
            if len(batch) < 9000:
                break
            time.sleep(0.5)
        # WRIS echoes district names in its own casing ("Hooghly" for a
        # "HOOGHLY" query), so compare case-insensitively or the count reads 0.
        stations = len(
            {
                r.get("stationCode")
                for r in rows
                if (r.get("district") or "").upper() == d.upper()
            }
        )
        print(f"  {d:22} {got_d:7} rows  {stations:4} stations", file=sys.stderr)
    return rows


def build(rows):
    # Pass 1: bucket raw values per station so each station's own sign
    # convention can be derived before anything is filtered.
    raw = defaultdict(list)
    for r in rows:
        v = r.get("dataValue")
        if v is None:
            continue
        try:
            v = float(v)
        except (TypeError, ValueError):
            continue
        if v in SENTINELS:
            continue
        raw[r.get("stationCode")].append((str(r.get("dataTime") or "")[:10], v, r))

    by_station = defaultdict(list)
    sign_flipped = []
    for code, obs in raw.items():
        # Mixed-sign stations are left as-is; their out-of-range values fall away below.
        flip = negative_down([v for _, v, _ in obs])
        if flip:
            sign_flipped.append(code)
        for d, v, meta in obs:
            depth = -v if flip else v
            if depth < 0 or depth > MAX_PLAUSIBLE_DEPTH_M:
                continue
            by_station[code].append((d, depth, meta))
    if sign_flipped:
        print(
            f"  sign convention: {len(sign_flipped)} station(s) report depth as negative "
            f"and were flipped ({', '.join(sign_flipped[:4])}{'...' if len(sign_flipped) > 4 else ''})",
            file=sys.stderr,
        )

    SIGN_FLIPPED = set(sign_flipped)
    stations = []
    for code, obs in by_station.items():
        obs.sort(key=lambda x: x[0])
        meta = obs[-1][2]
        # Coordinates come from ANY row that carries them, not just the latest.
        # WRIS leaves lat/lng null on plenty of individual readings, so keying
        # off the most recent row silently deleted whole stations: Nadia
        # collapsed from 203 to 39 that way, and the loss is invisible because
        # what remains still looks like a plausible network.
        lat = lng = None
        for _, _, m in reversed(obs):
            if m.get("latitude") is not None and m.get("longitude") is not None:
                lat, lng = m.get("latitude"), m.get("longitude")
                break
        if lat is None or lng is None:
            continue
        depths = [v for _, v, _ in obs]
        # Monthly means, matching the shape the shared station panel consumes
        # (readings: {year, month, depth_m_bgl, n_obs}). Raw cadence here is a
        # mix of 6-hourly telemetric and periodic manual, which would otherwise
        # put 9,000 points behind one sparkline.
        monthly: dict[tuple[int, int], list[float]] = defaultdict(list)
        for d, v, _ in obs:
            monthly[(int(d[:4]), int(d[5:7]))].append(v)
        readings = [
            {
                "year": y,
                "month": mo,
                "depth_m_bgl": round(sum(vals) / len(vals), 2),
                "n_obs": len(vals),
            }
            for (y, mo), vals in sorted(monthly.items())
        ]
        stations.append(
            {
                "name": (meta.get("stationName") or "").strip() or code,
                "station_code": code,
                "block": meta.get("block"),
                "district": meta.get("district"),
                "tehsil": meta.get("tehsil"),
                "village": meta.get("village"),
                "lat": float(lat),
                "lng": float(lng),
                "acquisition": meta.get("dataAcquisitionMode"),
                "status": meta.get("stationStatus") or "Active",
                "well_type": meta.get("wellType"),
                "aquifer_type": meta.get("wellAquiferType"),
                "well_depth_m": meta.get("wellDepth"),
                "sign_convention": "negative-down (flipped)"
                if code in SIGN_FLIPPED
                else "positive-down",
                "readings": readings,
                "depth_min_m_bgl": round(min(depths), 2),
                "depth_max_m_bgl": round(max(depths), 2),
                "depth_latest_m_bgl": round(depths[-1], 2),
                "latest_reading": f"{obs[-1][0][:7]}",
                "first_reading": obs[0][0],
                "last_reading": obs[-1][0],
                "raw_observations": len(obs),
            }
        )
    stations.sort(key=lambda s: (s["district"] or "", s["name"]))
    return stations


def district_liveness(stations, today: str):
    """Per-district recency. Howrah and Hooghly have gone quiet, and saying so
    is a finding - it must not be smoothed away by a regional average."""
    out = []
    by_d = defaultdict(list)
    for s in stations:
        by_d[s["district"]].append(s)
    for d, sts in sorted(by_d.items()):
        last = max(s["last_reading"] for s in sts)
        days = (date.fromisoformat(today) - date.fromisoformat(last)).days
        out.append(
            {
                "district": d,
                "stations": len(sts),
                "readings": sum(s["raw_observations"] for s in sts),
                "last_reading": last,
                "days_since": days,
                # Quarterly-ish manual networks legitimately lag; a year of
                # silence is a dead feed, not a slow one.
                "status": "live"
                if days <= 120
                else ("lagging" if days <= 365 else "stale"),
            }
        )
    return out


# ---- Delhi / Hyderabad recipe (CITIES entries with `years`) ----------------

RAW_KEYS = (
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
# Minimum readings before a station may vote on its family's sign convention (~a year of monthly reads).
MIN_READINGS_FOR_FAMILY_VOTE = 12


def load_yearly_raw(city, cfg, refresh: bool) -> list[dict]:
    """Yearly windows per district, paged, cached as JSONL so re-runs skip the download."""
    cache = CACHE_DIR / f"{city}-wris-gwl.jsonl"
    if cache.exists() and not refresh:
        print(f"using cached raw rows: {cache.relative_to(REPO_ROOT)}")
        return [
            json.loads(line) for line in cache.read_text().splitlines() if line.strip()
        ]
    cache.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    with cache.open("w") as fh:
        for year in cfg["years"]:
            n = 0
            for d in cfg["districts"]:
                for p in range(20):
                    got = fetch(
                        cfg["state"], d, p, start=f"{year}-01-01", end=f"{year}-12-31"
                    )
                    for r in got:
                        if r.get("dataValue") is None:
                            continue
                        rec = {k: r.get(k) for k in RAW_KEYS}
                        rows.append(rec)
                        fh.write(json.dumps(rec) + "\n")
                    n += len(got)
                    if len(got) < 9000:
                        break
                time.sleep(0.4)
            print(f"  {year}: {n:7d} rows", flush=True)
    return rows


def build_by_median(rows, suspect, envelope):
    """Wells with the sign convention from each station's median reading; returns (wells, dropped)."""
    meta, by_station = {}, defaultdict(list)
    for r in rows:
        meta.setdefault(r["stationCode"], r)
        by_station[r["stationCode"]].append(r)

    # Known-faulty sensors get no vote: CGWBDL32's sign-flipped duplicates would read positive and trip the assert.
    convention, families, low_n = {}, defaultdict(Counter), []
    for code, rs in by_station.items():
        if code in suspect:
            continue
        vals = [r["dataValue"] for r in rs]
        median_raw = st.median(vals)
        convention[code] = "negative-down" if median_raw < 0 else "positive-down"
        # Family = leading letters of the code (CGWBDL, AAXI, CGWHYD), else the numeric NHN codes.
        m = re.match(r"^([A-Za-z]+)", code)
        fam = m.group(1).upper() if m else "numeric"
        # A handful of readings cannot establish what a family means (Telangana: one 2-reading well).
        if len(vals) < MIN_READINGS_FOR_FAMILY_VOTE:
            low_n.append((code, fam, len(vals), median_raw))
            continue
        families[fam][convention[code]] += 1

    print(
        f"sign convention by station-code family "
        f"(suspect excluded; {len(low_n)} stations with "
        f"<{MIN_READINGS_FOR_FAMILY_VOTE} readings excluded from the vote):"
    )
    for fam, counts in sorted(families.items()):
        print(f"  {fam:8s} {dict(counts)}")
        # Guard, not decoration: it caught Delhi's sign-faulty sensor and a mis-generalised classifier.
        assert len(counts) == 1, (
            f"family {fam} disagrees on sign convention: {dict(counts)}"
        )
    disagreeing = [
        x
        for x in low_n
        if families.get(x[1])
        and ("negative-down" if x[3] < 0 else "positive-down") not in families[x[1]]
    ]
    if disagreeing:
        print(
            f"  note: {len(disagreeing)} low-reading station(s) disagree with their "
            "family and keep their own derived convention:"
        )
        for code, fam, n, med in disagreeing[:10]:
            print(f"    {code} ({fam}, n={n}, median={med:.2f})")

    lo, hi = envelope
    monthly = defaultdict(list)
    dropped = Counter()
    for code, rs in by_station.items():
        if code in suspect:
            dropped["suspect_station"] += len(rs)
            continue
        flip = convention[code] == "negative-down"
        for r in rs:
            if abs(r["dataValue"]) in SENTINELS:
                dropped["sentinel_value"] += 1
                continue
            depth = -r["dataValue"] if flip else r["dataValue"]
            if not (lo <= depth <= hi):
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
            # CgwbStation reads `block`; the assessment unit here is the district (unit_label).
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
        if code in suspect:
            w["_data_status"] = "suspect"
            w["_data_status_reason"] = suspect[code]
        wells.append(w)
    return wells, dropped


def main_yearly(city, cfg, refresh: bool) -> int:
    rows = load_yearly_raw(city, cfg, refresh)
    print(f"raw readings: {len(rows):,}")
    wells, dropped = build_by_median(rows, cfg["suspect"], cfg["depth_envelope"])
    withr = [w for w in wells if w.get("readings")]
    depths = [r["depth_m_bgl"] for w in withr for r in w["readings"]]
    prose = cfg["doc"]
    doc = {
        "_note": prose["_note"],
        "district": prose["district"],
        "well_type": "Observation well / piezometer (manual + telemetric DWLR)",
        "aquifer": prose["aquifer"],
        "depth_unit": "m_bgl",
        "source_label": "Central Ground Water Board, via India-WRIS Ground Water Level dataset",
        "source_url": "https://indiawris.gov.in/wris/",
        # CgwbStationPanel: not a Year Book transcription, so provenance + cadence override the TN defaults.
        "series_label": "CGWB via India-WRIS",
        "unit_label": "district",
        "reading_kind": "monthly means",
        "cadence_note": prose["cadence_note"],
        "retrieved": prose["retrieved"] or date.today().isoformat(),
        "coverage": {
            "period": prose["period"],
            "cadence_raw": "6-hourly (telemetric) / periodic (manual)",
            "cadence_published_here": "monthly mean",
        },
        **prose["extra"],
        "_sign_convention": (
            "WRIS returns depth-to-water with a programme-dependent sign. Delhi has three "
            "station-code families: numeric NHN codes and AAXI* report positive-down, "
            "CGWBDL* reports negative-down. The convention is derived per station from the "
            "median of its own readings (family agreement asserted at build time), never by "
            "abs() - which would erase real water-above-datum readings in floodplain wells "
            "and would launder sign-faulty sensors into plausible data."
        ),
        "_excluded": {
            "suspect_stations": cfg["suspect"],
            "depth_envelope_m_bgl": cfg["depth_envelope"],
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
    path = DATA_DIR / f"{city}-cgwb-stations.json"
    write_artifact(path, doc)
    s = doc["summary"]
    print(f"\nwrote {path.relative_to(REPO_ROOT)}")
    print(f"  stations {s['stations']} ({s['stations_with_readings']} with readings)")
    print(f"  monthly readings {s['monthly_readings']:,}")
    print(
        f"  depth median {s['depth_median_m_bgl']} m, range {s['depth_min_m_bgl']}..{s['depth_max_m_bgl']} m"
    )
    print(f"  dropped {dict(dropped)}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="kolkata", choices=sorted(CITIES))
    ap.add_argument(
        "--kma", action="store_true", help="all KMA districts, not just the core"
    )
    ap.add_argument(
        "--refresh", action="store_true", help="re-download a cached (yearly) city"
    )
    args = ap.parse_args(argv)

    cfg = CITIES[args.city]
    if "years" in cfg:
        return main_yearly(args.city, cfg, args.refresh)
    districts = cfg["kma_districts"] if args.kma else cfg["core_districts"]
    print(
        f"India-WRIS CGWB: {cfg['state']} / {len(districts)} districts, {START}..{END}",
        file=sys.stderr,
    )

    rows = collect(cfg["state"], districts)
    if not rows:
        print(
            "no rows - check mandatory params (blank district returns zero)",
            file=sys.stderr,
        )
        return 1

    stations = build(rows)
    today = date.today().isoformat()
    liveness = district_liveness(stations, today)

    out = {
        "place_id": args.city,
        "generated_at": today,
        "source": "Central Ground Water Board, via the India-WRIS Ground Water Level API",
        "source_url": "https://indiawris.gov.in/wris/",
        "scope": "KMA (six districts)" if args.kma else "Kolkata district",
        "window": {"from": START, "to": END},
        "station_count": len(stations),
        "reading_count": sum(s["raw_observations"] for s in stations),
        "source_label": "CGWB observation wells via India-WRIS",
        "series_label": "Depth to water table",
        "unit_label": "m below ground level",
        "reading_kind": "monthly mean",
        "cadence_note": (
            "Raw cadence is a mix of 6-hourly telemetric and periodic manual readings; "
            "published here as monthly means."
        ),
        "depth_unit": "m",
        "retrieved": today,
        "coverage": {
            "period": f"{START[:4]} to {END[:4]}",
            "cadence_raw": "6-hourly (telemetric) / periodic (manual)",
            "cadence_published_here": "monthly mean",
        },
        "summary": {
            "stations": len(stations),
            "stations_with_readings": sum(1 for s in stations if s["readings"]),
            "monthly_readings": sum(len(s["readings"]) for s in stations),
            "depth_min_m_bgl": round(min(s["depth_min_m_bgl"] for s in stations), 2)
            if stations
            else None,
            "depth_max_m_bgl": round(max(s["depth_max_m_bgl"] for s in stations), 2)
            if stations
            else None,
        },
        "district_liveness": liveness,
        "notes": [
            "Kolkata is NOT groundwater-poor: 23 stations in the district and 667 across "
            "the six KMA districts, denser per area than Delhi's 237-well network.",
            "Districts marked stale have genuinely stopped reporting and are shown as such "
            "rather than interpolated over.",
            "A narrow date window or an unpaged request understates the network badly: "
            "Kolkata reads as 3 stations either way, against 23 when paged to exhaustion.",
        ],
        "wells": stations,
    }
    path = DATA_DIR / f"{args.city}-cgwb-stations.json"
    write_artifact(path, out, indent=1)
    live = [d for d in liveness if d["status"] == "live"]
    out["district"] = "Kolkata Metropolitan Area" if args.kma else "Kolkata"
    print(
        f"{args.city}: {len(stations)} stations, {out['reading_count']} readings, "
        f"{len(live)}/{len(liveness)} districts live -> {path.name}",
        file=sys.stderr,
    )
    for d in liveness:
        print(
            f"    {d['district']:22} {d['stations']:4} st  last {d['last_reading']}  {d['status']}",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
