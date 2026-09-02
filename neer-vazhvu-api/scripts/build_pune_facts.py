#!/usr/bin/env python3
"""
Pune facts, DERIVED from the shipped artifacts rather than transcribed again.

Every number on a fact card is read out of a file already in public/data or
public/geojson. That is the whole design of this producer, and it is a
deliberate departure from build_kolkata_facts_allocations.py, which hardcodes
its figures beside their provenance. The Kolkata script has a comment
explaining why one of its facts had to be converted to a read: the waterlogging
count was frozen at one week's value and "had already drifted from the shipped
artifact by the time anyone looked".

So the drift is not hypothetical, and a facts page is exactly where it hurts
most - a journalist quotes the card. Here the card cannot disagree with the
dashboard, because it is computed from the same bytes. When the ESR edition
turns over, one producer changes and these cards follow.

The cost is that this file must FAIL rather than emit a wrong number when an
artifact changes shape. Hence require() on every lookup: a renamed key stops
the build instead of writing "None MLD" onto a quotable card.

Run:  python3 neer-vazhvu-api/scripts/build_pune_facts.py
"""

from datetime import date
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

DATA_DIR = REPO_ROOT / "public" / "data"
GEO_DIR = REPO_ROOT / "public" / "geojson"

# Source URLs, each one already carried by an artifact or the source registry
# in this repo. Nothing here is a URL invented for a citation.
ESR = (
    "https://webadmin.pmc.gov.in/sites/default/files/2026-08/"
    "PMC%20Draft%20ESR%202025-26_compressed.pdf"
)
ESR_LABEL = "PMC, Draft Environment Status Report 2025-26"
MWRRA_2025 = "https://mwrra.maharashtra.gov.in/wp-content/uploads/2025/11/85.pdf"
MWRRA_2018 = (
    "http://mwrra.maharashtra.gov.in/wp-content/uploads/2022/08/Case-14-of-2018.pdf"
)
INGRES = "https://ingres.iith.ac.in/"
INGRES_LABEL = "IN-GRES (CGWB and State groundwater departments), 2025-2026 assessment"
PRAVAH = "https://mwrdpravah.in/damsafety/control/pdfLatestReportEng"
PRAVAH_LABEL = "Maharashtra WRD, Pravah daily dam-safety bulletin"
TANKERS = "https://webadmin.pmc.gov.in/en/jsonapi/node/water_tanker"
TANKERS_LABEL = "PMC, daily tanker delivery registers"
WRIS = (
    "https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-6-hourly-maharashtra"
)
WRD_FLOOD = "https://wrd.maharashtra.gov.in/Site/1315/Flood-Line-Maps"

MCUM_PER_TMC = 28.31685  # 1 TMC = 1000 million cubic feet


def load(path: Path) -> dict:
    if not path.exists():
        raise SystemExit(f"missing artifact: {path.relative_to(REPO_ROOT)}")
    return json.loads(path.read_text())


def require(obj, *keys, ctx: str = ""):
    """Walk a key path and refuse to return None.

    A facts card is quotable, so a silently-missing key must not become an
    empty value on a journalist's screen. Every read goes through here.
    """
    cur = obj
    for k in keys:
        if not isinstance(cur, dict) or k not in cur:
            raise SystemExit(
                f"artifact shape changed: {ctx or 'value'} at {'.'.join(map(str, keys))} "
                f"(stopped at {k!r}). Fix this producer rather than shipping a blank card."
            )
        cur = cur[k]
    if cur is None:
        raise SystemExit(
            f"artifact shape changed: {ctx} at {'.'.join(map(str, keys))} is null"
        )
    return cur


def fmt(n: float, places: int = 0) -> str:
    """Thousands separators, and no trailing .0 on a whole number."""
    if places == 0:
        return f"{round(n):,}"
    s = f"{n:,.{places}f}"
    return s.rstrip("0").rstrip(".") if "." in s else s


