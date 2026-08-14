#!/usr/bin/env python3
"""
WBPCB EMIS Water Quality Information System -> river-quality-kolkata.json

    http://emis.wbpcb.gov.in/waterquality/showwqprevdatachoosedist.do

The strongest Kolkata data find: a 12-year quarterly water-quality series, plain
HTTP, no login. Note the `/waterquality/` ROOT is a login page - the citizen
path is not. Same "do not generalise a block from a sibling path" lesson as
India-WRIS.

Three-step Struts flow, each step verified against the live server:
  1. POST showwqprevdata.do        viewdistcode + station_types -> station list
  2. POST viewsampledatacitizen.do viewstncode                  -> dated samples
  3. GET  wq/sampdetailReport.do   samp_id + stn_type            -> full analysis
A jsessionid cookie is carried across all three.

WHAT MAKES THIS UNIQUE ON THE PLATFORM: the Adi Ganga - the original course of
the Ganga, running through south Kolkata past Kalighat - is sampled at six
points, and each point is sampled SEPARATELY AT HIGH TIDE AND LOW TIDE. No
other city here has tidal station pairs, and they are the correct way to model
a tidal river: the same location can be a different water body six hours apart.
The pairing is carried through as `tidal_phase` rather than being flattened,
because averaging a high-tide and a low-tide sample would erase the signal.

THE FINDING: Adi Ganga at Bansdroni, 07/05/2026 - dissolved oxygen NIL, faecal
coliform 4,900,000 MPN/100ml, with WBPCB's own observers recording the water as
"Blackish" and "Pungent". Reproduced by this scraper on every run.

COORDINATES ARE OURS, NOT WBPCB'S. The board publishes no station coordinates,
so STATION_COORDS below is hand-placed from station names against the mapped
channel and is marked approximate in the output. Anything not in that map is
emitted without coordinates rather than guessed.

Run:
  python3 neer-vazhvu-api/scripts/scrape_wbpcb_emis.py                 # Kolkata + Palta
  python3 neer-vazhvu-api/scripts/scrape_wbpcb_emis.py --districts 013,001,002
  python3 neer-vazhvu-api/scripts/scrape_wbpcb_emis.py --max-samples 12
"""

import argparse
import http.cookiejar
import re
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

BASE = "http://emis.wbpcb.gov.in/waterquality"
SOURCE_URL = f"{BASE}/showwqprevdatachoosedist.do"

# Verified against the live portal 2026-07-26.
DISTRICTS = {
    "001": "24 Parganas(N)",
    "002": "24 Parganas(S)",
    "010": "Hooghly",
    "011": "Howrah",
    "013": "Kolkata",
    "018": "Nadia",
}
DEFAULT_DISTRICTS = ["013", "001"]  # Kolkata + the district holding Palta intake

# WBPCB publishes no coordinates. These are hand-placed from station names and
# marked approximate in the output. Absent stations get null coordinates rather
# than a guess.
STATION_COORDS = {
    # Adi Ganga, north to south down the channel through south Kolkata.
    "adi ganga at jirat bridge": (22.5218, 88.3430),
    "adi ganga at kalighat": (22.5186, 88.3426),
    "adi ganga at karunamoyee": (22.5083, 88.3480),
    "adi ganga at sahid kshudiram": (22.4795, 88.3667),
    "adi ganga at kudghat": (22.4832, 88.3560),
    "adi ganga at bansdroni": (22.4700, 88.3720),
    # Hooghly / Ganga mainstem.
    "ganga at dakshineswar": (22.6550, 88.3575),
    "ganga at garden reach": (22.5484, 88.2921),
    "ganga at palta": (22.7925, 88.3722),
    # Lakes sampled under the same programme.
    "rabindra sarobar": (22.5110, 88.3560),
    "subhas sarobar": (22.5690, 88.4030),
    "subhash sarobar": (22.5690, 88.4030),
}

PARAM_MAP = {
    "bod": "bod_mgl",
    "dissolved o2(do)": "do_mgl",
    "dissolved o2": "do_mgl",
    "fecal coliform": "fecal_coliform_mpn",
    "faecal coliform": "fecal_coliform_mpn",
    "total coliform": "total_coliform_mpn",
    "cod": "cod_mgl",
    "ph": "ph",
    "total suspended solids(tss)": "tss_mgl",
    "temperature(water)": "water_temp_c",
    "conductivity": "conductivity_us",
    "total dissolved solids(tds)": "tds_mgl",
    "nitrate": "nitrate_mgl",
}


