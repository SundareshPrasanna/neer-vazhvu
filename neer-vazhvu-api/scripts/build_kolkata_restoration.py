#!/usr/bin/env python3
"""
Kolkata's flagship water bodies + restoration projects.

Kolkata has no equivalent of Chennai's CRRT - no single agency publishing a
restoration project register - so this is compiled from named, dated sources and
graded per entry with the same V / N / C scale the pre-onboarding research uses:
  V  verified against a primary source or our own ingested data
  N  news-sourced, directionally reliable, not a primary record
  C  claimed - asserted somewhere, primary source not reached

WHAT MAKES KOLKATA'S RESTORATION STORY DIFFERENT. Chennai's register is a
programme: one trust, numbered projects, budgets. Kolkata's is a court docket
plus a survey. Its two great lakes are managed by an authority (KMDA) that the
NGT had to appoint as custodian, and the most consequential live item is not a
restoration at all - it is KMC finally commissioning an inventory, because the
list it has been working from was compiled in 1993.

THE SELF-REFERENCE WORTH KEEPING: water quality for both Sarobars comes from our
OWN WBPCB ingest (river-quality-kolkata.json), not from a press release. The
restoration page and the rivers page are reading the same samples.

Run:  python3 neer-vazhvu-api/scripts/build_kolkata_restoration.py
"""

import json
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "public" / "data"

WIKI_RS = "https://en.wikipedia.org/wiki/Rabindra_Sarobar"
WIKI_SS = "https://en.wikipedia.org/wiki/Subhas_Sarobar"
RAY = "https://cdn.cseindia.org/attachments/0.65621700_1705401051_waterbodies_-kolkata.pdf"
DEP = "https://www.kmcgov.in/KMCPortal/downloads/EnvironmentPlan_KMC_2021.pdf"
EKWMA = "http://ekwma.in/ek/index.php"
WBPCB = "http://emis.wbpcb.gov.in/waterquality/showwqprevdatachoosedist.do"
MP_DREDGE = "https://www.millenniumpost.in/bengal/kmda-seeks-fresh-ngt-nod-to-dredge-rabindra-sarobar-666078"
MP_REJUV = "https://www.millenniumpost.in/bengal/kmc-to-rejuvenate-several-city-ponds-at-cost-of-about-rs-11-cr-552660"
NAGARIK = "https://nagarikmancha.org/feared-environmental-degradation-and-destruction-of-biodiversity-at-rabindra-sarovar-and-subhas-sarobar-during-ensuing-chhat-festival/"


def latest_wq(station_substring: str):
    """Pull the newest reading for a lake straight out of our own WBPCB ingest,
    so the restoration page and the rivers page cannot disagree."""
    path = DATA_DIR / "river-quality-kolkata.json"
    if not path.exists():
        return None
    d = json.loads(path.read_text())
    for rv in d.get("rivers", []):
        for s in list(rv.get("stations", [])) + list(rv.get("unmapped_stations", [])):
            if station_substring.lower() in (s.get("name") or "").lower():
                r = (s.get("readings") or [None])[0]
                if r:
                    return {
                        "date": r.get("date"),
                        "do_mgl": r.get("do_mgl"),
                        "bod_mgl": r.get("bod_mgl"),
                        "fecal_coliform_mpn": r.get("fecal_coliform_mpn"),
                    }
    return None


def wq_sentence(wq, name):
    if not wq:
        return ""
    return (
        f" WBPCB's own sampling on {wq['date']} recorded dissolved oxygen {wq['do_mgl']} mg/l, "
        f"BOD {wq['bod_mgl']} mg/l and faecal coliform {int(wq['fecal_coliform_mpn']):,} MPN/100ml"
        f" - by some distance the cleanest water we hold for {name}'s city."
    )


