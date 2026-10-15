"""Row tests for the Gujarat daily dam report scraper (Ahmedabad's feed).

reservoir_daily_v2 types inflow_cusecs and outflow_cusecs as integer, and
PostgREST rejects a decimal such as 0.0 for the whole batch, so a backfill
that sends one writes nothing at all.
"""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from scrape_gujarat_wrd_dams import db_rows  # noqa: E402

DAM = {
    "live_mcm": 834.47,
    "live_pct": 70.02,
    "level_m": 123.98,
    "inflow_cusecs": 0.0,
    "outflow_river_cusecs": 1234.5,
    "outflow_canal_cusecs": 0.25,
}


def test_flow_columns_are_integers():
    (row,) = db_rows("ahmedabad", date(2026, 10, 14), {"kadana": DAM})
    assert row["inflow_cusecs"] == 0 and type(row["inflow_cusecs"]) is int
    assert row["outflow_cusecs"] == 1235 and type(row["outflow_cusecs"]) is int


def test_missing_flows_stay_null():
    dam = {**DAM, "inflow_cusecs": None, "outflow_river_cusecs": None}
    (row,) = db_rows("ahmedabad", date(2026, 10, 14), {"kadana": dam})
    assert row["inflow_cusecs"] is None and row["outflow_cusecs"] is None


def test_misprinted_level_is_withheld_and_storage_kept():
    (row,) = db_rows("ahmedabad", date(2023, 5, 4), {"sardar_sarovar": DAM})
    assert row["level_ft"] is None
    assert row["storage_tmc"] == round(834.47 / 28.3168, 3)


def test_misprinted_row_is_withheld():
    rows = db_rows("ahmedabad", date(2024, 7, 3), {"dharoi": DAM, "kadana": DAM})
    assert [r["source_code"] for r in rows] == ["kadana"]


def test_level_above_frl_plus_two_metres_is_dropped(monkeypatch):
    import scrape_gujarat_wrd_dams as s

    ssp = {**DAM, "frl_m": 138.68, "level_m": 11849.0}
    kadana = {**DAM, "frl_m": 127.71, "level_m": 123.98}
    monkeypatch.setattr(s, "parse_sardar_sarovar", lambda text: dict(ssp))
    monkeypatch.setattr(s, "parse_dam", lambda text, name: dict(kadana))
    out = s.parse_report("", s.CITIES["ahmedabad"])
    assert out["sardar_sarovar"]["level_m"] is None
    assert out["kadana"]["level_m"] == 123.98
