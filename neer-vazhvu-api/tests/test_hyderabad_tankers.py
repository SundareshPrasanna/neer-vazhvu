"""Hyderabad tanker ledger: the arithmetic that an unattended monthly job commits."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from build_hyderabad_tankers import summarise  # noqa: E402


def _row(year, month, section, bookings, delivered, division="15"):
    return {
        "year": year,
        "month": month,
        "division": division,
        "section": section,
        "bookings": bookings,
        "delivered": delivered,
    }


def test_rankings_never_cross_the_feb_2026_recut():
    rows = [
        _row(2026, 1, "KONDAPUR (DIV 15)", 100, 100),
        _row(2026, 1, "MADHAPUR", 40, 39),
        _row(2026, 2, "KONDAPUR (DIV 15) (OLD)", 70, 70),
        _row(2026, 3, "KONDAPUR (NEW)", 90, 80, division="90"),
    ]
    out = summarise(rows)
    pre, post = out["eras"]
    assert (pre["id"], pre["from"], pre["to"], pre["bookings"]) == (
        "pre_recut",
        "Jan 2026",
        "Jan 2026",
        140,
    )
    assert [s["section"] for s in pre["sections"]] == ["KONDAPUR (DIV 15)", "MADHAPUR"]
    assert (post["from"], post["to"], post["bookings"], post["delivered"]) == (
        "Feb 2026",
        "Mar 2026",
        160,
        150,
    )
    assert [d["division"] for d in post["divisions"]] == ["90", "15"]
    assert out["totals"] == {
        "bookings": 300,
        "delivered": 289,
        "shortfall": 11,
        "fulfilment_pct": 96.3,
        "months": 3,
    }


def test_seasonality_uses_complete_years_only():
    rows = [_row(2023, m, "A", 10 * m, 10 * m) for m in range(1, 13)]
    rows += [_row(2024, m, "A", 1000, 1000) for m in range(1, 5)]
    season = summarise(rows)["seasonality"]
    assert [(s["label"], s["mean_bookings"], s["years"]) for s in season][:2] == [
        ("Jan", 10, 1),
        ("Feb", 20, 1),
    ]
    assert len(season) == 12