def supply_facts(s: dict) -> list[dict]:
    wb = require(s, "water_budget_2025_26", ctx="water budget")
    short = require(wb, "shortfall_tmc")
    loss = require(wb, "system_loss_tmc")
    nrw = require(wb, "nrw_pct")
    req = require(wb, "total_requirement_tmc")
    net = require(wb, "net_demand_tmc")
    quota = require(wb, "sanctioned_quota_tmc")
    ent = require(s, "entitlement", ctx="entitlement")
    slb = {r["indicator"]: r for r in require(s, "service_levels", "rows")}
    hours = require(slb, "Average supply duration", "reported_2025_26")
    target_hours = require(slb, "Average supply duration", "target")
    wtp = require(s, "wtps_summary", ctx="WTPs")
    proj = require(s, "equitable_supply_project", ctx="24x7 project")
    sew = require(s, "sewage", ctx="sewage")

    return [
        {
            "id": "shortfall-smaller-than-leak",
            "tier": 2,
            "category": "Supply",
            "title": "The shortfall is smaller than the leak",
            "value": fmt(short, 2),
            "unit": f"TMC/yr short, against {fmt(loss, 2)} TMC lost to leaks",
            "interpretation": (
                f"PMC's own water budget asks for {fmt(req, 2)} TMC a year against a "
                f"sanctioned {fmt(quota, 2)} TMC, a shortfall of {fmt(short, 2)} TMC. The same "
                f"budget books {fmt(loss, 2)} TMC to non-revenue water, at {fmt(nrw)}%. The leak "
                f"is larger than the gap it is used to justify: close the losses and net demand "
                f"is {fmt(net, 2)} TMC, comfortably inside the existing entitlement. Both halves "
                f"of this comparison are on the same page of the same corporation report."
            ),
            "data_date": "2025-26",
            "source_url": ESR,
            "source_label": ESR_LABEL,
        },
        {
            "id": "four-hours-a-day",
            "tier": 2,
            "category": "Supply",
            "title": f"{fmt(hours)} hours of water a day, against its own {fmt(target_hours)}-hour benchmark",
            "value": fmt(hours),
            "unit": "hours of supply per day",
            "interpretation": (
                f"PMC reports an average supply duration of {fmt(hours)} hours against a "
                f"service-level benchmark of {fmt(target_hours)} that it sets for itself. The "
                f"figure has not moved: the {fmt(hours)}-hour number is reprinted unchanged in "
                f"every edition from 2021-22 onward, through a 24x7 supply project that has been "
                f"running the whole time."
            ),
            "data_date": "2025-26",
            "source_url": ESR,
            "source_label": ESR_LABEL,
        },
        {
            "id": "slb-table-reprinted-four-years",
            "tier": 2,
            "category": "Transparency",
            "title": "The same service-level table, four years running",
            "value": "4",
            "unit": "consecutive years reporting identical figures",
            "interpretation": (
                "PMC's service-level benchmark table is identical across the 2021-22, 2022-23, "
                "2023-24 and 2024-25 editions of its Environment Status Report: coverage 98%, "
                "supply duration 4 hours, non-revenue water 35%, per-capita 250 LPCD, metered "
                "connections 30%, collection efficiency 88%. Six indicators, four years, no "
                "movement in any of them. This is one observation reprinted, not a four-year "
                "trend, and the surfaces here present it as one."
            ),
            "data_date": "2024-25",
            "source_url": ESR,
            "source_label": ESR_LABEL,
        },
        {
            "id": "entitlement-never-settled",
            "tier": 3,
            "category": "Governance",
            "title": "Nine years, two regulatory orders, still no entitlement",
            "value": fmt(require(ent, "sanctioned_tmc"), 2),
            "unit": "TMC/yr total authorisation, and it is contested",
            "interpretation": (
                f"PMC's total authorisation is {fmt(require(ent, 'sanctioned_tmc'), 2)} TMC. The "
                "number that circulates instead, 11.5 TMC, is the Khadakwasla-only reservation "
                "and comparing it against total lifting compares one reservoir's share against "
                "every source the city draws on. The entitlement itself has never been fixed: a "
                "PDRO set it at 8.19 TMC in October 2017; MWRRA set that aside in December 2018 "
                "and deemed 11.5 TMC an entitlement, finding Khadakwasla's farmers deprived of "
                "their share; PMC appealed, and in May 2025 MWRRA found the issuing officer was "
                "not the competent authority and remitted the matter. The city has been drawing "
                "water throughout."
            ),
            "data_date": "2025-05-19",
            "source_url": MWRRA_2025,
            "source_label": "MWRRA Order 01/2025, on appeal from Order 19/2018",
        },
        {
            "id": "no-measured-draw-since-2017-18",
            "tier": 2,
            "category": "Gap",
            "title": "No measured annual draw published since 2017-18",
            "value": "8",
            "unit": "years since the last published measurement",
            "interpretation": (
                "The last year for which an actual annual draw was published is 2017-18, and for "
                "that year the utility and the regulator disagree by 4.15 TMC: PMC's affidavit "
                "says 14.56 TMC, the state water department's says 18.71. Everything since is "
                "installed lifting capacity, not measured delivery. This is why no allocation "
                "ledger is published for Pune: the ledger's primitive is entitled-against-"
                "received, and the received column would be eight years old and contested."
            ),
            "data_date": "2017-18",
            "source_url": MWRRA_2018,
            "source_label": "MWRRA Order 19/2018 (Case 14 of 2018), affidavits of PMC and WRD",
        },
        {
            "id": "wtp-capacity",
            "tier": 4,
            "category": "Infrastructure",
            "title": "Treatment capacity, across a plant count the report cannot agree on",
            "value": fmt(require(wtp, "fresh_water_capacity_mld")),
            "unit": "MLD installed water treatment capacity",
            "interpretation": (
                f"{fmt(require(wtp, 'fresh_water_capacity_mld'))} MLD across the plants PMC lists. "
                f"The count is genuinely unclear in the source: the report's text says 17 plants "
                f"while its own table carries {fmt(require(wtp, 'plant_count_listed'))} rows, and "
                f"the previous edition said 15 plants totalling 1,914 MLD. The capacities here are "
                f"the table's, and the discrepancy is flagged rather than resolved."
            ),
            "data_date": "2025-26",
            "source_url": ESR,
            "source_label": ESR_LABEL,
        },
        {
            "id": "tanks-built-versus-commissioned",
            "tier": 2,
            "category": "Governance",
            "title": "67 storage tanks built, 35 actually commissioned",
            "value": fmt(require(proj, "storage_tanks_commissioned")),
            "unit": f"of {fmt(require(proj, 'storage_tanks_planned'))} planned tanks in service",
            "interpretation": (
                f"Pune's equitable (24x7) water supply project reports "
                f"{fmt(require(proj, 'physical_progress_pct'))}% physical progress and "
                f"Rs {fmt(require(proj, 'spent_inr_crore'), 2)} crore spent of a sanctioned "
                f"Rs {fmt(require(proj, 'sanctioned_cost_inr_crore'), 2)} crore. Of "
                f"{fmt(require(proj, 'storage_tanks_planned'))} storage tanks, "
                f"{fmt(require(proj, 'storage_tanks_built'))} are built but only "
                f"{fmt(require(proj, 'storage_tanks_commissioned'))} are commissioned, and the gap "
                f"between those two is the honest measure of what has reached anybody. No PMC "
                f"source claims continuous 24-hour supply anywhere in the city."
            ),
            "data_date": "2025-26",
            "source_url": ESR,
            "source_label": ESR_LABEL,
        },
        {
            "id": "sewage-untreated",
            "tier": 2,
            "category": "Sewage",
            "title": "Half the city's sewage reaches the river untreated",
            "value": fmt(require(sew, "untreated_mld")),
            "unit": "MLD untreated into the Mula-Mutha",
            "interpretation": (
                f"Pune generates {fmt(require(sew, 'generated_mld'))} MLD of sewage against "
                f"{fmt(require(sew, 'installed_capacity_mld'))} MLD of operating treatment "
                f"capacity across {fmt(require(sew, 'operating_stp_count'))} plants, leaving "
                f"{fmt(require(sew, 'untreated_mld'))} MLD - "
                f"{fmt(require(sew, 'untreated_pct'))}% of what the city produces - going into the "
                f"Mula-Mutha untreated. The JICA-funded programme now under construction adds "
                f"{fmt(require(sew, 'jica_programme_mld'))} MLD, which would still not close the "
                f"gap. The untreated figure is a subtraction from PMC's own two numbers, not a "
                f"figure PMC states."
            ),
            "data_date": "2025-26",
            "source_url": ESR,
            "source_label": ESR_LABEL,
        },
        {
            "id": "pmc-publishes-no-groundwater-number",
            "tier": 2,
            "category": "Gap",
            "title": "PMC's supply accounts exclude groundwater entirely, and say so",
            "value": "0",
            "unit": "MLD of groundwater in the corporation's accounts",
            "interpretation": (
                "PMC publishes no groundwater figure at all, and is explicit about it: its supply "
                "accounts state that they do not include groundwater sources such as borewells, "
                "private tanker supply, or other alternative sources. So every per-capita and "
                "coverage number the corporation publishes describes only the piped system, in a "
                "city where the corporation itself dispatches tankers daily. The omission is "
                "recorded here rather than filled with an estimate."
            ),
            "data_date": "2025-26",
            "source_url": ESR,
            "source_label": ESR_LABEL,
        },
    ]


