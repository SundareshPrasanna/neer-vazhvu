#!/usr/bin/env python3
"""
CGWB groundwater observation wells from the India-WRIS Ground Water Level API.

City-generic (the Delhi build has its own script with Delhi-specific sentinel
and sign-convention handling; new cities use this one).

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

Run:
  python3 neer-vazhvu-api/scripts/build_cgwb_stations.py --city kolkata
  python3 neer-vazhvu-api/scripts/build_cgwb_stations.py --city kolkata --kma
"""

import argparse
import json
import ssl
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
# Every producer writing under public/ goes through the envelope-preserving
# writer: a scheduled rewrite must not strip the NVDM envelope it finds.
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402

DATA_DIR = REPO_ROOT / "public" / "data"

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


def fetch(state, district, page, size=9000, tries=4):
    q = urllib.parse.urlencode(
        {
            "stateName": state,
            "districtName": district,
            "agencyName": "CGWB",
            "startdate": START,
            "enddate": END,
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
        vals = [v for _, v, _ in obs]
        neg = sum(1 for v in vals if v < 0)
        # A station is on the negative convention when its readings are
        # overwhelmingly negative. Mixed-sign stations are left as-is and their
        # out-of-range values fall away below.
        flip = neg > 0.9 * len(vals)
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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="kolkata", choices=sorted(CITIES))
    ap.add_argument(
        "--kma", action="store_true", help="all KMA districts, not just the core"
    )
    args = ap.parse_args()

    cfg = CITIES[args.city]
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
