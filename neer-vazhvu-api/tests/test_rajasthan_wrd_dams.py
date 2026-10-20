"""Row tests for the Rajasthan WRD "Water Storage Data" scraper (Jaipur's feed).

Fixtures are verbatim line excerpts of pdftotext -layout output, saved by the
feeds research on 2026-10-20 (.onboarding-state/research/feeds/raw/wrd):
the 08 Oct 2026 and 16 May 2025 (off-season) storage reports, the 15 Jul 2026
report (its year-typo line), the 15 Sep 2023 Daily Rainfall Bulletin (Kruti Dev
tables, read against the page images) and the misfiled "Morning Rainfall
Bulletin" of 08 Oct 2026 (a canal rotation).
"""

import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import scrape_rajasthan_wrd_dams as s  # noqa: E402

FIX = Path(__file__).resolve().parent / "fixtures"


def report(name: str) -> dict:
    return s.parse_report((FIX / f"rajasthan_wrd_{name}_excerpt.txt").read_text())


OCT = report("2026-10-08")
MAY = report("2025-05-16")
BULLETIN_2023 = report("bulletin_2023-09-15")


def test_bisalpur_8_october_2026():
    r = OCT["readings"]["bisalpur"]
    assert OCT["date"] == "2026-10-08"
    assert (r["level_m"], r["gross_mcum"], r["pct_designed"]) == (313.90, 781.41, 71.31)
    assert (r["designed_level_m"], r["designed_mcum"]) == (315.50, 1095.84)
    assert (r["prev_date"], r["prev_level_m"]) == ("2026-10-07", 313.92)
    assert (r["last_year_date"], r["last_year_mcum"]) == ("2025-10-08", 1095.84)
    assert r["inflow_cusecs"] == 0.0


def test_every_jaipur_dam_is_found_and_none_withheld():
    assert set(OCT["readings"]) == set(s.DAMS)
    assert OCT["withheld"] == [] and OCT["warnings"] == []
    got = {c: (r["gross_mcum"], r["pct_designed"]) for c, r in OCT["readings"].items()}
    assert got["ramgarh"] == (0.0, 0.0)
    assert got["kanota"] == (14.13, 100.0)
    assert got["mansagar_jalmahal"] == (0.906, 79.75)
    assert got["isarda"] == (59.6, 64.95)


def test_same_names_resolve_by_designed_capacity():
    # Jodhpur's 6.600 Mcum "Bisalpur" and Tonk's "Mansagar*1" sit in the same
    # excerpt; the two "Chandlai" rows are told apart by capacity.
    assert OCT["readings"]["bisalpur"]["designed_mcum"] == 1095.84
    assert OCT["readings"]["mansagar_jalmahal"]["designed_mcum"] == 1.136
    assert OCT["readings"]["chandlai_tonk"]["designed_mcum"] == 4.53
    assert OCT["readings"]["chandlai_jaipur"]["designed_mcum"] == 2.04
    assert OCT["readings"]["chandlai_tonk"]["printed_name"] == "Tonk Chandlai"


def test_off_season_report_2025():
    assert MAY["date"] == "2025-05-16"
    b = MAY["readings"]["bisalpur"]
    assert (b["level_m"], b["gross_mcum"], b["pct_designed"]) == (
        312.99,
        634.155,
        57.87,
    )
    # The previous column is the last report (1 May), and last year's column
    # is dated 30/09/2024 in its header, not the same date a year back.
    assert b["prev_date"] == "2025-05-01" and b["last_year_date"] == "2024-09-30"
    assert b["inflow_cusecs"] is None  # printed "Inflow - Cusec"
    assert "isarda" not in MAY["readings"]  # not in the major-dam table yet


def test_district_labels_lag_so_rows_match_by_name():
    assert MAY["readings"]["kanota"]["printed_name"] == "Jaipur-Rural Kanota"
    assert MAY["readings"]["chhaparwara"]["printed_name"] == "Dudu Chhaparwara"