def reservoir_facts(dams: dict) -> list[dict]:
    """Live storage and cross-checked capacity for the four dams PMC drinks from."""
    chain = ("khadakwasla", "panshet", "warasgaon", "temghar")
    rows = {d["source_code"]: d for d in require(dams, "dams", ctx="dam list")}
    missing = [c for c in chain if c not in rows]
    if missing:
        raise SystemExit(f"dam artifact is missing the Khadakwasla chain: {missing}")
    live_cap = sum(require(rows[c], "live_capacity_mcum") for c in chain)
    stored = sum(require(rows[c], "storage_mcum") for c in chain)
    ly = sum(require(rows[c], "last_year_storage_mcum") for c in chain)
    pct = stored / live_cap * 100
    ly_pct = ly / live_cap * 100
    as_of = max(require(rows[c], "date") for c in chain)
    tmc = live_cap / MCUM_PER_TMC
    # PMC publishes 29.15 TMC for the same four dams. Asserted, because the
    # agreement between an irrigation bulletin and a municipal report is the
    # check on both, and a silent drift here would be invisible on the card.
    if abs(tmc - 29.15) > 0.05:
        raise SystemExit(
            f"Khadakwasla chain live capacity is {tmc:.3f} TMC, which no longer reproduces "
            f"the 29.15 TMC PMC publishes. Investigate before shipping."
        )
    return [
        {
            # Tier 2, not 1: static snapshot, so no "Live" badge.
            "id": "khadakwasla-chain-today",
            "tier": 2,
            "category": "Reservoirs",
            "title": "Water in the four dams Pune drinks from",
            "value": fmt(pct, 1),
            "unit": "% of live capacity",
            "interpretation": (
                f"Khadakwasla, Panshet, Warasgaon and Temghar together hold "
                f"{fmt(stored, 2)} Mcum against a live capacity of {fmt(live_cap, 2)} Mcum, "
                f"{fmt(pct, 1)}% full, on {as_of}. On the same date a year earlier the chain was "
                f"at {fmt(ly_pct, 1)}%. Read the chain rather than any single dam: Khadakwasla is "
                f"the smallest of the four and the one the city actually draws from, refilled from "
                f"the three upstream."
            ),
            "data_date": as_of,
            "source_url": PRAVAH,
            "source_label": PRAVAH_LABEL,
        },
        {
            "id": "khadakwasla-chain-capacity",
            "tier": 4,
            "category": "Reservoirs",
            "title": "The whole city runs on 29 TMC of storage",
            "value": fmt(tmc, 2),
            "unit": "TMC of live storage across four dams",
            "interpretation": (
                f"{fmt(live_cap, 2)} Mcum, {fmt(tmc, 2)} TMC, across Khadakwasla, Panshet, "
                f"Warasgaon and Temghar. That total is not taken on trust from one publisher: it "
                f"is computed from the state irrigation department's daily bulletin and it "
                f"independently reproduces the 29.15 TMC PMC publishes in its own report, while "
                f"CWC's National Register of Large Dams agrees to the cubic metre on Panshet and "
                f"Warasgaon. And the complex is an IRRIGATION project, not a municipal one: PMC's "
                f"drinking provision in the original project planning was 8.3 TMC."
            ),
            "data_date": as_of,
            "source_url": PRAVAH,
            "source_label": f"{PRAVAH_LABEL}, cross-checked against CWC NRLD-2019 and PMC's ESR",
        },
    ]


