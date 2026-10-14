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
