"""Nagpur supply overview and allocation ledger: consumer fields, copy rules and self-checks."""

import json
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import build_nagpur_allocations as alloc  # noqa: E402
import build_nagpur_supply as supply  # noqa: E402

DASHES = re.compile("[–—]")


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
def overview():
    return supply.build()


@pytest.fixture(scope="module")
def ledger():
    return alloc.build()


def test_hero_reads_what_the_component_reads(overview):
    hero = overview["hero_copy"]
    for key in (
        "headline",
        "body",
        "wtp_label",
        "wtp_sub",
        "uphill_label",
        "uphill_sub",
        "nrw_sub",
        "footer",
    ):
        assert hero[key].strip()
    # Placeholders the component fills: headline {km}/{m}; body {city}/{km}/{m}.
    assert set(re.findall(r"\{(\w+)\}", hero["headline"])) <= {"km", "m"}
    assert set(re.findall(r"\{(\w+)\}", hero["body"])) <= {"city", "km", "m"}
    plants = overview["wtps_summary"]["plants"]
    assert (
        overview["wtps_summary"]["total_installed_capacity_mld"]
        == sum(p["capacity_mld"] for p in plants)
        == 786
    )
    assert overview["allocation_context"]["nrw_pct"] == 41.91
    assert overview["allocation_context"]["transmission_distance_km"] == 48.5
    # First metric current: no census population tile on the hero.
    assert overview["distribution"]["population_served"] is None


def test_supply_tile_fields(overview):
    mix = overview["current_supply_mix_mld"]
    assert sum(m["mld"] for m in mix) == overview["current_supply_total_mld"]
    dist = overview["distribution"]
    assert dist["administrative_zones"] == 10  # gates the stat row
    assert (dist["ground_level_cwrs"], dist["distribution_network_km"]) == (106, 4650)
    assert dist["connections"] == {"total": 450_000}
    assert overview["supply_chain"] and overview["_view_overrides"]["subtitle"]
    for s in overview["_sources"]:
        assert set(s) == {"name", "url", "date", "extracted"} and s["url"].startswith(
            "https://"
        )


def test_supplied_is_not_billed(overview):
    wb = overview["water_balance_2023_24"]
    assert wb["pure_water_supplied_mcm"] == 257.642
    assert wb["loss_pct"] == 41.91 and wb["loss_pct_from_410_of_706"] == 41.93
    assert "supplied total" in wb["_note"]
    assert wb["pure_water_supplied_mld_over_365_days"] == 705.9


@pytest.mark.parametrize("fixture", ["overview", "ledger"])
def test_copy_rules(fixture, request):
    doc = request.getfixturevalue(fixture)
    text = list(_strings(doc))
    assert not [s for s in text if DASHES.search(s)], (
        "no en or em dashes in user-facing text"
    )
    banned = re.compile(
        r"\b(aggregator|awaiting review|workbook|lapse[ds]?|failed to)\b", re.I
    )
    assert not [s for s in text if banned.search(s)]


def test_still_appears_only_inside_quotes(overview, ledger):
    shown = [
        *overview["hero_copy"].values(),
        *overview["supply_chain"],
        overview["_view_overrides"]["subtitle"],
        overview["distribution"]["_connections_note"],
        ledger["headline"],
        ledger["intro"],
        *(e["note"] for e in ledger["events"]),
        *(f["status"] for f in ledger["futures"]),
        *ledger["gaps"],
    ]
    for s in shown:
        assert not re.search(r"\bstill\b", re.sub(r"'[^']*'", "", s), re.I), s


def test_supply_self_checks_fail_loudly(monkeypatch):
    monkeypatch.setitem(supply.F, "billed_mld", 400)
    with pytest.raises(SystemExit):
        supply.checks()


def test_allocation_records_are_accountable(ledger):
    env_ids = {s["id"] for s in ledger["provenance"]["sources"]}
    authorities = {a["id"] for a in ledger["authorities"]}
    for a in ledger["arrangements"]:
        assert a["as_of"] and set(a["source_ids"]) <= env_ids
        assert a.get("authority_id") is None or a["authority_id"] in authorities
        assert a["entitled"]["unit"] == a["received"]["unit"] == "Mcum/yr"
        assert "note" not in a or isinstance(
            a["note"], str
        )  # the contract types it string
    refs = set(ledger["sources"])
    for e in ledger["events"]:
        assert isinstance(e["year"], int) and set(e["source_refs"]) <= refs
    assert [e["year"] for e in ledger["events"]] == sorted(
        e["year"] for e in ledger["events"]
    )
    for item in [*ledger["futures"], *ledger["authorities"]]:
        assert set(item["source_refs"]) <= refs


def test_received_is_2017_18_only(ledger):
    by_id = {a["id"]: a for a in ledger["arrangements"]}
    assert by_id["pench-nmc"]["entitled"]["value"] == 190
    # Pench, Kanhan and Gorewada: billed and treated figures disagree, so no
    # delivery is shown for any of them; the note carries both.
    for key in ("pench-nmc", "kanhan-nmc", "gorewada-nmc"):
        assert by_id[key]["received"]["value"] is None
        assert by_id[key]["received"]["year"] is None
    assert "185 MLD" in by_id["kanhan-nmc"]["received"]["note"]
    assert "456 MLD" in by_id["pench-nmc"]["received"]["note"]
    assert "bills 143.00 Mcum" in by_id["pench-nmc"]["received"]["note"]
    years = {
        a["received"]["year"]
        for a in ledger["arrangements"]
        if a["received"]["value"] is not None
    }
    assert years <= {"2017-18", "availability, NMC's 2017-18 water budget"}


def test_futures_link_the_agreed_commitment_ids(ledger):
    assert {f["commitment_id"] for f in ledger["futures"]} == {
        "ngp-lohghogari-diversion",
        "ngp-rohana-reduce-78",
        "ngp-kolar-kanhan-barrage-dpr",
    }
    assert all(
        f["mld"] is None for f in ledger["futures"]
    )  # Mcum/yr never silently converted


def test_allocation_self_checks_fail_loudly(monkeypatch):
    monkeypatch.setitem(alloc.REPLAN, "nmc", (112, 190, 340))
    with pytest.raises(SystemExit):
        alloc.checks()


def test_built_artifacts_match_the_producers(overview, ledger):
    root = Path(__file__).resolve().parents[2] / "public" / "data"
    for name, built in (
        ("nagpur-supply-overview.json", overview),
        ("allocations-nagpur.json", ledger),
    ):
        path = root / name
        if not path.exists():
            pytest.skip(f"{name} not generated (corpus not checked out)")
        on_disk = json.loads(path.read_text())
        drop = lambda d: {k: v for k, v in d.items() if k != "provenance"}  # noqa: E731
        assert drop(on_disk) == drop(built)
