"""Parser tests for the BBMB daily reservoir bulletin (Delhi's Bhakra feed).

The fetch half is not tested here - it hits a NICNET host from the launchd
runner. What matters for correctness is the parse: BBMB overwrites one file
daily with no archive, so a silent parse regression loses days permanently
rather than raising.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from scrape_bbmb_dams import parse  # noqa: E402

# Exactly as `pdftotext -layout` renders the 2026-07-26 bulletin.
BULLETIN = """
                            BBMB Reservoir Data
  Bhakra Dam
  FRL- 1680 ft
  Pong Dam
  Reduced FRL - 1390 ft.
         (FRL- Full Reservoir Level, MWL- Maximum Water Level)

                  Latest BBMB Reservoir Data
                       as on 26-07-2026 06:00 Hrs.

  Reservoir            Level               Inflows         Outflows
                       (Feet)             (Cusecs)         (Cusecs)
Bhakra                1592.91                    40363         26132

Pong                  1329.86                    37172         10007
"""


def test_parses_report_date_and_both_dams():
    report_date, readings = parse(BULLETIN)
    assert report_date == "2026-07-26"
    assert [r["source_code"] for r in readings] == ["bhakra", "pong"]


def test_bhakra_values_and_delhi_binding():
    _, readings = parse(BULLETIN)
    bhakra = next(r for r in readings if r["source_code"] == "bhakra")
    assert bhakra["level_ft"] == 1592.91
    assert bhakra["inflow_cusecs"] == 40363
    assert bhakra["outflow_cusecs"] == 26132
    assert bhakra["reading_time"] == "06:00"
    # Bhakra is the only row that may reach reservoir_daily_v2.
    assert bhakra["city_id"] == "delhi"


def test_pong_is_context_only_and_never_reaches_the_db():
    _, readings = parse(BULLETIN)
    pong = next(r for r in readings if r["source_code"] == "pong")
    assert pong["city_id"] is None
    # Pong's operative level is the REDUCED FRL, not the design 1400 ft.
    assert pong["frl_ft"] == 1390.0


def test_no_storage_volume_is_invented_from_level():
    """Level over FRL is not a volume ratio, and Delhi's share of Bhakra is
    never published - so the parser must not emit storage or a percentage."""
    _, readings = parse(BULLETIN)
    for r in readings:
        assert "storage_tmc" not in r
        assert "storage_pct_frl" not in r


def test_missing_as_on_date_yields_none_rather_than_today():
    """A bulletin without its 'as on' line must not be dated optimistically -
    main() refuses to upsert when the date is None."""
    report_date, readings = parse(BULLETIN.replace("as on 26-07-2026 06:00", "as on"))
    assert report_date is None
    assert readings, "rows still parse; only the date is unknown"


def test_layout_change_yields_no_rows_rather_than_wrong_rows():
    """If BBMB reflows the table, the row regex should match nothing at all -
    a loud zero, not a plausible-but-wrong number."""
    _, readings = parse(BULLETIN.replace("1592.91", "1592.91 ft"))
    assert [r["source_code"] for r in readings] == ["pong"]