def make_opener():
    cj = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    op.addheaders = [("User-Agent", "Mozilla/5.0 (neer-vazhvu civic water dashboard)")]
    return op


def post(op, path, data, retries=3):
    body = urllib.parse.urlencode(data).encode()
    for attempt in range(1, retries + 1):
        try:
            with op.open(f"{BASE}/{path}", body, timeout=60) as r:
                return r.read().decode("utf-8", errors="replace")
        except Exception:
            if attempt == retries:
                raise
            time.sleep(3 * attempt)
    return ""


def get(op, url, retries=2, timeout=25):
    for attempt in range(1, retries + 1):
        try:
            with op.open(url, timeout=timeout) as r:
                return r.read().decode("utf-8", errors="replace")
        except Exception:
            if attempt == retries:
                raise
            time.sleep(2)
    return ""


def strip_tags(html: str) -> list[str]:
    t = re.sub(r"<[^>]+>", "|", html)
    t = t.replace("&nbsp;", " ").replace("&amp;", "&")
    return [c.strip() for c in t.split("|") if c.strip()]


def parse_stations(html: str) -> list[dict]:
    """Options look like: 'River-Adi Ganga at Bansdroni (High Tide)(Kolkata)'."""
    out = []
    for code, label in re.findall(r'<option[^>]*value="([^"]+)"[^>]*>([^<]*)', html):
        label = label.strip()
        if not code or not label:
            continue
        kind, _, rest = label.partition("-")
        rest = re.sub(
            r"\((?:Kolkata|[^)]*Parganas[^)]*|Hooghly|Howrah|Nadia)\)\s*$", "", rest
        ).strip()
        phase = None
        m = re.search(r"\((High|Low) Tide\)", rest, re.I)
        if m:
            phase = m.group(1).lower()
            rest = re.sub(r"\s*\((High|Low) Tide\)", "", rest, flags=re.I).strip()
        out.append(
            {
                "code": code,
                "name": rest,
                "kind": kind.strip(),
                "tidal_phase": phase,
            }
        )
    return out


def parse_sample_list(html: str) -> list[dict]:
    ids = re.findall(r"samp_id=([A-Za-z0-9\-]+)", html)
    dates = re.findall(r"(\d{2}/\d{2}/\d{4})", html)
    return [{"samp_id": i, "date": d} for i, d in zip(ids, dates)]


def parse_detail(html: str) -> dict:
    cells = strip_tags(html)
    out: dict = {"observations": {}, "values": {}}

    def after(label):
        for i, c in enumerate(cells):
            if c.lower().startswith(label.lower()):
                return cells[i + 1] if i + 1 < len(cells) else None
        return None

    for key, label in [
        ("river_basin", "River Basin:"),
        ("sample_date", "Sample Date:"),
        ("sample_time", "Sample Time:"),
        ("weather", "Weather:"),
        ("water_body", "Water Body:"),
        ("frequency", "Frequency Of Monitoring:"),
        ("use_based_class", "Use Based Class:"),
        ("depth", "Approximate Depth"),
        ("colour", "Color & Intensity:"),
        ("odour", "Odour:"),
        ("effluent_discharge", "Visible effluent discharge:"),
        ("human_activities", "Human Activities:"),
    ]:
        v = after(label)
        if v and not v.endswith(":"):
            out["observations"][key] = v

    # The results table is a flat run of (parameter, value, unit) triples.
    try:
        start = next(i for i, c in enumerate(cells) if c.lower() == "unit") + 1
    except StopIteration:
        return out
    i = start
    while i + 2 < len(cells) + 1:
        if i + 1 >= len(cells):
            break
        name, raw = cells[i].lower(), cells[i + 1]
        field = PARAM_MAP.get(name)
        if field:
            # "NIL" is a real measurement - zero dissolved oxygen - not a gap.
            # Storing it as null would erase the single most important reading
            # in this dataset.
            out["values"][field] = 0.0 if raw.strip().upper() == "NIL" else to_num(raw)
        i += 3
    return out


def to_num(s: str):
    try:
        return float(re.sub(r"[^\d.\-]", "", s))
    except (ValueError, TypeError):
        return None