def test_designed_value_drift_warns_and_keeps_the_row():
    assert MAY["readings"]["ramgarh"]["designed_mcum"] == 75.022
    assert {
        "source_code": "ramgarh",
        "warning": "designed capacity 75.022 (expected 75.04)",
    } in MAY["warnings"]
    assert MAY["withheld"] == []


def test_filled_marker_is_ignored():
    # "*1" sits on Kanota at 100% and on Jaipur's Chandlai, never on the name.
    assert OCT["readings"]["kanota"]["printed_name"] == "Jaipur Kanota*¹"
    assert OCT["readings"]["kanota"]["pct_designed"] == 100.0


def test_year_typo_in_summary_line_does_not_move_the_date():
    jul = report("2026-07-15")
    # The report prints "MAJOR DAM STATUS ON 15.06.2025" for 15/06/2026.
    assert jul["dates"] == ["2026-07-15"]
    assert jul["readings"]["bisalpur"]["gross_mcum"] == 738.412
    assert jul["readings"]["isarda"]["last_year_mcum"] is None  # printed "-"


def test_kruti_dev_bulletin_2023():
    b = BULLETIN_2023
    assert b["date"] == "2023-09-15"
    assert set(b["readings"]) == set(s.DAMS) - {"isarda"}
    bis = b["readings"]["bisalpur"]
    assert bis["font"] == "kruti-dev"
    assert (bis["level_m"], bis["gross_mcum"], bis["pct_designed"]) == (
        313.74,
        750.14,
        68.45,
    )
    assert bis["inflow_cusecs"] == 0.0 and bis["last_year_date"] == "2022-09-15"
    # Ramgarh's name is on its own line above the row.
    assert b["readings"]["ramgarh"]["printed_name"] == "t;iqj | jkex<"
    # Two-decimal capacities still pass the % check (1.02 / 1.136 = 89.79%).
    assert b["readings"]["mansagar_jalmahal"]["pct_designed"] == 89.79
    assert b["readings"]["chandlai_tonk"]["gross_mcum"] == 2.48


def test_bulletin_rows_from_other_tables_are_not_read():
    # The English "DATE OF FILLING" list (trailing date), the rainfall table
    # and CWC's Bisalpur Reservoir level row are all in the excerpt.
    assert BULLETIN_2023["readings"]["kanota"]["font"] == "kruti-dev"
    assert BULLETIN_2023["withheld"] == []


def test_canal_rotation_misfiled_as_a_bulletin_has_no_dam_table():
    m = report("morning_2026-10-08")
    assert m["date"] is None and m["readings"] == {}
    assert m["withheld"] == [{"reason": "no_dam_table"}]


def test_dam_rows_without_a_report_date_are_not_read():
    text = (FIX / "rajasthan_wrd_2026-10-08_excerpt.txt").read_text()
    for rx in (*s._DATE_LINES, s._HDR):
        text = rx.sub("", text)
    bad = s.parse_report(text)
    assert bad["readings"] == {} and bad["withheld"] == [{"reason": "no_report_date"}]


@pytest.mark.parametrize(
    "line",
    [
        "fnuakd :-        15-Sep-2023",
        "fnuakd :-         14/Jul/2023",
        "fnukad:- 14 July 2023",
        "fnukad:- 14/07/23",
    ],
)
def test_kruti_dev_date_lines(line):
    assert s.report_dates(line) == {date(2023, *(9, 15) if "Sep" in line else (7, 14))}


def test_gauge_printed_zero_beside_storage_drops_only_the_level():
    text = (FIX / "rajasthan_wrd_2026-10-08_excerpt.txt").read_text()
    newta = "4.88          6.703       3.66       3.66      3.770"
    rep = s.parse_report(
        text.replace(newta, newta.replace("3.66       3.66", "0.00       0.00"))
    )
    r = rep["readings"]["ramsagar_newta"]
    assert r["level_m"] is None and r["gross_mcum"] == 3.77
    assert {
        "source_code": "ramsagar_newta",
        "warning": "level 0.00 beside storage; level dropped",
    } in rep["warnings"]


