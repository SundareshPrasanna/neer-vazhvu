"""Nagpur commitments register and lake-restoration files against their consumers.

The commitments rows are src/cities/nagpur/commitments.json, built by
build_commitments.py (which runs the shared checks); these tests add Nagpur's own.

The commitments page (commitments-client.tsx) and the lake-restoration page
(lake-restoration-content.tsx) read these fields without guards; React keys are
the commitment id, the flagship name, the project scheme_name and the court
order's writ_petition, so each must be unique. The allocation ledger links
three of the commitment ids, so renaming one breaks a cross-page link.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "neer-vazhvu-api" / "scripts"))

import build_commitments as engine  # noqa: E402
import build_nagpur_lakes as bl  # noqa: E402

SPEC = json.loads((ROOT / "src/cities/nagpur/commitments.json").read_text())
COMMITMENTS = SPEC["payload"]["commitments"]
# Government Resolutions whose official PDF did not open on 15 October 2026, so
# the row links the orgpedia mahGRs archive copy.
MIRROR_CODES = {
    "202211021115299425",  # Naik lake, AMRUT 2.0
    "202211021157345625",  # Lendi lake, AMRUT 2.0
    "202303061239587125",  # AMRUT 2.0 water distribution
    "202304061347581325",  # AMRUT 1.0 pipeline replacement
    "202304201803571027",  # Kolar-Kanhan barrage DPR, Rohana
}

STATUSES = {"delivered", "on-track", "slipped", "overdue", "stalled", "unverified"}
DATE = re.compile(r"^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$")
# Internal process words and blame words never reach a page (quotes of a
# document's own title or wording are allowed, so only bare uses are checked).
BANNED = re.compile(r"\b(still|failed|lapsed|awaiting|workbook|drop)\b", re.I)


def test_commitment_rows_match_the_page():
    ids = [c["id"] for c in COMMITMENTS]
    assert len(ids) == len(set(ids))
    for c in COMMITMENTS:
        for key in ("category", "title", "committed_by", "what"):
            assert isinstance(c[key], str) and c[key], (c["id"], key)
        assert c["status"] in STATUSES
        assert c["due"] is None or DATE.match(c["due"])
        assert c["revised_due"] is None or DATE.match(c["revised_due"])
        assert c["next_check"] is None or DATE.match(c["next_check"])
        cs = c["commitment_source"]
        assert (
            cs["label"] and cs["url"].startswith("https://") and DATE.match(cs["date"])
        )
        assert c["status_history"], c["id"]
        for e in c["status_history"]:
            assert DATE.match(e["date"]) and e["status"] in STATUSES
            assert (
                e["note"]
                and e["source_label"]
                and e["source_url"].startswith("https://")
            )
        # The row's status is its latest dated status.
        assert c["status"] == c["status_history"][-1]["status"], c["id"]


def test_statuses_follow_the_dates():
    for c in COMMITMENTS:
        if c["status"] == "slipped":
            assert c["revised_due"], c["id"]
        if c["status"] == "overdue":
            assert c["due"] and (c["revised_due"] or c["due"]) < "2026-10-15", c["id"]


def test_ids_linked_from_the_allocation_ledger_exist():
    ids = {c["id"] for c in COMMITMENTS}
    for linked in (
        "ngp-lohghogari-diversion",
        "ngp-rohana-reduce-78",
        "ngp-kolar-kanhan-barrage-dpr",
    ):
        assert linked in ids
    ledger = ROOT / "public" / "data" / "allocations-nagpur.json"
    if ledger.exists():
        arrangements = {a["id"] for a in json.loads(ledger.read_text())["arrangements"]}
        for c in COMMITMENTS:
            if c.get("ledger_id"):
                assert c["ledger_id"] in arrangements, c["id"]


def test_mirror_text_grs_are_flagged_and_linked():
    flagged = [c for c in COMMITMENTS if c["commitment_source"].get("text_via_mirror")]
    assert {c["commitment_source"]["gr_code"] for c in flagged} <= MIRROR_CODES
    for c in flagged:
        cs = c["commitment_source"]
        assert "archive copy" in cs["label"] and cs["gr_code"] in cs["label"]
        # The page links `url`: it must be the copy that opens, not the 404 path.
        assert cs["url"] == cs["mirror_url"] and "orgpedia/mahGRs" in cs["url"]
        assert cs["official_url"].startswith("https://gr.maharashtra.gov.in/")
        assert any("orgpedia/mahGRs" in e["source_url"] for e in c["status_history"])


def test_producer_invariants_hold():
    problems, _ = engine.check("nagpur", SPEC, "2026-10-15")
    assert problems == []


def test_lake_files_match_the_page():
    bodies, projects, orders = bl.bodies(), bl.projects(), bl.court_orders()
    assert len({b["name"] for b in bodies}) == len(bodies)
    assert len({p["scheme_name"] for p in projects}) == len(projects)
    assert len({o["writ_petition"] for o in orders}) == len(orders)
    for b in bodies:
        assert b["confidence"] in ("V", "N", "C") and b["status"] and b["type"]
        assert b["sources"] and len(set(b["sources"])) == len(b["sources"])
        assert b.get("year_built") is None or isinstance(b["year_built"], int)
        assert 21.0 < b["lat"] < 21.3 and 78.9 < b["lon"] < 79.2, b["name"]
    for p in projects:
        assert p["operator"] and p["scope"] and p["status"] and p["sources"]
        assert "amount_cr" not in p or p["amount_cr"] > 0
    for o in orders:
        assert (
            o["ruling"]
            and o["concern"]
            and o["source"].startswith("https://indiankanoon.org/doc/")
        )
        assert DATE.match(o["date"]) and isinstance(o["specific_tanks"], list)


def test_ambazari_is_placed_in_the_city_not_at_nrld_coordinates():
    amb = next(b for b in bl.bodies() if b["name"] == "Ambazari Lake")
    # NRLD prints 21 02' 21" N, 78 49' 42" E, about 25 km west-south-west.
    assert abs(amb["lat"] - 21.1255) < 0.01 and abs(amb["lon"] - 79.043) < 0.01


def test_page_text_is_plain():
    page = json.loads((ROOT / "public/data/commitments-nagpur.json").read_text())
    texts = [
        json.dumps(COMMITMENTS),
        json.dumps([bl.bodies(), bl.projects(), bl.court_orders()]),
        json.dumps([page[k] for k in ("headline", "intro", "status_legend")]),
    ]
    for t in texts:
        assert "—" not in t and "–" not in t
        assert not BANNED.search(re.sub(r"'[^']*'", "", t)), BANNED.search(t)
