"""CMWSSB HTML parser: unreported and implausible values must never become 0.

A "-" or blank storage cell means the reservoir is UNREPORTED that day; the
parser skips the row so the pipeline's completeness guard refuses the partial
day, instead of storing a confident 0 that renders as an empty reservoir
(2026-08 baseline P0.1b).
"""

from app.scrapers.cmwssb import _parse_cmwssb_html


def _page(rows: str) -> str:
    return f"""
    <html><body>
    <p>Lake level as on 01/08/2026</p>
    <table>{rows}</table>
    </body></html>
    """


def _row(name: str, capacity: str, level: str, storage: str, pct: str) -> str:
    # Parser layout: cells[0]=name, [2]=capacity, [3]=level, [4]=storage,
    # [5]=pct, [6]=inflow, [7]=outflow, [8]=rainfall.
    cells = [name, "x", capacity, level, storage, pct, "10", "5", "0"]
    return "<tr>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>"


def test_normal_row_parses():
    result = _parse_cmwssb_html(_page(_row("Poondi", "3231", "30.1", "1500.5", "46.4")))
    assert len(result.readings) == 1
    r = result.readings[0]
    assert r.reservoir == "poondi"
    assert r.current_storage_mcft == 1500.5
    assert r.date == "2026-08-01"


def test_unparseable_storage_skips_row_not_zero():
    html = _page(
        _row("Poondi", "3231", "30.1", "1500.5", "46.4")
        + _row("Cholavaram", "1081", "-", "-", "-")
    )
    result = _parse_cmwssb_html(html)
    names = [r.reservoir for r in result.readings]
    assert names == ["poondi"], "unreported reservoir must be skipped, not stored as 0"


def test_storage_above_capacity_skips_row():
    # Column-shift guard: storage far above known capacity means the table
    # layout changed upstream; better no row than a wrong row.
    html = _page(
        _row("Poondi", "3231", "30.1", "1500.5", "46.4")
        + _row("Cholavaram", "1081", "22.0", "3300", "100")
    )
    result = _parse_cmwssb_html(html)
    assert [r.reservoir for r in result.readings] == ["poondi"]