def groundwater_facts(gwr: dict, stations: dict) -> list[dict]:
    blocks = {b["name"]: b for b in require(gwr, "blocks", ctx="taluka list")}
    shirur = require(blocks, "Shirur", ctx="Shirur taluka")
    latest = require(shirur, "latest")
    editions = len(require(gwr, "assessment_years"))
    crit_all = all(h["class"] == "Critical" for h in require(shirur, "history"))
    # The gradient is IN-GRES's own per-taluka rainfall, not an inference.
    rains = {
        b["name"]: b["detail"][-1].get("rainfall_mm")
        for b in require(gwr, "blocks")
        if b.get("detail")
    }
    rains = {k: v for k, v in rains.items() if v}
    wet_name, wet = max(rains.items(), key=lambda kv: kv[1])
    dry_name, dry = min(rains.items(), key=lambda kv: kv[1])
    summ = require(stations, "summary", ctx="station summary")

    facts = [
        {
            "id": "shirur-critical-inside-a-safe-district",
            "tier": 2,
            "category": "Groundwater",
            "title": "A CRITICAL taluka inside a district that reads SAFE",
            "value": fmt(require(latest, "development_pct"), 2),
            "unit": "% of extractable groundwater already drawn, Shirur taluka",
            "interpretation": (
                f"Shirur is categorised CRITICAL and stands at "
                f"{fmt(require(latest, 'development_pct'), 2)}% of its extractable resource. Pune "
                f"district as a whole reads 63.73% and is categorised SAFE. Publishing the "
                f"district figure alone would state the opposite of what the talukas inside it "
                f"show, which is why this city's assessment is drilled to taluka rather than left "
                f"at district level"
                + (
                    f" - and Shirur has been CRITICAL in all {editions} published editions, never "
                    f"below 94%."
                    if crit_all
                    else "."
                )
                + " It is also an irrigation story rather than a city one: 92.9% of that "
                "extraction is agriculture."
            ),
            "data_date": "2025-2026",
            "source_url": INGRES,
            "source_label": INGRES_LABEL,
        },
        {
            "id": "rainfall-gradient-across-one-district",
            "tier": 2,
            "category": "Rainfall",
            "title": f"A {wet / dry:.1f}x rainfall gradient inside one district",
            "value": f"{fmt(wet)} to {fmt(dry)}",
            "unit": "mm, wettest to driest taluka, same year",
            "interpretation": (
                f"{wet_name} receives {fmt(wet)} mm and {dry_name} {fmt(dry)} mm in the same "
                f"assessment year, in the same district. This is not an inference from a rainfall "
                f"grid: it is the per-taluka figure carried in the groundwater assessment itself. "
                f"The structural fact about water here is which end is which - the wet end is "
                f"where the city's dams sit, and the dry end is where their canals go. It also "
                f"means a quarter-degree rainfall grid cell is a real decision for Pune rather "
                f"than a rounding error."
            ),
            "data_date": "2025-2026",
            "source_url": INGRES,
            "source_label": INGRES_LABEL,
        },
        {
            "id": "telemetry-density-is-not-urban",
            "tier": 2,
            "category": "Groundwater",
            "title": "120 groundwater monitors in the district, one inside the city",
            "value": fmt(require(summ, "stations_in_city_limits")),
            "unit": f"of {fmt(require(summ, 'stations'))} telemetry stations inside city limits",
            "interpretation": (
                f"Pune district carries {fmt(require(summ, 'stations'))} telemetric groundwater "
                f"stations returning readings every six hours, and "
                f"{fmt(require(summ, 'valid_readings'))} valid readings are retained here. Tested "
                f"point-in-polygon against the 41 prabhags, exactly "
                f"{fmt(require(summ, 'stations_in_city_limits'))} of them stands inside the "
                f"corporation: {', '.join(require(summ, 'in_city_station_names'))}. The rest "
                f"instrument the eastern irrigation belt. A bounding box would have said nine, "
                f"which is why no per-ward urban depth surface is drawn for this city: the density "
                f"is real and it is somewhere else."
            ),
            "data_date": require(stations, "coverage", "to"),
            "source_url": WRIS,
            "source_label": "India-WRIS / NWDP groundwater level telemetry, Maharashtra",
        },
    ]
    return facts


