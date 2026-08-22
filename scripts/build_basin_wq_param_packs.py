#!/usr/bin/env python3
"""Attach CPCB NWMP parameter-trend packs to a basin's monitoring-points family
(station-readings contract v1, `wq-param-series` kind).

Source: CPCB's annual "Water Quality of Rivers" station-wise tables
(docs/cpcb/WQuality_River-Data-<year>.pdf, cpcb.gov.in/nwmp-data/), which
report each station's OBSERVED MIN-MAX per parameter per year. The honest
single-line trend from a min-max table is the WORST end: annual max for BOD
and Fecal Coliform, annual min for DO - the same worst-case basis CPCB itself
uses to classify polluted stretches (BOD > 3 mg/L). Criterion lines are the
CPCB Primary Water Quality Criteria for Outdoor Bathing (Class B).

Parsing: pdftotext -layout, then one uniform line rule that holds for every
edition 2020-2024: a data line starts with the numeric station code and ends
with the numeric tail; the state name sits between name fragments and the
tail; BDL / ND / "-" occupy their column slot (alignment survives). Column
pairs are positional: Temp, DO, pH, Conductivity, BOD, Nitrate, FC, TC[, FS].
Every parsed row must pass a pH sanity check (pair 3 within 3.5-11) or the
row is skipped WITH A WARNING - misaligned numbers must never ship.

Join: station code from each monitoring-point feature (config `codeFrom`:
a props key holding the bare NWMP code, or "stationKey" for CPCB_<code>
keys). Matched stations get readings/<stationKey>.json and
hasReadings: true; unmatched features (e.g. lake stations, which live in a
different CPCB annexure) are left untouched.

Run AFTER any re-ingest that regenerates monitoring-points.geojson.

Usage:
    python3 scripts/build_basin_wq_param_packs.py \
        public/data/basins/kabini scripts/basin-sources/kabini-wq-params.json
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

SOURCE_LABEL = "CPCB NWMP, annual Water Quality of Rivers (station-wise min-max)"
SOURCE_URL = "https://cpcb.gov.in/nwmp-data/"

STATES = [
    "ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH",
    "GOA", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JAMMU & KASHMIR",
    "JAMMU AND KASHMIR", "JHARKHAND", "KARNATAKA", "KERALA", "MADHYA PRADESH",
    "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA",
    "PUDUCHERRY", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL NADU", "TELANGANA",
    "TRIPURA", "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL", "DELHI",
    "DAMAN & DIU", "DADRA & NAGAR HAVELI",
]
# Positional column pairs in every edition's river table.
PARAM_ORDER = ["temp", "do", "ph", "cond", "bod", "nitrate", "fc", "tc", "fs"]
NULLISH = {"-", "BDL", "ND", "NIL", "NA"}
NUM_RE = re.compile(r"^\d+(\.\d+)?$")


def parse_pdf(pdf: Path, cache_dir: Path) -> dict[str, dict]:
    """-> {stationCode: {param: (min, max)}} for one edition. Cached as JSON."""
    cached = cache_dir / f"{pdf.stem}.parsed.json"
    if cached.exists() and cached.stat().st_mtime > pdf.stat().st_mtime:
        return json.loads(cached.read_text())
    txt_path = cache_dir / f"{pdf.stem}.txt"
    if not txt_path.exists() or txt_path.stat().st_mtime < pdf.stat().st_mtime:
        subprocess.run(["pdftotext", "-layout", str(pdf), str(txt_path)], check=True)
    out: dict[str, dict] = {}
    warned = 0
    for line in txt_path.read_text(errors="replace").splitlines():
        toks = line.split()
        if len(toks) < 12 or not toks[0].isdigit():
            continue
        # find the state: the last non-numeric-tail token run must end with one
        tail_start = None
        joined = " ".join(toks)
        state_pos = None
        for st in STATES:
            m = re.search(rf"\b{re.escape(st)}\b", joined)
            if m:
                state_pos = m
                break
        if not state_pos:
            continue
        tail = joined[state_pos.end():].split()
        if len(tail) < 10:
            continue
        if any(not (NUM_RE.match(t) or t in NULLISH) for t in tail):
            continue
        vals = [float(t) if NUM_RE.match(t) else None for t in tail]
        if len(vals) % 2 == 1:
            vals = vals[:-1]
        pairs = list(zip(vals[0::2], vals[1::2]))
        params = dict(zip(PARAM_ORDER, pairs))
        ph = params.get("ph")
        if not ph or ph[0] is None or not (3.5 <= ph[0] <= 11.0):
            warned += 1
            print(f"    ! {pdf.stem}: pH sanity failed for station {toks[0]}, row skipped")
            continue
        out[toks[0]] = {k: list(v) for k, v in params.items()}
    if warned:
        print(f"    ! {pdf.stem}: {warned} rows skipped on sanity checks")
    if not out:
        sys.exit(f"FAIL: no rows parsed from {pdf.name} - format drift?")
    cached.write_text(json.dumps(out))
    return out


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit("usage: build_basin_wq_param_packs.py <basin-dir> <config.json>")
    basin_dir = REPO / sys.argv[1]
    cfg = json.loads((REPO / sys.argv[2]).read_text())
    cache_dir = REPO / ".cache" / "cpcb-nwmp-parsed"
    cache_dir.mkdir(parents=True, exist_ok=True)

    by_year: dict[int, dict[str, dict]] = {}
    for year in cfg["years"]:
        pdf = REPO / cfg["pdfDir"] / cfg["pdfPattern"].format(year=year)
        if not pdf.exists():
            sys.exit(f"missing source PDF: {pdf}")
        by_year[year] = parse_pdf(pdf, cache_dir)
        print(f"  {year}: {len(by_year[year])} station rows parsed")

    mp_path = basin_dir / "monitoring-points.geojson"
    fc = json.loads(mp_path.read_text())
    code_from = cfg.get("codeFrom", "stationKey")

    def code_of(props: dict) -> str | None:
        if code_from == "stationKey":
            m = re.match(r"^[A-Z]+_(\d+)$", str(props.get("stationKey") or ""))
            return m.group(1) if m else None
        v = str(props.get(code_from) or "")
        return v if v.isdigit() else None

    # The worst end of each year's min-max, per the module docstring.
    emit_params = [
        ("bod", 1, "BOD (annual worst)", "mg/L", 3,
         "BOD ≤ 3 mg/L (outdoor bathing criterion)"),
        ("do", 0, "Dissolved oxygen (annual worst)", "mg/L", 5,
         "DO ≥ 5 mg/L (outdoor bathing criterion)"),
        ("fc", 1, "Fecal coliform (annual worst)", "MPN/100ml", 2500,
         "FC ≤ 2500 MPN/100ml (outdoor bathing criterion)"),
    ]

    (basin_dir / "readings").mkdir(exist_ok=True)
    licence = registry_license("cpcb-nwmp-annual")
    fetched = cfg["fetched"]
    packed = 0
    for feat in fc["features"]:
        props = feat["properties"]
        code = code_of(props)
        if not code:
            continue
        series = []
        for key, end, label, unit, criterion, crit_label in emit_params:
            pts = []
            for year in cfg["years"]:
                pair = by_year[year].get(code, {}).get(key)
                if pair and pair[end] is not None:
                    pts.append([str(year), pair[end]])
            if len(pts) >= 2:
                series.append({
                    "kind": "wq-param-series", "unit": unit, "verified": True,
                    "label": label, "param": label.split(" (")[0],
                    "criterion": criterion, "criterionLabel": crit_label,
                    "note": "CPCB's annual tables report each year's observed min-max; "
                            "the worst end is plotted (max for BOD/FC, min for DO).",
                    "points": pts,
                })
        if not series:
            continue
        station_key = str(props.get("stationKey") or f"CPCB_{code}")
        props["stationKey"] = station_key
        years_with = sorted({p[0] for s in series for p in s["points"]})
        pack = {
            "schemaVersion": 1,
            "station": {"stationKey": station_key, "name": props.get("name"),
                        "agency": props.get("agency"), "siteType": "NWMP",
                        "river": props.get("river")},
            "source": {"label": SOURCE_LABEL, "url": SOURCE_URL,
                       "fetched": fetched, "licence": licence},
            "period": {"from": years_with[0], "to": years_with[-1],
                       "waterYear": "calendar years"},
            "series": series,
        }
        pack_path = basin_dir / "readings" / f"{station_key}.json"
        write_artifact(pack_path, pack, compact=True)
        props["hasReadings"] = True
        props["readingsFrom"], props["readingsTo"] = years_with[0], years_with[-1]
        packed += 1
        print(f"  pack {station_key:12} {str(props.get('name'))[:40]:40} {len(series)} series")

    if packed == 0:
        sys.exit("FAIL: no stations matched the parsed tables - check codeFrom/config")
    write_artifact(mp_path, fc, compact=True)
    print(f"\n{packed}/{len(fc['features'])} monitoring points have parameter packs "
          f"-> {mp_path.relative_to(REPO)}")


if __name__ == "__main__":
    main()
