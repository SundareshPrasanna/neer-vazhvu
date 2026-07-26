#!/usr/bin/env python3
"""
Kolkata's sewage balance and upcoming-STP programme, from KMC's own
District Environment Plan 2021.

    https://www.kmcgov.in/KMCPortal/downloads/EnvironmentPlan_KMC_2021.pdf
    (33 pp, PDF creation date 1 Dec 2021, filed under the NGT-mandated
     District Environment Plan process)

THE FINDING THIS EXISTS TO CARRY: 910 of Kolkata's 1,400 MLD of sewage - 65% -
is treated by the fisheries of the East Kolkata Wetlands, roughly five times
what all five of the city's sewage treatment plants manage combined (179 MLD).
By the corporation's own accounting, the principal sewage treatment
infrastructure of a 4.5-million-person city is a wetland: unbuilt, unpaid for,
under real-estate pressure, and lying OUTSIDE KMC in North and South 24
Parganas. That last fact is why Kolkata is modelled as a region.

WHY TRANSCRIPTION RATHER THAN A PARSER. The STP table is a five-level nested
multi-column layout (programme x status x plant x capacity x timeline) that
pdftotext flattens irrecoverably - a positional parser over it would be fragile
in a way that fails silently, which is the worst failure mode for a numbers
surface. So the table is transcribed here WITH its provenance, and the script's
job is to VALIDATE the transcription against arithmetic the document itself
states. That check is real: if any capacity is mistyped, the sum stops matching
KMC's own printed 280.06 MLD total and the build fails loudly.

Run:  python3 neer-vazhvu-api/scripts/build_kolkata_sewage_balance.py
"""

import json
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "public" / "data"

SOURCE = {
    "publisher": "Kolkata Municipal Corporation",
    "document": "District Environment Plan 2021 - Kolkata",
    "url": "https://www.kmcgov.in/KMCPortal/downloads/EnvironmentPlan_KMC_2021.pdf",
    "document_date": "2021-12-01",
    "filed_under": "NGT-mandated District Environment Plan process",
}

# --- The balance, verbatim from the plan (p.25 table + §9.0) -----------------
# "Quantity of treated sewage flowing into Rivers (directly or indirectly):
#  910 MLD in EKW fisheries + 179 MLD in existing 5 nos. STPs = Total 1089 MLD"
BALANCE = {
    "total_generated_mld": 1400,
    "treated_ekw_fisheries_mld": 910,
    "treated_stps_mld": 179,
    "existing_stp_count": 5,
    "total_treatment_capacity_mld": 1089,
    "untreated_or_partial_mld": 311,
    "untreated_pct_stated": 22.21,
    "sewage_into_lakes_mld": 0,
}