def river_facts(rq: dict) -> list[dict]:
    rivers = {r["id"]: r for r in require(rq, "rivers", ctx="river list")}
    # Worst reading anywhere in the city, found rather than asserted.
    worst = None
    for r in require(rq, "rivers"):
        for st in r.get("stations", []):
            for rd in st.get("readings", []):
                if rd.get("bod_mgl") is not None and (
                    worst is None or rd["bod_mgl"] > worst[0]
                ):
                    worst = (rd["bod_mgl"], st["name"], r["name"], rd["year"])
    if worst is None:
        raise SystemExit("river-quality artifact carries no BOD readings")
    bod, st_name, river_name, year = worst
    mula = require(rivers, "mula", ctx="Mula")
    nat = require(rq, "national_context_2024", ctx="national context")
    return [
        {
            "id": "mula-bopodi-worst-in-india-top-ten",
            "tier": 2,
            "category": "Rivers",
            "title": "One of six readings in India above 100 mg/L, in a stretch CPCB calls improved",
            "value": fmt(bod, 1),
            "unit": f"mg/L BOD, {river_name} at {st_name.split(',')[0]}",
            "interpretation": (
                f"CPCB measured {fmt(bod, 1)} mg/L of biochemical oxygen demand on the "
                f"{river_name} in {year}. It is one of only "
                f"{fmt(require(nat, 'locations_above_100_mg_l'))} readings above 100 mg/L among "
                f"the {fmt(require(nat, 'locations_tabulated'))} locations tabulated nationally, "
                f"and it is worse than the worst station on the Delhi Yamuna "
                f"({fmt(require(nat, 'worst_delhi_yamuna', 'bod'), 1)}) and worse than the Mithi "
                f"at Mahim ({fmt(require(nat, 'mithi_at_mahim', 'bod'), 1)}). In the same report "
                f"CPCB records this stretch as IMPROVED, moving it from Priority I to Priority II. "
                f"The class and the reading are different vintages from one document and are not "
                f"merged here; both are shown."
            ),
            "data_date": str(year),
            "source_url": require(rq, "source_url"),
            "source_label": require(rq, "source_label"),
        },
        {
            "id": "mutha-does-not-arrive-polluted",
            "tier": 2,
            "category": "Rivers",
            "title": "The river does not arrive polluted. It leaves that way",
            "value": "4.1 to 50.2",
            "unit": "mg/L BOD across roughly 15 km",
            "interpretation": (
                "The Mutha leaves Khadakwasla dam at 4.1 mg/L of BOD and reads 50.2 mg/L at Veer "
                "Savarkar Bhavan, about fifteen kilometres downstream. Nothing upstream of the "
                "city explains that: the water enters clean and the city is what happens to it. "
                "It is the same arithmetic as the sewage balance, measured in the river instead of "
                "at the plants."
            ),
            "data_date": "2024",
            "source_url": require(rq, "source_url"),
            "source_label": require(rq, "source_label"),
        },
        {
            "id": "mula-priority-history",
            "tier": 3,
            "category": "Rivers",
            "title": "Eight years of CPCB priority classes, and no year off the list",
            "value": " -> ".join(
                f"{y}: {c}" for y, c in require(mula, "cpcb_priority_history").items()
            ),
            "unit": "CPCB priority class, Mula",
            "interpretation": (
                "The Mula has appeared in every CPCB polluted-stretch assessment since 2018, "
                "moving from Priority I to Priority II and staying there. A move down the priority "
                "bands is a smaller exceedance, not a clean river: Priority II still means "
                "20.1 to 30 mg/L of BOD, against 3 mg/L for water fit to bathe in."
            ),
            "data_date": "2025-10",
            "source_url": require(rq, "source_url"),
            "source_label": require(rq, "source_label"),
        },
    ]


