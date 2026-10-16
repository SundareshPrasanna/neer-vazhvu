#!/usr/bin/env python3
"""
Visakhapatnam facts, DERIVED from the shipped artifacts rather than typed again.

The Pune pattern (build_pune_facts.py): every number on a card is read out of a
file already in public/data or public/geojson, so a quoted card cannot disagree
with the page it came from, and a renamed key stops the build instead of
writing "None MLD" onto a card. Figures an artifact carries only in a note are
checked against that note (`quoted`), so a rewritten note stops the build too.
The exceptions: APPCB's coastal outfall series (COMAPS station 21, and the
names of stations 16, 17 and 22), which no artifact carries in full because
we have not found published coordinates for its stations; the PFAS study;
and CPCB's polluted river stretch lists. Those are dated, quoted with their
page, and listed in the constants below.

The envelope is written fresh: write_artifact keeps an existing file's
envelope, so after a provenance change delete the output and rerun.

No card is tier 1: like every static-facts city, Visakhapatnam's dashboard
keeps the key-findings strip off and the cards live on /facts.

Run:  python3 neer-vazhvu-api/scripts/build_visakhapatnam_facts.py
"""

import json
import re
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

CITY = "visakhapatnam"
DATA = REPO_ROOT / "public" / "data"
GEO = REPO_ROOT / "public" / "geojson"

# APPCB COMAPS annual averages, FY2024-25 (DO / BOD / NH3-N, mg/L), station 21.
# "COMAPS Annual Averages - 2011 - 25( upto March ).pdf", pcb.ap.gov.in, p9;
# the legend (p19) defines NH3-N as ammoniacal nitrogen.
COMAPS_URL = "https://pcb.ap.gov.in/PCBLive/PCB/QualityMonitoring"
COMAPS_LAVENDER = {"do": 0.7, "bod": 7.8, "nh3n": 19.73, "do_2017_18": 6.1, "page": 9}
# The same PDF's mouth stations: 16 'Confluence point of Gosthani river joining
# the sea near Bheemili', 17 'Gambheeram Gedda joining the sea', 22
# 'Mehadrigedda surplus coarse ... joining the sea at parallel bridge near
# dockyard'.
COMAPS_MOUTHS = "16, 22 and 17"

# CPCB's polluted river stretch lists (September 2018; 2022; October 2025, the
# copy NMCG hosts). None of Andhra Pradesh's listed stretches is in
# Visakhapatnam; the 'Gostani' at Vendra is in West Godavari.
PRS_YEARS = "2018, 2022 and 2025"

PFAS = {
    "compounds": 38,
    "targeted": 77,
    "sea_max_ng_l": 597,
    "sewage_max_ng_l": 1324,
    "sewage_share_pct": 41,
    "url": "https://www.nature.com/articles/s44454-026-00046-0",
}

MONTHS = "January February March April May June July August September October November December".split()


def load(path: Path) -> dict:
    with path.open() as f:
        return json.load(f)


def require(obj, *keys, ctx: str = ""):
    cur = obj
    for k in keys:
        if isinstance(cur, dict) and k in cur:
            cur = cur[k]
        elif isinstance(cur, list) and isinstance(k, int) and k < len(cur):
            cur = cur[k]
        else:
            sys.exit(f"facts: missing {'/'.join(map(str, keys))} in {ctx}")
    if cur is None:
        sys.exit(f"facts: null {'/'.join(map(str, keys))} in {ctx}")
    return cur


def quoted(text: str, *needles: str, ctx: str = "") -> None:
    """Stop the build if a figure the card repeats is no longer in its artifact."""
    for n in needles:
        if n not in text:
            sys.exit(f"facts: '{n}' no longer in {ctx}")


def fmt(n: float, places: int = 0) -> str:
    return f"{n:,.{places}f}"


def month_year(iso: str) -> str:
    y, m = iso.split("-")[:2]
    return f"{MONTHS[int(m) - 1]} {y}"


def day_month_year(iso: str) -> str:
    y, m, d = iso.split("-")[:3]
    return f"{int(d)} {MONTHS[int(m) - 1]} {y}"


def fact(
    fid, tier, category, title, value, unit, interpretation, data_date, url, label
) -> dict:
    return {
        "id": fid,
        "tier": tier,
        "category": category,
        "title": title,
        "value": value,
        "unit": unit,
        "interpretation": interpretation,
        "data_date": data_date,
        "source_url": url,
        "source_label": label,
    }


