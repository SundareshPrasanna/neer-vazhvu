#!/usr/bin/env python3
"""
CPCB NWMP river water quality -> public/data/river-quality-hyderabad.json

Source: CPCB National Water Quality Monitoring Programme annual river data,
https://cpcb.gov.in/nwmp-data/ , editions 2019-2024 (2012-2025 exist).

WHY THIS REPLACES THE TGPCB EXTRACTION
The first version of this file came from OCR'ing TGPCB's scanned NGT return,
taken on the belief that CPCB was IP-blocked. That was wrong: cpcb.nic.in is a
dead host but CPCB serves everything on cpcb.gov.in, and these PDFs carry a TEXT
LAYER - no OCR needed. CPCB is also broader (15 Musi-context stations against
TGPCB's 4) and deeper (annual editions rather than one quarter).

WHAT CHANGES IN THE DATA MODEL
CPCB publishes an annual MIN-MAX per parameter per station, not monthly point
values. So a reading here is a RANGE for a year, and the file records it as
such rather than inventing a midpoint. The TGPCB monthly points are retained in
the river notes as a cross-check, including the one place the two sources
disagree.

UNITS: CPCB labels conductivity "umhos/cm" (= uS/cm), which also settles the
ambiguity in the TGPCB annexure, where the same magnitudes were printed under
"mS/cm". We follow CPCB.

Column order in the tables, verified against the printed header:
  Temperature, Dissolved Oxygen, pH, Conductivity, BOD, Nitrate,
  Fecal Coliform, Total Coliform, Fecal Streptococci -- each as MIN then MAX.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "data" / "river-quality-hyderabad.json"
CACHE = Path("/tmp/audit/cpcb2")
YEARS = [2019, 2020, 2021, 2022, 2023, 2024]
PDF_URL = "https://cpcb.gov.in/wqm/{y}/WQuality_River-Data-{y}.pdf"

# Musi-system stations we publish, with the coordinates we can source honestly.
# Anything without a coordinate is still parsed and kept, just not plotted.
STATIONS: dict[str, dict] = {
    "2339": {"name": "River Musi at Nagole", "lat": 17.37753, "lng": 78.56012,
             "stretch": "Through the city", "river": "musi"},
    "1173": {"name": "Musi d/s at Pratapasingaram", "lat": None, "lng": None,
             "stretch": "Downstream of the city", "river": "musi"},
    "3082": {"name": "River Musi at Solipet (Kasaniguda), Nalgonda", "lat": None, "lng": None,
             "stretch": "Downstream recovery reach", "river": "musi"},
    "4656": {"name": "River Musi at Moosarambagh Bridge, Hyderabad", "lat": None, "lng": None,
             "stretch": "City centre", "river": "musi"},
    "4657": {"name": "River Musi at Pillaipalli, Rangareddy", "lat": None, "lng": None,
             "stretch": "Downstream of the city", "river": "musi"},
    "4658": {"name": "River Musi at Valigonda Bridge, Nalgonda", "lat": None, "lng": None,
             "stretch": "Lower reach", "river": "musi"},
    "4659": {"name": "Musi at outlet of Nalla Cheruvu, Peerajadiguda", "lat": None, "lng": None,
             "stretch": "Tank outlet, east of the city", "river": "musi"},
    "4660": {"name": "River Musi at Peerajadiguda, Ranga Reddy", "lat": None, "lng": None,
             "stretch": "East of the city", "river": "musi"},
    "1465": {"name": "River Krishna at Wadapally", "lat": 16.6943, "lng": 79.66149,
             "stretch": "Below the Musi confluence", "river": "krishna"},
    "2374": {"name": "Manjeera u/s at Gowdicharla, before Nakkavagu", "lat": None, "lng": None,
             "stretch": "Above the Nakkavagu confluence", "river": "manjira"},
    "2375": {"name": "Manjeera d/s at Gowdicherla, after Nakkavagu", "lat": None, "lng": None,
             "stretch": "Below the Nakkavagu confluence", "river": "manjira"},
}

ROW = re.compile(r"^\s*(\d{2,5})\s+(.*?)\s+(TELANGANA|ANDHRA[A-Z ]*)\s+([\d.\sA-Za-z-]+)$")
NUM = re.compile(r"^-?\d+(?:\.\d+)?$")


def fetch(year: int) -> Path | None:
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / f"river{year}.pdf"
    if p.exists() and p.stat().st_size > 10000:
        return p
    try:
        req = urllib.request.Request(PDF_URL.format(y=year),
                                     headers={"User-Agent": "NeerVazhvu/1.0 (contact@neervazhvu.org)"})
        with urllib.request.urlopen(req, timeout=240) as r:
            if r.status != 200:
                return None
            p.write_bytes(r.read())
        return p
    except Exception as e:
        print(f"  {year}: fetch failed {e}", file=sys.stderr)
        return None


def parse(pdf: Path, year: int) -> dict[str, dict]:
    txt = subprocess.run(["pdftotext", "-layout", str(pdf), "-"],
                         stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout.decode("utf-8", "replace")
    if len(txt.strip()) < 500:
        print(f"  {year}: NO TEXT LAYER - refusing to guess", file=sys.stderr)
        return {}
    out: dict[str, dict] = {}
    lines = txt.splitlines()
    for i, line in enumerate(lines):
        m = ROW.match(line)
        if not m:
            continue
        code = m.group(1)
        if code not in STATIONS:
            continue
        toks = [t for t in m.group(4).split() if NUM.match(t) or t.upper() in ("BDL", "-")]
        vals = [None if (t.upper() in ("BDL", "-")) else float(t) for t in toks]
        if len(vals) < 10:
            continue

        def rng(i0: int):
            if len(vals) <= i0 + 1:
                return None
            lo, hi = vals[i0], vals[i0 + 1]
            if lo is None and hi is None:
                return None
            return {"min": lo, "max": hi}

        out[code] = {
            "year": year,
            "temperature_c": rng(0),
            "do_mgl": rng(2),
            "ph": rng(4),
            "conductivity_umhos": rng(6),
            "bod_mgl": rng(8),
            "nitrate_mgl": rng(10),
            "fecal_coliform_mpn": rng(12),
            "total_coliform_mpn": rng(14),
            "fecal_streptococci_mpn": rng(16),
        }
    return out


def main() -> int:
    per_year: dict[int, dict[str, dict]] = {}
    for y in YEARS:
        p = fetch(y)
        if not p:
            continue
        got = parse(p, y)
        per_year[y] = got
        print(f"  {y}: {len(got)} of {len(STATIONS)} tracked stations", file=sys.stderr)

    if not per_year:
        print("FATAL: no editions parsed", file=sys.stderr)
        return 1

    rivers: dict[str, dict] = {
        "musi": {"id": "musi", "name": "Musi", "name_te": "మూసీ నది",
                 "length_km": 244, "cpcb_class": "Priority-I",
                 "overall_status": "CPCB Priority-I polluted river stretch (Hyderabad to Nalgonda)",
                 "description": "", "notes": "", "stations": []},
        "manjira": {"id": "manjira", "name": "Manjira", "name_te": "మంజీరా నది",
                    "length_km": 174, "cpcb_class": "Priority-II",
                    "overall_status": "CPCB Priority-II polluted stretch (Gowdicherla to Nakkavagu), merged with the Nakkavagu action plan",
                    "description": "", "notes": "", "stations": []},
        "krishna": {"id": "krishna", "name": "Krishna at Wadapally", "name_te": "కృష్ణా నది",
                    "length_km": None, "cpcb_class": None,
                    "overall_status": "Receiving river below the Musi confluence",
                    "description": "", "notes": "", "stations": []},
    }

    for code, meta in STATIONS.items():
        readings = [per_year[y][code] for y in sorted(per_year) if code in per_year[y]]
        if not readings:
            continue
        rivers[meta["river"]]["stations"].append({
            "id": f"nwmp-{code}",
            "nwmp_code": code,
            "name": meta["name"],
            "lat": meta["lat"],
            "lng": meta["lng"],
            "stretch": f'{meta["stretch"]} (NWMP {code})',
            "readings": readings,
        })

    plotted = sum(1 for r in rivers.values() for s in r["stations"] if s["lat"] is not None)
    total_st = sum(len(r["stations"]) for r in rivers.values())

    rivers["musi"]["description"] = (
        "The Musi enters the city with oxygen and leaves without it. Across CPCB's own annual monitoring "
        "the through-city and downstream stations sit at dissolved-oxygen minima below 1 mg/L while BOD "
        "maxima run into double figures, and the river recovers only well downstream. The starkest reading "
        "is not on the mainstem at all: station 4659, at the outlet of Nalla Cheruvu, recorded dissolved "
        "oxygen of 0.0 in 2022 - no oxygen at either end of the year's range."
    )
    rivers["manjira"]["description"] = (
        "A Hyderabad supply corridor rather than an urban river: the Manjira carries the Singur and Manjira "
        "reservoirs, two of HMWSSB's six sources. The two monitored stations deliberately bracket the "
        "Nakkavagu confluence, so the pair reads as a before-and-after on that tributary."
    )
    rivers["krishna"]["description"] = (
        "The river the Musi joins, and the receiving water for everything the Musi carries out of Hyderabad. "
        "Akkampally, one of HMWSSB's six daily sources, draws from the Krishna system."
    )

    payload = {
        "last_updated": time.strftime("%Y-%m-%d"),
        "data_year_range": f"{min(per_year)}-{max(per_year)}",
        "source": "CPCB National Water Quality Monitoring Programme (NWMP), annual river water quality data",
        "source_url": "https://cpcb.gov.in/nwmp-data/",
        "source_label": "CPCB NWMP annual river data, editions "
                        + ", ".join(str(y) for y in sorted(per_year)),
        "_reading_shape": (
            "CPCB publishes an annual MIN-MAX per parameter per station, not monthly point values. Each "
            "reading here is therefore a range for that year, recorded as {min, max}. No midpoint is "
            "invented. BDL (below detectable limit) and blank cells become null rather than zero."
        ),
        "_units": (
            "Conductivity is umhos/cm (= uS/cm) as CPCB labels it. This also settles an ambiguity in the "
            "TGPCB annexure this file previously drew on, where the same magnitudes were printed under "
            "'mS/cm'; CPCB's label is the consistent one."
        ),
        "_provenance": (
            "Parsed from the text layer of CPCB's annual PDFs - no OCR. An earlier version of this file was "
            "OCR'd from TGPCB's scanned NGT return on the mistaken belief that CPCB was IP-blocked; in fact "
            "cpcb.nic.in is a dead host and CPCB serves everything on cpcb.gov.in. Station coordinates are "
            "NOT published by CPCB: the two carried here come from OSM/Nominatim (Nagole) and our own water- "
            "sources table cross-checked against Nominatim (Wadapally). The rest are parsed and published "
            f"without coordinates rather than placed by guesswork - {plotted} of {total_st} stations plot."
        ),
        "_reporting_floor_caveat": (
            "READ LOW DO VALUES AS A FLOOR, NOT A MEASUREMENT. In 9 of 51 station-years the annual MINIMUM "
            "dissolved oxygen equals the annual MAXIMUM, which cannot describe a real 12-month range - and 7 "
            "of those 9 sit at exactly 0.3 mg/L (the others at 0.0 and 0.1). The same 0.3 recurs across "
            "different stations and different years, and it is also the value TGPCB printed for all three "
            "months at two stations. The consistent reading is that 0.3 is a reporting or detection floor in "
            "this programme rather than an instrument reading. Treat 'DO 0.3' as 'at or below the floor', "
            "which is why this site says the Musi is anoxic through the city rather than quoting 0.3 as a "
            "measured concentration."
        ),
        "_cross_check_tgpcb": (
            "Checked against TGPCB's Jan-Mar 2022 monthly figures (Annexure-VIII of its NGT OA 606 of 2018 "
            "return), which this file previously carried. The monthly values fall inside CPCB's 2022 annual "
            "range at Kasaniguda 3082 and Krishna Wadapally 1465. They do NOT at the two anoxic stations: "
            "TGPCB reported DO 0.3 at Nagole 2339 and Pratapasingaram 1173, below CPCB's annual minima of "
            "0.5 and 0.8. An annual minimum cannot exceed a monthly value at the same station, so the two "
            "government sources are inconsistent there. See _reporting_floor_caveat: CPCB's OWN data shows 0.3 "
            "recurring as an annual min==max across several stations and years, so the likeliest explanation "
            "is that both bodies report a floor rather than that either is wrong. Both sources agree on the "
            "qualitative finding."
        ),
        "rivers": [r for r in rivers.values() if r["stations"]],
    }

    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"\nWrote {OUT} ({OUT.stat().st_size // 1024} KB)")
    for r in payload["rivers"]:
        print(f"  {r['name']}: {len(r['stations'])} stations, "
              f"{sum(len(s['readings']) for s in r['stations'])} station-years")
    print(f"  plotted: {plotted}/{total_st}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