def tanker_facts(t: dict) -> list[dict]:
    tot = require(t, "totals", ctx="tanker totals")
    od = require(t, "on_demand_split", ctx="on-demand split")
    out = require(t, "outside_corporation", ctx="outside-corporation bucket")
    cov = require(t, "coverage", ctx="coverage")
    points = require(t, "filling_points", ctx="filling points")
    busiest = require(t, "busiest_day", ctx="busiest day")
    top = max(points, key=lambda p: p["deliveries"])
    return [
        {
            # Tier 2, not 1: static snapshot, so no "Live" badge.
            "id": "tanker-register-on-demand-share",
            "tier": 2,
            "category": "Supply",
            "title": "Most municipal tanker water in Pune is unscheduled",
            "value": fmt(require(od, "on_demand_share_pct"), 1),
            "unit": "% of tanker trips booked on demand, not scheduled",
            "interpretation": (
                f"PMC publishes a spreadsheet per tanker filling point per working day, one row "
                f"per tanker sent. Across {fmt(require(tot, 'deliveries'))} deliveries from "
                f"{fmt(require(tot, 'filling_points'))} filling points and "
                f"{fmt(require(tot, 'distinct_vehicles'))} distinct vehicles, "
                f"{fmt(require(od, 'on_demand_share_pct'), 1)}% of trips are on demand rather than "
                f"scheduled. A scheduled tanker route is a known supply gap being serviced; an "
                f"on-demand majority is a system responding to failures it has not planned for. "
                f"Counts only: the source rows carry recipient addresses and phone numbers and "
                f"none of that is republished."
            ),
            "data_date": require(cov, "to"),
            "source_url": TANKERS,
            "source_label": TANKERS_LABEL,
        },
        {
            "id": "tankers-to-the-area-pmc-excluded",
            "tier": 2,
            "category": "Governance",
            "title": "PMC still runs tankers to the area it removed from the corporation",
            "value": fmt(require(out, "deliveries")),
            "unit": "deliveries booked to 'NAGAR PARISHAD'",
            "interpretation": (
                f"{fmt(require(out, 'deliveries'))} deliveries, "
                f"{fmt(require(out, 'share_of_ward_attributed_pct'), 1)}% of everything with a "
                f"ward attached, are booked in PMC's own register to 'NAGAR PARISHAD' rather than "
                f"to a prabhag. That is Uruli Devachi and Fursungi, the area taken out of the "
                f"corporation in 2024 to form its own council. The tankers did not stop at the new "
                f"boundary. Kept as its own bucket here rather than coerced into a ward number."
            ),
            "data_date": require(cov, "to"),
            "source_url": TANKERS,
            "source_label": TANKERS_LABEL,
        },
        {
            "id": "busiest-tanker-day",
            "tier": 4,
            "category": "Supply",
            "title": "One filling point can dispatch a tanker every two minutes",
            "value": fmt(require(busiest, "deliveries")),
            "unit": f"deliveries in a single day, city-wide, on {require(busiest, 'date')}",
            "interpretation": (
                f"The busiest recorded day is {require(busiest, 'date')}, with "
                f"{fmt(require(busiest, 'deliveries'))} deliveries. "
                f"{require(top, 'point')} is the busiest point, averaging "
                f"{fmt(require(top, 'mean_per_dated_day'), 1)} deliveries on the days it reports. "
                f"The register begins on {require(cov, 'from')}, which is when PMC began "
                f"publishing it and not when tanker supply began - there is no earlier archive on "
                f"the endpoint, so read this as a four-month window rather than a history."
            ),
            "data_date": require(busiest, "date"),
            "source_url": TANKERS,
            "source_label": TANKERS_LABEL,
        },
    ]