def supply_facts(s: dict, alloc: dict) -> list[dict]:
    mix = require(s, "current_supply_mix_mld", ctx="supply-overview")
    total = require(s, "current_supply_total_mld", ctx="supply-overview")
    godavari = next(m for m in mix if m["source"].startswith("Godavari"))
    raiwada = next(m for m in mix if m["source"].startswith("Raiwada"))
    if sorted(m["mld"] for m in mix)[-2] != raiwada["mld"]:
        sys.exit("facts: Raiwada is no longer the second largest source")
    km = require(
        s, "allocation_context", "transmission_distance_km", ctx="supply-overview"
    )
    wtp = require(
        s, "wtps_summary", "total_installed_capacity_mld", ctx="supply-overview"
    )
    n_wtp = require(s, "wtps_summary", "fresh_water_wtps_count", ctx="supply-overview")
    lo, hi = require(s, "allocation_context", "_lpcd_range", ctx="supply-overview")
    std = require(s, "allocation_context", "_lpcd_standard", ctx="supply-overview")
    cgwb = next(
        x
        for x in s["_sources"]
        if x["name"].startswith("CGWB, Aquifer Management Plan")
    )
    gcap = next(
        x for x in s["_sources"] if "draft posted for public comment" in x["name"]
    )
    cgwb22 = next(x for x in s["_sources"] if "AAP 2020-21" in x["name"])
    quoted(
        require(s, "_supply_total_note", ctx="supply-overview"),
        "GVMC was able to draw 345.5 MLD",
        ctx="supply-overview _supply_total_note",
    )
    quoted(
        require(s, "hero_copy", "body", ctx="supply-overview"),
        f"About {fmt(total)} MLD is available from nine sources",
        "unchanged since its June 2022 report",
        "We have not found a figure that splits the system's share between the two rivers",
        ctx="supply-overview hero_copy.body",
    )
    quoted(
        godavari["note"],
        "182 to 204 MLD",
        f"list the source at {km} km from the city",
        ctx="supply-overview Godavari row",
    )
    sheet = alloc["sources"]["gvmc-2021-sheet"]
    split = {a["id"]: a for a in alloc["arrangements"]}
    gvmc = require(split, "yeleru-viwsco-gvmc", "received", "value", ctx="allocations")
    rinl = require(split, "rinl-viwsco", "received", "value", ctx="allocations")
    quoted(
        require(split, "rinl-viwsco", "received", "note", ctx="allocations"),
        "The sheet prints no unit for its tail-end split",
        ctx="allocations rinl-viwsco",
    )
    quoted(
        require(split, "yeleru-viwsco-gvmc", "received", "note", ctx="allocations"),
        "11 March 2021",
        "0.900 to Rural Water Supply",
        ctx="allocations yeleru-viwsco-gvmc",
    )
    futures = {f["id"]: f for f in alloc["futures"]}
    dc = require(futures, "data-centres-2026", ctx="allocations")
    campuses = re.findall(
        r"([\d,]+) KLD: (\d+) fresh, (\d+) recycled on site", dc["status"]
    )
    if len(campuses) != 3:
        sys.exit(f"facts: data-centre status now splits {len(campuses)} campuses")
    dc_total, dc_fresh, dc_rec = zip(
        *[(int(t.replace(",", "")), int(f), int(r)) for t, f, r in campuses]
    )
    if any(t != f + r for t, f, r in zip(dc_total, dc_fresh, dc_rec)):
        sys.exit("facts: a data-centre total is not its fresh plus recycled water")
    if round(sum(dc_fresh) / 1000, 2) != dc["mld"]:
        sys.exit("facts: data-centres-2026 mld is not the fresh-water figures added")
    dc_all = fmt(sum(dc_total) / 1000, 2)
    quoted(
        dc["status"],
        "18 Apr 2026",
        "10 Jun 2026",
        "name Rural Water Supply and Sanitation as the source of water",
        "so the fresh water is the claim on Rural Water Supply and Sanitation",
        "no cooling-water source is stated",
        f"{fmt(dc['mld'], 2)} MLD is the three fresh-water figures added",
        f"({dc_all} MLD with the water recycled on site)",
        "Press reports of 19 Aug 2026",
        "telling the Assembly that a 6.5 GW cluster would need about 3 TMC of water a year",
        ctx="allocations data-centres-2026",
    )
    park = require(futures, "apiic-dc-park-madhurawada", ctx="allocations")
    quoted(
        park["status"],
        "24 Dec 2024",
        "2,644 KLD",
        "1,429 KLD",
        "is to be met from GVMC",
        "1,215 KLD is recycled water from the park's own sewage treatment plant",
        "the clearance records the request as under process",
        "No GVMC allotment order was found",
        ctx="allocations apiic-dc-park-madhurawada",
    )
    lmc_row = require(
        split, "polavaram-lmc-visakhapatnam", "entitled", ctx="allocations"
    )
    quoted(
        lmc_row["note"],
        "(Jan 2019) cites GO MS No.96 of 10-09-2004 for 24 TMC",
        "CGWB 2025 says 12 TMC for the urban area",
        "the Ministry of Jal Shakti's 2024 note and CAG Report 4 of 2025",
        "The documents also describe the beneficiaries differently",
        ctx="allocations polavaram-lmc-visakhapatnam",
    )
    lmc = lmc_row["value"]
    ppa = alloc["sources"]["ppa"]
    return [
        fact(
            "godavari-largest-source",
            2,
            "Supply",
            f"The largest source is the Godavari and Yeleru, up to {km} km away",
            fmt(godavari["mld"]),
            f"MLD of about {fmt(total)} MLD",
            f"About {fmt(total)} MLD is available from nine sources (GVMC's figures; CGWB's tables carry the same quantities unchanged since its {month_year(cgwb22['date'])} report), and about {fmt(godavari['mld'])} MLD of it comes from the Godavari and Yeleru system. CGWB lists the source at {km} km from the city, and the water reaches the city through the Yeleru canal. The {month_year(cgwb22['date'])} report (AAP 2020-21) said GVMC was able to draw 345.5 MLD of the {fmt(total)}. CGWB gives this source as 182 to 204 MLD; 182 is the figure that makes its own {fmt(total)} MLD total add up. We have not found a figure that splits it between the two rivers. The next largest, Raiwada, gives {raiwada['mld']} MLD.",
            cgwb22["date"],
            cgwb["url"],
            cgwb["name"],
        ),
        fact(
            "canal-shared-with-steel-plant",
            2,
            "Supply",
            "The city shares its largest supply canal with the steel plant",
            f"{gvmc:.3f} vs {rinl:.3f}",
            "million gallons a day, city vs steel plant",
            f"On 11 March 2021, the only day for which we have found GVMC's split, {gvmc:.3f} million gallons of the Yeleru canal's tail-end water went to the city and {rinl:.3f} to the RINL steel plant, with the rest to APIIC's industrial parks, NTPC, the port and rural water supply (0.900). The canal was first built to serve the steel plant. The sheet prints no unit for this split; it is read as million gallons a day, the unit of the sheet's other columns.",
            "2021-03-11",
            sheet["url"],
            sheet["title"],
        ),
        fact(
            "litres-per-person",
            2,
            "Supply",
            f"Litres a person a day, against a {std} litre standard",
            f"{lo} to {hi}",
            "litres a person a day",
            f"The draft Green City Action Plan (prepared by IFC for GVMC, posted by GVMC for comment on 19 Oct 2024) puts average supply at {lo} to {hi} litres a person a day against the national standard of {std}. It is a city-wide average, and the plan does not say how it was worked out.",
            gcap["date"],
            gcap["url"],
            gcap["name"],
        ),
        fact(
            "treatment-capacity",
            3,
            "Supply",
            f"{n_wtp} water treatment plants",
            fmt(wtp),
            "MLD of water treatment capacity",
            f"The draft Green City Action Plan gives GVMC {n_wtp} water treatment plants with {fmt(wtp)} MLD of capacity between them. We have not found a plant-by-plant list with commissioning years.",
            gcap["date"],
            gcap["url"],
            gcap["name"],
        ),
        fact(
            "polavaram-three-figures",
            2,
            "Governance",
            "Three official figures for the city's Polavaram share",
            f"{lmc} / 24 / 12",
            "TMC a year",
            f"The Polavaram Project Authority, the Ministry of Jal Shakti and CAG give {lmc} TMC a year for Visakhapatnam from the Polavaram Left Main Canal. The ADB environmental review GVMC published (January 2019) cites a 2004 order for 24 TMC; CGWB's 2025 plan says 12 TMC for the urban area. The documents also describe the beneficiaries differently, and we have not found the 2004 order itself.",
            str(ppa["year"]),
            ppa["url"],
            f"{ppa['publisher']}, {ppa['title']}",
        ),
        fact(
            "data-centre-water",
            2,
            "Supply",
            "Data-centre campuses, by their clearances",
            fmt(dc["mld"], 2),
            "MLD of fresh water across three campuses",
            f"Environmental clearances issued in April and June 2026 for three data-centre campuses list total water requirements of {dc_total[0]}, {dc_total[1]} and {dc_total[2]} kilolitres a day and name Rural Water Supply and Sanitation as the source of water. Part of each total is the campus's own treated wastewater, recycled on site, so the claim on Rural Water Supply and Sanitation is the fresh water: {dc_fresh[0]}, {dc_fresh[1]} and {dc_fresh[2]} kilolitres a day, {fmt(dc['mld'], 2)} MLD together ({dc_all} MLD with the recycled water). No cooling-water source is stated. A separate December 2024 clearance for APIIC's data-centre and technology park at Madhurawada, inside the city, lists a total water requirement of 2,644 kilolitres a day, of which fresh water, capped at 1,429 kilolitres a day, is to be met from GVMC's supply and the other 1,215 is to be recycled water from the park's own sewage treatment plant; the clearance records APIIC's request for the allotment as under process, and we have not found a GVMC allotment order. Press reports of August 2026 quoted the state IT minister as telling the Assembly that a 6.5 GW cluster would need about 3 TMC of water a year; we have not found the Assembly's own record.",
            "2026-06-10",
            alloc["sources"]["seiaa-dc-2026"]["url"],
            alloc["sources"]["seiaa-dc-2026"]["title"],
        ),
    ]


