"""Row tests for the Pravah daily dam bulletin scraper, on the 15 Oct 2026
bulletin's per-dam pages (pdftotext -layout, all 138 major-project rows).

Nagpur matches whole names inside its own district block: "Nand" and
"Wadgaon" are short enough that a substring match over the statewide PDF
would take the first such row anywhere in Maharashtra.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import scrape_pravah_dams  # noqa: E402
from scrape_pravah_dams import (  # noqa: E402
    CITIES,
    NAGPUR_DESIGNED,
    _same_date_last_year,
    db_rows,
    parse_readings,
    upsert_db_rows,
)

BULLETIN = (
    Path(__file__).resolve().parent / "fixtures" / "pravah_major_dams_2026-10-15.txt"
).read_text()
NAGPUR = CITIES["nagpur"]
# Two rows that a substring matcher would take for Nand and Wadgaon, placed in
# the Bhandara block, i.e. BEFORE the Nagpur block in reading order.
DECOYS = (
    " 3      Nand                  15/10/2026   08:00 AM    1.00   10.00     11.00"
    "      5.00      6.00    50.00 %    60.00 %\n"
    " 4      Wadgaon Kh            15/10/2026   08:00 AM    1.00   20.00     21.00"
    "      5.00      6.00    25.00 %    30.00 %\n"
)


def _by_code(readings):
    return {r["source_code"]: r for r in readings}


def test_nagpur_block_gives_exactly_its_five_dams():
    rows = _by_code(parse_readings(BULLETIN, NAGPUR))
    assert sorted(rows) == ["khindsi", "nand", "navegaon_khairi", "totladoh", "wadgaon"]
    t = rows["totladoh"]
    assert (t["storage_mcum"], t["live_capacity_mcum"]) == (454.92, 1016.93)
    assert (t["storage_pct_live"], t["last_year_pct_live"]) == (44.7, 99.7)
    assert t["date"] == "2026-10-15" and t["corporations"] == ["nmc"]
    k = rows["navegaon_khairi"]
    assert k["pravah_name"] == "Kamthi Khairy" and k["storage_mcum"] == 101.06
    assert rows["khindsi"]["corporations"] == []


def test_every_nagpur_row_carries_its_own_designed_storage():
    for r in parse_readings(BULLETIN, NAGPUR):
        designed = (
            r["dead_storage_mcum"],
            r["live_capacity_mcum"],
            r["gross_capacity_mcum"],
        )
        assert designed == NAGPUR_DESIGNED[r["source_code"]], r["source_code"]


def test_same_names_in_another_district_are_not_taken():
    text = BULLETIN.replace("Chandrapur\n", DECOYS + "Chandrapur\n", 1)
    rows = _by_code(parse_readings(text, NAGPUR))
    assert rows["nand"]["storage_mcum"] == 41.08
    assert rows["wadgaon"]["storage_mcum"] == 74.92
    # The decoys are real traps: the substring matcher Mumbai and Pune use
    # takes them, because they come first.
    loose = {k: v for k, v in NAGPUR.items() if k != "district"}
    caught = _by_code(parse_readings(text, loose))
    assert caught["nand"]["storage_mcum"] == 5.00
    assert caught["wadgaon"]["storage_mcum"] == 5.00


def test_no_nagpur_heading_means_no_rows_not_rows_from_elsewhere():
    text = BULLETIN.replace("\nNagpur\n", "\n", 1)
    assert parse_readings(text, NAGPUR) == []


def test_a_page_break_inside_the_block_keeps_the_block():
    header = BULLETIN[: BULLETIN.index(" All Reservoir")]
    assert header.startswith("\f")
    text = BULLETIN.replace(" 3      Nand ", header + " 3      Nand ", 1)
    assert len(parse_readings(text, NAGPUR)) == 5


def test_mumbai_and_pune_still_parse_their_dams():
    mumbai = _by_code(parse_readings(BULLETIN, CITIES["mumbai"]))
    pune = _by_code(parse_readings(BULLETIN, CITIES["pune"]))
    assert len(mumbai) == 8 and "barvi" in mumbai
    assert len(pune) == 7 and "khadakwasla" in pune


def test_same_date_last_year_handles_29_february():
    assert _same_date_last_year("2026-10-15") == "2025-10-15"
    assert _same_date_last_year("2028-02-29") == "2027-02-28"
    assert _same_date_last_year("2028-03-01") == "2027-03-01"


def test_db_rows_hold_only_nmc_dams_on_the_report_date():
    rows = db_rows("nagpur", NAGPUR, parse_readings(BULLETIN, NAGPUR))
    assert {(r["source_code"], r["date"]) for r in rows} == {
        ("totladoh", "2026-10-15"),
        ("navegaon_khairi", "2026-10-15"),
        ("totladoh", "2025-10-15"),
        ("navegaon_khairi", "2025-10-15"),
    }
    today = {r["source_code"]: r for r in rows if r["date"] == "2026-10-15"}
    assert today["totladoh"]["storage_pct_frl"] == 44.7
    assert today["totladoh"]["storage_tmc"] == 16.065
    assert all(r["inflow_cusecs"] is None and r["outflow_cusecs"] is None for r in rows)


def test_db_rows_on_29_february_date_last_year_to_28_february():
    readings = [{**r, "date": "2028-02-29"} for r in parse_readings(BULLETIN, NAGPUR)]
    dates = {r["date"] for r in db_rows("nagpur", NAGPUR, readings)}
    assert dates == {"2028-02-29", "2027-02-28"}


class _FakeTable:
    def __init__(self, calls):
        self.calls = calls

    def upsert(self, rows, **kw):
        self.calls.append((rows, kw))
        return self

    def execute(self):
        return None


class _FakeClient:
    def __init__(self):
        self.calls = []

    def table(self, name):
        assert name == "reservoir_daily_v2"
        return _FakeTable(self.calls)


def test_nagpur_last_year_rows_go_in_a_second_insert_only_upsert():
    rows = db_rows("nagpur", NAGPUR, parse_readings(BULLETIN, NAGPUR))
    sb = _FakeClient()
    assert upsert_db_rows(sb, rows) == (2, 2)
    (today, kw1), (back, kw2) = sb.calls
    assert {r["date"] for r in today} == {
        "2026-10-15"
    } and "ignore_duplicates" not in kw1
    assert {r["date"] for r in back} == {"2025-10-15"}
    assert kw2 == {"on_conflict": "city_id,source_code,date", "ignore_duplicates": True}


def test_a_printed_zero_last_year_is_not_stored_for_nagpur_only():
    readings = [
        {**r, "last_year_pct_live": 0.0, "last_year_storage_mcum": 0.0}
        if r["source_code"] == "totladoh"
        else r
        for r in parse_readings(BULLETIN, NAGPUR)
    ]
    keys = {(r["source_code"], r["date"]) for r in db_rows("nagpur", NAGPUR, readings)}
    assert ("totladoh", "2025-10-15") not in keys
    assert ("totladoh", "2026-10-15") in keys and (
        "navegaon_khairi",
        "2025-10-15",
    ) in keys
    # Without the flag (Mumbai, Pune) a zero is still stored, as before.
    loose = {k: v for k, v in NAGPUR.items() if k != "ly_insert_only"}
    keys = {(r["source_code"], r["date"]) for r in db_rows("nagpur", loose, readings)}
    assert ("totladoh", "2025-10-15") in keys


def _run_main(monkeypatch, tmp_path, text):
    monkeypatch.setattr(scrape_pravah_dams, "_pdf_to_text", lambda _path: text)
    out = tmp_path / "nagpur-dam-storage.json"
    monkeypatch.setattr(
        sys, "argv", ["x", "--city", "nagpur", "--pdf", "unused.pdf", "--out", str(out)]
    )
    return scrape_pravah_dams.main(), out


def test_a_missing_context_dam_warns_and_the_rest_is_written(
    monkeypatch, tmp_path, capsys
):
    khindsi = next(line for line in BULLETIN.splitlines() if "Khindsi" in line)
    rc, out = _run_main(monkeypatch, tmp_path, BULLETIN.replace(khindsi + "\n", "", 1))
    assert rc == 0 and out.exists()
    assert "WARNING: nagpur context dam(s) missing: khindsi" in capsys.readouterr().err
    codes = {d["source_code"] for d in json.loads(out.read_text())["dams"]}
    assert codes == {"nand", "navegaon_khairi", "totladoh", "wadgaon"}


def test_a_missing_nmc_dam_writes_nothing(monkeypatch, tmp_path):
    totladoh = next(line for line in BULLETIN.splitlines() if "Totladoh" in line)
    rc, out = _run_main(monkeypatch, tmp_path, BULLETIN.replace(totladoh + "\n", "", 1))
    assert rc == 1 and not out.exists()
