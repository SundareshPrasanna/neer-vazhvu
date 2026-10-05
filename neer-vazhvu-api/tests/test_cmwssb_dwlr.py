"""CMWSSB ward loggers: what can go wrong silently is the transform.

The portal answers with the latest reading BEFORE the date asked, writes 0.000
for a missed reading, flips sign while a logger is being commissioned, and
throws the odd 50 m spike. None of that may reach the table as a measurement.
"""

import json
from datetime import date, datetime, timedelta
from types import SimpleNamespace

from app.scrapers import cmwssb_dwlr
from app.scrapers.cmwssb_dwlr import (
    Depot,
    RawArchive,
    Reading,
    daily_rows,
    parse_latest,
    parse_report,
    upsert_daily,
)

ENNORE = Depot(1, "Thiruvottiyur", 1, "Ennore, Thalangkuppam, Ch - 57")


def _answer(date1, level):
    return json.dumps(
        [{"date": "-", "date1": date1, "waterlevel": level, "areaId": 0, "wellId": 0}]
    ).encode()


def test_reading_date_comes_from_the_answer_not_the_question():
    r = parse_latest(_answer("Oct 3, 2026 8:00:00 PM", -1.641), ENNORE)
    assert r.observed_at == datetime(2026, 10, 3, 20, 0)
    assert (r.depot_id, r.zone, r.value) == (1, 1, -1.641)


def test_no_data_answer_is_no_reading():
    body = json.dumps(
        [{"areaId": 0, "errorMsg": "No Data Found", "wellId": 0}]
    ).encode()
    assert parse_latest(body, ENNORE) is None


def test_report_columns_found_by_header(monkeypatch):
    rows = [
        ["", "", "GROUND WATER LEVEL -LOCATION WISE REPORT", "", "", ""],
        ["", "Sl.No", "", "Area", "Depot", "Date", "Water Level (in m)"],
        [
            "",
            1,
            "",
            "AREA15",
            "DP198,Sholinganallur, Ponniamman Koil Street, Ch - 119",
            "01/06/2021 06:00:00",
            "-4.794",
        ],
        [
            "",
            2,
            "",
            "AREA15",
            "DP198,Sholinganallur, Ponniamman Koil Street, Ch - 119",
            "01/06/2021 18:00:00",
            "-",
        ],
    ]
    sheet = SimpleNamespace(nrows=len(rows), row_values=lambda i: rows[i])
    book = SimpleNamespace(sheet_by_index=lambda i: sheet, datemode=0)
    monkeypatch.setattr(cmwssb_dwlr.xlrd, "open_workbook", lambda **k: book)
    assert parse_report(b"\xd0\xcf") == [
        Reading(
            198,
            15,
            "Sholinganallur, Ponniamman Koil Street, Ch - 119",
            datetime(2021, 6, 1, 6, 0),
            -4.794,
        )
    ]


def test_no_record_page_is_no_reading():
    assert parse_report(b"<html>...No record found...</html>") == []


def _series(values, start=datetime(2021, 1, 1, 6, 0)):
    return [
        Reading(4, 1, "Ennore booster", start + timedelta(hours=12 * i), v)
        for i, v in enumerate(values)
    ]


def test_spike_dropped_against_its_neighbours():
    values = [-3.8 - 0.01 * (i % 5) for i in range(40)]
    values[21] = -51.491  # DEP 4, 2021-01-11 18:00
    rows = {r["reading_date"]: r for r in daily_rows(_series(values), {})}
    day = rows["2021-01-11"]
    assert (day["readings"], day["dropped"], day["status"]) == (1, 1, "measured")
    assert 3.7 < day["depth_m_bgl"] < 3.9


def test_placeholders_and_commissioning_values_are_not_measured():
    values = [19.9, 20.1, 0.0, 0.0] + [-5.8 - 0.05 * (i % 7) for i in range(60)]
    rows = daily_rows(_series(values), {})
    first, second = rows[0], rows[1]
    assert first["status"] == second["status"] == "not_measured"
    assert first["depth_m_bgl"] is None and first["dropped"] == 2
    assert all(r["depth_m_bgl"] > 0 for r in rows[2:])


def test_flat_logger_marked_stuck_with_value_kept():
    rows = daily_rows(_series([-7.25] * 90), {})
    assert rows[0]["status"] == "measured"  # too little history yet to call it
    assert rows[-1]["status"] == "stuck" and rows[-1]["depth_m_bgl"] == 7.25


def test_rows_name_their_raw_file():
    rs = _series([-2.0, -2.1])
    refs = {(4, rs[1].observed_at): "latest/004/2021-01-02.json.gz"}
    assert daily_rows(rs, refs)[0]["raw_ref"] == "latest/004/2021-01-02.json.gz"


def test_archive_keeps_the_latest_fetch_of_a_reading(tmp_path):
    archive = RawArchive(tmp_path)
    archive.save_depots([ENNORE])
    archive.save(
        "latest/001/2026-10-04.json",
        _answer("Oct 3, 2026 8:00:00 PM", -1.6),
        {"fetched_at": "1"},
    )
    archive.save(
        "latest/001/2026-10-05.json",
        _answer("Oct 3, 2026 8:00:00 PM", -1.641),
        {"fetched_at": "2"},
    )
    readings, refs = archive.readings()
    assert [r.value for r in readings] == [-1.641]
    assert set(refs.values()) == {"latest/001/2026-10-05.json.gz"}
    assert archive.read("latest/001/2026-10-05.json.gz") == _answer(
        "Oct 3, 2026 8:00:00 PM", -1.641
    )


def test_upsert_names_the_city():
    calls = []

    class Table:
        def upsert(self, rows, on_conflict):
            calls.append((rows, on_conflict))
            return self

        def execute(self):
            return None

    db = SimpleNamespace(table=lambda name: Table())
    upsert_daily(
        db,
        [{"station_id": "CMWSSB-001", "reading_date": date(2026, 10, 3).isoformat()}],
        "chennai",
    )
    assert calls == [
        (
            [
                {
                    "station_id": "CMWSSB-001",
                    "reading_date": "2026-10-03",
                    "city_id": "chennai",
                }
            ],
            "city_id,station_id,reading_date",
        )
    ]