def sewage_facts(s: dict) -> list[dict]:
    sw = require(s, "_sewage", ctx="supply-overview")
    if sw["population_connected_pct"] != 60:
        sys.exit("facts: sewer coverage is no longer 60%; retitle the sewers card")
    return [
        fact(
            "sewers-reach-60-pct",
            2,
            "Sewage",
            "Sewers reach six in ten people",
            f"{sw['population_connected_pct']}%",
            "of people connected to sewers",
            f"{fmt(sw['households_connected'])} households, {sw['population_connected_pct']}% of the population, are connected to underground drainage, by the state's {month_year(sw['as_of'])} affidavit to the National Green Tribunal.",
            sw["as_of"],
            sw["source_url"],
            sw["source_label"],
        ),
        fact(
            "sewage-treated",
            2,
            "Sewage",
            "Sewage generated against treatment capacity in use",
            fmt(sw["utilised_mld"]),
            f"MLD of plant capacity in use, against {fmt(sw['generation_mld'])} MLD of sewage generated ({month_year(sw['as_of'])})",
            f"The state reports {fmt(sw['generation_mld'])} MLD of sewage generated in Visakhapatnam, {fmt(sw['installed_capacity_mld'])} MLD of treatment capacity installed and {fmt(sw['utilised_mld'])} MLD of plant capacity in use, a gap of {fmt(sw['gap_mld'])} MLD between sewage generated and capacity in use. {fmt(sw['reuse_mld'])} MLD of treated water is reused, {fmt(sw['reuse_to_hpcl_mld'])} MLD of it at the HPCL refinery.",
            sw["as_of"],
            sw["source_url"],
            sw["source_label"],
        ),
    ]


def reservoir_facts(dams: dict) -> list[dict]:
    rows = {d["source_code"]: d for d in require(dams, "dams", ctx="dam-storage")}
    city = [rows[c] for c in ("raiwada", "thatipudi", "meghadrigedda")]
    now = (
        sum(d["storage_mcum"] for d in city)
        / sum(d["live_capacity_mcum"] for d in city)
        * 100
    )
    ago = (
        sum(d["last_year_storage_mcum"] for d in city)
        / sum(d["live_capacity_mcum"] for d in city)
        * 100
    )
    when = require(dams, "as_of", ctx="dam-storage")
    yel = rows["yeleru"]
    year_ago = f"{int(when[:4]) - 1}{when[4:]}"
    for d in city + [yel]:
        if d["date"] != when or d["last_year_date"] != year_ago:
            sys.exit(f"facts: {d['source_code']} is not read on {when} and {year_ago}")
    quoted(
        require(dams, "_note", ctx="dam-storage"),
        "GVMC's own Mudasarlova reservoir and the Gambhiramgedda reservoir are not in this feed",
        ctx="dam-storage _note",
    )
    return [
        fact(
            "city-reservoirs-vs-last-year",
            2,
            "Reservoirs",
            "Three of the reservoirs that supply the city, against a year earlier",
            f"{now:.0f}%",
            f"of live capacity, against {ago:.0f}% a year earlier",
            f"Raiwada, Thatipudi and Meghadrigedda, three of the reservoirs that supply the city, together held {now:.0f}% of their live capacity on {day_month_year(when)}, against {ago:.0f}% on the same date a year earlier. Yeleru, the reservoir behind the city's largest source, held {yel['storage_pct_live']:.0f}% against {yel['last_year_pct_live']:.0f}%. GVMC's own Mudasarlova reservoir and the Gambheeram reservoir are not in the state's daily feed. Live storage is the water above each dam's lowest outlet.",
            when,
            "https://apwrims.ap.gov.in/",
            "APWRIMS daily reservoir storage (Water Resources Department, Government of Andhra Pradesh)",
        )
    ]


