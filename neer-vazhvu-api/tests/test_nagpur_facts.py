"""Nagpur facts and ward profiles: the fields their pages read, and the copy rules."""

import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
FACTS = ROOT / "public/data/facts-nagpur.json"
PROFILES = ROOT / "public/data/nagpur-ward-profiles.json"
DASHES = re.compile("[–—]")
DATE = re.compile(r"^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$")
INTERNAL = re.compile(
    r"awaiting review|proposed|workbook|\bdrop(ped)?\b|aggregator", re.I
)


def _strings(node):
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for v in node.values():
            yield from _strings(v)
    elif isinstance(node, list):
        for v in node:
            yield from _strings(v)


@pytest.fixture(scope="module")
def facts():
    if not FACTS.exists():
        pytest.skip("facts-nagpur.json not built")
    return json.loads(FACTS.read_text())


@pytest.fixture(scope="module")
def profiles():
    if not PROFILES.exists():
        pytest.skip("nagpur-ward-profiles.json not built")
    return json.loads(PROFILES.read_text())


def test_cards_carry_what_the_facts_page_reads(facts):
    ids = [f["id"] for f in facts["facts"]]
    assert len(ids) == len(set(ids)), "duplicate fact id (React key and #anchor)"
    for f in facts["facts"]:
        for k in ("id", "tier", "category", "title", "value", "unit", "interpretation"):
            assert f.get(k) not in (None, ""), f"{f['id']}: {k} empty"
        assert f["tier"] in (1, 2, 3, 4)
        assert f["source_url"].startswith("https://"), f["id"]
        assert f["source_label"], f["id"]
        if "data_date" in f:
            assert DATE.match(f["data_date"]), f"{f['id']}: data_date {f['data_date']}"


def test_every_card_cites_an_envelope_source(facts):
    env = {s["id"] for s in facts["provenance"]["sources"]}
    for f in facts["facts"]:
        assert f["source_ids"] and set(f["source_ids"]) <= env, f["id"]


def test_dashboard_strip_opens_on_supply_and_spans_categories(facts):
    strip = [f for f in facts["facts"] if f.get("featured")]
    assert strip[0]["category"] == "Supply"
    assert len({f["category"] for f in strip}) >= 4


def test_no_card_claims_live(facts):
    # Tier 1 is the facts page's Live badge; every Nagpur card is a dated
    # document figure or a snapshot.
    assert not [f["id"] for f in facts["facts"] if f["tier"] == 1]


def test_copy_rules(facts, profiles):
    for s in list(_strings(facts["facts"])) + list(_strings(profiles["wards"])):
        assert not DASHES.search(s), s[:80]
        assert not INTERNAL.search(s), s[:80]


def test_profiles_mark_missing_sections_not_zero(profiles):
    assert len(profiles["wards"]) == 38
    for w in profiles["wards"]:
        for k in ("flood", "drainage", "sewerage", "industrial", "lost_bodies"):
            assert w[k]["_data_status"] == "not_available" and w[k]["_data_status_note"]
        assert w["groundwater_assessment"]["block"] is not None
        assert w["rivers"]["nearest_station_id"]


def test_profiles_cite_only_used_sources(profiles):
    ids = {s["id"] for s in profiles["provenance"]["sources"]}
    stations = {w["rivers"]["nearest_station_id"] for w in profiles["wards"]}
    if all(s.startswith("esr-") for s in stations):
        assert "mpcb-prs-monthly-nagpur-rivers" not in ids
        assert "nmc-esr-river-stp-tables" in ids