def normalise(name: str) -> str:
    """WBPCB's station names are inconsistent within one district: shouty
    ('RABINDRASAROVAR NATIONAL LAKE, CALCUTTA, WES'), suffixed with a state or
    an old city name, truncated by the portal's own column width, and carrying
    at least one upstream typo ('Dakshmineswar' for Dakshineswar). Normalise
    before any coordinate lookup, or every lookup silently misses."""
    n = name.lower()
    n = re.sub(r",\s*(west beng\w*|calcutta|kolkata)\b", "", n)
    n = n.replace("dakshmineswar", "dakshineswar")
    n = re.sub(r"\brabindrasarovar\b", "rabindra sarobar", n)
    n = re.sub(r"\bsubhas sarovar\b", "subhas sarobar", n)
    n = re.sub(r"\s*national lake\b", "", n)
    n = re.sub(r"[,\s]+$", "", n)
    return re.sub(r"\s+", " ", n).strip()


# WBPCB spells the same station inconsistently ACROSS ITS OWN STATION LIST:
# "Adi Ganga at Kalighat" (low tide, code 00112) and "Adi ganga at Kalighat"
# (high tide, code 01313) are the same point. Left alone, three of the six
# tidal pairs split into six separate single-phase stations, destroying exactly
# the high-vs-low comparison this dataset is uniquely able to support.
CANONICAL = [
    (re.compile(r"\badi\s+ganga\b", re.I), "Adi Ganga"),
    (re.compile(r"\bganga\b(?!\s*at)", re.I), "Ganga"),
]