def groundwater_facts(gwr: dict, wells: dict) -> list[dict]:
    blocks = {b["name"]: b for b in require(gwr, "blocks", ctx="gwr-blocks")}
    notes = " ".join(require(gwr, "notes", ctx="gwr-blocks"))
    quoted(
        notes,
        "43.85%",
        "NEWER THAN CGWB'S DECEMBER 2025 REPORT",
        "223.88 ham of surface-irrigation recharge",
        "surface-irrigation recharge is cut from 111.95 to 19.19 ham",
        ctx="gwr-blocks notes",
    )

    def edition(name: str, label: str) -> dict:
        return next(h for h in blocks[name]["history"] if h["year_label"] == label)

    def detail(name: str, label: str) -> dict:
        return next(d for d in blocks[name]["detail"] if d["year_label"] == label)

    def drawn(d: dict) -> float:
        return (
            d["draft_domestic_ham"]
            + d["draft_agriculture_ham"]
            + d["draft_industry_ham"]
        )

    rural = edition("Visakhapatnam Rural", "2024-2025")
    rural_new = edition("Visakhapatnam Rural", "2025-2026")
    critical = [
        n for n in blocks if edition(n, "2024-2025")["class"].lower() == "critical"
    ]
    if critical != ["Visakhapatnam Rural"]:
        sys.exit(f"facts: critical units in 2024-2025 are now {critical}")
    gajuwaka = edition("Gajuwaka", "2025-2026")
    gaj_prev = edition("Gajuwaka", "2024-2025")
    gaj_ind = (
        detail("Gajuwaka", "2024-2025")["draft_industry_ham"],
        detail("Gajuwaka", "2025-2026")["draft_industry_ham"],
    )
    urban = [
        "Gopalapatnam",
        "Mulagada",
        "Peddagantyada",
        "Visakhapatnam Rural",
        "Gajuwaka",
        "Maharanipeta",
        "Seethammadhara",
    ]
    dom = tot = 0.0
    for name in urban:
        d = detail(name, "2024-2025")
        dom += d["draft_domestic_ham"]
        tot += drawn(d)
    farm = ["Anandapuram", "Padmanabham", "Pendurthi"]
    farm_min = min(
        detail(n, "2024-2025")["draft_agriculture_ham"] / drawn(detail(n, "2024-2025"))
        for n in farm
    )
    if farm_min <= 0.95:
        sys.exit("facts: a rural mandal's irrigation share fell to 95% or below")
    bhe = detail("Bheemunipatnam", "2024-2025")
    if bhe["draft_domestic_ham"] <= bhe["draft_agriculture_ham"]:
        sys.exit("facts: Bheemunipatnam no longer draws more for homes")
    src_url = require(gwr, "source_url", ctx="gwr-blocks")

    def cls(h: dict) -> str:
        return h["class"].lower().replace(" ", "-")

    # Only the stations file states well, site and series counts; this card
    # carries the record's first year and points to the page.
    w = require(wells, "wells", ctx="cgwb-stations")
    first = min(r["year"] for x in w for r in x["readings"])
    recorders = [x for x in w if x["acquisition"] != "manual"]
    if min(r["year"] for x in recorders for r in x["readings"]) <= first:
        sys.exit("facts: a recorder now starts as early as the oldest hand-read well")
    quoted(
        require(wells, "cadence_note", ctx="cgwb-stations"),
        f"read by hand once a month, the oldest from {first}",
        "kept as separate series",
        ctx="cgwb-stations cadence_note",
    )
    ly, lm = max((r["year"], r["month"]) for x in w for r in x["readings"])
    latest = f"{ly}-{lm:02d}"
    return [
        fact(
            "visakhapatnam-rural-critical",
            2,
            "Groundwater",
            "One mandal drew almost all the groundwater it could in 2024-25",
            f"{rural['development_pct']:.2f}%",
            "of extractable groundwater drawn (2024-25)",
            f"In CGWB's December 2025 report (assessment year 2024-25), Visakhapatnam Rural mandal drew {rural['development_pct']:.2f}% of the groundwater that can be extracted there each year and was rated {cls(rural)}, the district's only such unit. The district as a whole stood at about 44%. The 2025-26 IN-GRES edition, newer than CGWB's December 2025 report, rates it {cls(rural_new)} at {rural_new['development_pct']:.2f}%: its extractable resource rises from {fmt(rural['availability_ham'], 1)} to {fmt(rural_new['availability_ham'], 1)} hectare-metres, with a new 223.9 hectare-metre recharge entry from surface irrigation, while extraction falls from {fmt(rural['draft_total_ham'], 1)} to {fmt(rural_new['draft_total_ham'], 1)} hectare-metres. That is a revised input, not measured change. The groundwater map colours the 2025-26 edition.",
            str(rural["year"]),
            src_url,
            "IN-GRES, Andhra Pradesh, assessment year 2024-25 (CGWB, Dynamic Ground Water Resources of AP 2025)",
        ),
        fact(
            "gajuwaka-2025-26",
            3,
            "Groundwater",
            "Gajuwaka in the newest assessment",
            f"{gajuwaka['development_pct']:.2f}%",
            "of extractable groundwater drawn (2025-26)",
            f"The 2025-26 IN-GRES edition, newer than CGWB's December 2025 report and with rainfall inputs carried over from 2024-25, puts Gajuwaka at {gajuwaka['development_pct']:.2f}% ({cls(gajuwaka)}), up from {gaj_prev['development_pct']:.2f}% a year earlier. Two revised inputs drive the jump: estimated industrial draw goes from {gaj_ind[0]:.1f} to {gaj_ind[1]:.1f} hectare-metres, and recharge from surface irrigation falls from 111.95 to 19.19 hectare-metres, cutting the extractable resource from {fmt(gaj_prev['availability_ham'], 1)} to {fmt(gajuwaka['availability_ham'], 1)} hectare-metres.",
            str(gajuwaka["year"]),
            src_url,
            "IN-GRES, Andhra Pradesh, assessment year 2025-26 (newer than CGWB's December 2025 report)",
        ),
        fact(
            "city-groundwater-is-domestic",
            2,
            "Groundwater",
            "In the city, groundwater is drawn for homes",
            f"{dom / tot * 100:.0f}%",
            "of groundwater drawn in the seven urban mandals goes to homes",
            f"In 2024-25, {fmt(dom, 1)} of the {fmt(tot, 1)} hectare-metres drawn in the seven urban mandals was for domestic use. In Anandapuram, Padmanabham and Pendurthi, more than 95% of it is irrigation; in Bheemunipatnam, homes take a little more than half ({fmt(bhe['draft_domestic_ham'], 1)} of {fmt(drawn(bhe), 1)} hectare-metres).",
            str(rural["year"]),
            src_url,
            "IN-GRES, Andhra Pradesh, assessment year 2024-25",
        ),
        fact(
            "wells-on-record",
            4,
            "Groundwater",
            "Wells on the groundwater map",
            str(first),
            "the year the oldest hand-read well records begin",
            f"The groundwater page plots wells inside the eleven mandals: AP Ground Water Department wells read by hand once a month, the oldest from {first}, and automatic recorders on the state's APWRIMS portal, read every day and shown as monthly means. Where a recorder and a hand-read well stand at the same site, they are kept as separate series. The wells are too few for a depth map of each ward.",
            latest,
            require(wells, "source_url", ctx="cgwb-stations"),
            require(wells, "source_label", ctx="cgwb-stations"),
        ),
    ]


