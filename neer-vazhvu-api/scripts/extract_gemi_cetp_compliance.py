#!/usr/bin/env python3
"""
Extract the CETP discharge-compliance ledger for Surat from GEMI's monitoring
report.

WHY THIS EXISTS
Surat is a textile city and its industrial effluent layer was the largest
outstanding gap. The obvious source is telemetry and it is a dead end twice
over: GPCB's own OCEMS dashboard (gpcboms.gpcb.gov.in) accepts TCP on 80 and
443 and then never completes a TLS handshake, and CPCB's national OCEMS API -
already decoded on this platform for Arkavathi - returns 100% NA values with no
coordinates.

What exists instead is better than telemetry. GEMI, an autonomous institute of
the Gujarat Forest and Environment Department, sampled both Surat CETPs monthly
for a year and tabulated every result AGAINST THE DISCHARGE NORM IN THAT PLANT'S
OWN GPCB consent. That is a compliance record, not a dashboard: twelve dated
samples per parameter, each of which either meets the plant's licence or does
not.

  Pandesara Infrastructure Ltd (PIL)      100 MLD  -> Bhedvad creek
  Sachin Infra Environment Ltd (SIEL)      50 MLD  -> Unn creek

Bhedvad is one of the five khadis SMC publishes a danger level for and which
the city dashboard already renders live. The creek the corporation watches for
flooding is the creek receiving 100 MLD of textile effluent.

TWO THINGS THIS SCRIPT REFUSES TO DO

1. It does not read the report's SUMMARY tables (Table 5 and Table 8). Those
   disagree with the report's own per-sample tables by roughly a thousandfold
   on two metals - Table 8 gives Sachin's total chromium as 11.33 mg/L and
   nickel as 15.07 mg/L, while Table 9's samples for the same plant and period
   run 0.005-0.027 mg/L. Almost certainly ug/L mislabelled as mg/L. The
   per-sample tables (6 and 9) are the source of truth here and the summaries
   are not used at all.

2. It does not mirror the PDF. The report is stamped "(c) GEMI, All rights
   reserved"; it is a government publication we cite with attribution, and
   figures are extracted while the document stays at its own URL.

EXCEEDANCE IS RECOMPUTED, NOT READ
The original marks exceedances with a highlight, which pdftotext cannot see. So
each value is compared to its norm here: a range norm (pH) is breached on either
side, a ceiling norm on the high side, and a below-detection reading can never
be an exceedance.

Run:
  cd neer-vazhvu-api && python3 scripts/extract_gemi_cetp_compliance.py \
      --txt <pdftotext -layout output> --root ..
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from nvdm_write import write_artifact  # noqa: E402

CITY = "surat"

CETPS = {
    "pandesara": {
        "name": "Pandesara Infrastructure Ltd (PIL)",
        "short": "Pandesara",
        "capacity_mld": 100,
        "estate": "Pandesara Industrial Estate",
        "receiving_water": "Bhedvad creek",
        "receiving_water_note": (
            "One of the five khadis Surat Municipal Corporation publishes a danger level "
            "for, and which the city dashboard renders live."
        ),
        "table": "Table 6",
        "lat": 21.1470,
        "lng": 72.8330,
    },
    "sachin": {
        "name": "Sachin Infra Environment Ltd (SIEL)",
        "short": "Sachin",
        "capacity_mld": 50,
        "estate": "Sachin GIDC",
        "receiving_water": "Unn creek",
        "receiving_water_note": None,
        "table": "Table 9",
        "lat": 21.0810,
        "lng": 72.8790,
    },
}

# "6.5 to 8.5" | "40 °C" | "100 Hazen" | "250 mg/L" | "01 mg/L"
_RANGE = re.compile(r"^\s*([\d.]+)\s*to\s*([\d.]+)\s*$")
_CEIL = re.compile(r"^\s*0?([\d.]+)\s*(mg/L|Hazen|°?C)\s*$", re.I)
_DATE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{2})")


def parse_norm(raw: str) -> dict | None:
    raw = raw.strip()
    m = _RANGE.match(raw)
    if m:
        return {"kind": "range", "min": float(m.group(1)), "max": float(m.group(2)), "text": raw}
    m = _CEIL.match(raw)
    if m:
        unit = m.group(2)
        return {"kind": "ceiling", "max": float(m.group(1)), "unit": unit, "text": raw}
    return None


def iso(d: str) -> str | None:
    m = _DATE.search(d)
    if not m:
        return None
    dd, mm, yy = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return f"20{yy:02d}-{mm:02d}-{dd:02d}"


def sample_dates(header: str) -> list[str]:
    out = []
    for tok in _DATE.finditer(header):
        v = iso(tok.group(0))
        if v and v not in out:
            out.append(v)
    return out


def breaches(value: float, norm: dict) -> bool:
    if norm["kind"] == "range":
        return value < norm["min"] or value > norm["max"]
    return value > norm["max"]


def parse_table(lines: list[str], start: int) -> tuple[list[str], list[dict]]:
    """Parse one compliance block: its date header and its parameter rows."""
    dates: list[str] = []
    rows: list[dict] = []
    for raw in lines[start : start + 60]:
        if not dates:
            found = sample_dates(raw)
            if len(found) >= 6:
                dates = found
            continue
        # "<sr> <parameter words> <norm> <v1> <v2> ...". A single space may
        # separate the name from the norm ("Suspended Solid 100 mg/L"), so the
        # separator cannot be \s{2,}.
        m = re.match(
            r"^\s*(\d{1,2})\s+([A-Za-z][A-Za-z&\s./]*?)\s+"
            r"([\d.]+\s*to\s*[\d.]+|0?[\d.]+\s*(?:mg/L|Hazen|°?\s?C))\s+(.*)$",
            raw,
        )
        if not m:
            # The report also wraps long names around their own value row:
            #     "        Ammonical"
            #     " 7                50 mg/L   19.04  31.64 ..."
            #     "         Nitrogen"
            # so a row whose name is empty borrows the words on either side.
            m2 = re.match(
                r"^\s*(\d{1,2})\s+"
                r"([\d.]+\s*to\s*[\d.]+|0?[\d.]+\s*(?:mg/L|Hazen|°?\s?C))\s+(.*)$",
                raw,
            )
            if m2:
                idx = lines.index(raw, start) if raw in lines[start : start + 60] else None
                name = ""
                if idx:
                    above = lines[idx - 1].strip()
                    below = lines[idx + 1].strip() if idx + 1 < len(lines) else ""
                    parts = [w for w in (above, below) if w and not re.search(r"[\d/]", w)]
                    name = " ".join(parts)
                if name:
                    norm = parse_norm(m2.group(2))
                    if norm:
                        rows.append(
                            {
                                "sr": int(m2.group(1)),
                                "parameter": " ".join(name.split()),
                                "norm": norm,
                                "cells": re.findall(r"BDL|[\d.]+", m2.group(3)),
                            }
                        )
                continue
            if re.search(r"BDL\s*=\s*Below Detection", raw, re.I):
                break
            continue
        norm = parse_norm(m.group(3))
        if not norm:
            continue
        cells = re.findall(r"BDL|[\d.]+", m.group(4))
        rows.append(
            {
                "sr": int(m.group(1)),
                "parameter": " ".join(m.group(2).split()),
                "norm": norm,
                "cells": cells,
            }
        )
    return dates, rows


# The report misspells two parameters. The corrected name is shown and the
# source spelling is kept, because a reader checking against the PDF must be
# able to find the row.
SPELLING = {"Cyadnides": "Cyanides", "Ammonical Nitrogen": "Ammoniacal Nitrogen"}


def build(txt: Path, root: Path) -> dict:
    lines = txt.read_text(encoding="utf-8", errors="replace").split("\n")
    plants = []
    for key, meta in CETPS.items():
        starts = [
            i
            for i, ln in enumerate(lines)
            if meta["table"] in ln and "Comparison with the discharge norms" in ln
        ]
        # The caption also appears in the table-of-contents; the real blocks are
        # the later ones, and the table wraps across two pages.
        starts = [i for i in starts if i > 400]
        dates: list[str] = []
        merged: dict[str, dict] = {}
        for s in starts:
            d, rows = parse_table(lines, s)
            if d and not dates:
                dates = d
            for r in rows:
                merged.setdefault(r["parameter"], r)
        parameters = []
        for name, r in sorted(merged.items(), key=lambda kv: kv[1]["sr"]):
            samples = []
            for i, dt in enumerate(dates):
                cell = r["cells"][i] if i < len(r["cells"]) else None
                if cell is None:
                    continue
                if cell.upper() == "BDL":
                    samples.append({"date": dt, "below_detection_limit": True, "exceeds": False})
                    continue
                try:
                    val = float(cell)
                except ValueError:
                    continue
                samples.append({"date": dt, "value": val, "exceeds": breaches(val, r["norm"])})
            if samples:
                n_ex = sum(1 for s in samples if s["exceeds"])
                parameters.append(
                    {
                        "parameter": SPELLING.get(name, name),
                        "parameter_as_published": name if name in SPELLING else None,
                        "norm": r["norm"],
                        "samples": samples,
                        "sampled": len(samples),
                        "exceedances": n_ex,
                    }
                )
        plants.append(
            {
                "id": key,
                **{k: v for k, v in meta.items() if k != "table"},
                "sample_dates": dates,
                "parameters": parameters,
                "total_exceedances": sum(p["exceedances"] for p in parameters),
                "parameters_ever_breached": sum(1 for p in parameters if p["exceedances"]),
            }
        )

    reg = json.loads((root / "scripts/source-registry/surat.json").read_text())
    src = next(s for s in reg["sources"] if s["id"] == "gemi-cetp-discharge")

    return {
        "nvdm": "1.0",
        "dataset": "data-root/cetp-compliance",
        "scope": {"kind": "city", "id": CITY},
        "provenance": {
            "sources": [
                {
                    "id": src["id"],
                    "title": src["notes"].split(".")[0],
                    "publisher": src["publisher"],
                    "license": src["license"],
                    "url": src["url"],
                }
            ],
            "method": "pdf-extract",
            "note": (
                "Per-sample compliance tables only (Table 6 for Pandesara, Table 9 for "
                "Sachin). The report's SUMMARY tables are deliberately not used: they "
                "disagree with these by roughly a thousandfold on total chromium and "
                "nickel, almost certainly ug/L mislabelled as mg/L. Exceedance is "
                "recomputed here by comparing each value to its consent norm, because "
                "the original marks exceedances with a highlight that text extraction "
                "cannot see."
            ),
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/extract_gemi_cetp_compliance.py",
        },
        "_note": (
            "Every norm here is the plant's own GPCB Consolidated Consent & Authorization "
            "limit, not a generic standard. An exceedance is a plant discharging outside "
            "the licence it holds."
        ),
        "monitoring_period": {"from": "2022-04", "to": "2023-03", "samples_per_plant": 12},
        "cetps": plants,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--txt", required=True)
    ap.add_argument("--root", default="..")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    root = Path(args.root).resolve()
    payload = build(Path(args.txt), root)
    out = Path(args.out) if args.out else root / "public/data/cetp-compliance-surat.json"
    write_artifact(out, payload)
    for p in payload["cetps"]:
        print(
            f"  {p['short']:<11} {len(p['sample_dates'])} samples, "
            f"{len(p['parameters'])} parameters, {p['total_exceedances']} exceedances "
            f"across {p['parameters_ever_breached']} parameters"
        )
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