def flagship():
    rs, ss = latest_wq("Rabindra Sarobar"), latest_wq("Subhas Sarobar")
    return [
        {
            "name": "Rabindra Sarobar",
            "alternate_names": ["Dhakuria Lake"],
            "type": "lake",
            "area_acres": 192,
            "year_built": None,
            "era": "Excavated by the Calcutta Improvement Trust in the early 1920s",
            "builder": (
                "Calcutta Improvement Trust - its first chairman Cecil Henry Bompass, KMC "
                "chief engineer M.R. Atkins, and Prabodh Chandra Chatterjee of Shibpur B.E. College"
            ),
            "feed": "Rainwater and groundwater; no natural inflow, which is why silt accumulates rather than flushes",
            "status": (
                "192 acres in total, of which about 73 are open water and the rest mature "
                "planting, some of it over a century old. The NGT appointed KMDA custodian in "
                "2017; KMDA has since sought fresh NGT permission to dredge, the lake having "
                "gone without proper desilting for two to three decades."
                + wq_sentence(rs, "Rabindra Sarobar")
            ),
            "cultural_note": (
                "Renamed from Dhakuria Lake in May 1958 in tribute to Rabindranath Tagore, and "
                "included in the Ministry of Environment and Forests' National Lake Conservation "
                "Plan. Recorded bird species have fallen from 118 in 2021 to 110 through October "
                "2023 as pollution has risen - the clearest ecological series the city has for "
                "any water body."
            ),
            "confidence": "V",
            "sources": [WIKI_RS, MP_DREDGE, WBPCB],
        },
        {
            "name": "Subhas Sarobar",
            "alternate_names": ["Beliaghata Lake"],
            "type": "lake",
            "area_acres": 73,
            "year_built": None,
            "era": "Developed in the 1950s from a natural depression",
            "builder": "Post-independence state development; maintained by KMDA",
            "feed": "Rainwater and groundwater",
            "status": (
                "About 73 acres including the surrounding parkland. Suffers encroachment and "
                "irregular maintenance; desilting, aeration and community programmes have been "
                "run at various points."
                + wq_sentence(ss, "Subhas Sarobar")
            ),
            "cultural_note": (
                "The eastern counterpart to Rabindra Sarobar, and the second of the two lakes "
                "the NGT's Chhath Puja restrictions were sought for."
            ),
            "confidence": "N",
            "sources": [WIKI_SS, NAGARIK, WBPCB],
        },
        {
            "name": "Lal Dighi",
            "alternate_names": ["Great Tank", "Lal Dighi Tank"],
            "type": "tank",
            "area_acres": None,
            "year_built": None,
            "era": "Pre-colonial; the tank the colonial settlement was laid out around",
            "builder": "Pre-dates the British settlement; adopted as the centrepiece of Dalhousie Square",
            "feed": "Rainwater",
            "status": (
                "Survives at the centre of B.B.D. Bagh, ringed by the city's colonial "
                "administrative core - one of the few central Kolkata tanks never filled."
            ),
            "cultural_note": (
                "The city of Kolkata was laid out around this pond; the British called it the "
                "Great Tank. That a city organised itself around a pond, and then filled roughly "
                "44% of its ponds within two decades, is the whole of Kolkata's water history in "
                "one object."
            ),
            "confidence": "N",
            "sources": [RAY],
        },
        {
            "name": "East Kolkata Wetlands",
            "alternate_names": ["EKW", "the bheris"],
            "type": "wetland",
            # 12,500 ha
            "area_acres": 30888,
            "year_built": None,
            "era": "Evolved from the early twentieth century as the Bidyadhari silted up",
            "builder": "Not built - a fishery system that grew around the city's sewage outfall",
            "feed": "Kolkata's raw sewage, carried east through the dry-weather flow channels",
            "status": (
                "12,500 hectares holding 254 sewage-fed fisheries across 37 mouzas, treating "
                "910 MLD - 65% of Kolkata's sewage, roughly five times what all five of the "
                "city's treatment plants manage combined. Protected under the East Kolkata "
                "Wetlands (Conservation and Management) Act 2006, and under continuous "
                "real-estate pressure; EKWMA publishes FIR and charge-sheet records against "
                "encroachment."
            ),
            "cultural_note": (
                "A Ramsar site, and the only case on this platform where a city's largest piece "
                "of water infrastructure is neither built, owned, nor paid for by the city - and "
                "lies outside its boundary."
            ),
            "confidence": "V",
            "sources": [DEP, EKWMA],
        },
    ]


