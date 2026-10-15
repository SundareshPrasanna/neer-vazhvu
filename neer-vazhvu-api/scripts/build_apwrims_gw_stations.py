#!/usr/bin/env python3
"""
Groundwater wells for an Andhra Pradesh city's groundwater map, as monthly
mean depth below ground, from the state's two public groundwater feeds:

  1. APWRIMS, the Water Resources Department portal (no login, JSON):
       - station list with coordinates: iot/api/groundwater/lastknown/aggregated
       - the Ground Water Department's older recorders (APGW piezometers,
         mostly from September 2022): daily archive api/v2/gw/gwReport
       - the recorder network installed from December 2025: daily
         iot/api/groundwater/timeseries
  2. The AP Ground Water Department's MANUAL monthly record (2002 onward) on
     the NWIC National Water Data Portal, resource 7df4b96d.
  3. Two checks, never published as readings: the same department's
     TELEMETRY on NWDP (resources b57798f7, 0e97a298), which names the older
     recorders independently, and the Water Resources Department's mandal
     boundaries on the APWRIMS GeoServer (layer AP_MANDAL_V3).

City-generic: a city is an entry in CITIES - which APWRIMS districts to list,
which NWDP district tags to ask for, which assessment-unit polygons to keep
wells in, and which mandal layer names them.

PLACED BY COORDINATES, NEVER BY TAG. A well is kept only if its coordinates
fall inside one of the city's IN-GRES unit polygons (recorded as
`ingres_unit`). Its `block` is the AP mandal the coordinates fall in, because
IN-GRES's urban units do not follow the state's mandal lines (in
Visakhapatnam the unit IN-GRES calls Mulagada covers most of Pedagantyada
mandal). The feed's own mandal tag is kept beside both. A pair of same-site
series always carries one `block` and one `ingres_unit`, the recorder's, whose
position is precise.

APWRIMS TRAPS, all found on the Visakhapatnam pull of 14 Oct 2026:
  - ONE UUID, TWO NAMES. The station list and the archive's station summary
    disagree on names (150752fb is "Arilova" in one and "Endadu_gw" in the
    other), and NWDP's telemetry, matched reading for reading, names the
    older recorders a third way. Wells are keyed on uuid; the list's name,
    which travels with the coordinates, is displayed and every name is
    recorded. A recorder whose names disagree is flagged `name_conflict`,
    carries an `identity_note`, and is never paired with a manual well; if
    NWDP also places it outside the units, it is left out.
  - AN UNKNOWN ID RETURNS THE WHOLE STATE. gwReport given a station id it
    does not know silently returns all ~420 stations (112 MB). Only ids from
    the archive's own station summary are ever sent, and a reply carrying
    more than one station is refused.
  - CARRIED-FORWARD AND INTERPOLATED DAYS. The archive repeats one value for
    months (195 days at Visalakshinagar in 2026) and fills gaps with straight
    lines of up to 30 days. Runs of identical values and runs of constant
    daily slope are dropped, keeping the run's first (real) reading.
  - SPIKES of 909, 476, 254 and 153 m. The physical envelope removes the
    first three; the rolling-median spike rule removes the last.

Every reading also passes the platform's shared rules
(app/scrapers/well_levels.py): placeholders, sign from the station's own
median, the physical envelope, spikes and stuck sensors. Rejected counts are
recorded per well, never dropped silently.

WHAT IS PUBLISHED IS A DERIVED AGGREGATE: per well, identity, position, unit,
and monthly means of depth below ground. Recorder months need at least five
good days. The manual record is one reading a month and is published as read.

The manual wells and the recorders are partly the same sites (the 2025-26
recorders were installed at the manual network's wells), but they stay
separate series: one is a monthly hand reading, the other a recorder mean,
and splicing them would hide the change of method. Pairs are recorded in
`same_site_as`. A manual well whose published position falls outside the
units, but whose name and one coordinate match a recorder's, is placed at
that recorder (the feed carries typing errors such as 83.84 for 83.34).

Run:  python3 neer-vazhvu-api/scripts/build_apwrims_gw_stations.py --city visakhapatnam
      (--cache DIR keeps raw replies for reruns while developing)
"""

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from statistics import StatisticsError, correlation, mean, median

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
sys.path.insert(0, str(REPO_ROOT / "neer-vazhvu-api"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402
from app.scrapers.well_levels import (  # noqa: E402
    SPIKE_M,
    WIMS_PLACEHOLDERS,
    keep_mask,
    spike_mask,
    stuck_days,
)

SENSOR_API = "https://apwrims2.0.vassarlabs.com/iot/api/groundwater/"
PROJ_API = "https://apwrims.ap.gov.in/api/"
NWDP_API = "https://nwdp.nwic.gov.in/api/3/action/datastore_search"
MANDAL_WFS = "https://geo.vassarlabs.com/geoserver/APWRIMS/ows"
TEL_LEVEL = "Groundwater Level Telemetry 6 Hourly (meter)"
TEL_FIELDS = ["Station", "Tehsil", "Latitude", "Longitude", "Data Acquisition Time"]
# APWRIMS's own Andhra Pradesh uuid (a different namespace from IN-GRES's).
AP_UUID = "6f86292b-dd9a-4987-bb8f-c3940263b349"
IST = timezone(timedelta(hours=5, minutes=30))
UA = "Mozilla/5.0 (neer-vazhvu water-data platform)"
PAUSE_S = 1.5

CARRY_RUN = 3  # identical values on this many consecutive readings: carried forward
INTERP_RUN = 4  # constant daily slope on this many consecutive steps: interpolated
INTERP_TOL_M = 0.0005
MIN_DAYS = 5  # good days a recorder month needs to be published
MANUAL_SPIKE_WINDOW = 3  # months either side for the manual record's spike rule
PAIR_KM = 1.5  # the manual record's coordinates are rounded to 0.01-0.001 degree
TYPO_DEG = 0.01  # a misplaced manual well still matches its recorder on one axis
# The same instrument in two feeds agrees within half a metre on average,
# month after month (Visakhapatnam 2022-26: 0.06-0.28 m). Two different wells
# still correlate at r 0.7-0.9 because they share the monsoon, and over six
# months even 0.99, so agreement with a nearby manual well is no identity test.
TEL_MIN_MONTHS, TEL_MIN_R, TEL_MAX_M = 12, 0.95, 0.5
# A sustained fault the rolling spike rule cannot see: BHPV's recorder read
# 37.64 m for weeks among 7.64 m readings. No well here swings 20 m in a year
# (Endada's 12 m is the widest), so a reading that far from the well's own
# median is a fault, not water.
OFFSET_M = 20.0

CITIES = {
    "visakhapatnam": {
        "district_label": "Visakhapatnam",
        "out": "public/data/visakhapatnam-cgwb-stations.json",
        "units": "public/geojson/visakhapatnam-gwr-blocks.geojson",
        "unit_label": "mandal",
        "mandals": {
            "layer": "APWRIMS:AP_MANDAL_V3",
            "districts": ["Visakhapatnam", "Anakapalli"],
        },
        # Station lists are asked for both districts of the old Visakhapatnam;
        # placement, not the tag, decides what is kept.
        "apwrims_districts": {
            "Visakhapatnam": "64aef6ac-4417-4d10-a82d-c2e14c59e25c",
            "Anakapalli": "c8d81113-a191-43e5-93ce-4ff724937cb3",
        },
        "archive_from": 2016,
        "recorder_from": "20251101",
        "nwdp_resource": "7df4b96d-3af5-4b16-b714-74ff6426ff5f",
        "nwdp_district_tags": ["Visakhapatnam", "Anakapalli"],
        # 2021-2025 and 2026-2030; tagged by the pre-2022 district.
        "nwdp_telemetry": [
            "b57798f7-9a87-423f-9b99-c7d15eacc902",
            "0e97a298-62b4-444c-81d6-599264010ebd",
        ],
        "nwdp_telemetry_districts": ["VISAKHAPATNAM"],
        "apwrims_source_id": "apwrims-groundwater",
        "nwdp_source_id": "nwic-nwdp-groundwater-andhra",
    },
}


def _fetch(url: str, body: dict | None, cache: Path | None, key: str):
    """GET or POST JSON, sequentially and politely, with an optional raw cache."""
    hit = cache / f"{hashlib.sha1(key.encode()).hexdigest()}.json" if cache else None
    if hit and hit.exists():
        return json.loads(hit.read_text())
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", "User-Agent": UA},
        method="POST" if body is not None else "GET",
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                raw = r.read()
            break
        except Exception as exc:
            if attempt == 2:
                raise
            print(f"  retry {attempt + 1}: {exc}", file=sys.stderr)
            time.sleep(5 * (attempt + 1))
    time.sleep(PAUSE_S)
    if hit:
        hit.write_bytes(raw)
    return json.loads(raw)


def _in_ring(x: float, y: float, ring: list) -> bool:
    inside = False
    for i in range(len(ring) - 1):
        x1, y1 = ring[i][:2]
        x2, y2 = ring[i + 1][:2]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def unit_of(lon: float, lat: float, units: list) -> str | None:
    for name, polys in units:
        for poly in polys:
            if _in_ring(lon, lat, poly[0]) and not any(
                _in_ring(lon, lat, h) for h in poly[1:]
            ):
                return name
    return None


def ap_mandals(cfg: dict, cache: Path | None) -> list:
    """The Water Resources Department's own mandal boundaries, which name a
    well's mandal (the IN-GRES units only decide which wells are kept)."""
    m = cfg["mandals"]
    cql = "new_d_name IN (" + ",".join(f"'{d}'" for d in m["districts"]) + ")"
    url = (
        f"{MANDAL_WFS}?service=WFS&version=1.0.0&request=GetFeature"
        f"&typeName={m['layer']}&outputFormat=application/json"
        "&propertyName=new_m_name,new_d_name,geom&CQL_FILTER=" + urllib.parse.quote(cql)
    )
    fc = _fetch(url, None, cache, f"mandals {m['layer']} {cql}")
    return [
        (f["properties"]["new_m_name"], f["geometry"]["coordinates"])
        for f in fc["features"]
        if (f.get("geometry") or {}).get("type") == "MultiPolygon"
    ]


def _km(a: tuple, b: tuple) -> float:
    (la1, lo1), (la2, lo2) = a, b
    h = (
        sin(radians(la2 - la1) / 2) ** 2
        + cos(radians(la1)) * cos(radians(la2)) * sin(radians(lo2 - lo1) / 2) ** 2
    )
    return 12742 * asin(sqrt(h))


def _place_key(name: str) -> str:
    """'Vishalakshinagar' == 'Visalakshinagar', 'Yendada' == 'Endada', 'T.Devada' == 'Devada'."""
    s = re.sub(r"^[a-z]\.\s*", "", name.lower())
    s = re.sub(r"[^a-z]", "", s).replace("h", "")
    s = re.sub(r"(.)\1", r"\1", s)
    return s[1:] if s.startswith("y") else s


def place_name(raw: str) -> str:
    """'Visakhapatnam (Steel Plant)(GW)' -> 'Steel Plant'; 'Bhimili_gw' -> 'Bhimili'."""
    s = re.sub(r"(?:\s*\(GW\)|[\s_-]+GW)$", "", raw.strip(), flags=re.I)
    m = re.match(r"^Visakhapatnam\s*\((.+)\)$", s)
    s = m.group(1) if m else re.sub(r"\s*\([^)]*\)$", "", s) or s
    # The station list spells it "YSR Prak"; the manual record "YSR Park".
    return s.replace("YSR Prak", "YSR Park").strip()


def carried_forward(pts: list[tuple[date, float]]) -> list[bool]:
    """False for repeats in a run of CARRY_RUN+ identical consecutive values."""
    keep = [True] * len(pts)
    i = 0
    while i < len(pts):
        j = i
        while j + 1 < len(pts) and pts[j + 1][1] == pts[i][1]:
            j += 1
        if j - i + 1 >= CARRY_RUN:
            for k in range(i + 1, j + 1):
                keep[k] = False
        i = j + 1
    return keep


def interpolated(pts: list[tuple[date, float]]) -> list[bool]:
    """False for the interior of a run of INTERP_RUN+ equal daily steps."""
    keep = [True] * len(pts)
    steps = [
        (pts[i + 1][1] - pts[i][1]) if (pts[i + 1][0] - pts[i][0]).days == 1 else None
        for i in range(len(pts) - 1)
    ]
    i = 0
    while i < len(steps):
        if steps[i] is None or abs(steps[i]) < INTERP_TOL_M:
            i += 1
            continue
        j = i
        while (
            j + 1 < len(steps)
            and steps[j + 1] is not None
            and abs(steps[j + 1] - steps[i]) <= INTERP_TOL_M
        ):
            j += 1
        if j - i + 1 >= INTERP_RUN:
            for k in range(i + 1, j + 1):
                keep[k] = False
        i = j + 1
    return keep


def plausible(series: dict[date, float], rej: Counter) -> list[tuple[date, float]]:
    """Shared rules (placeholders, envelope, sign from the median), then OFFSET_M."""
    days = sorted(series)
    values = [series[d] for d in days]
    ok = keep_mask(values, WIMS_PLACEHOLDERS)
    rej["placeholder_or_envelope"] = ok.count(False)
    pts = [(d, v) for d, v, k in zip(days, values, ok) if k]
    if not pts:
        return pts
    sign = -1.0 if median(v for _, v in pts) < 0 else 1.0
    mid = sign * median(v for _, v in pts)
    keep = [(d, sign * v) for d, v in pts if abs(sign * v - mid) <= OFFSET_M]
    rej["offset_from_median"] = len(pts) - len(keep)
    return keep


def clean_daily(series: dict[date, float]) -> tuple[list[dict], Counter]:
    """Daily recorder values -> monthly means, after every quality rule."""
    rej: Counter = Counter()
    pts = plausible(series, rej)
    for rule, mask in (
        ("carried_forward", carried_forward),
        ("interpolated", interpolated),
    ):
        m = mask(pts)
        rej[rule] = m.count(False)
        pts = [p for p, k in zip(pts, m) if k]
    if pts:
        m = spike_mask([d for d, _ in pts], [v for _, v in pts])
        rej["spike"] = m.count(False)
        pts = [p for p, k in zip(pts, m) if k]
    stuck = stuck_days(dict(pts))
    rej["stuck"] = len(stuck)
    monthly: dict[tuple, list] = defaultdict(list)
    for d, v in pts:
        if d not in stuck:
            monthly[(d.year, d.month)].append(v)
    readings = []
    for (y, mo), vs in sorted(monthly.items()):
        if len(vs) < MIN_DAYS:
            rej["thin_month_days"] += len(vs)
            continue
        readings.append(
            {
                "year": y,
                "month": mo,
                "depth_m_bgl": round(mean(vs), 2),
                "n_obs": len(vs),
            }
        )
    return readings, rej


def clean_manual(series: dict[date, float]) -> tuple[list[dict], Counter]:
    """The manual monthly record: one reading a month, published as read."""
    rej: Counter = Counter()
    pts = plausible(series, rej)
    # spike_mask's 15-day window holds a single monthly reading, so the same
    # departure is tested against the neighbouring months instead.
    w = MANUAL_SPIKE_WINDOW
    keep = [
        abs(v - median(x for _, x in pts[max(0, i - w) : i + w + 1])) <= SPIKE_M
        for i, (_, v) in enumerate(pts)
    ]
    rej["spike"] = keep.count(False)
    readings = [
        {"year": d.year, "month": d.month, "depth_m_bgl": round(v, 2), "n_obs": 1}
        for (d, v), k in zip(pts, keep)
        if k
    ]
    return readings, rej


def apwrims_wells(cfg: dict, units: list, cache: Path | None):
    now = int(time.time() * 1000)
    listed: dict[str, dict] = {}
    for tag, district_uuid in cfg["apwrims_districts"].items():
        rows = _fetch(
            SENSOR_API + "lastknown/aggregated",
            {
                "pEUUID": AP_UUID,
                "pUUID": district_uuid,
                "pType": "DISTRICT",
                "cType": "GROUNDWATER",
                "src": "MERGED_DWLR",
                "format": "HOURLY",
                "sDate": str(now - 30 * 86_400_000),
                "eDate": str(now),
                "aggr": "LATEST",
                "includeAllLoc": True,
            },
            cache,
            f"lastknown {district_uuid}",
        )
        for r in rows:
            if (r.get("name") or "").upper() != "TOTAL" and r.get("uuid"):
                listed[r["uuid"]] = r
        print(f"  APWRIMS {tag}: {len(rows)} listed", file=sys.stderr)
    summary = _fetch(
        PROJ_API + "groundwater/dwlr/stations", None, cache, "dwlr summary"
    )
    archive_ids = {s["locationUuid"]: s for s in summary["stations"]}

    wells, excluded, outside = [], [], 0
    today = date.today()
    for uid, r in sorted(listed.items(), key=lambda kv: kv[1]["name"]):
        lat, lng = r.get("lat"), r.get("lng")
        block = unit_of(lng, lat, units) if lat and lng else None
        if block is None:
            outside += 1
            continue
        names = [r["name"]]
        series: dict[date, float] = {}
        if r.get("src") == "SENSOR_DATA":
            body = {
                "pEUUID": AP_UUID,
                "pUUID": uid,
                "pType": "GROUNDWATER",
                "cType": "GROUNDWATER",
                "src": "SENSOR_DATA",
                "format": "DAILY",
                "sDate": cfg["recorder_from"],
                "eDate": today.strftime("%Y%m%d"),
                "aggr": "LATEST",
                "includeAllLoc": True,
            }
            ts = _fetch(
                SENSOR_API + "timeseries", body, cache, f"ts {uid} {body['eDate']}"
            )
            for k, v in ts.items():
                gw = (v or {}).get("GW") or {}
                level = gw.get("averageLevel", gw.get("cl"))
                if isinstance(level, (int, float)):
                    series[datetime.fromtimestamp(int(k) / 1000, IST).date()] = level
            network, kind = "APWRIMS recorder (installed 2025-26)", "recorder"
        elif uid in archive_ids:
            if archive_ids[uid]["locationName"] not in names:
                names.append(archive_ids[uid]["locationName"])
            for year in [None, *range(cfg["archive_from"] + 5, today.year + 1)]:
                s, e = (
                    (f"{cfg['archive_from']}0101", f"{cfg['archive_from'] + 4}1231")
                    if year is None
                    else (f"{year}0101", f"{year}1231")
                )
                body = {
                    "lType": "GROUNDWATER",
                    "src": "DWLR",
                    "view": "ADMIN",
                    "aggr": ["LATEST"],
                    "reportType": "Station Wise Timeseries",
                    "sDate": s,
                    "eDate": e,
                    "calendarFormat": "yyyyMMdd",
                    "STATE": [AP_UUID],
                    "sUUID": AP_UUID,
                    "DISTRICT": [],
                    "MANDAL": [],
                    "BASIN": [],
                    "SUBBASIN": [],
                    "STATION": [uid],
                    "filtertype": "DAILY",
                }
                rep = _fetch(
                    PROJ_API + "v2/gw/gwReport", body, cache, f"gwr {uid} {s} {e}"
                )
                if len(rep) > 1:
                    raise RuntimeError(
                        f"gwReport returned {len(rep)} stations for {uid}; refusing"
                    )
                for got, rec in rep.items():
                    if got not in names:
                        names.append(got)
                    for k, v in ((rec or {}).get("LATEST") or {}).items():
                        level = (v or {}).get("currentLevel")
                        if isinstance(level, (int, float)):
                            series[datetime.strptime(k, "%Y%m%d").date()] = level
            network, kind = "APWRIMS piezometer recorder", "piezometer"
        else:
            excluded.append(
                {
                    "feed": "apwrims",
                    "name": r["name"],
                    "reason": "no archive for this id",
                }
            )
            continue
        readings, rej = clean_daily(series)
        if not readings:
            excluded.append(
                {
                    "feed": "apwrims",
                    "name": r["name"],
                    "reason": "no month passed the rules",
                }
            )
            continue
        wells.append(
            {
                "name": place_name(r["name"]),
                "station_code": f"apwrims:{uid}",
                "lat": round(lat, 5),
                "lng": round(lng, 5),
                "block": block,
                "network": network,
                "kind": kind,
                "source_names": names,
                "sensor": r.get("sensorName")
                or (archive_ids.get(uid) or {}).get("externalId"),
                "feed_mandal": r.get("mnm"),
                "feed_district": r.get("dt"),
                **(
                    {"archive_mandal": f"{arch['mandalName']}, {arch['districtName']}"}
                    if (arch := archive_ids.get(uid)) and arch.get("mandalName")
                    else {}
                ),
                "acquisition": "telemetry",
                "readings": readings,
                "raw_observations": len(series),
                "rejected": {k: v for k, v in sorted(rej.items()) if v},
            }
        )
    return wells, excluded, outside


def _monthly(w: dict) -> dict:
    return {(r["year"], r["month"]): r["depth_m_bgl"] for r in w["readings"]}


def _agreement(
    a: dict, b: dict
) -> tuple[int, float | None, float | None, float | None]:
    """Months in common; r, median and mean absolute difference of a - b."""
    both = sorted(set(a) & set(b))
    if not both:
        return 0, None, None, None
    d = [a[k] - b[k] for k in both]
    try:
        r = correlation([a[k] for k in both], [b[k] for k in both])
    except StatisticsError:
        r = None
    return len(both), r, median(d), mean(abs(x) for x in d)


def nwdp_telemetry(cfg: dict, cache: Path | None) -> list[dict]:
    """The AP Ground Water Department's telemetry on NWDP as monthly median
    depth per station, after plausible(): the older APWRIMS recorders under
    NWDP's own names (it also carries readings of 159 and 659 m)."""
    obs: dict[str, dict] = defaultdict(dict)
    meta: dict[str, dict] = {}
    for rid in cfg["nwdp_telemetry"]:
        for tag in cfg["nwdp_telemetry_districts"]:
            offset = 0
            while True:
                params = {
                    "resource_id": rid,
                    "filters": json.dumps({"District": tag}),
                    "fields": ",".join([*TEL_FIELDS, TEL_LEVEL]),
                    "limit": 32000,
                    "offset": offset,
                }
                res = _fetch(
                    NWDP_API + "?" + urllib.parse.urlencode(params),
                    None,
                    cache,
                    f"nwdp telemetry {rid} {tag} {offset}",
                )["result"]
                for r in res["records"]:
                    try:
                        t = datetime.strptime(
                            r["Data Acquisition Time"], "%d-%m-%Y %H:%M"
                        )
                        v = float(r[TEL_LEVEL])
                    except (KeyError, TypeError, ValueError):
                        continue
                    obs[r["Station"]][t] = v
                    meta.setdefault(r["Station"], r)
                print(
                    f"  NWDP telemetry {rid[:8]} @{offset}: {len(res['records'])} rows",
                    file=sys.stderr,
                )
                if len(res["records"]) < 32000:
                    break
                offset += 32000
    stations = []
    for name, series in obs.items():
        months: dict[tuple, dict] = defaultdict(dict)
        for t, v in plausible(series, Counter()):
            months[(t.year, t.month)][t] = v
        m = meta[name]
        stations.append(
            {
                "name": re.sub(r"\s+", " ", name).strip(),
                "tehsil": None if m.get("Tehsil") in (None, "-") else m["Tehsil"],
                "lat": _num(m.get("Latitude")),
                "lng": _num(m.get("Longitude")),
                "monthly": {
                    k: median(vs.values())
                    for k, vs in months.items()
                    if len({t.day for t in vs}) >= MIN_DAYS
                },
            }
        )
    return stations


def check_identities(wells: list[dict], stations: list[dict], units: list) -> list:
    """Name each recorder as NWDP does, by matching readings, then flag a
    recorder whose names disagree. One that NWDP also places outside the
    units is removed from `wells` and returned as excluded."""
    excluded = []
    for w in [w for w in wells if w["kind"] != "manual"]:
        mine = _monthly(w)
        best = None
        for s in stations:
            n, r, diff, mad = _agreement(mine, s["monthly"])
            if (
                n >= TEL_MIN_MONTHS
                and r is not None
                and r >= TEL_MIN_R
                and mad <= TEL_MAX_M
                and (best is None or r > best[1])
            ):
                best = (s, r, n, diff)
        names = list(w["source_names"])
        if best:
            s, r, n, diff = best
            names.append(s["name"])
            where = f", {s['tehsil'].title()}" if s["tehsil"] else ""
            w["source_names"].append(f"{s['name']} (NWDP telemetry{where})")
            w["nwdp_telemetry_match"] = {
                "station": s["name"],
                "tehsil": s["tehsil"],
                "lat": s["lat"],
                "lng": s["lng"],
                "months_compared": n,
                "r": round(r, 3),
                "median_difference_m": round(diff, 2),
            }
        shown: dict[str, str] = {}
        for x in names:
            x = " ".join(t[:1].upper() + t[1:] for t in place_name(x).split())
            shown.setdefault(_place_key(x)[:5], x)
        if len(shown) < 2:
            continue
        w["name_conflict"] = True
        w["identity_note"] = (
            "Station identity unresolved: the published station lists give this "
            f"recorder different names ({', '.join(shown.values())}), so the site "
            "it is shown at is not certain."
        )
        if (
            best
            and best[0]["lat"]
            and unit_of(best[0]["lng"], best[0]["lat"], units) is None
        ):
            wells.remove(w)
            excluded.append(
                {
                    "feed": "apwrims",
                    "name": w["name"],
                    "station_code": w["station_code"],
                    "source_names": w["source_names"],
                    "reason": (
                        "identity unresolved"
                        + (
                            f": the APWRIMS archive lists it in {w['archive_mandal']},"
                            if w.get("archive_mandal")
                            else ","
                        )
                        + " and the National Water Data Portal places its readings "
                        f"at {best[0]['name']}{where} ({best[0]['lat']}, "
                        f"{best[0]['lng']}), outside the district"
                    ),
                }
            )
    return excluded


def _typo_recorder(names: list, lat, lng, recorders: list[dict]) -> dict | None:
    """The one recorder sharing a manual well's name and at least one of its
    coordinates (to TYPO_DEG), for a well published outside every unit."""
    keys = {_place_key(n)[:5] for n in names if n}
    hits = [
        rec
        for rec in recorders
        if not rec.get("name_conflict")
        and _place_key(rec["name"])[:5] in keys
        and (
            (lat is not None and abs(lat - rec["lat"]) <= TYPO_DEG)
            or (lng is not None and abs(lng - rec["lng"]) <= TYPO_DEG)
        )
    ]
    return hits[0] if len(hits) == 1 else None


def nwdp_wells(cfg: dict, units: list, cache: Path | None, recorders: list[dict]):
    rows: list[dict] = []
    for tag in cfg["nwdp_district_tags"]:
        offset = 0
        while True:
            params = {
                "resource_id": cfg["nwdp_resource"],
                "filters": json.dumps({"District Name (as per LGD)": tag}),
                "limit": 32000,
                "offset": offset,
            }
            res = _fetch(
                NWDP_API + "?" + urllib.parse.urlencode(params),
                None,
                cache,
                f"nwdp {tag} {offset}",
            )["result"]
            rows.extend(res["records"])
            print(
                f"  NWDP {tag} @{offset}: {len(res['records'])} rows", file=sys.stderr
            )
            if len(res["records"]) < 32000:
                break
            offset += 32000
    by_well: dict[str, dict] = {}
    for r in rows:
        try:
            day = datetime.strptime(r["Date"], "%d-%m-%Y").date()
            value = float(r["Water Level"])
        except (KeyError, TypeError, ValueError):
            continue
        w = by_well.setdefault(r["Well ID"], {"row": r, "obs": {}})
        w["obs"][day] = value

    wells, excluded = [], []
    for wid, w in sorted(by_well.items()):
        r = w["row"]
        village = re.sub(
            r"\s+", " ", r.get("Village (as per LGD, if available)") or ""
        ).strip()
        place = place_name(village) or r["Site Name"]
        try:
            lat, lng = float(r["Latitude"]), float(r["Longitude"])
        except (TypeError, ValueError):
            lat = lng = None
        block = unit_of(lng, lat, units) if lat and lng else None
        position_note = "published to 0.01-0.001 degree, so placed to about 1 km"
        published = None
        if block is None:
            rec = _typo_recorder([place, r["Site Name"]], lat, lng, recorders)
            if rec is None:
                excluded.append(
                    {
                        "feed": "nwdp",
                        "name": f"{place} ({r['Site Name']})",
                        "well_id": wid,
                        "published_position": [lat, lng],
                        "reason": "published position is outside every unit",
                    }
                )
                continue
            km = _km((lat, lng), (rec["lat"], rec["lng"]))
            published = [lat, lng]
            position_note = (
                f"published position {lat}, {lng} falls outside the district, "
                + (
                    f"{km:.1f} km from the recorder at the same site"
                    if km <= PAIR_KM
                    else "but matches the recorder at the same site on one coordinate"
                )
                + ", so the well is placed at that recorder"
            )
            lat, lng, block = rec["lat"], rec["lng"], rec["block"]
        readings, rej = clean_manual(w["obs"])
        if not readings:
            continue
        wells.append(
            {
                "name": place.strip(),
                "station_code": f"apgwd-manual:{wid}",
                "lat": lat,
                "lng": lng,
                **({"published_position": published} if published else {}),
                "block": block,
                "network": "AP Ground Water Department manual monthly record",
                "kind": "manual",
                "source_names": [r["Site Name"], village],
                "well_id": wid,
                "well_type": r.get(
                    "Well Type (Dug Well, Bore Well, Tube Well, Handpump, Spring)"
                ),
                "well_depth_m": _num(r.get("Well Depth, m")),
                "aquifer": r.get(
                    "Aquifer Tapped (Unconfined, Semi-Confined, Confined)"
                ),
                "feed_mandal": re.sub(
                    r"\s+", " ", r.get("Block Name (as per LGD)") or ""
                ),
                "feed_district": r.get("District Name (as per LGD)"),
                "acquisition": "manual",
                "position_note": position_note,
                "readings": readings,
                "raw_observations": len(w["obs"]),
                "rejected": {k: v for k, v in sorted(rej.items()) if v},
            }
        )
    return wells, excluded, len(rows)


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def pair_sites(wells: list[dict]) -> int:
    """Record which manual well and which recorder stand at the same site (a
    shared name within PAIR_KM), and how far apart their readings sit over the months
    both have. The difference describes the pair; it does not prove identity
    (see TEL_MIN_R), so a recorder flagged name_conflict is never paired. The
    manual well takes the recorder's block and IN-GRES unit, so one site reads
    one mandal and one unit, and its position_note says so."""
    manual = [w for w in wells if w["kind"] == "manual"]
    pairs = 0
    for rec in (w for w in wells if w["kind"] != "manual"):
        if rec.get("name_conflict"):
            continue
        key = _place_key(rec["name"])[:5]
        for m in manual:
            if (
                key not in {_place_key(n)[:5] for n in [m["name"], *m["source_names"]]}
                or _km((rec["lat"], rec["lng"]), (m["lat"], m["lng"])) > PAIR_KM
            ):
                continue
            n, _, diff, mad = _agreement(_monthly(rec), _monthly(m))
            for x, y, sign in ((rec, m, 1), (m, rec, -1)):
                x.setdefault("same_site_as", []).append(
                    {
                        "station_code": y["station_code"],
                        "months_compared": n,
                        "median_difference_m": None
                        if n == 0
                        else sign * round(diff, 2),
                        "mean_abs_difference_m": None if n == 0 else round(mad, 2),
                    }
                )
            moved = [k for k in ("block", "ingres_unit") if m[k] != rec[k]]
            for k in moved:
                print(f"  {m['name']}: {k} {m[k]} -> {rec[k]}", file=sys.stderr)
                m[k] = rec[k]
            same = (
                "; its mandal and IN-GRES unit are those of the recorder at the "
                "same site, whose position is precise"
            )
            if moved and same not in m["position_note"]:
                m["position_note"] += same
            pairs += 1
    return pairs


SUFFIX = {"recorder": "recorder", "piezometer": "recorder", "manual": "manual"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", required=True, choices=sorted(CITIES))
    ap.add_argument("--cache", type=Path, default=None)
    args = ap.parse_args()
    cfg = CITIES[args.city]
    if args.cache:
        args.cache.mkdir(parents=True, exist_ok=True)

    fc = json.loads((REPO_ROOT / cfg["units"]).read_text())
    units = [
        (
            f["properties"]["block"],
            [f["geometry"]["coordinates"]]
            if f["geometry"]["type"] == "Polygon"
            else f["geometry"]["coordinates"],
        )
        for f in fc["features"]
    ]
    a_wells, a_excl, a_outside = apwrims_wells(cfg, units, args.cache)
    dropped = check_identities(a_wells, nwdp_telemetry(cfg, args.cache), units)
    n_wells, n_excl, n_rows = nwdp_wells(cfg, units, args.cache, a_wells)
    wells = a_wells + n_wells
    if not wells:
        print("no wells placed - check the unit polygons", file=sys.stderr)
        return 1
    mandals = ap_mandals(cfg, args.cache)
    for w in wells:
        w["ingres_unit"] = w["block"]
        w["block"] = unit_of(w["lng"], w["lat"], mandals) or w["block"]
    pairs = pair_sites(wells)
    place_of = {w["station_code"]: (w["block"], w["ingres_unit"]) for w in wells}
    assert all(
        place_of[s["station_code"]] == (w["block"], w["ingres_unit"])
        for w in wells
        for s in w.get("same_site_as", [])
    ), "a same-site pair straddles two mandals or two IN-GRES units"
    first_manual = min(r["year"] for w in n_wells for r in w["readings"])
    unresolved = sum(1 for w in a_wells if w.get("name_conflict"))
    retyped = sum(1 for w in n_wells if "published_position" in w)
    caveats = (
        f" {retyped} manual wells whose published position falls outside the "
        "district are placed at their same-site recorder."
        if retyped
        else ""
    ) + (
        f" {unresolved} recorders carry different names in different station "
        "lists; they are flagged (identity_note) and not paired"
        + (
            f", and {len(dropped)} more that NWDP places outside the district "
            + ("is" if len(dropped) == 1 else "are")
            + " left out."
            if dropped
            else "."
        )
        if unresolved
        else ""
    )
    for w in wells:
        w["name"] = f"{w['name']} ({SUFFIX[w.pop('kind')]})"
        latest = w["readings"][-1]
        w["depth_latest_m_bgl"] = latest["depth_m_bgl"]
        w["latest_reading"] = f"{latest['year']}-{latest['month']:02d}"
    dupes = Counter(w["name"] for w in wells)
    for w in wells:
        if dupes[w["name"]] > 1:
            w["name"] = f"{w['name'][:-1]}, {w['station_code'].split(':')[1][:8]})"
    wells.sort(key=lambda w: (w["block"], w["name"]))
    assert len({w["name"] for w in wells}) == len(wells)

    reading_count = sum(len(w["readings"]) for w in wells)
    first = min((r["year"], r["month"]) for w in wells for r in w["readings"])
    last = max((r["year"], r["month"]) for w in wells for r in w["readings"])
    produced = date.today().isoformat()
    label = cfg["district_label"]
    out = {
        "nvdm": "1.0",
        "dataset": "data-root/cgwb-stations",
        "scope": {"kind": "city", "id": args.city},
        "provenance": {
            "sources": [
                {
                    "id": cfg["apwrims_source_id"],
                    "title": (
                        f"APWRIMS groundwater recorders, {label}: station list, daily "
                        "piezometer archive and the 2025-26 recorder network; mandal "
                        f"boundaries from the APWRIMS GeoServer ({cfg['mandals']['layer']})"
                    ),
                    "publisher": (
                        "Water Resources Department, Government of Andhra Pradesh (APWRIMS)"
                    ),
                    "license": registry_license(cfg["apwrims_source_id"]),
                },
                {
                    "id": cfg["nwdp_source_id"],
                    "title": (
                        "Andhra Pradesh Ground Water Department manual monthly water "
                        "levels 2002-2026 (NWDP resource 7df4b96d), and its telemetry "
                        "2021-2030 (resources b57798f7, 0e97a298), used only to check "
                        "which recorder is which"
                    ),
                    "publisher": (
                        "National Water Informatics Centre, Ministry of Jal Shakti "
                        "(National Water Data Portal)"
                    ),
                    "license": registry_license(cfg["nwdp_source_id"]),
                },
            ],
            "method": "api",
            "produced_at": produced,
            "produced_by": "neer-vazhvu-api/scripts/build_apwrims_gw_stations.py",
            "note": (
                "Monthly mean depth below ground per well after the shared quality "
                "rules and the APWRIMS carried-forward, interpolation and spike rules. "
                "Wells are kept by coordinates in the IN-GRES unit polygons and named "
                "by the AP Water Resources Department mandal their coordinates fall "
                "in, never by tag; recorders are matched to NWDP telemetry by reading."
            ),
            "internal_inputs": [cfg["units"]],
            "conventions": {
                "sign": (
                    "depth_m_bgl is positive below ground; each feed's sign is taken "
                    "from the well's own median, never abs()"
                ),
                "aggregation": (
                    f"recorders: monthly mean of daily values, months with fewer than "
                    f"{MIN_DAYS} good days left out; manual: one reading a month as read"
                ),
                "comparability": (
                    "a recorder and a manual well at the same site are different "
                    "methods and are not spliced (see same_site_as)"
                ),
            },
        },
        "district": label,
        "well_type": "Piezometers: daily recorders (APWRIMS) and manual monthly readings (AP Ground Water Department)",
        "aquifer": (
            "Mostly unconfined, as the manual record tags its wells; "
            "we have not found an aquifer tag for the recorders"
        ),
        "depth_unit": "metres below ground level (monthly mean)",
        "series_label": "AP Ground Water Dept.",
        "reading_kind": "monthly readings",
        "unit_label": cfg["unit_label"],
        "cadence_note": (
            "Wells marked 'recorder' are read automatically every day and shown as "
            "monthly means of at least five good days. Wells marked 'manual' are read "
            f"by hand once a month, the oldest from {first_manual}; readings from 2015 "
            f"and earlier are history. At {pairs} sites a recorder and a manual well "
            "stand together, kept as separate series."
        ),
        "quality_note": (
            "Repeated values carried forward by the portal, straight-line gap fills, "
            "spikes, readings more than 20 m from a well's usual level and stuck "
            "sensors are removed before averaging."
        ),
        "source_label": (
            "Andhra Pradesh Water Resources Department (APWRIMS) and AP Ground Water "
            "Department via the National Water Data Portal (NWIC)"
        ),
        "source_url": "https://apwrims.ap.gov.in/",
        "retrieved": produced,
        # Payload, not envelope: write_artifact keeps an existing envelope
        # (ext included) over a fresh one, so counts that must refresh live here.
        "_note": (
            f"Point wells, not an interpolated surface: {len(wells)} wells inside the "
            f"{len(units)} IN-GRES {cfg['unit_label']}s, {len(a_wells)} daily recorders "
            f"and {len(n_wells)} manual wells, {reading_count} monthly readings from "
            f"{first[0]}-{first[1]:02d} to {last[0]}-{last[1]:02d}. Readings from 2015 "
            f"and earlier are history. {pairs} recorder and manual pairs stand at the "
            f"same site and are kept as separate series.{caveats}"
        ),
        "_methodology": {
            "placement": (
                f"kept by coordinates in {cfg['units']} (ingres_unit); block is the "
                f"mandal of {cfg['mandals']['layer']} the coordinates fall in; a "
                "manual well at a recorder's site takes the recorder's block and "
                "ingres_unit"
            ),
            "apwrims_listed_outside_units": a_outside,
            "nwdp_rows_fetched": n_rows,
            "rules": {
                "placeholders": sorted(WIMS_PLACEHOLDERS),
                "envelope_and_sign": "app/scrapers/well_levels.py keep_mask",
                "carried_forward_run": CARRY_RUN,
                "interpolated_run_days": INTERP_RUN,
                "interpolated_step_tolerance_m": INTERP_TOL_M,
                "spike_departure_m": SPIKE_M,
                "offset_from_well_median_m": OFFSET_M,
                "manual_spike_window_months": MANUAL_SPIKE_WINDOW,
                "stuck": "app/scrapers/well_levels.py stuck_days",
                "min_good_days_per_recorder_month": MIN_DAYS,
                "same_site_km": PAIR_KM,
                "misplaced_manual_one_coordinate_deg": TYPO_DEG,
                "nwdp_telemetry_match": {
                    "min_months": TEL_MIN_MONTHS,
                    "min_r": TEL_MIN_R,
                    "max_mean_abs_difference_m": TEL_MAX_M,
                },
            },
        },
        "_excluded": a_excl + dropped + n_excl,
        "wells": wells,
    }
    path = REPO_ROOT / cfg["out"]
    write_artifact(path, out, compact=True)

    print(
        f"{args.city}: {len(wells)} wells ({len(a_wells)} recorder, {len(n_wells)} "
        f"manual), {reading_count} monthly readings, {first} to {last}, "
        f"{pairs} same-site pairs, {len(a_excl) + len(dropped) + len(n_excl)} excluded "
        f"-> {path.name}",
        file=sys.stderr,
    )
    for w in wells:
        print(
            f"  {w['block']:20} {w['name'][:40]:40} {len(w['readings']):4d} months "
            f"to {w['latest_reading']}  latest {w['depth_latest_m_bgl']:6.2f} m  "
            f"rejected {w['rejected']}",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
