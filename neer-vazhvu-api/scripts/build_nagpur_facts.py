#!/usr/bin/env python3
"""
Nagpur facts, derived from the shipped artifacts rather than typed again.

Every number on a card is read out of a file in public/data or public/geojson,
so a card cannot disagree with the page it summarises (the Ahmedabad and Pune
pattern). require() makes a renamed key stop the build instead of writing a
blank onto a quotable card; num() does the same for a figure held inside an
artifact's own sentence. Thresholds that are norms rather than data (CPCB's
bathing criteria, CGWB's 70% line) are written as norms.

Order is the reading order: the featured cards come first, most current first,
because the dashboard strip shows the first featured card of each category.
Tiers are the facts page's freshness badges (1 Live, 2 Annual, 3 Historical,
4 Structural), and no Nagpur card is live, so the strip is picked with
`featured` rather than tier 1.
data_date is the month or year the figure describes; for a document's
statement of its current state (a budget count) it is the document's month.
The ESR 2023-24 cards all carry the end of its year, 2024-03, and the IN-GRES
cards the first year of their edition (2025 for 2025-2026), so one report
never shows two badge years (data_date must be an ISO date, year-month or
year: envelope.schema.json).

Run after the artifacts it reads, and after build_ward_profiles.py --city nagpur:
  python3 neer-vazhvu-api/scripts/build_nagpur_facts.py
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

DATA = REPO_ROOT / "public" / "data"
GEO = REPO_ROOT / "public" / "geojson"
ESR = "https://nmcnagpur.gov.in/assets/300/2025/08/Public-Notices/ESR_Final_Report_2023-2024.pdf"
BUDGET = "https://nmcnagpur.gov.in/assets/300/2026/06/mediafiles/6a1d606eebca4_nmcbudget2026.pdf"
GR_2020 = "https://gr.maharashtra.gov.in/Site/Upload/Government%20Resolutions/Marathi/202003191442414827.pdf"
INGRES = "https://ingres.iith.ac.in/"
MPCB = "https://mpcb.gov.in/en/river-polluted-streches/water_quality_of_polluted_river_stretches"

INPUTS = {
    "supply": "public/data/nagpur-supply-overview.json",
    "alloc": "public/data/allocations-nagpur.json",
    "dams": "public/data/nagpur-dam-storage.json",
    "gwr": "public/data/gwr-blocks-nagpur.json",
    "wells": "public/data/nagpur-cgwb-stations.json",
    "rq": "public/data/river-quality-nagpur.json",
    "commits": "public/data/commitments-nagpur.json",
    "flagship": "public/data/water-bodies-flagship-nagpur.json",
    "flood": "public/data/flood-lines-nagpur.json",
    "rain": "public/data/imd-rainfall-monthly-nagpur.json",
    "profiles": "public/data/nagpur-ward-profiles.json",
    "stps": "public/geojson/nagpur-stps.geojson",
    "wards": "public/geojson/nagpur-wards-2025.geojson",
    "bodies": "public/geojson/nagpur-water-bodies-current.geojson",
}

SOURCES = [
    (
        "nmc-esr",
        "NMC Environment Status Report 2023-24",
        "Nagpur Municipal Corporation",
    ),
    ("nmc-budget", "NMC Budget 2026-27", "Nagpur Municipal Corporation"),
    (
        "mahagr-wrd-resolutions",
        "WRD resolution on Pench water use, 19 Mar 2020",
        "Water Resources Department, Government of Maharashtra",
    ),
    (
        "mwrra-case-8-2017",
        "MWRRA Order 13/2018 (Case 8 of 2017)",
        "Maharashtra Water Resources Regulatory Authority",
    ),
    (
        "wrd-pravah-nagpur-dams",
        "Maharashtra WRD Pravah daily dam bulletin",
        "Water Resources Department, Government of Maharashtra",
    ),
    (
        "ingres-groundwater-maharashtra",
        "IN-GRES assessment, Nagpur district talukas",
        "CGWB / IIT-Hyderabad (IN-GRES)",
    ),
    (
        "nwic-nwdp-groundwater-maharashtra",
        "NWDP groundwater telemetry, Nagpur district",
        "National Water Informatics Centre",
    ),
    (
        "nmc-esr-river-stp-tables",
        "NMC ESR 2023-24 river sampling and sewage plant tables",
        "Nagpur Municipal Corporation",
    ),
    (
        "mpcb-prs-monthly-nagpur-rivers",
        "MPCB monthly readings, Kanhan, Kolar and Wainganga",
        "Maharashtra Pollution Control Board",
    ),
    (
        "cpcb-prs-report",
        "CPCB Polluted River Stretches, 2018, 2022 and 2025",
        "Central Pollution Control Board",
    ),
    (
        "mahagr-nagpur-resolutions",
        "Government Resolutions on Nagpur's water, sewage and lakes",
        "Government of Maharashtra",
    ),
    (
        "nagpur-court-docket",
        "Court and tribunal orders on Nagpur's lakes and rivers",
        "Supreme Court of India, Bombay High Court (Nagpur Bench), National Green Tribunal",
    ),
    (
        "amrut2-portal-nagpur",
        "AMRUT 2.0 portal, Nagpur list",
        "Ministry of Housing and Urban Affairs",
    ),
    (
        "cwc-nrld-2019-nagpur",
        "National Register of Large Dams, 2019",
        "Central Water Commission",
    ),
    (
        "maharashtra-gazetteer-nagpur-1966",
        "Maharashtra State Gazetteer, Nagpur District (1966)",
        "Government of Maharashtra",
    ),
    (
        "mrsac-waterbodies-10k-2017-18",
        "MRSAC 1:10,000 water bodies, 2017-18",
        "Maharashtra Remote Sensing Applications Centre (MRSAC)",
    ),
    (
        "mrsac-gatishakti-dma-wards",
        "MRSAC PM Gati Shakti ward layer",
        "Maharashtra Remote Sensing Applications Centre (MRSAC)",
    ),
    (
        "sec-maharashtra-nmc-ward-formation-2025",
        "Final ward notification, 4 Oct 2025",
        "Nagpur Municipal Corporation, with the State Election Commission, Maharashtra",
    ),
    (
        "wrd-flood-line-maps",
        "WRD red and blue flood-line register",
        "Water Resources Department, Government of Maharashtra",
    ),
    (
        "imd-gridded-rainfall-nagpur",
        "IMD gridded rainfall, cell 21.0 N 79.0 E",
        "India Meteorological Department",
    ),
]


def load(key: str) -> dict:
    return json.loads((REPO_ROOT / INPUTS[key]).read_text())


def require(obj, *keys):
    for k in keys:
        if isinstance(obj, dict) and k in obj:
            obj = obj[k]
        elif isinstance(obj, list) and isinstance(k, int) and k < len(obj):
            obj = obj[k]
        else:
            raise SystemExit(f"facts: missing {keys} - an artifact changed shape")
    if obj is None:
        raise SystemExit(f"facts: {keys} is null")
    return obj


def one(items, pred, what: str):
    hits = [x for x in items if pred(x)]
    if len(hits) != 1:
        raise SystemExit(f"facts: expected one {what}, found {len(hits)}")
    return hits[0]


def num(text: str, pattern: str, what: str) -> float:
    """A figure held inside an artifact's own sentence; stop if the wording moved."""
    m = re.search(pattern, text)
    if not m:
        raise SystemExit(f"facts: {what} not found in its artifact text")
    return float(m.group(1).replace(",", ""))