# --- Upcoming STPs (p.29 "Details of upcoming STPs") ------------------------
# Every entry that carries coordinates in the source carries them here; the
# Borough-XII proposal genuinely has none in the document and is not invented.
UPCOMING_STPS = [
    {
        "name": "Near WBSETCL, Joka",
        "capacity_mld": 45,
        "programme": "KEIIP",
        "stage": "under_construction",
        "status_text": "Work in progress (17%)",
        "completion_pct": 17,
        "timeline_text": "March, 2022",
        "due": "2022-03-31",
        "lat": 22.4496,
        "lng": 88.2982,
    },
    {
        "name": "At Bank Plot, M.G Road",
        "capacity_mld": 40,
        "programme": "KEIIP",
        "stage": "under_construction",
        "status_text": "Work in progress (14%)",
        "completion_pct": 14,
        "timeline_text": "March, 2022",
        "due": "2022-03-31",
        "lat": 22.4583,
        "lng": 88.3130,
    },
    {
        "name": "Rajpur-Sonarpur, Rania",
        "capacity_mld": 23,
        "programme": "KEIIP",
        "stage": "tendered",
        "status_text": "Tendering process completed. Agreement done. Work Order to be issued after Election.",
        "completion_pct": None,
        "timeline_text": "24 months from the date of issuance of work order",
        "due": None,
        "lat": 22.4492,
        "lng": 88.3504,
    },
    {
        "name": "Police Telecom Department Land, near Wireless Park",
        "capacity_mld": 15.3,
        "programme": "Tollys Nullah",
        "stage": "tendered",
        "status_text": "Tender process in progress. Technical bid submitted.",
        "completion_pct": None,
        "timeline_text": "30 months from the date of issuance of work order",
        "due": None,
        "lat": 22.48039,
        "lng": 88.34874,
    },
    {
        "name": "Near Golf Garden, Sukhapukur",
        "capacity_mld": 5.06,
        "programme": "Tollys Nullah",
        "stage": "tendered",
        "status_text": "Tender process in progress.",
        "completion_pct": None,
        "timeline_text": "30 months from the date of issuance of work order",
        "due": None,
        "lat": 22.49851,
        "lng": 88.35096,
    },
    {
        "name": "Near Kavi Nazrul Metro Station, Birji Road",
        "capacity_mld": 5.7,
        "programme": "Tollys Nullah",
        "stage": "tendered",
        "status_text": "Tender process in progress.",
        "completion_pct": None,
        "timeline_text": "30 months from the date of issuance of work order",
        "due": None,
        "lat": 22.46576,
        "lng": 88.38884,
    },
    {
        "name": "Proposed STP for Borough-XII (Wards 108, 109 part, 110)",
        "capacity_mld": 70,
        "programme": "KEIIP",
        "stage": "proposed",
        "status_text": "To be finalized based on implementation of future loan or from own resources of KMC",
        "completion_pct": None,
        "timeline_text": "Not yet finalized",
        "due": None,
        # No coordinates in the source - in 2021 this plant was a proposal, not
        # a site. The 2026 update below supplies them.
        "lat": None,
        "lng": None,
        # WHAT HAPPENED NEXT, from a primary document five years later. The 2021
        # figures above are left EXACTLY as transcribed - they are what KMC
        # filed, and the 280.06 MLD checksum depends on them. This block records
        # the current state separately rather than editing history.
        "update_2026": {
            "as_of": "2026-02-24",
            "capacity_mld": 41,
            "site": "Anandapur, Ward 108, Borough XII (adjacent to the existing Anandapur pumping station)",
            "technology": "Sequencing batch reactor (SBR)",
            "programme": "KMC SHARP (ADB project 56287-001), package KMC SHARP/OCB/SD 04/2025-26",
            "land": "3.781 acres available, 2.66 acres allocated; KMDA-owned, currently a non-operational oxidation pond",
            "effluent_to": "Lead Channel D-D1, to NGT effluent standards",
            "schedule": "Bids invited March 2026; 3.5-year design-and-construction period, then 15 years O&M",
            "site_moved_from": (
                "Originally sited at Hossainpur in the SAME ward under the same package, with a "
                "draft IEE disclosed via ADB in 2024. Relocated after legal litigation made that "
                "land parcel unavailable; the new site is within 2.5 km."
            ),
            "note_on_double_counting": (
                "The 'Hossainpur 41 MLD STP' and the 'Anandapur 41 MLD STP' in ADB's document "
                "library are the SAME plant, relocated - not two plants. Counting both would "
                "invent 41 MLD of capacity."
            ),
            "source_url": "https://www.keiip.in/kmcsharp_report.html",
            "source_label": "KMC/ADB, Updated Initial Environmental Examination, 24 Feb 2026",
        },
    },
    {
        "name": "STP Near L.S 10",
        "capacity_mld": 16,
        "programme": "MWWP",
        "stage": "proposed",
        "status_text": "Draft DPR submitted to NMCG. Draft Bidding Document under evaluation by Technical Review Committee.",
        "completion_pct": None,
        "timeline_text": "52 months from the date of issuance of work order",
        "due": None,
        "lat": 22.51841,
        "lng": 88.32479,
    },
    {
        "name": "STP Near Surinaam Ghat, Dhankheti Nikashi",
        "capacity_mld": 25,
        "programme": "MWWP",
        "stage": "proposed",
        "status_text": "Draft DPR submitted to NMCG.",
        "completion_pct": None,
        "timeline_text": "52 months from the date of issuance of work order",
        "due": None,
        "lat": 22.55041,
        "lng": 88.29222,
    },
    {
        "name": "STP Near Bhanga Khal, Gardenreach area",
        "capacity_mld": 35,
        "programme": "MWWP",
        "stage": "proposed",
        "status_text": "Draft DPR submitted to NMCG.",
        "completion_pct": None,
        "timeline_text": "52 months from the date of issuance of work order",
        "due": None,
        "lat": 22.54118,
        "lng": 88.25155,
    },
]

# Totals the document itself prints, used as the check on the transcription.
STATED_UPCOMING_TOTAL_MLD = 280.06
STATED_RESIDUAL_GAP_MLD = 30.94