def water_quality_facts(rq: dict) -> list[dict]:
    quoted(
        require(rq, "_framing", ctx="river-quality"),
        "no river station on any Visakhapatnam or Anakapalli river",
        ctx="river-quality _framing",
    )
    years = require(rq, "data_year_range", ctx="river-quality")
    rivers = require(rq, "rivers", ctx="river-quality")
    notes = {r["name"]: r["notes"] for r in rivers}
    desc = {r["name"]: r["description"] for r in rivers}
    stations = {st["id"]: st for r in rivers for st in r["stations"]}
    # The card names each station: Meghadrigedda reservoir and the dockyard
    # creek (Meghadri Gedda), Thatipudi reservoir (Gosthani), the Yeleru canal.
    if len(rivers) != 3 or set(stations) != {
        "nwmp-5160",
        "nwmp-5678",
        "nwmp-4927",
        "nwmp-4356",
    }:
        sys.exit("facts: river-quality channels or stations changed; rewrite the card")
    creek, creek_notes = stations["nwmp-5678"], notes["Meghadri Gedda"]
    quoted(
        desc.get("Gosthani", ""),
        "Thatipudi reservoir on the Gosthani, upstream in Vizianagaram district",
        ctx="river-quality Gosthani description",
    )
    quoted(
        desc.get("Yeleru Left Main Canal", ""),
        "near Jawaharlal Nehru Pharma City at Parawada",
        ctx="river-quality Yeleru canal description",
    )
    # The APPCB mouth stations the gap card names, as river-quality carries them.
    quoted(
        notes.get("Meghadri Gedda", ""),
        "APPCB samples the surplus course",
        "joins the sea",
        ctx="river-quality Meghadri Gedda notes",
    )
    quoted(
        notes.get("Gosthani", ""),
        "where the Gosthani joins the sea near Bheemili",
        ctx="river-quality Gosthani notes",
    )
    quoted(creek_notes, "4.0 mg/L", "below 3.0 mg/L", ctx="river-quality creek notes")
    r23 = next(r for r in creek["readings"] if r["year"] == 2023)
    r24 = next(r for r in creek["readings"] if r["year"] == 2024)
    return [
        fact(
            "no-river-station",
            2,
            "Gap",
            "CPCB samples the city's channels at reservoirs, a creek and a canal",
            str(len(stations)),
            f"CPCB stations on the city's channels in its {years[0]}-{years[1]} tables, none of them a river-type station",
            f"In its {years[0]}-{years[1]} tables, CPCB's national water quality programme samples the city's three channels at four stations: the Meghadrigedda reservoir and a creek by the Naval Dockyard on the Meghadri Gedda, Thatipudi reservoir on the Gosthani, upstream in Vizianagaram district, and the Yeleru canal near Pharma City at Parawada. None is a river-type station: the tables list no river station on any river or gedda in Visakhapatnam or Anakapalli. CPCB's other stations here are one lake, the sea and groundwater wells. APPCB's coastal monitoring samples the Gosthani, the Meghadri Gedda's surplus course and the Gambheeram Gedda where they meet the sea (its stations {COMAPS_MOUTHS}). No stretch here appears in CPCB's polluted river lists of {PRS_YEARS}. Without river stations, those lists say nothing either way about these rivers.",
            str(years[1]),
            "https://cpcb.gov.in/nwmp-data-2024/",
            f"CPCB National Water Quality Monitoring Programme, {years[0]}-{years[1]}; APPCB COMAPS annual averages 2011-2025 (stations 16, 17 and 22); CPCB polluted river stretch lists, {PRS_YEARS}",
        ),
        fact(
            "dockyard-creek-oxygen",
            2,
            "Rivers",
            "Oxygen in the creek by the Naval Dockyard",
            f"{r24['do_mgl']['min']}",
            "mg/L dissolved oxygen at its lowest (2024), against CPCB's coastal benchmark of 4",
            f"At the Sardar Vallabhai Patel Bridge by the Naval Dockyard, where the Meghadri Gedda's channel reaches the harbour, CPCB's {r24['n_samples']} samples in 2024 recorded dissolved oxygen as low as {r24['do_mgl']['min']} mg/L, after {r23['do_mgl']['min']} mg/L in 2023. CPCB's 2024 coastal table prints 4.0 mg/L, its criterion for bathing-class (SW-II) water, at the head of every page. Both readings are also below 3.0 mg/L, the lowest oxygen floor of any coastal class, harbour waters (SW-IV) included.",
            str(r24["year"]),
            "https://cpcb.gov.in/nwmp-data-2024/",
            "CPCB National Water Quality Monitoring Programme, creek and marine tables 2023 and 2024; coastal class floors from APPCB's COMAPS tables (p19)",
        ),
        fact(
            "lavender-canal-oxygen",
            2,
            "Coastal",
            "Oxygen where a sewage canal meets the harbour",
            str(COMAPS_LAVENDER["do"]),
            "mg/L dissolved oxygen, 2024-25 average",
            f"APPCB's coastal monitoring at the confluence of the 'lavender canal' sewage with the sea at the harbour averaged {COMAPS_LAVENDER['do']} mg/L of dissolved oxygen, {COMAPS_LAVENDER['bod']} mg/L BOD and {COMAPS_LAVENDER['nh3n']} mg/L ammoniacal nitrogen (NH3-N, ammonia measured as nitrogen) in 2024-25. In 2017-18 the same station averaged {COMAPS_LAVENDER['do_2017_18']} mg/L of oxygen.",
            "2025-03",
            COMAPS_URL,
            f"APPCB, COMAPS annual averages 2011-2025, p{COMAPS_LAVENDER['page']}",
        ),
        fact(
            "pfas-research",
            3,
            "Coastal",
            "Research: 'forever chemicals' in the sea and sewage",
            str(PFAS["compounds"]),
            f"of {PFAS['targeted']} PFAS compounds detected (June 2025 samples)",
            f"A 2026 peer-reviewed study found {PFAS['compounds']} PFAS compounds in Visakhapatnam's coastal water and sewage, up to {PFAS['sea_max_ng_l']} ng/L in seawater and {fmt(PFAS['sewage_max_ng_l'])} ng/L in sewage, and estimated that sewage accounts for about {PFAS['sewage_share_pct']}% of median coastal PFAS concentrations. This is research, not official monitoring; we have not found an official response.",
            "2025-06",
            PFAS["url"],
            "Khalid et al., npj Emerging Contaminants 2:28 (2026)",
        ),
    ]