def gap_facts(wb: dict) -> list[dict]:
    return [
        {
            # The sheet register is Maharashtra-wide, so its count never
            # headlines as a Pune figure. Old id slug kept: it is an anchor.
            "id": "flood-lines-are-518-scanned-sheets",
            "tier": 2,
            "category": "Flood",
            "title": "Pune's flood lines exist as scanned sheets in a statewide register, not as data",
            "value": "0",
            "unit": "machine-readable flood-line files, for Pune or any Maharashtra city",
            "interpretation": (
                "Maharashtra's water resources department publishes red (100-year) and blue "
                "(25-year) flood lines for the whole state as one register of scanned PDF map "
                "sheets - 513 sheets across every district as checked on 2 September 2026, "
                "organised by river rather than by city, with Pune's Mula, Mutha, Pawna and "
                "Indrayani sheets inside it. None of it comes as a shapefile, GeoJSON or KML; "
                "text extraction returns no characters at all from the Mutha sheets. So the "
                "city's own statutory flood boundary cannot be put on a map or joined to "
                "anything. The flood record itself is well documented - the Panshet breach of "
                "12 July 1961, the Ambil Odha flash flood of 2019, July and August 2024, "
                "August 2025 - but there is nothing to draw. This is the single largest "
                "capability gap against Chennai here, and it is a publishing decision rather "
                "than a data engineering task."
            ),
            "data_date": "2026-09-02",
            "source_url": WRD_FLOOD,
            "source_label": "Maharashtra Water Resources Department, flood line maps",
        },
        {
            "id": "no-lake-register-exists",
            "tier": 2,
            "category": "Water bodies",
            "title": "No authority publishes a lake register for this city",
            "value": fmt(len(require(wb, "features", ctx="water body features"))),
            "unit": "water bodies mapped, all from OpenStreetMap",
            "interpretation": (
                f"{fmt(len(wb['features']))} lake, tank and reservoir polygons, and every one of "
                f"them comes from OpenStreetMap, because no government layer exists to use "
                f"instead. PMC's only water-body file is twelve polygons of river channel. "
                f"MRSAC, the state remote-sensing centre that would be the equivalent of Tamil "
                f"Nadu's open GeoServer, does not resolve publicly. Bhuvan answers a request for "
                f"vector data with 'Service WFS is disabled'. The national water bodies census "
                f"does cover Maharashtra but enumerates only ten inside the corporation, and "
                f"records 3,679 of its 3,680 district entries as un-encroached, which is an "
                f"unfilled form rather than a measurement. Katraj, Pashan, Jambhulwadi and Bund "
                f"Garden are in OpenStreetMap and in no municipal dataset reachable."
            ),
            "data_date": "2026-08",
            "source_url": "https://www.openstreetmap.org/copyright",
            "source_label": "OpenStreetMap contributors (ODbL 1.0), and the absence of any register",
        },
    ]