def validate() -> list[str]:
    """Arithmetic the DOCUMENT asserts. A mistyped capacity breaks one of
    these, which is the whole point of transcribing with a checker."""
    errs = []

    total = round(sum(s["capacity_mld"] for s in UPCOMING_STPS), 2)
    if total != STATED_UPCOMING_TOTAL_MLD:
        errs.append(
            f"upcoming STP capacities sum to {total}, document states {STATED_UPCOMING_TOTAL_MLD}"
        )

    treated = BALANCE["treated_ekw_fisheries_mld"] + BALANCE["treated_stps_mld"]
    if treated != BALANCE["total_treatment_capacity_mld"]:
        errs.append(
            f"910 + 179 = {treated}, document states {BALANCE['total_treatment_capacity_mld']}"
        )

    residual = BALANCE["total_generated_mld"] - BALANCE["total_treatment_capacity_mld"]
    if residual != BALANCE["untreated_or_partial_mld"]:
        errs.append(
            f"1400 - 1089 = {residual}, document states {BALANCE['untreated_or_partial_mld']}"
        )

    # KMC's stated 22.21% is against a denominator it does not name. 311/1400 is
    # 22.21%, so the denominator is total generation - worth pinning, because it
    # means "untreated" is a share of ALL sewage, not of what reaches a plant.
    pct = round(100 * BALANCE["untreated_or_partial_mld"] / BALANCE["total_generated_mld"], 2)
    if abs(pct - BALANCE["untreated_pct_stated"]) > 0.01:
        errs.append(f"311/1400 = {pct}%, document states {BALANCE['untreated_pct_stated']}%")

    gap = round(STATED_UPCOMING_TOTAL_MLD - BALANCE["untreated_or_partial_mld"], 2)
    if round(abs(gap), 2) != STATED_RESIDUAL_GAP_MLD:
        errs.append(
            f"280.06 vs 311 residual is {gap}, document states {STATED_RESIDUAL_GAP_MLD}"
        )

    return errs


def build_balance() -> dict:
    return {
        "place_id": "kolkata",
        "generated_at": date.today().isoformat(),
        "source": SOURCE,
        "balance": BALANCE,
        "ekw_share_pct": round(
            100 * BALANCE["treated_ekw_fisheries_mld"] / BALANCE["total_generated_mld"], 1
        ),
        "ekw_vs_stp_ratio": round(
            BALANCE["treated_ekw_fisheries_mld"] / BALANCE["treated_stps_mld"], 1
        ),
        "upcoming_stps": UPCOMING_STPS,
        "upcoming_total_mld": STATED_UPCOMING_TOTAL_MLD,
        "residual_gap_mld": STATED_RESIDUAL_GAP_MLD,
        "notes": [
            "The East Kolkata Wetlands lie outside KMC, in North and South 24 Parganas. "
            "The city's largest sewage treatment asset is not inside the city.",
            "Even if every upcoming STP is built, 280.06 MLD of new capacity against "
            "311 MLD currently untreated leaves a residual gap of 30.94 MLD - and that "
            "assumes the wetlands keep treating 910 MLD, which the plan takes as given.",
            "KMC's Environment Plan leaves the entire industrial-wastewater section "
            "blank, naming WBPCB as the responsible agency. That is the corporation "
            "declaring a gap in its own statutory plan.",
        ],
    }