def water_body_facts(rest: dict, wb: dict) -> list[dict]:
    projects = require(rest, "projects", ctx="restoration-projects")
    total = sum(p["amount_cr"] for p in projects)
    done = sum(1 for p in projects if str(p["status"]).startswith("Completed"))
    open_ = [p for p in projects if not str(p["status"]).startswith("Completed")]
    if len(open_) != 1:
        sys.exit(f"facts: {len(open_)} AMRUT tanks not completed; card says one")
    m = re.search(r" at (\w+) \(AMRUT", open_[0]["scheme_name"])
    if not m:
        sys.exit("facts: cannot read the open AMRUT tank's name")
    for p in projects:
        quoted(
            str(p["status"]),
            "as on 5 March 2026",
            ctx=f"restoration {p['scheme_name']}",
        )
    quoted(
        require(rest, "note", ctx="restoration-projects"),
        "checked 14 Oct 2026",
        "a 12th, Rajupalem tank",
        "Rs 2.00 crore at DPR stage",
        ctx="restoration-projects note",
    )
    quoted(
        open_[0]["scope"],
        "has no Thungalam row",
        "in place of Thungalam, a Rs 1.27 crore 'Thimmaraju Tank' project",
        "appears to be the same project under a new name; MoHUA's live list has no project IDs and does not say so",
        ctx="restoration open AMRUT tank scope",
    )
    osm = require(wb, "provenance", "sources", 0, ctx="water-bodies-current")
    return [
        fact(
            "amrut-tank-rejuvenation",
            2,
            "Restoration",
            "Tanks rejuvenated under AMRUT 2.0",
            f"{done} of {len(projects)}",
            f"tank projects completed by 5 March 2026 (Rs {total:.2f} crore)",
            f"MoHUA's status list of 5 March 2026 shows {len(projects)} GVMC water-body projects under AMRUT 2.0, worth Rs {total:.2f} crore together: {done} completed and one, {m.group(1)}, under way. MoHUA's live list, checked on 14 Oct 2026, also shows a 12th, a Rs 2.00 crore project at Rajupalem at DPR stage, which is not counted here. It has no {m.group(1)} row. In its place is a Rs {open_[0]['amount_cr']:.2f} crore 'Thimmaraju Tank' project, which appears to be the same project under a new name; MoHUA's live list has no project IDs and does not say so.",
            "2026-03-05",
            projects[0]["sources"][0]
            if projects[0].get("sources")
            else "https://amrut.mohua.gov.in/",
            "MoHUA, Status of Approved Projects under AMRUT 2.0 in Andhra Pradesh, as on 05-03-2026",
        ),
        fact(
            "water-bodies-mapped",
            4,
            "Water bodies",
            "Water bodies on the map",
            fmt(len(require(wb, "features", ctx="water-bodies-current"))),
            "water bodies mapped in and around the city",
            f"The water-bodies map draws every pond, tank, lake and reservoir OpenStreetMap holds in and around GVMC, as retrieved on {day_month_year(osm['retrieved'])}. It is not an official register: we have not found a gazetted lake register. No list of lost tanks is shown: we have not found a published official one.",
            osm["retrieved"],
            "https://www.openstreetmap.org/",
            osm["publisher"],
        ),
    ]


