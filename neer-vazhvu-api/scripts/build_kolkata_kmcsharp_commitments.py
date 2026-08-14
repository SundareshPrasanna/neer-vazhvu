#!/usr/bin/env python3
"""
KMC-SHARP sewerage packages -> Kolkata's Commitments Register.

Source: Semi Annual Environment Monitoring Report for KMC-SHARP, July-December
2025, disclosed via https://www.keiip.in/kmcsharp_report.html
(ADB Loan 4584-IND, project 56287-001).

WHY THIS IS THE RIGHT SOURCE. Kolkata's commitments were two orphaned promises
from a 2021 statutory filing with no follow-up. KMC-SHARP's SEMR carries what a
commitments register actually needs and almost no Indian civic source provides:
a package number, a NAMED CONTRACTOR, a contractual completion date, and a
% physical progress figure - refreshed every six months by an ADB disclosure
obligation rather than at the implementing agency's discretion.

THE FINDING AS OF 31 DECEMBER 2025: five packages have been awarded, contractors
mobilised, and work formally commenced on 15.10.2025 - and every one of them
stands at 0.0% PHYSICAL PROGRESS. What has happened is topographical survey and
manhole-data collection. That is not a scandal on its own; these are 3-4 year
builds two and a half months past commencement. It is a baseline, and it is
exactly what a register exists to hold: the next SEMR either shows movement or
it does not.

TWO PACKAGES ARE NOT YET BID, and both are the Anandapur STP work whose DPR is
"under finalization". That is also the document that would settle the 6 mm/hour
drainage design standard the dashboard hero rests on - so this register and that
open question resolve from the same source.

Run:  python3 neer-vazhvu-api/scripts/build_kolkata_kmcsharp_commitments.py
"""

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
# Every producer writing under public/ goes through the envelope-preserving
# writer: a scheduled rewrite must not strip the NVDM envelope it finds.
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
DATA_DIR = REPO_ROOT / "public" / "data"

SRC = {
    "label": "KMC-SHARP Semi Annual Environment Monitoring Report, Jul-Dec 2025 (ADB Loan 4584-IND)",
    "url": "https://www.keiip.in/kmcsharp_report.html",
    "date": "2026-02-01",
}
AS_OF = "2025-12-31"

# Milestones shared by all five awarded packages, per SEMR Table 2.
LOA, AWARD, NTP, START = "28.04.2025", "30.06.2025", "24.09.2025", "15.10.2025"

PACKAGES = [
    {
        "pkg": "KMC-SHARP/OCB/SD01/2023-24",
        "where": "Nayabad and adjoining areas, Borough XII (part of Ward 109)",
        "contractor": "M/s Traders & Engineers Private Ltd.",
        "scope": "8.4 km combined RCC sewer network, 981 catch pits, 52 gully pits, 466 manholes, house service connections, and five gravity outfalls discharging storm-water flow into the Guniagachi canal in the Tollygunge-Panchanangram basin",
        "due": "2028-10-14",
        "progress_pct": 0.0,
        "awarded": True,
    },
    {
        "pkg": "KMC-SHARP/OCB/SD02/2023-24",
        "where": "Ajaynagar and adjoining areas, Borough XII (part of Ward 109)",
        "contractor": "M/s Traders & Engineers Private Ltd.",
        "scope": "6.7 km combined RCC sewer network, 784 catch pits, 41 gully pits, 352 manholes, house service connections, and six gravity outfalls discharging into the Suti canal",
        "due": "2028-10-14",
        "progress_pct": 0.0,
        "awarded": True,
    },
    {
        "pkg": "KMC-SHARP/OCB/SD06R/2024-25",
        "where": "Julpia catchment, Borough XVI (part of Ward 142), including Julpia pumping station",
        "contractor": "M/s LC Infra Projects Pvt. Ltd. - Gypsum Structural JV",
        "scope": "16.9 km combined sewer network, of which 2.7 km by micro-tunnelling, plus the Julpia pumping station",
        "due": "2029-10-14",
        "progress_pct": 0.0,
        "awarded": True,
    },
    {
        "pkg": "KMC-SHARP/OCB/SD07R/2024-25",
        "where": "Kabar Danga catchment, Borough XVI (parts of Wards 142 and 143), including Kabar Danga pumping station",
        "contractor": "M/s LC Infra Projects Pvt. Ltd. - Gypsum Structural JV",
        "scope": "16.6 km combined sewer network plus the Kabar Danga pumping station",
        "due": "2029-10-14",
        "progress_pct": 0.0,
        "awarded": True,
    },
    {
        "pkg": "KMC-SHARP/OCB/SD08/2024-25",
        "where": "Sonamukhi Main Road and Kastodanga Road, Suti sub-basin, Borough XIV (part of Ward 127)",
        "contractor": None,
        "scope": "Combined sewer and drainage network in the Suti sub-basin",
        "due": "2029-04-14",
        "progress_pct": 0.0,
        "awarded": True,
    },
    {
        "pkg": "KMC-SHARP/OCB/SD09R/2025-26",
        "where": "Jadav Ghosh Road, Suti basin, Boroughs XIV and XVI (parts of Wards 126 and 127)",
        "contractor": None,
        "scope": "Sewerage and drainage network plus a pumping station",
        "due": None,
        "progress_pct": None,
        "awarded": False,
        "status_note": "Bidding completed; selection of contractor under process",
    },
    {
        "pkg": "KMC-SHARP/OCB/SD05A/2025-26",
        "where": "Anandapur Highway, Borough XII (Ward 108), including the Anandapur pumping station",
        "contractor": None,
        "scope": "Main trunk sewer line along Anandapur Highway and construction of the Anandapur pumping station",
        "due": None,
        "progress_pct": None,
        "awarded": False,
        "status_note": "DPR under finalization; bidding to follow. Site was earlier Hossainpur",
    },
]