def build_commitments() -> dict:
    """Shape fixed by src/app/[cityId]/commitments/commitments-client.tsx.
    `status` must be one of the six tracked values - there is no "unknown".
    The honest value for these is `unverified`: the platform's rule is that a
    status only changes with a dated citation, and we have none for what
    happened after December 2021."""
    commitments = []
    for stp in UPCOMING_STPS:
        if not stp["due"]:
            continue
        slug = (
            stp["name"].lower().replace(" ", "-").replace(",", "").replace("(", "").replace(")", "")
        )[:40].strip("-")
        commitments.append(
            {
                "id": f"stp-{slug}",
                "category": "Sewage treatment",
                "title": f"Commission the {stp['capacity_mld']} MLD STP at {stp['name']}",
                "committed_by": f"Kolkata Municipal Corporation / KEIIP ({stp['programme']})",
                "what": (
                    f"KMC's District Environment Plan 2021 records this plant at "
                    f"{stp['completion_pct']}% completion with a stated timeline of "
                    f"{stp['timeline_text']} - a deadline already less than four months away "
                    f"when the plan was filed on 1 December 2021. No later public document "
                    f"confirming completion or re-dating has been found."
                ),
                "due": stp["due"],
                "revised_due": None,
                "commitment_source": {
                    "label": f"{SOURCE['publisher']}, {SOURCE['document']}, p.29",
                    "url": SOURCE["url"],
                    "date": SOURCE["document_date"],
                },
                "status": "unverified",
                "status_history": [
                    {
                        "date": SOURCE["document_date"],
                        "status": "on-track",
                        "note": f"{stp['completion_pct']}% complete against a {stp['timeline_text']} timeline",
                        "source_label": SOURCE["document"],
                        "source_url": SOURCE["url"],
                    },
                    {
                        "date": date.today().isoformat(),
                        "status": "unverified",
                        "note": (
                            "Deadline is four years past. No KEIIP or KMC document confirming "
                            "commissioning, slippage or a revised date has been located, so the "
                            "status cannot move to delivered or overdue without inventing evidence."
                        ),
                        "source_label": None,
                        "source_url": None,
                    },
                ],
                "next_check": None,
                "ledger_id": None,
            }
        )
    # The Borough-XII plant carried no deadline in 2021 ("not yet finalized"),
    # so it never became a tracked commitment. A February 2026 ADB-disclosed IEE
    # gives it one - which is exactly the dated citation the register requires
    # before a status can move.
    u = next(
        (s["update_2026"] for s in UPCOMING_STPS if s.get("update_2026")), None
    )
    if u:
        commitments.append(
            {
                "id": "stp-anandapur-borough-xii",
                "category": "Sewage treatment",
                "title": f"Commission the {u['capacity_mld']} MLD STP at Anandapur, Ward 108",
                "committed_by": "Kolkata Municipal Corporation / KMC SHARP, financed by the Asian Development Bank",
                "what": (
                    f"KMC's 2021 Environment Plan listed a 70 MLD plant for Borough-XII with no "
                    f"timeline, to be built 'based on implementation of future loan or from own "
                    f"resources'. The loan arrived: this is now a {u['capacity_mld']} MLD "
                    f"{u['technology']} plant under {u['programme']}, with {u['schedule'].lower()}. "
                    f"{u['site_moved_from']} It is being built on {u['land'].split(';')[1].strip()}, "
                    f"discharging to {u['effluent_to']}."
                ),
                # Bids March 2026 + a 3.5-year design-and-construction period.
                "due": "2029-09-30",
                "revised_due": None,
                "commitment_source": {
                    "label": u["source_label"],
                    "url": u["source_url"],
                    "date": u["as_of"],
                },
                "status": "on-track",
                "status_history": [
                    {
                        "date": SOURCE["document_date"],
                        "status": "unverified",
                        "note": "Listed at 70 MLD for Borough-XII with no timeline and no committed funding",
                        "source_label": SOURCE["document"],
                        "source_url": SOURCE["url"],
                    },
                    {
                        "date": u["as_of"],
                        "status": "on-track",
                        "note": (
                            f"Financed and scheduled: {u['capacity_mld']} MLD at Anandapur, bids "
                            f"March 2026, 3.5-year build. Capacity is 41 MLD, not the 70 MLD "
                            f"proposed in 2021, and the site moved after litigation."
                        ),
                        "source_label": u["source_label"],
                        "source_url": u["source_url"],
                    },
                ],
                "next_check": "2026-10-01",
                "ledger_id": None,
            }
        )

    return {
        "place_id": "kolkata",
        "updated": date.today().isoformat(),
        "headline": "Kolkata's sewage-treatment promises",
        "intro": (
            "Dated commitments from KMC's own statutory filings. Two KEIIP plants were recorded "
            "at 17% and 14% completion against a March 2022 deadline in a document filed "
            "December 2021. What happened next is not in any public record we have found, so "
            "they read 'unverified' rather than a guess in either direction."
        ),
        "status_legend": {
            "delivered": "Done, with a source confirming it",
            "on-track": "Progressing with no known slippage",
            "slipped": "Officially or credibly re-dated - both dates kept",
            "overdue": "Past its promised date with no official word",
            "stalled": "Years without movement",
            "unverified": "A change may have happened; awaiting a citable confirmation",
        },
        "commitments": commitments,
        "update_model": (
            "Statuses change only with a dated citation; every change appends to the "
            "commitment's history, and the slippage trail is the product. Kolkata's "
            "verification route is KEIIP project documents and KMC budget statements - "
            "neither publishes on a predictable calendar, which is itself why these sit at "
            "unverified rather than overdue."
        ),
        "sources_note": f"{SOURCE['document']} ({SOURCE['document_date']}), {SOURCE['url']}",
    }


def main() -> int:
    errs = validate()
    if errs:
        print("TRANSCRIPTION CHECK FAILED against the document's own totals:", file=sys.stderr)
        for e in errs:
            print(f"  - {e}", file=sys.stderr)
        return 1

    bal = build_balance()
    (DATA_DIR / "kolkata-sewage-balance.json").write_text(
        json.dumps(bal, ensure_ascii=False, indent=2)
    )
    com = build_commitments()
    (DATA_DIR / "commitments-kolkata.json").write_text(
        json.dumps(com, ensure_ascii=False, indent=2)
    )

    with_coords = sum(1 for s in UPCOMING_STPS if s["lat"] is not None)
    print(
        f"kolkata: EKW treats {bal['ekw_share_pct']}% of sewage "
        f"({BALANCE['treated_ekw_fisheries_mld']} of {BALANCE['total_generated_mld']} MLD), "
        f"{bal['ekw_vs_stp_ratio']}x the 5 STPs combined; "
        f"{len(UPCOMING_STPS)} upcoming STPs = {STATED_UPCOMING_TOTAL_MLD} MLD "
        f"({with_coords} mappable), residual gap {STATED_RESIDUAL_GAP_MLD} MLD; "
        f"{len(com['commitments'])} dated commitments",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