def test_recorded_misprints():
    # Chhaparwara on 18 Jun 2026 printed Kalakhsagar's 1.57 m and 0.010 Mcum.
    assert s.MISPRINTS[("chhaparwara", "2026-06-18")] == "row"


def test_wrong_percentage_is_withheld_not_corrected():
    text = (FIX / "rajasthan_wrd_2026-10-08_excerpt.txt").read_text()
    bad = s.parse_report(text.replace("781.410     71.31%", "781.410     17.31%"))
    assert "bisalpur" not in bad["readings"]
    assert any(
        w.get("source_code") == "bisalpur" and w["reason"] == "pct_arithmetic"
        for w in bad["withheld"]
    )


def test_level_above_designed_plus_two_metres_is_withheld():
    text = (FIX / "rajasthan_wrd_2026-10-08_excerpt.txt").read_text()
    bad = s.parse_report(text.replace("313.92      313.90", "313.92      331.90"))
    assert any(
        w.get("source_code") == "bisalpur" and w["reason"] == "level_out_of_range"
        for w in bad["withheld"]
    )


def test_two_dates_in_one_file_withhold_the_file():
    text = (FIX / "rajasthan_wrd_2026-10-08_excerpt.txt").read_text()
    bad = s.parse_report(
        text.replace("Date : 08 October 2026", "Date : 09 October 2026")
    )
    assert bad["date"] is None and bad["readings"] == {}
    assert bad["withheld"] == [{"reason": "report_date_conflict"}]


def test_misprint_list_withholds(monkeypatch):
    monkeypatch.setitem(s.MISPRINTS, ("kanota", "2026-10-08"), "test")
    rep = report("2026-10-08")
    assert "kanota" not in rep["readings"]
    assert any(w["reason"] == "misprint: test" for w in rep["withheld"])


def _entry(title, path, date_field="2026-10-08T00:00:00"):
    return {
        "Id": 1,
        "Title": title,
        "Date": date_field,
        "AttachmentList": [{"Path": path}],
    }


URL = "https://jankalyanfile.rajasthan.gov.in/Files//Content/UploadFolder/OrderEntry/WR/2026/Departmental_Activities/O_{}_x.pdf"


def test_catalogue_reads_titles_not_list_dates():
    storage = [
        _entry(
            "Water Storage Data - 16.12.2025",
            URL.format("240226"),
            "2026-02-24T00:00:00",
        ),
        _entry("Water Storage Data -25.06.2026\t\n", URL.format("250626")),
        _entry("Water Storage Data -04.07.2026", URL.format("040726"), None),
        _entry("Morning Rainfall Bulletin - 14.09.2026", URL.format("140926")),
    ]
    monsoon = [
        _entry("Water storage data date 01.08.2026", URL.format("010826")),
        _entry("Daily Rainfall Bulletin 20-07-2025", URL.format("200725")),
        _entry("Morning Rainfall Bulletin - 08.10.2026", URL.format("081026")),
        _entry("Fortnight Report", URL.format("010923")),
    ]
    items, skipped = s.catalogue(storage, monsoon)
    got = {(i["kind"], i["title_date"]) for i in items}
    assert got == {
        ("storage", date(2025, 12, 16)),
        ("storage", date(2026, 6, 25)),
        ("storage", date(2026, 7, 4)),
        ("storage", date(2026, 8, 1)),
        ("bulletin", date(2025, 7, 20)),
    }
    late = next(i for i in items if i["title_date"] == date(2025, 12, 16))
    assert late["posted"] == date(2026, 2, 24)
    assert [x["title"] for x in skipped] == ["Morning Rainfall Bulletin - 14.09.2026"]