def commitment(p):
    awarded = p["awarded"]
    contractor = f" Contractor: {p['contractor']}." if p.get("contractor") else ""
    if awarded:
        what = (
            f"{p['scope']}. Letter of award {LOA}, contract awarded {AWARD}, notice to proceed "
            f"{NTP}, work formally commenced {START}.{contractor} As of {AS_OF} the package stood "
            f"at {p['progress_pct']}% physical progress, with topographical survey and manhole-data "
            f"collection under way."
        )
        status, note = "on-track", (
            f"Awarded and commenced; {p['progress_pct']}% physical progress at the first reporting date"
        )
    else:
        what = f"{p['scope']}. {p.get('status_note','')}.{contractor}"
        status, note = "unverified", p.get("status_note", "Not yet awarded")

    return {
        "id": "kmcsharp-" + p["pkg"].split("/")[-2].lower().replace(" ", "-"),
        "category": "Sewerage and drainage",
        "title": f"{p['pkg'].split('/')[-2]}: sewerage and drainage in {p['where'].split(',')[0]}",
        "committed_by": "Kolkata Municipal Corporation, KMC-SHARP programme, financed by the Asian Development Bank (Loan 4584-IND)",
        "what": what,
        "due": p["due"],
        "revised_due": None,
        "commitment_source": SRC,
        "status": status,
        "status_history": [
            {
                "date": AS_OF,
                "status": status,
                "note": note,
                "source_label": SRC["label"],
                "source_url": SRC["url"],
            }
        ],
        # ADB disclosure is semi-annual, so the next report is the natural check.
        "next_check": "2026-09-30",
        "ledger_id": None,
    }


def main() -> int:
    path = DATA_DIR / "commitments-kolkata.json"
    d = json.loads(path.read_text())
    existing = {c["id"] for c in d["commitments"]}
    added = [commitment(p) for p in PACKAGES]
    d["commitments"].extend([c for c in added if c["id"] not in existing])

    d["intro"] = (
        "Dated commitments from KMC's own statutory filings and from the ADB-disclosed KMC-SHARP "
        "programme. The 2021 Environment Plan entries carry deadlines but no follow-up, so they sit "
        "at 'unverified'. The KMC-SHARP packages are the opposite: named contractors, contractual "
        "completion dates and a percentage-progress figure refreshed every six months by an ADB "
        "disclosure obligation rather than at the implementing agency's discretion. Five of them "
        "commenced on 15 October 2025 and every one stood at 0.0% physical progress on 31 December "
        "2025 - a baseline the next report either moves or does not."
    )
    d["update_model"] = (
        "Statuses change only with a dated citation; every change appends to the commitment's "
        "history, and the slippage trail is the product. Kolkata's verification calendar is now "
        "real: KMC-SHARP publishes a Semi Annual Environment Monitoring Report through ADB, so "
        "these packages have a fixed six-monthly checkpoint. The 2021 KEIIP-era entries have no "
        "such calendar, which is precisely why they remain unverified."
    )
    d["sources_note"] = (
        "KMC District Environment Plan 2021 (2021-12-01); KMC-SHARP Semi Annual Environment "
        "Monitoring Report Jul-Dec 2025, ADB Loan 4584-IND, via keiip.in"
    )
    write_artifact(path, d)

    by = {}
    for c in d["commitments"]:
        by[c["status"]] = by.get(c["status"], 0) + 1
    print(
        f"kolkata commitments: {len(d['commitments'])} total {by}; "
        f"{sum(1 for p in PACKAGES if p['awarded'])} awarded KMC-SHARP packages at 0.0% progress",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