def shoreline_facts(tr: dict, zones: dict) -> list[dict]:
    feats = [f["properties"] for f in require(tr, "features", ctx="coastal-transects")]
    high = [p for p in feats if p.get("confidence") == "high"]
    eroding = sum(1 for p in high if p["trend"] == "erosion")
    stable = sum(1 for p in high if p["trend"] == "stable")
    period = require(high, 0, "period", ctx="coastal-transects")
    z = {
        f["properties"]["zone_id"]: f["properties"]
        for f in require(zones, "features", ctx="coastal-zones")
    }
    low = [k for k, p in z.items() if p["class_label"].startswith("Low Erosion")]
    if low != ["II", "IV", "VII", "VIII"]:
        sys.exit(f"facts: MoES Low Erosion zones are now {low}")
    for k in ("V", "VI"):
        if z[k]["class_label"] != "Not on the erosion-prone list (MoES 2024)":
            sys.exit(f"facts: zone {k} now carries an official class")
    quoted(z["VII"]["summary"], "Mangamari Peta to Bheemili", ctx="coastal-zones VII")
    quoted(
        z["VIII"]["summary"],
        "Bheemunipatnam to Pedanagamayyapalem",
        ctx="coastal-zones VIII",
    )
    for k in ("V", "VI"):
        quoted(z[k]["summary"], "2024", ctx=f"coastal-zones {k}")
    quoted(z["IV"]["summary"], "managed beach", ctx="coastal-zones IV")
    rk = [p for p in high if p.get("zone_id") == "IV"]
    rk_stable = sum(1 for p in rk if p["trend"] == "stable")
    if rk_stable * 2 <= len(rk):
        sys.exit("facts: RK Beach no longer reads mostly stable")
    return [
        fact(
            "shoreline-eroding-share",
            2,
            "Shoreline",
            "How much of the city's coast is retreating",
            f"{eroding / len(high) * 100:.0f}%",
            f"of {len(high)} reliable points retreating ({period})",
            f"Measured from Landsat and Sentinel-2 images every 100 m from Appikonda to Pedda Nagamayyapalem, just north of Bheemunipatnam: {len(high)} of the {len(feats)} points measured give a reliable reading, and {eroding} of those {len(high)} are retreating and {stable} are stable. The Ministry of Earth Sciences (Lok Sabha reply, 11 Dec 2024, drawing on NCCR's shoreline assessment) classes four stretches here as Low Erosion: Yarada, RK Beach, 'Mangamari Peta to Bheemili' and 'Bheemunipatnam to Pedanagamayyapalem'. Its list does not name Lawson's Bay or Rushikonda. RK Beach reads mostly stable here ({rk_stable} of its {len(rk)} reliable points), and the port adds dredged sand to it, so that is a managed beach.",
            period.split("-")[-1],
            z["IV"]["source_url"],
            "Our satellite measurement, set beside NCCR's National Assessment of Shoreline Changes (2018) and MoES Lok Sabha answer 2638 (2024)",
        )
    ]


def rainfall_facts(imd: dict) -> list[dict]:
    normal = require(imd, "normals", "annual_mean_mm", ctx="imd-rainfall")
    if normal <= 0:
        sys.exit(
            "facts: IMD normal is not positive - refusing to publish a zero-rainfall card"
        )
    p = require(imd, "normal_period", ctx="imd-rainfall")
    period = f"{p[0]}-{p[1]}" if isinstance(p, list) else str(p)
    gp = require(imd, "grid_point", ctx="imd-rainfall")
    cell = f"{gp['lat']} N, {gp['lon']} E"
    recent = [
        r["total_mm"]
        for r in require(imd, "annual_totals", ctx="imd-rainfall")
        if 1991 <= r["year"] <= 2020
    ]
    if len(recent) != 30:
        sys.exit("facts: IMD cell is missing a year in 1991-2020")
    note = require(imd, "note", ctx="imd-rainfall")

    def from_note(rx: str) -> str:
        m = re.search(rx, note)
        if not m:
            sys.exit(f"facts: IMD note no longer matches {rx!r}")
        return m.group(1)

    airport = from_note(r"'Visakhapatnam\(AP\)', of ([\d,.]+) mm \(Climatological")
    other = from_note(r"station index 43150\) has a 1991-2020 normal of ([\d,.]+) mm")
    district = from_note(r"district normal is ([\d,.]+) mm")
    return [
        fact(
            "rainfall-normal",
            3,
            "Rainfall",
            "An average year's rain over the city",
            fmt(normal),
            f"mm a year, IMD gridded data at {gp['lat']} N {gp['lon']} E ({period} mean)",
            f"Our average of IMD's 0.25-degree gridded rainfall for the grid cell over the city ({cell}) is about {fmt(normal)} mm a year over {period}. Over 1991-2020 the same cell gives {fmt(sum(recent) / 30)} mm, close to the {airport} mm normal of IMD's Visakhapatnam airport observatory; IMD's other Visakhapatnam observatory (station 43150) has a 1991-2020 normal of {other} mm, and the AP planning department's normal for the district is {district} mm.",
            str(p[1]) if isinstance(p, list) else "2020",
            "https://imdpune.gov.in/cmpg/Griddata/Rainfall_25_NetCDF.html",
            f"IMD 0.25 degree gridded rainfall, cell {gp['lat']} N {gp['lon']} E (our average); IMD Climatological Tables 1991-2020 for the station normals",
        )
    ]


