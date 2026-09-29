"""Tests for the printed-spreadsheet reader (scripts/lib/sheet_print.py).

KSPCB's monthly NWMP data is an Excel sheet printed to PDF. Each case below
is a layout the real reports use, built from word boxes, so the placement
rules are tested without pdftotext.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "lib"))

import sheet_print  # noqa: E402

KEY = re.compile(r"\d{1,5}")
WANTED = {
    "do": re.compile(r"Dissolv(e|ed)?d?O2"),
    "ph": re.compile(r"pH"),
    "ec": re.compile(r"Conduc"),
}


def word(x, y, text):
    return (float(x), float(y), float(x + 5 * len(text)), float(y + 10), text)


HEADER = [
    word(10, 10, "STN"),
    word(50, 10, "Colour"),
    word(110, 10, "Temp"),
    word(150, 10, "Dissolved"),
    word(150, 20, "O2"),
    word(210, 10, "pH"),
    word(250, 10, "Conductivity"),
]


def row(y, code, cells, code_dy=0):
    xs = {"colour": 50, "temp": 112, "do": 152, "ph": 210, "ec": 252}
    return [word(10, y + code_dy, code)] + [
        word(xs[k] if k in xs else k, y, v) for k, v in cells
    ]


def usual(y, code, temp, do, ph, ec, code_dy=0):
    return row(
        y,
        code,
        [("colour", "Clear"), ("temp", temp), ("do", do), ("ph", ph), ("ec", ec)],
        code_dy,
    )


def test_a_shifted_row_is_placed_by_position():
    # A two-word colour beside a blank conductivity cell has the usual cell count; read by count it would put
    # the dissolved oxygen value under pH (December 2025, station 5177).
    shifted = row(
        110,
        "5177",
        [(42, "Turbid"), (74, "Green"), ("temp", "31"), ("do", "5.1"), ("ph", "8.4")],
    )
    words = (
        HEADER
        + usual(50, "2326", "28", "7.5", "7.8", "610")
        + usual(70, "3460", "27", "6.5", "7.9", "615")
        + usual(90, "2328", "28", "6.2", "7.3", "70")
        + shifted
    )
    labels, rows, skipped = sheet_print.tile(words, KEY)
    do, ph, ec = (
        next(i for i, label in enumerate(labels) if rx.search(label.replace(" ", "")))
        for rx in WANTED.values()
    )
    assert (rows["5177"][do], rows["5177"][ph], rows["5177"][ec]) == ("5.1", "8.4", "")
    assert (rows["2326"][do], rows["2326"][ph], rows["2326"][ec]) == (
        "7.5",
        "7.8",
        "610",
    )
    assert skipped == []


def test_a_code_set_below_its_row_takes_that_row():
    words = (
        HEADER
        + usual(50, "2326", "28", "7.5", "7.8", "610", code_dy=8)
        + usual(76, "3460", "27", "6.5", "7.9", "615", code_dy=8)
        + usual(102, "1207", "27", "9.3", "7.2", "87")
    )
    _, rows, _ = sheet_print.tile(words, KEY)
    assert rows["2326"][2:] == ["7.5", "7.8", "610"]
    assert rows["3460"][2:] == ["6.5", "7.9", "615"]
    assert rows["1207"][2:] == ["9.3", "7.2", "87"]


def test_a_header_naming_two_parameters_is_left_out(monkeypatch):
    # 'Dissolved O2 pH' printed over one column (October and December 2025).
    merged = [w for w in HEADER if w[4] != "pH"] + [word(150, 30, "pH")]
    page = (
        merged
        + usual(50, "2326", "28", "7.5", "7.8", "610")
        + usual(70, "3460", "27", "6.5", "7.9", "615")
    )
    monkeypatch.setattr(sheet_print, "pages", lambda pdf: [page])
    found, notes = sheet_print.columns(Path("report.pdf"), KEY, WANTED)
    assert found["2326"] == {"ec": "610"}
    assert any("do and ph share a column" in n for n in notes)