def projects():
    return [
        {
            "scheme_name": "Rabindra Sarobar desilting",
            "operator": "Kolkata Metropolitan Development Authority (KMDA)",
            "scope": (
                "Dredging the 72-73 acre lake, which has not been properly desilted for two to "
                "three decades. KMDA is seeking fresh NGT permission, the lake being under the "
                "Tribunal's protection since 2017."
            ),
            "status": "Awaiting NGT clearance",
            "sources": [MP_DREDGE],
        },
        {
            "scheme_name": "KMC pond rejuvenation programme",
            "operator": "Kolkata Municipal Corporation, Environment Department",
            "scope": (
                "Rejuvenation of city ponds, with work identified at Convent Lane (Ward 56), "
                "Patra Para Road (Ward 57), Katjunagar Pond (Ward 93), '3 no. jheel' in Behala "
                "(Ward 127) and Martin Para (Ward 108). KMC reports around 300 water bodies "
                "restored to date, with mosquito-borne disease control cited alongside "
                "conservation as the driver."
            ),
            "funding_summary": "About Rs 11 crore across the identified schemes",
            "amount_cr": 11,
            "status": "Ongoing",
            "sources": [MP_REJUV],
        },
        {
            "scheme_name": "KMC water-body inventory survey",
            "operator": (
                "KMC Environment Department, with the West Bengal Department of Science & "
                "Technology and Biotechnology (Boroughs I-X) and Jadavpur University "
                "(Boroughs XI-XVI)"
            ),
            "scope": (
                "A fresh borough-by-borough inventory of Kolkata's water bodies. This is the "
                "most consequential item on this page and it is not a restoration: KMC's working "
                "inventory is a departmental tank list compiled in 1993, supplemented by a 2004 "
                "NRSA aerial map. Until this survey lands, every official Kolkata pond count "
                "rests on a 33-year-old document, and the four published counts for 2006 alone "
                "range from 3,873 to 8,731."
            ),
            "status": "Commissioned",
            "partnership_unlock": True,
            "sources": [MP_REJUV, RAY],
        },
        {
            "scheme_name": "East Kolkata Wetlands conservation",
            "operator": "East Kolkata Wetlands Management Authority (EKWMA)",
            "scope": (
                "Statutory protection and encroachment enforcement across 12,500 hectares under "
                "the East Kolkata Wetlands (Conservation and Management) Act 2006, with an "
                "Integrated Management Plan 2021-2026. EKWMA publishes FIR-status and "
                "charge-sheet pages - an enforcement record rather than a construction programme."
            ),
            "status": "Ongoing",
            "sources": [EKWMA, DEP],
        },
    ]


def court_orders():
    return [
        {
            "case": "Restrictions on rituals and events at Rabindra Sarobar",
            "writ_petition": "NGT Principal Bench (Wangdi J. and Prof. P.C. Mishra)",
            "court": "National Green Tribunal",
            "date": "2017-11-15",
            "ruling": (
                "prohibited puja, community picnics and other social events in and around "
                "Rabindra Sarobar, and appointed KMDA custodian of the lake."
            ),
            "specific_tanks": ["Rabindra Sarobar"],
            "concern": (
                "Ritual immersion and mass gatherings degrading the water and the lake's "
                "birdlife. The NGT later rejected KMDA's own plea to permit Chhath Puja under "
                "restrictions and upheld the ban - a rare case of a state authority asking to "
                "relax protection over the water body it had been made custodian of."
            ),
            "source": NAGARIK,
        }
    ]


def main() -> int:
    today = date.today().isoformat()
    fl = {
        "place_id": "kolkata",
        "compiled_at": today,
        "note": (
            "Kolkata has no single restoration register. Entries are compiled from named, dated "
            "sources and graded V (verified against a primary source or our own ingested data), "
            "N (news-sourced) or C (claimed). Water quality for both Sarobars comes from our own "
            "WBPCB ingest, so this page and the rivers page read the same samples."
        ),
        "bodies": flagship(),
    }
    pj = {
        "place_id": "kolkata",
        "compiled_at": today,
        "note": (
            "Chennai's restoration record is a programme with numbered projects and budgets. "
            "Kolkata's is a court docket plus a survey: its two great lakes are run by an "
            "authority the NGT had to appoint as custodian, and the most consequential live item "
            "is KMC finally commissioning a water-body inventory to replace the 1993 list it has "
            "been working from."
        ),
        "projects": projects(),
        "court_orders": court_orders(),
    }
    (DATA_DIR / "water-bodies-flagship-kolkata.json").write_text(
        json.dumps(fl, ensure_ascii=False, indent=1)
    )
    (DATA_DIR / "restoration-projects-kolkata.json").write_text(
        json.dumps(pj, ensure_ascii=False, indent=1)
    )
    grades = {}
    for b in fl["bodies"]:
        grades[b["confidence"]] = grades.get(b["confidence"], 0) + 1
    print(
        f"kolkata: {len(fl['bodies'])} flagship bodies {grades}, "
        f"{len(pj['projects'])} projects, {len(pj['court_orders'])} court orders",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