def main() -> int:
    s = load(DATA / "visakhapatnam-supply-overview.json")
    alloc = load(DATA / "allocations-visakhapatnam.json")
    facts = (
        supply_facts(s, alloc)
        + sewage_facts(s)
        + reservoir_facts(load(DATA / "visakhapatnam-dam-storage.json"))
        + groundwater_facts(
            load(DATA / "gwr-blocks-visakhapatnam.json"),
            load(DATA / "visakhapatnam-cgwb-stations.json"),
        )
        + water_quality_facts(load(DATA / "river-quality-visakhapatnam.json"))
        + water_body_facts(
            load(DATA / "restoration-projects-visakhapatnam.json"),
            load(GEO / "visakhapatnam-water-bodies-current.geojson"),
        )
    )
    facts += shoreline_facts(
        load(GEO / "visakhapatnam-coastal-transects.geojson"),
        load(GEO / "visakhapatnam-coastal-zones.geojson"),
    )
    imd_path = DATA / "imd-rainfall-monthly-visakhapatnam.json"
    if imd_path.exists():
        facts += rainfall_facts(load(imd_path))
    today = date.today().isoformat()
    out = {
        "nvdm": "1.0",
        "dataset": "data-root/facts",
        "scope": {"kind": "city", "id": CITY},
        "provenance": {
            "sources": [
                {
                    "id": sid,
                    "title": title,
                    "publisher": pub,
                    "license": registry_license(sid),
                    "role": "input",
                }
                for sid, title, pub in [
                    (
                        "cgwb-visakhapatnam-aquifer-plans",
                        "Supply by source: CGWB's 2025 aquifer plan, Table 9.1, with the same quantities as Table 5.1 of its June 2022 district report (via visakhapatnam-supply-overview.json)",
                        "Central Ground Water Board",
                    ),
                    (
                        "ngt-andhra-filings",
                        "GVMC's daily supply sheet of 11 March 2021 (NGT OA 14/2021 (SZ)) and the Government of Andhra Pradesh affidavit of Feb 2026 in NGT Principal Bench OA 606/2018 (via the supply-overview and allocations artifacts)",
                        "National Green Tribunal",
                    ),
                    (
                        "apwrims-reservoirs",
                        "Daily reservoir storage (via visakhapatnam-dam-storage.json)",
                        "Water Resources Department, Government of Andhra Pradesh",
                    ),
                    (
                        "ingres-groundwater-andhra",
                        "Mandal assessments (via gwr-blocks-visakhapatnam.json)",
                        "IN-GRES",
                    ),
                    (
                        "cpcb-nwmp-visakhapatnam",
                        "NWMP water quality (via river-quality-visakhapatnam.json), its 2019-2024 Ground Water tables, and the polluted river stretch lists of September 2018, 2022 and October 2025",
                        "Central Pollution Control Board",
                    ),
                    (
                        "appcb-coastal-monitoring",
                        "COMAPS coastal annual averages 2011-2025: station 21 (lavender canal), and stations 16, 17 and 22 where the Gosthani, the Gambheeram Gedda and the Meghadri Gedda surplus course meet the sea",
                        "Andhra Pradesh Pollution Control Board",
                    ),
                    (
                        "mohua-amrut-status-ap",
                        "AMRUT 2.0 projects (via restoration-projects-visakhapatnam.json)",
                        "Ministry of Housing and Urban Affairs",
                    ),
                    (
                        "nccr-shoreline-assessment",
                        "NCCR's shoreline assessment and the MoES Lok Sabha reply (USQ 2638, 2024) that gives its stretch classes (via visakhapatnam-coastal-zones.geojson)",
                        "National Centre for Coastal Research",
                    ),
                    (
                        "gvmc-whats-new",
                        "The draft Green City Action Plan (IFC for GVMC), posted by GVMC for comment on 19 Oct 2024: litres a person a day and treatment plants (via visakhapatnam-supply-overview.json)",
                        "Greater Visakhapatnam Municipal Corporation",
                    ),
                    (
                        "ppa-polavaram",
                        "Visakhapatnam's share of the Polavaram Left Main Canal (via allocations-visakhapatnam.json)",
                        "Polavaram Project Authority",
                    ),
                    (
                        "seiaa-ap-clearances",
                        "Environmental clearances for three data-centre campuses (April and June 2026) and APIIC's data-centre park at Madhurawada (December 2024) (via allocations-visakhapatnam.json)",
                        "State Environment Impact Assessment Authority, Andhra Pradesh",
                    ),
                    (
                        "osm-visakhapatnam-water",
                        "Ponds, tanks, lakes and reservoirs (via visakhapatnam-water-bodies-current.geojson)",
                        "OpenStreetMap contributors",
                    ),
                    (
                        "imd-gridded-rainfall-visakhapatnam",
                        "0.25-degree gridded rainfall for the cell over the city (via imd-rainfall-monthly-visakhapatnam.json)",
                        "India Meteorological Department",
                    ),
                ]
            ],
            "method": "derived",
            "produced_at": today,
            "produced_by": "neer-vazhvu-api/scripts/build_visakhapatnam_facts.py",
            "internal_inputs": [
                "public/data/visakhapatnam-supply-overview.json",
                "public/data/allocations-visakhapatnam.json",
                "public/data/visakhapatnam-dam-storage.json",
                "public/data/gwr-blocks-visakhapatnam.json",
                "public/data/visakhapatnam-cgwb-stations.json",
                "public/data/river-quality-visakhapatnam.json",
                "public/data/restoration-projects-visakhapatnam.json",
                "public/geojson/visakhapatnam-water-bodies-current.geojson",
                "public/geojson/visakhapatnam-coastal-transects.geojson",
                "public/geojson/visakhapatnam-coastal-zones.geojson",
                "public/data/imd-rainfall-monthly-visakhapatnam.json",
            ],
            "note": "Every figure is read from an artifact this site already serves, except these, which the producer carries as dated constants with their page: APPCB's COMAPS averages for station 21 and the names of its stations 16, 17 and 22; CPCB's polluted river stretch lists (2018, 2022, 2025); and the PFAS research figures.",
        },
        "place_id": CITY,
        "generated_at": today,
        "note": "Static snapshot. Re-run after any input artifact changes.",
        "facts": facts,
    }
    write_artifact(DATA / "facts-visakhapatnam.json", out, indent=1)
    tiers: dict[int, int] = {}
    for f in facts:
        tiers[f["tier"]] = tiers.get(f["tier"], 0) + 1
    print(
        f"wrote {len(facts)} facts: "
        + " ".join(f"tier{t}={tiers[t]}" for t in sorted(tiers))
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