def fmt(n: float) -> str:
    return f"{n:,.0f}" if float(n).is_integer() else f"{n:,}"


def main() -> int:
    supply, alloc, dams, gwr = load("supply"), load("alloc"), load("dams"), load("gwr")
    wells, rq, commits = load("wells"), load("rq"), load("commits")
    flagship, flood, rain = load("flagship"), load("flood"), load("rain")
    profiles, stps, wards, bodies = (
        load("profiles"),
        load("stps"),
        load("wards"),
        load("bodies"),
    )

    # Supply.
    plants = require(supply, "wtps_summary", "plants")
    total_cap = require(supply, "wtps_summary", "total_installed_capacity_mld")
    pench = [p for p in plants if p["raw_water"] == "Pench"]
    kanhan = one(plants, lambda p: p["raw_water"] == "Kanhan", "Kanhan plant")
    pench_mld = sum(p["capacity_mld"] for p in pench)
    if pench_mld + kanhan["capacity_mld"] != total_cap:
        raise SystemExit("facts: plant capacities no longer add to the total")
    km_chain = require(supply, "allocation_context", "transmission_distance_km")
    tankers = require(supply, "service_levels", "tankers_nmc")
    t_first, t_last = tankers[0], tankers[-1]
    base = re.match(r"^(\d{4}) \(ESR\) or (\d{4}) \(Budgets\)$", t_first["when"])
    if not base:
        raise SystemExit("facts: the tanker baseline's dating moved")
    tanker_series = (
        f"{fmt(t_first['count'])} (dated {base.group(1)} in its environment reports and {base.group(2)} in its budgets), "
        + ", ".join(f"{fmt(t['count'])} in {t['when']}" for t in tankers[1:])
    )
    wb = require(supply, "water_balance_2023_24")
    wb22 = require(supply, "water_balance_2022_23")
    dark = require(supply, "service_levels", "dark_zones")
    dark_now = one(dark, lambda d: d["year"] == "2023-24", "2023-24 dark-zone row")
    dark_prev = one(dark, lambda d: d["year"] == "2022-23", "2022-23 dark-zone row")
    samples = require(supply, "service_levels", "point_of_use_samples_2023_24")
    dist = require(supply, "distribution")

    # Allocations.
    pench_arr = one(
        require(alloc, "arrangements"), lambda a: a["id"] == "pench-nmc", "pench-nmc"
    )
    entitled = require(pench_arr, "entitled", "value")
    # The ledger shows no Pench delivery figure (billed and treated disagree);
    # the bill and the treated output are read from its note.
    received_note = require(pench_arr, "received", "note")
    bill_year = re.search(r"the two (\d{4}-\d{2}) figures disagree", received_note)
    if not bill_year:
        raise SystemExit("facts: the Pench received note's year moved")
    bill_year = bill_year.group(1)
    pench_bill = num(received_note, r"bills ([\d.]+) Mcum", "Pench bill")
    pench_treated = num(received_note, r"about (\d+) Mcum over a year", "Pench treated")
    events = require(alloc, "events")
    plan = num(
        one(events, lambda e: e["year"] == 1965, "1965 event")["title"],
        r"^(\d+) Mcum",
        "1965 share",
    )
    extra = num(
        one(events, lambda e: e["year"] == 1998, "1998 event")["title"],
        r"^(\d+) Mcum",
        "1998 share",
    )
    if plan + extra != entitled:
        raise SystemExit(
            "facts: the 1965 and 1998 shares no longer add to the entitlement"
        )
    lohg = one(
        require(alloc, "futures"),
        lambda f: f["id"] == "lohghogari-341",
        "Lohghogari future",
    )
    phase2 = num(lohg["status"], r"rises to (\d+) Mcum", "phase-2 share")

    # Reservoirs.
    dam_list = require(dams, "dams")
    tot = one(dam_list, lambda d: d["source_code"] == "totladoh", "Totladoh")
    nk = one(
        dam_list, lambda d: d["source_code"] == "navegaon_khairi", "Navegaon Khairi"
    )
    report_date = require(tot, "date")

    # Groundwater.
    blocks = {b["name"]: b for b in require(gwr, "blocks")}
    district = require(gwr, "district_total")[-1]
    gwr_pulled = require(gwr, "generated_at")
    latest_label = require(district, "year_label")
    safe = [b for b in blocks.values() if require(b, "latest", "class") == "Safe"]
    urban = require(blocks, "Nagpur (Urban)")
    if {h["class"] for h in require(urban, "history")} != {"Safe"} or district[
        "class"
    ] != "Safe":
        raise SystemExit(
            "facts: Nagpur (Urban) or the district left Safe; rewrite the card"
        )
    top = max(blocks.values(), key=lambda b: b["latest"]["development_pct"])
    urban_note = require(urban, "history_caveat")
    cmd_now = num(urban_note, r"enters ([\d,]+) ha of the unit", "Urban command area")
    cmd_before = num(
        urban_note, r"\(([\d,]+) ha the year before\)", "Urban command before"
    )
    hingna_cmd = num(
        require(blocks, "Hingna", "history_caveat"),
        r"Semi Critical at ([\d.]+)%",
        "Hingna command stage",
    )
    katol = require(blocks, "Katol")
    k_cls = [h["class"] for h in katol["history"]]
    katol_semi = [
        h["year_label"] for h in katol["history"] if h["class"] == "Semi Critical"
    ]
    if len(katol_semi) < 2 or set(k_cls[len(katol_semi) :]) != {"Safe"}:
        raise SystemExit("facts: Katol's class history changed shape; rewrite the card")
    well_list = require(wells, "wells")
    in_city = [w for w in well_list if w["block"] == "Nagpur (Urban)"]
    in_city_latest = max(w["latest_reading"] for w in in_city)
    month_label = f"{date.fromisoformat(in_city_latest + '-01'):%B %Y}"

    # Rivers.
    rivers = {r["id"]: r for r in require(rq, "rivers")}
    st = {s["id"]: s for r in rivers.values() for s in r["stations"]}

    def do_of(sid: str) -> float:
        return require(st, sid, "readings", 0, "do_mgl")

    nag_start, nag_end = do_of("esr-nag-1"), do_of("esr-nag-10")
    pili_end, pora_end = do_of("esr-pilli-8"), do_of("esr-pora-5")
    esr_sites = sum(1 for s in st if s.startswith("esr-"))

    def bod_max(sid: str, year: int) -> float:
        vals = [
            r["bod_mgl"]
            for r in require(st, sid, "readings")
            if r["year"] == year and r.get("bod_mgl") is not None
        ]
        require(vals, 0)
        return max(vals)

    agar24, sinora24 = bod_max("nwmp-1909", 2024), bod_max("nwmp-2170", 2024)
    dry_junes = sorted(
        int(r["month"][:4])
        for r in st["nwmp-1909"]["readings"]
        if r["month"].endswith("-06") and r.get("condition") == "Dry"
    )
    if dry_junes != list(range(dry_junes[0], dry_junes[-1] + 1)):
        raise SystemExit("facts: Agargaon's dry Junes are no longer a run of years")
    prs = {}
    for rid in ("kanhan", "kolar", "wainganga"):
        m = re.match(
            r"^Priority (\w+) in 2025 \((\w+) in 2022, (\w+) in 2018\)$",
            require(rivers, rid, "cpcb_class"),
        )
        if not m:
            raise SystemExit(f"facts: {rid} CPCB class wording moved")
        prs[rid] = m.groups()
    if len({c[0] for c in prs.values()}) != 1:
        raise SystemExit("facts: the three rivers no longer share one 2025 class")
    if not all(
        rivers[r]["cpcb_class"].startswith("Not assessed")
        for r in ("nag", "pili", "pora")
    ):
        raise SystemExit("facts: a city river gained a CPCB class; rewrite the card")
    stp = require(stps, "summary")

    # Commitments.
    rows = require(commits, "commitments")
    count = {
        s: sum(1 for c in rows if c["status"] == s)
        for s in (
            "delivered",
            "on-track",
            "slipped",
            "overdue",
            "stalled",
            "unverified",
        )
    }
    if sum(count.values()) != len(rows):
        raise SystemExit("facts: a commitment carries a status outside the legend")
    moved_overdue = sum(
        1 for c in rows if c["status"] == "overdue" and c.get("revised_due")
    )
    if (count["slipped"], moved_overdue) != (1, 1):
        raise SystemExit(
            "facts: slipped/overdue rows changed; reword the commitments card"
        )

    # Water bodies, lakes, flood lines, wards, rainfall.
    placed = sum(w["water_bodies"]["current_count"] for w in require(profiles, "wards"))
    kinds = {}
    for f in require(bodies, "features"):
        k = f["properties"]["water_type"]
        kinds[k] = kinds.get(k, 0) + 1
    lakes = {b["name"]: b for b in require(flagship, "bodies")}
    # Futala's year is the Supreme Court's record (era), not a year_built badge.
    futala_era = re.match(
        r"(\d{4}) in the Supreme Court's record", require(lakes, "Futala Lake", "era")
    )
    if not futala_era or require(lakes, "Futala Lake").get("year_built") is not None:
        raise SystemExit(
            "facts: Futala's era string changed; rewrite the old-lakes card"
        )
    futala = int(futala_era.group(1))
    gorewada = require(lakes, "Gorewada Lake", "year_built")
    second = re.search(
        r"(built as the city's second source .*\))$",
        require(lakes, "Gorewada Lake", "builder"),
    )
    if not second:
        raise SystemExit("facts: Gorewada's builder note moved")
    fl_rivers = require(flood, "rivers")
    sheets = sum(len(r["sheets"]) for r in fl_rivers)
    if any("Pili" in r["name"] for r in fl_rivers):
        raise SystemExit(
            "facts: a Pili flood-line sheet appeared; rewrite the flood-lines card"
        )
    nallas = sum(1 for r in fl_rivers if "nalla" in r["name"].lower())
    fl_gaps = require(flood, "gaps_note")
    if (len(fl_rivers) - nallas, nallas) != (5, 1) or not all(
        w in fl_gaps for w in ("Wainganga", "Jam", "Nand")
    ):
        raise SystemExit(
            "facts: the flood-line selection changed; rewrite the flood-lines card"
        )
    feats = require(wards, "features")
    pops = [require(f, "properties", "population") for f in feats]
    seats = sum(require(f, "properties", "councillors") for f in feats)
    notes = [
        f["properties"]["boundary_note"]
        for f in feats
        if f["properties"].get("boundary_note")
    ]
    final_on = re.search(r"final notification of (\d+ \w+ \d{4})", notes[0])
    draft_on = re.search(r"the (\w+ \d{4}) draft", notes[0])
    if not (final_on and draft_on):
        raise SystemExit("facts: the ward boundary note's wording moved")
    snap = date.fromisoformat(report_date)
    snap_label = f"{snap.day} {snap:%B %Y}"
    normal = require(rain, "normals", "annual_mean_mm")
    monthly = require(rain, "normals", "monthly_mean_mm")
    jjas = round(sum(monthly[5:9]) / sum(monthly) * 100)
    obs = num(require(rain, "note"), r"normal of ([\d,.]+) mm", "observatory normal")
    esr_edition = "2024-03"  # data_date of every ESR 2023-24 card: the end of its year
    gw_year = latest_label[:4]  # IN-GRES edition 2025-2026 -> 2025
    wettest = max(require(rain, "annual_totals"), key=lambda t: t["total_mm"])

    facts = [
        {
            "id": "pench-four-of-five-plants",
            "tier": 4,
            "featured": True,
            "category": "Supply",
            "title": "Four of the city's five treatment plants run on Pench water",
            "value": fmt(pench_mld),
            "unit": f"MLD of NMC's {fmt(total_cap)} MLD treatment capacity is in the four Pench plants (NMC, 2023-24)",
            "interpretation": f"NMC's Environment Status Report lists five plants: Pench I to IV ({', '.join(fmt(p['capacity_mld']) for p in pench)} MLD) and Kanhan ({fmt(kanhan['capacity_mld'])} MLD). The Pench water is released from Totladoh, the Pench hydro-electric reservoir shared with Madhya Pradesh, into the Navegaon Khairi pick-up dam, and goes to the Mahadula pumping station, at km {fmt(km_chain)} of the old canal route (ESR 2017-18 draft); NMC told the state regulator that a closed pipeline replaced the canal in April 2015. The Kanhan plant draws from the river.",
            "data_date": esr_edition,
            "source_url": ESR,
            "source_label": "NMC Environment Status Report 2023-24, s.6.2.1, printed pp.132-133",
            "source_ids": ["nmc-esr"],
        },
        {
            "id": "groundwater-safe-every-edition",
            "tier": 2,
            "featured": True,
            "category": "Groundwater",
            "title": "Every taluka in the district reads Safe on its total, the city's own unit included",
            "value": f"{len(safe)} of {len(blocks)}",
            "unit": f"talukas of Nagpur district assessed Safe in {latest_label}, including the city's own unit, Nagpur (Urban)",
            "interpretation": f"IN-GRES puts the district at {fmt(district['development_pct'])}% of its extractable groundwater drawn in {latest_label}, Safe. Nagpur (Urban), assessed as its own unit from {urban['history'][0]['year_label']}, is Safe in all {len(urban['history'])} of its editions. Its {latest_label} figure of {fmt(urban['latest']['development_pct'])}% is computed with {fmt(cmd_now)} ha of the unit entered as canal command area ({fmt(cmd_before)} ha the year before), so it is in effect the stage of the non-command part alone; the category, Safe in all three editions, is the steadier comparison. Inside Hingna, the canal command area reads Semi Critical ({fmt(hingna_cmd)}%).",
            "data_date": gw_year,
            "source_url": INGRES,
            "source_label": f"IN-GRES dynamic groundwater assessment, {latest_label}",
            "source_ids": ["ingres-groundwater-maharashtra"],
        },
        {
            "id": "commitments-register",
            "tier": 2,
            "featured": True,
            "category": "Governance",
            "title": "Dated promises on the city's water, each on its own document",
            "value": str(len(rows)),
            "unit": f"commitments tracked: {count['delivered']} delivered, {count['on-track']} on track",
            "interpretation": f"Each promise sits on a Government Resolution, a court or tribunal order, an NMC budget or report, the AMRUT 2.0 portal or a funder's document, and each change of status cites a dated document. One has a date moved by NMC that has not yet come; {count['overdue']} are past their date with no delivery on record, one of them after NMC moved it. {count['stalled']} is recorded as stalled, and for {count['unverified']} the promise can be cited but not yet its current status.",
            "data_date": require(commits, "updated")[:7],
            "source_url": "https://nmcnagpur.gov.in/",
            "source_label": "Government Resolutions, court orders, NMC budgets and reports, AMRUT 2.0 (see /nagpur/commitments)",
            "source_ids": [
                "mahagr-nagpur-resolutions",
                "nagpur-court-docket",
                "amrut2-portal-nagpur",
                "nmc-budget",
            ],
        },
        {
            "id": "nag-oxygen-through-the-city",
            "tier": 2,
            "featured": True,
            "category": "Rivers",
            "title": "Oxygen in the Nag falls on its way through the city",
            "value": fmt(nag_end),
            "unit": f"mg/L dissolved oxygen at the Nag's last sampling point in the city, against {fmt(nag_start)} where it leaves Ambazari lake (monsoon 2023)",
            "interpretation": f"NMC sampled {esr_sites} points on the Nag, the Pili and the Pora in the monsoon of 2023. At the last point on each river dissolved oxygen was {fmt(nag_end)} mg/L (Nag), {fmt(pili_end)} (Pili, where it meets the Nag) and {fmt(pora_end)} (Pora). CPCB's bathing-water criterion is 5 mg/L or more.",
            "data_date": "2023",
            "source_url": ESR,
            "source_label": "NMC Environment Status Report 2023-24, Tables 6.13 to 6.16, printed pp.161-166",
            "source_ids": ["nmc-esr-river-stp-tables"],
        },
        {
            "id": "tankers-in-areas-without-network",
            "tier": 2,
            "featured": True,
            "category": "Supply",
            "title": "Fewer tankers serving areas the network does not reach",
            "value": fmt(t_last["count"]),
            "unit": f"tankers in NMC's 2026-27 budget (published May 2026), against {fmt(t_first['count'])} in its earlier count",
            "interpretation": f"NMC's own count: {tanker_series}. The documents do not say whether the count is of vehicles or daily trips.",
            "data_date": "2026-05",
            "source_url": BUDGET,
            "source_label": "NMC Budget 2026-27, Commissioner's speech, p.B-4",
            "source_ids": ["nmc-budget"],
        },
        {
            "id": "water-lost-source-to-consumer",
            "tier": 2,
            "category": "Supply",
            "title": "Water lost between source and consumer",
            "value": fmt(wb["loss_pct"]),
            "unit": f"% lost in 2023-24, by NMC's own figures: {fmt(wb['supplied_mld'])} MLD supplied, {fmt(wb['billed_mld'])} MLD billed",
            "interpretation": f"The report prints {fmt(wb['loss_pct'])}%; {fmt(wb['billed_mld'])} of {fmt(wb['supplied_mld'])} gives {fmt(wb['loss_pct_from_410_of_706'])}%. The 2022-23 report stated {fmt(wb22['loss_pct_stated'])}%, and its own table's figures give {fmt(round(wb22['loss_pct_by_own_table']))}% on our arithmetic.",
            "data_date": esr_edition,
            "source_url": ESR,
            "source_label": "NMC Environment Status Report 2023-24, s.6.2.1 and Table 6.2, printed p.133",
            "source_ids": ["nmc-esr"],
        },
        {
            "id": "pench-share-190",
            "tier": 2,
            "category": "Supply",
            "title": "NMC's share of the Pench",
            "value": fmt(entitled),
            "unit": f"million cubic metres a year in the State's 2020 plan, rising to {fmt(phase2)} after the Lohghogari tunnel",
            "interpretation": f"The 2020 resolution sets NMC's share at {fmt(entitled)} Mcum a year. A WRD engineer described that {fmt(entitled)} to the regulator in 2017 as the project plan's {fmt(plan)} plus the {fmt(extra)} sanctioned in 1998; NMC described it as 15% of the complex's 1,262 Mcum. The state water regulator held in 2018 that the {fmt(extra)} is 'legal and intact as on today'. The latest published figures for what the city drew from the Pench are in NMC's draft {bill_year} report (its table is headed 'present' and gives no year), and they disagree: {fmt(pench_bill)} million cubic metres billed, while the four Pench plants treated about {fmt(pench_treated)}.",
            "data_date": "2020-03",
            "source_url": GR_2020,
            "source_label": "WRD resolution of 19 Mar 2020 (table on p.2); MWRRA Order 13/2018",
            "source_ids": ["mahagr-wrd-resolutions", "mwrra-case-8-2017"],
        },
        {
            "id": "totladoh-on-snapshot-day",
            "tier": 2,
            "category": "Reservoirs",
            "title": "Totladoh on the day of this snapshot",
            "value": fmt(tot["storage_pct_live"]),
            "unit": f"% of designed live storage on {snap_label}; Navegaon Khairi {fmt(nk['storage_pct_live'])}%",
            "interpretation": f"The state Water Resources Department's daily bulletin. On the same date a year earlier Totladoh held {fmt(tot['last_year_pct_live'])}% and Navegaon Khairi {fmt(nk['last_year_pct_live'])}%. Totladoh is shared with Madhya Pradesh and NMC holds a yearly reservation in it, so the figure is the whole dam's storage, not the city's. The dashboard's reservoir cards carry the daily series.",
            "data_date": report_date,
            "source_url": "https://mwrdpravah.in/damsafety/control/main",
            "source_label": "Maharashtra WRD Pravah daily dam bulletin",
            "source_ids": ["wrd-pravah-nagpur-dams"],
        },
        {
            "id": "short-supply-areas",
            "tier": 2,
            "category": "Supply",
            "title": "Areas that get water for less than two hours a day",
            "value": f"{dark_now['with_areas_under_2h']} of {dark_now['command_areas']}",
            "unit": f"command areas with some areas counted as 'dark zones' in 2023-24, against {dark_prev['with_areas_under_2h']} in 2022-23",
            "interpretation": "NMC's report counts 'certain areas' in these command areas as dark zones, 'since the water supply was found to be less than 2 h per day'. The reports give no citywide hours of supply.",
            "data_date": esr_edition,
            "source_url": ESR,
            "source_label": "NMC Environment Status Report 2023-24, printed p.134",
            "source_ids": ["nmc-esr"],
        },
        {
            "id": "tap-samples-fit",
            "tier": 2,
            "category": "Supply",
            "title": "Tap-water samples found fit",
            "value": fmt(samples["fit_pct"]),
            "unit": f"% of {fmt(samples['tested'])} samples tested in 2023-24 were fit; {fmt(samples['unfit'])} were not",
            "interpretation": f"Tested at the {samples['laboratory']}, as NMC reports it.",
            "data_date": esr_edition,
            "source_url": ESR,
            "source_label": "NMC Environment Status Report 2023-24, printed p.134",
            "source_ids": ["nmc-esr"],
        },
        {
            "id": "highest-taluka-draw",
            "tier": 2,
            "category": "Groundwater",
            "title": "The highest stage of groundwater extraction in the district",
            "value": fmt(top["latest"]["development_pct"]),
            "unit": f"% of extractable groundwater drawn in {top['name']}, the highest of {len(blocks)} talukas ({latest_label})",
            "interpretation": f"CGWB's Safe class ends at 70%. Katol read Semi Critical in {', '.join(katol_semi[:-1])} and {katol_semi[-1]}, and Safe since; its {latest_label} figure of {fmt(katol['latest']['development_pct'])}% follows a larger estimate of what can be drawn, with extraction close to flat.",
            "data_date": gw_year,
            "source_url": INGRES,
            "source_label": f"IN-GRES dynamic groundwater assessment, {latest_label}",
            "source_ids": ["ingres-groundwater-maharashtra"],
        },
        {
            "id": "telemetry-wells-in-city",
            "tier": 2,
            "category": "Groundwater",
            "title": "Groundwater telemetry under the city",
            "value": str(len(in_city)),
            "unit": f"of {len(well_list)} telemetry wells in the district stand in the city's own unit",
            "interpretation": f"All {len(in_city)} are Central Ground Water Board piezometers ({', '.join(w['name'] for w in in_city)}), read every six hours on the National Water Data Portal and shown as monthly means; the latest month is {month_label}. India-WRIS lists these piezometers as semi-confined, deeper than an ordinary dug well, so the page shows the wells themselves rather than one city water-table depth.",
            "data_date": in_city_latest,
            "source_url": "https://nwdp.nwic.gov.in/",
            "source_label": "National Water Data Portal, groundwater telemetry",
            "source_ids": ["nwic-nwdp-groundwater-maharashtra"],
        },
        {
            "id": "kanhan-below-the-city",
            "tier": 2,
            "category": "Rivers",
            "title": "The Kanhan below the city",
            "value": fmt(agar24),
            "unit": f"mg/L highest BOD in 2024 at Agargaon, downstream of Nagpur, against {fmt(sinora24)} at Sinora upstream",
            "interpretation": f"MPCB samples the Kanhan every month; BOD measures organic pollution, and CPCB's bathing-water criterion is 3 mg/L or less. MPCB recorded the river at Agargaon as dry in June of every year from {dry_junes[0]} to {dry_junes[-1]}.",
            "data_date": "2024-12",
            "source_url": MPCB,
            "source_label": "MPCB monthly river readings, Kanhan, 2017-2024",
            "source_ids": ["mpcb-prs-monthly-nagpur-rivers"],
        },
        {
            "id": "polluted-stretch-classes",
            "tier": 2,
            "category": "Rivers",
            "title": "Three rivers in CPCB's polluted-stretch list",
            "value": f"Priority {prs['kanhan'][0]}",
            "unit": "for the Kanhan, the Kolar and the Wainganga in CPCB's 2025 report",
            "interpretation": "Priority I is CPCB's most severe class and Priority V its least. In the earlier editions: "
            + "; ".join(
                f"the {rid.capitalize()} {c[1]} in 2022 and {c[2]} in 2018"
                for rid, c in prs.items()
            )
            + ". The Nag, the Pili and the Pora have no CPCB readings, so they are not assessed: MPCB lists five national-programme stations on the Nag and the Pili, but CPCB's river tables up to 2024 carry none of them, and neither list has a station on the Pora.",
            "data_date": "2025-10",
            "source_url": "https://cpcb.gov.in/reports-3/",
            "source_label": "CPCB Polluted River Stretches, 2018, 2022 and 2025",
            "source_ids": ["cpcb-prs-report"],
        },
        {
            "id": "sewage-treatment-capacity",
            "tier": 2,
            "category": "Sewage",
            "title": "Sewage treatment against sewage generated",
            "value": fmt(stp["operational_capacity_mld"]),
            "unit": f"MLD of treatment capacity in {stp['operational_count']} operating plants, against an estimated {fmt(stp['sewage_generated_mld_esr'])} MLD of sewage ({int(100 * stp['sewage_generated_mld_esr'] / wb['supplied_mld'])}% of supply)",
            "interpretation": f"NMC's plant table for 2023-24. The sewage figure is the report's estimate, about {int(100 * stp['sewage_generated_mld_esr'] / wb['supplied_mld'])}% of the water supplied, and the report asks NMC to measure the real quantity. A further {fmt(stp['trial_run_capacity_mld'])} MLD plant at Narsala was on trial run.",
            "data_date": esr_edition,
            "source_url": ESR,
            "source_label": "NMC Environment Status Report 2023-24, s.6.2.2 and Table 6.3, printed pp.136-137",
            "source_ids": ["nmc-esr-river-stp-tables"],
        },
        {
            "id": "mapped-water-bodies",
            "tier": 3,
            "category": "Water bodies",
            "title": "Water bodies on the map",
            "value": fmt(len(bodies["features"])),
            "unit": f"water bodies in and around the city from the State's 2017-18 survey; {placed} of them inside the city's wards",
            "interpretation": f"MRSAC mapped the district's water bodies at 1:10,000 in 2017-18. The map's frame reaches the Pench reservoirs north of the city, so most are outside it: {fmt(require(kinds, 'farm pond'))} farm ponds, {fmt(require(kinds, 'tank'))} tanks and {fmt(require(kinds, 'reservoir'))} reservoirs among them. Names come from MRSAC and, where it gives none, from OpenStreetMap.",
            "data_date": "2018",
            "source_url": "https://gsc.mrsac.org.in/webadpgis1/rest/services/gatishakti/Water_Resources/MapServer/14",
            "source_label": "MRSAC water bodies, 1:10,000, 2017-18",
            "source_ids": ["mrsac-waterbodies-10k-2017-18"],
        },
        {
            "id": "old-lakes",
            "tier": 3,
            "category": "Heritage",
            "title": "When two of the city's lakes were built",
            "value": str(futala),
            "unit": f"the year Futala lake was built, as the Supreme Court records; Gorewada followed in {gorewada}",
            "interpretation": f"The Supreme Court records that Futala was built in {futala} by Gyanoji Bhosale 'to cater to the irrigational needs'; a Nagpur Museum record quoted in the judgment ties it to the Bhonsles' garden at Telankhedi. Gorewada, dammed on the Pili, was {second.group(1)}; the Central Water Commission's register of large dams gives its completion as {gorewada}.",
            "data_date": "2025-10",
            "source_url": "https://indiankanoon.org/doc/85333771/",
            "source_label": "Supreme Court of India, 2025 INSC 1199, paras 5.3 and 5.3.4; Maharashtra District Gazetteer (1966); CWC National Register of Large Dams (2019)",
            "source_ids": [
                "nagpur-court-docket",
                "maharashtra-gazetteer-nagpur-1966",
                "cwc-nrld-2019-nagpur",
            ],
        },
        {
            "id": "flood-line-sheets",
            "tier": 3,
            "category": "Flood",
            "title": "Official flood-line maps for the rivers around the city",
            "value": str(sheets),
            "unit": "register entries of red- and blue-line maps for five rivers and a nalla around the city; none for the Pili",
            "interpretation": "The Water Resources Department's legal flood boundaries: the blue line is the 25-year flood and the red line the 100-year flood. The count is of the register's entries for the Nag, the Pora, the Kanhan, the Kolar, the Vena and the Bagdor nalla around the city; the register also lists Nagpur-district entries for the Wainganga, the Jam and the Nand. On the Nag the maps cover a stretch at the city's eastern edge, not its course through the centre. They are scanned maps, so they are linked, not drawn on a map.",
            "data_date": require(flood, "updated")[:7],
            "source_url": "https://wrd.maharashtra.gov.in/Site/1315/Flood-Line-Maps",
            "source_label": "WRD Maharashtra, Flood Line Maps register",
            "source_ids": ["wrd-flood-line-maps"],
        },
        {
            "id": "distribution-network",
            "tier": 4,
            "category": "Supply",
            "title": "The network the water travels through",
            "value": fmt(dist["distribution_network_km"]),
            "unit": f"km of distribution mains, {fmt(dist['ground_level_cwrs'])} water tanks and {dist['connections']['total'] / 1e5:.2f} lakh connections",
            "interpretation": f"NMC's 2026-27 budget (published May 2026). The city is divided into {fmt(dist['administrative_zones'])} water distribution zones.",
            "data_date": "2026-05",
            "source_url": BUDGET,
            "source_label": "NMC Budget 2026-27, Commissioner's speech, p.B-3",
            "source_ids": ["nmc-budget"],
        },
        {
            "id": "wards-and-councillors",
            "tier": 4,
            "category": "Governance",
            "title": f"{len(feats)} wards, {seats} councillors",
            "value": fmt(sum(pops)),
            "unit": f"people across {len(feats)} wards, as printed in the final ward notification of {final_on.group(1)}",
            "interpretation": f"Ward populations run from {fmt(min(pops))} to {fmt(max(pops))}. The notification does not name the census year its figures come from. The ward outlines are MRSAC's map, whose ward populations follow the {draft_on.group(1)} draft; for {len(notes)} wards, part of an edge may not follow the final line.",
            "data_date": "2025-10",
            "source_url": "https://mahasecelec.in/Forms/Admin/DownloadGazetteMC.aspx",
            "source_label": "Final ward notification No. 1600-E.D.-NMC-2025; MRSAC ward layer",
            "source_ids": [
                "sec-maharashtra-nmc-ward-formation-2025",
                "mrsac-gatishakti-dma-wards",
            ],
        },
        {
            "id": "normal-rainfall",
            "tier": 4,
            "category": "Rainfall",
            "title": "A normal year's rain",
            "value": fmt(normal),
            "unit": "mm a year, IMD gridded data at 21.0 N 79.0 E (1970-2020 mean)",
            "interpretation": f"IMD's own Nagpur observatory normal is {fmt(obs)} mm (1991-2020). On this grid cell, June to September bring {jjas}% of a normal year's rain; the wettest year in the record is {wettest['year']}, at {fmt(wettest['total_mm'])} mm.",
            "data_date": "2020",
            "source_url": "https://imdlib.readthedocs.io/en/latest/",
            "source_label": "India Meteorological Department, gridded rainfall",
            "source_ids": ["imd-gridded-rainfall-nagpur"],
        },
        {
            "id": "gap-supply-by-source",
            "tier": 3,
            "category": "Gap",
            "title": "How much water each source supplies",
            "value": "Not published",
            "unit": f"no per-source supply figure found after NMC's draft {bill_year} report",
            "interpretation": f"NMC's reports give treatment capacity plant by plant, and its 2023-24 water balance one citywide total, {fmt(wb['pure_water_supplied_mcm'])} million cubic metres of treated water. The latest figures by source are the raw-water bills in NMC's draft {bill_year} report, whose table is headed 'present' and gives no year; they disagree with the treated output the same report gives for each plant.",
            "data_date": esr_edition,
            "source_url": ESR,
            "source_label": "NMC Environment Status Report 2023-24, Table 6.2",
            "source_ids": ["nmc-esr"],
        },
    ]

    out = {
        "nvdm": "1.0",
        "dataset": "data-root/facts",
        "scope": {"kind": "city", "id": "nagpur"},
        "provenance": {
            "sources": [
                {
                    "id": sid,
                    "title": t,
                    "publisher": pub,
                    "license": registry_license(sid),
                    "role": "input",
                    # The IN-GRES cards carry an edition label, not a calendar
                    # date; the pull date is their date signal (spec 5.1).
                    **(
                        {"retrieved": gwr_pulled}
                        if sid == "ingres-groundwater-maharashtra"
                        else {}
                    ),
                }
                for sid, t, pub in SOURCES
            ],
            "method": "derived",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_nagpur_facts.py",
            "internal_inputs": sorted(INPUTS.values()),
            "note": "Every figure is read from a shipped artifact; nothing is transcribed a second time.",
        },
        "place_id": "nagpur",
        "generated_at": date.today().isoformat(),
        "note": "Each card's number comes from the artifact behind the page it summarises.",
        "facts": facts,
    }
    cited = {s for f in facts for s in f["source_ids"]}
    if cited != {s[0] for s in SOURCES}:
        raise SystemExit(
            f"facts: envelope and cards disagree on sources: {cited ^ {s[0] for s in SOURCES}}"
        )
    path = DATA / "facts-nagpur.json"
    write_artifact(path, out)
    print(
        f"{len(facts)} facts ({sum(bool(f.get('featured')) for f in facts)} featured) -> {path.name}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