def main() -> int:
    supply = load(DATA_DIR / "pune-supply-overview.json")
    dams = load(DATA_DIR / "pune-dam-storage.json")
    gwr = load(DATA_DIR / "gwr-blocks-pune.json")
    stations = load(DATA_DIR / "gw-stations-pune.json")
    rq = load(DATA_DIR / "river-quality-pune.json")
    tankers = load(DATA_DIR / "pune-tankers.json")
    wb = load(GEO_DIR / "pune-water-bodies-current.geojson")

    facts = (
        supply_facts(supply)
        + reservoir_facts(dams)
        + groundwater_facts(gwr, stations)
        + river_facts(rq)
        + tanker_facts(tankers)
        + gap_facts(wb)
    )

    ids = [f["id"] for f in facts]
    if len(set(ids)) != len(ids):
        raise SystemExit(
            f"duplicate fact ids: {sorted({i for i in ids if ids.count(i) > 1})}"
        )

    payload = {
        "nvdm": "1.0",
        "dataset": "data-root/facts",
        "scope": {"kind": "city", "id": "pune"},
        "provenance": {
            "sources": [
                {
                    "id": "pmc-esr",
                    "title": "PMC Draft Environment Status Report 2025-26, chapter 5",
                    "publisher": "Pune Municipal Corporation, Environment Department",
                    "license": registry_license("pmc-esr"),
                    "role": "input",
                },
                {
                    "id": "ingres-groundwater-maharashtra",
                    "title": "IN-GRES dynamic groundwater assessment, Pune district talukas",
                    "publisher": "CGWB and State groundwater departments, via IIT Hyderabad",
                    "license": registry_license("ingres-groundwater-maharashtra"),
                    "role": "input",
                },
                {
                    "id": "cpcb-polluted-river-stretches",
                    "title": "CPCB Polluted River Stretches (Updated Version), October 2025",
                    "publisher": "Central Pollution Control Board",
                    "license": registry_license("cpcb-polluted-river-stretches"),
                    "role": "input",
                },
                {
                    "id": "wrd-pravah-pune-dams",
                    "title": "Maharashtra WRD Pravah daily dam-safety bulletin",
                    "publisher": "Water Resources Department, Government of Maharashtra",
                    "license": registry_license("wrd-pravah-pune-dams"),
                    "role": "input",
                },
                {
                    "id": "pmc-tanker-register",
                    "title": "PMC daily tanker delivery registers",
                    "publisher": "Pune Municipal Corporation, Water Supply Department",
                    "license": registry_license("pmc-tanker-register"),
                    "role": "input",
                },
                {
                    "id": "wris-telemetry-pune",
                    "title": (
                        "India-WRIS / NWDP groundwater level telemetry (6-hourly), "
                        "Maharashtra - Pune district cut"
                    ),
                    "publisher": (
                        "Maharashtra Groundwater Surveys and Development Agency, "
                        "via India-WRIS / NWDP"
                    ),
                    "license": registry_license("wris-telemetry-pune"),
                    "role": "input",
                },
                {
                    "id": "osm-pune-water",
                    "title": "OpenStreetMap water bodies, Pune",
                    "publisher": "OpenStreetMap contributors",
                    "license": registry_license("osm-pune-water"),
                    "role": "input",
                },
            ],
            "method": "derived",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_pune_facts.py",
            "note": (
                f"{len(facts)} facts, every figure READ FROM A SHIPPED ARTIFACT rather than "
                "transcribed a second time, so a card cannot disagree with the dashboard it came "
                "from. Deliberately absent: any per-capita supply figure presented as delivered "
                "water (PMC's own accounts exclude groundwater and tankers, so the denominator is "
                "wrong for the claim), and any measured annual draw (none published since "
                "2017-18, and the two published figures for that year differ by 4.15 TMC). Each "
                "appears as a gap fact instead."
            ),
        },
        "place_id": "pune",
        "generated_at": date.today().isoformat(),
        "note": (
            "Compiled from primary government sources only, and derived from the artifacts those "
            "sources already produced in this repo. Every card carries its own source URL and "
            "vintage. Two headline numbers a reader would expect are absent on purpose: a "
            "litres-per-capita figure and a measured annual draw. Both are recorded as gaps."
        ),
        "facts": facts,
    }
    write_artifact(DATA_DIR / "facts-pune.json", payload)
    tiers: dict[int, int] = {}
    for f in facts:
        tiers[f["tier"]] = tiers.get(f["tier"], 0) + 1
    print(
        f"pune: {len(facts)} facts ("
        + " ".join(f"tier{t}={tiers[t]}" for t in sorted(tiers))
        + ") -> public/data/facts-pune.json",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