def display_name(name: str) -> str:
    """Title-case the shouty ones; leave already-mixed-case names alone."""
    # The portal truncates long names mid-word, so a trailing ", WES" or
    # ", WEST BENGA" is common - match the prefix, not the full word.
    cleaned = re.sub(
        r",\s*(W(E(S(T)?)?)?(\s*BENG\w*)?|CALCUTTA|KOLKATA)\s*$", "", name, flags=re.I
    )
    cleaned = re.sub(
        r",\s*(WEST BENG\w*|CALCUTTA|KOLKATA)\b", "", cleaned, flags=re.I
    ).strip(" ,")
    cleaned = re.sub(r"\s+NATIONAL LAKE\b", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\bRABINDRASAROVAR\b", "Rabindra Sarobar", cleaned, flags=re.I)
    cleaned = re.sub(r"\bSUBHAS(H)? SAROVAR\b", "Subhas Sarobar", cleaned, flags=re.I)
    if cleaned.isupper():
        cleaned = cleaned.title()
        # Title-case turns "GANGA AT GARDEN REACH" into "Ganga At Garden
        # Reach"; put the small words back down.
        cleaned = re.sub(
            r"\b(At|Of|In|On|The|And)\b", lambda m: m.group(1).lower(), cleaned
        )
    cleaned = re.sub(r"\s+", " ", cleaned).replace("Dakshmineswar", "Dakshineswar")
    for pat, canon in CANONICAL:
        cleaned = pat.sub(canon, cleaned)
    return cleaned


# Position along the channel, used as the station's `stretch` label. WBPCB
# publishes no such descriptor, so these are ours, derived from where each
# sampling point physically sits - north to south down the Adi Ganga, and by
# role on the Hooghly (the intake matters more than its coordinates).
STRETCH = {
    "adi ganga at jirat bridge": "Upper",
    "adi ganga at kalighat": "Upper",
    "adi ganga at karunamoyee": "Middle",
    "adi ganga at kudghat": "Middle",
    "adi ganga at sahid kshudiram": "Lower",
    "adi ganga at bansdroni": "Lower",
    "ganga at palta": "Intake (Palta)",
    "ganga at dakshineswar": "Upstream of the city",
    "ganga at garden reach": "Downstream of the city",
}


# Narrative fields the shared river panel renders (length, class, description).
# Length is measured off our own dissolved OSM geometry, not asserted.
RIVER_META = {
    "adi-ganga": {
        "length_km": 39,
        "cpcb_class": "Not on the CPCB national polluted-stretch list; WBPCB Use-Based Class E",
        "description": (
            "The original course of the Ganga through south Kolkata, past Kalighat, now largely "
            "the engineered channel also called Tolly's Nullah. Sampled at six points, each "
            "separately at high and low tide."
        ),
        "notes": (
            "Dissolved oxygen is NIL at every monitored point in the latest round and low tide "
            "runs worse than high - less dilution, more concentration."
        ),
    },
    "hooghly": {
        "length_km": 140,
        "cpcb_class": "WBPCB Use-Based Class B/C at the city's intakes",
        "description": (
            "The Ganga distributary Kolkata was built on and draws essentially all its drinking "
            "water from, abstracted at Palta about 22 km north and at Garden Reach. Tidal this "
            "far inland."
        ),
        "notes": "Comparatively healthy at the intakes; the pollution story is the Adi Ganga, not the mainstem.",
    },
    "bidyadhari": {
        "length_km": 38,
        "cpcb_class": None,
        "description": "Drains the East Kolkata Wetlands eastward towards the Sundarbans.",
        "notes": "Its silting up in the early twentieth century created the wetland fishery system that now treats 910 MLD of Kolkata's sewage.",
    },
    "lakes": {
        "length_km": None,
        "cpcb_class": None,
        "description": "Lakes and ponds sampled under the same WBPCB programme.",
        "notes": None,
    },
    "groundwater": {
        "length_km": None,
        "cpcb_class": None,
        "description": "WBPCB groundwater monitoring points, sampled under the same programme.",
        "notes": "Groundwater samples carry no DO or BOD - a different parameter set from the river stations.",
    },
    "other": {
        "length_km": None,
        "cpcb_class": None,
        "description": None,
        "notes": None,
    },
}


def river_of(station_name: str) -> tuple[str, str]:
    n = station_name.lower()
    if "adi ganga" in n:
        return "adi-ganga", "Adi Ganga"
    if "ganga" in n or "hooghly" in n or "hugli" in n:
        return "hooghly", "Hooghly (Ganga)"
    if "sarobar" in n or "sarovar" in n or "lake" in n:
        return "lakes", "Lakes"
    return "other", "Other monitored waters"


def run(districts, max_samples, sleep_s):
    op = make_opener()
    stations, samples_by_station = [], {}

    for dcode in districts:
        html = post(
            op, "showwqprevdata.do", {"viewdistcode": dcode, "station_types": "R"}
        )
        st = parse_stations(html)
        for s in st:
            s["district"] = DISTRICTS.get(dcode, dcode)
            s["district_code"] = dcode
        stations.extend(st)
        print(
            f"  district {dcode} ({DISTRICTS.get(dcode)}): {len(st)} stations",
            file=sys.stderr,
        )
        time.sleep(sleep_s)

    total_details = 0
    for s in stations:
        html = post(op, "viewsampledatacitizen.do", {"viewstncode": s["code"]})
        lst = parse_sample_list(html)
        if max_samples:
            lst = lst[:max_samples]
        samples_by_station[s["code"]] = []
        time.sleep(sleep_s)
        for smp in lst:
            url = f"{BASE}/wq/sampdetailReport.do?samp_id={smp['samp_id']}&stn_type=R"
            try:
                det = parse_detail(get(op, url))
            except Exception as exc:
                print(f"    ! {smp['samp_id']}: {exc}", file=sys.stderr)
                continue
            det["date"] = smp["date"]
            det["samp_id"] = smp["samp_id"]
            samples_by_station[s["code"]].append(det)
            total_details += 1
            time.sleep(sleep_s)
        print(
            f"  {s['code']} {s['name'][:44]:44} {len(samples_by_station[s['code']]):3} samples",
            file=sys.stderr,
        )
    return stations, samples_by_station, total_details


def build(stations, samples_by_station):
    by_river = defaultdict(list)
    for s in stations:
        # Route by the portal's OWN kind label ("River-", "Ground Water-",
        # "Lake-"). Guessing from the station name put groundwater wells in
        # with rivers, which would have quietly mixed two different parameter
        # sets - groundwater samples carry no DO or BOD at all.
        k = (s.get("kind") or "").lower()
        if "ground" in k:
            rid, rname = "groundwater", "Groundwater monitoring"
        elif "lake" in k or "pond" in k:
            rid, rname = "lakes", "Lakes and ponds"
        else:
            rid, rname = river_of(s["name"])
        readings = []
        for det in samples_by_station.get(s["code"], []):
            d = det["date"]
            year = int(d.split("/")[-1]) if "/" in d else None
            row = {"date": iso(d), "year": year, **det["values"]}
            for k in ("colour", "odour", "use_based_class", "weather"):
                if k in det["observations"]:
                    row[k] = det["observations"][k]
            readings.append(row)
        readings.sort(key=lambda r: r["date"] or "", reverse=True)
        coords = STATION_COORDS.get(normalise(s["name"]))
        by_river[(rid, rname)].append(
            {
                "id": s["code"],
                "name": display_name(s["name"]),
                "stretch": STRETCH.get(normalise(s["name"])),
                "tidal_phase": s["tidal_phase"],
                "district": s["district"],
                "lat": coords[0] if coords else None,
                "lng": coords[1] if coords else None,
                "coords_approximate": bool(coords),
                "readings": readings,
            }
        )

    rivers = []
    for (rid, rname), sts in sorted(by_river.items()):
        sts.sort(key=lambda x: (x["name"], x["tidal_phase"] or ""))
        # The map layer dereferences station.lat, so only placeable stations go
        # in `stations`. WBPCB publishes no coordinates and we refuse to invent
        # them, but the readings are still real - unplaceable stations are kept
        # in `unmapped_stations` so the data survives and the omission is
        # visible, rather than being silently dropped or crashing the panel.
        mapped = [x for x in sts if x["lat"] is not None and x["lng"] is not None]
        unmapped = [x for x in sts if x["lat"] is None or x["lng"] is None]
        rivers.append(
            {
                "id": rid,
                "name": rname,
                **{k: v for k, v in RIVER_META.get(rid, {}).items()},
                "overall_status": None,  # computed by the shared classifier
                "stations": mapped,
                "unmapped_stations": unmapped,
                "unmapped_note": (
                    f"{len(unmapped)} station(s) have readings but no coordinates: WBPCB "
                    "publishes none and we do not guess. Their series are retained here."
                )
                if unmapped
                else None,
                "tidal": any(x["tidal_phase"] for x in mapped),
            }
        )
    return rivers


def iso(d: str):
    if not d or "/" not in d:
        return None
    dd, mm, yy = d.split("/")
    return f"{yy}-{mm}-{dd}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--districts", default=",".join(DEFAULT_DISTRICTS))
    ap.add_argument("--max-samples", type=int, default=0, help="0 = all")
    ap.add_argument("--sleep", type=float, default=0.4)
    ap.add_argument("--out", default=str(DATA_DIR / "river-quality-kolkata.json"))
    args = ap.parse_args()

    districts = [d.strip() for d in args.districts.split(",") if d.strip()]
    print(f"WBPCB EMIS: districts {districts}", file=sys.stderr)
    stations, samples, n = run(districts, args.max_samples, args.sleep)
    if not stations:
        print("no stations parsed - portal layout may have changed", file=sys.stderr)
        return 1

    rivers = build(stations, samples)
    years = [
        r["year"]
        for rv in rivers
        for s in rv["stations"]
        for r in s["readings"]
        if r.get("year")
    ]
    out = {
        "last_updated": date.today().isoformat(),
        "data_year_range": [min(years), max(years)] if years else None,
        "source": "West Bengal Pollution Control Board, EMIS Water Quality Information System",
        "source_url": SOURCE_URL,
        "source_label": "WBPCB EMIS (citizen path, no login)",
        "notes": (
            "The Adi Ganga is sampled at six points, each SEPARATELY at high tide and low "
            "tide - the only tidal station pairing on this platform. High- and low-tide "
            "readings are kept apart rather than averaged, because the same location is a "
            "different water body six hours apart. 'NIL' dissolved oxygen is stored as 0.0: "
            "it is a real measurement, not a missing value."
        ),
        "coords_note": (
            "WBPCB publishes no station coordinates. Positions are hand-placed from station "
            "names against the mapped channel and flagged coords_approximate; stations we "
            "could not place carry null coordinates rather than a guess."
        ),
        "station_count": len(stations),
        "sample_count": n,
        "rivers": rivers,
    }
    write_artifact(Path(args.out), out, indent=1)
    print(
        f"WBPCB: {len(stations)} stations, {n} samples, "
        f"{out['data_year_range']} -> {Path(args.out).name}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