def test_select_takes_late_uploads_and_fills_gaps_with_bulletins():
    def it(kind, d, posted=None):
        return {
            "kind": kind,
            "title_date": d,
            "posted": posted or d,
            "id": 0,
            "url": "",
            "title": "",
        }

    items = [
        it("storage", date(2025, 12, 16), posted=date(2026, 2, 24)),
        it("storage", date(2026, 2, 16)),
        it("storage", date(2026, 7, 6)),
        it("bulletin", date(2026, 7, 6)),
        it("bulletin", date(2026, 7, 5)),
        *(it("bulletin", date(2024, 7, d)) for d in range(1, 11)),
    ]
    got = s.select(items, date(2026, 2, 20), date(2026, 10, 20), "gaps", 1)
    assert [(i["kind"], i["title_date"]) for i in got] == [
        ("storage", date(2025, 12, 16)),  # posted inside the window
        ("storage", date(2026, 7, 6)),
        ("bulletin", date(2026, 7, 5)),  # no storage file that day
    ]
    early = s.select(items, date(2024, 1, 1), date(2026, 10, 20), "gaps", 5)
    assert [i["title_date"].day for i in early if i["title_date"].year == 2024] == [
        1,
        6,
    ]


def test_db_rows_are_gross_with_integer_flows():
    r = OCT["readings"]["bisalpur"]
    readings = {
        ("bisalpur", "2026-10-08"): {**r, "file_url": "u"},
        ("isarda", "2026-10-08"): {**OCT["readings"]["isarda"], "file_url": "u"},
    }
    (row,), back = s.db_rows(readings)
    assert back == []
    assert row["storage_tmc"] == round(781.41 / 28.3168, 3)
    assert row["storage_pct_frl"] == 71.31
    assert row["level_ft"] == round(313.90 * 3.280839895, 2)
    assert row["inflow_cusecs"] == 0 and type(row["inflow_cusecs"]) is int
    assert row["city_id"] == "jaipur" and row["outflow_cusecs"] is None


def test_last_year_column_fills_only_unmeasured_dates():
    r = {**OCT["readings"]["bisalpur"], "file_url": "u"}
    measured_last_year = {
        **r,
        "date": "2025-10-08",
        "gross_mcum": 1095.84,
        "last_year_mcum": None,
    }
    ly, agree = s.last_year_readings(
        {("bisalpur", "2026-10-08"): r, ("bisalpur", "2025-10-08"): measured_last_year}
    )
    assert ly == {} and agree == {"agree": 1}
    ly, _ = s.last_year_readings({("bisalpur", "2026-10-08"): r})
    assert ly[("bisalpur", "2025-10-08")]["gross_mcum"] == 1095.84
    _, back = s.db_rows({}, ly)
    assert back[0]["date"] == "2025-10-08" and back[0]["storage_pct_frl"] == 100.0
    assert back[0]["level_ft"] is None


@pytest.mark.parametrize("bad", [(0.5, 0.9, 0.5), (0.5, 0.1, 0.5)])
def test_series_flags_a_one_day_spike(bad):
    def rd(d, g):
        return {"date": d, "gross_mcum": g, "level_m": 1.0}

    readings = {
        ("mansagar_jalmahal", f"2026-07-0{i}"): rd(f"2026-07-0{i}", g)
        for i, g in enumerate(bad, 1)
    }
    flags = s.series_flags(readings)
    assert [f["date"] for f in flags] == ["2026-07-02"]


def test_a_storage_file_that_is_gone_is_read_from_that_days_bulletin(monkeypatch):
    text = (FIX / "rajasthan_wrd_2026-10-08_excerpt.txt").read_text()

    def fake(url, cache):
        if "storage" in url:
            raise OSError("HTTP Error 404: Not Found")
        return text, "sha"

    monkeypatch.setattr(s, "pdf_text", fake)
    day = date(2026, 10, 8)
    storage = {
        "kind": "storage",
        "title_date": day,
        "posted": day,
        "id": 1,
        "url": "storage",
        "title": "Water Storage Data- 08.10.2026",
    }
    bulletin = {
        **storage,
        "kind": "bulletin",
        "url": "bulletin",
        "title": "Daily Rainfall Bulletin- 08.10.2026",
    }
    res = s.run([storage], None, 10, backup={day: bulletin})
    assert res["readings"][("bisalpur", "2026-10-08")]["file_kind"] == "bulletin"
    assert res["files"][0]["read_instead"] == "Daily Rainfall Bulletin- 08.10.2026"
