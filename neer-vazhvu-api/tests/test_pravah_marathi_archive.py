"""Row tests for the WRD Marathi-archive backfill, on an excerpt of the
15-10-2026 file as pdftotext -layout prints it: Devanagari digits, broken
Marathi names, the Nagpur region's major-project rows.
"""

import http.client
import sys
import urllib.error
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import backfill_pravah_marathi_archive as archive  # noqa: E402
from backfill_pravah_marathi_archive import (  # noqa: E402
    DEVANAGARI_DIGITS,
    fetch,
    parse_archive_text,
)
from scrape_pravah_dams import NAGPUR_DESIGNED  # noqa: E402

EXCERPT = (
    (
        Path(__file__).resolve().parent
        / "fixtures"
        / "wrd_marathi_archive_15-10-2026_excerpt.txt"
    )
    .read_text(encoding="utf-8")
    .translate(DEVANAGARI_DIGITS)
)
DAY = date(2026, 10, 15)
TOTLADOH = next(line for line in EXCERPT.splitlines() if "1016.93" in line)


def _codes(parsed):
    return {r["source_code"]: r for r in parsed["rows"]}


def test_five_nagpur_rows_by_designed_storage():
    parsed = parse_archive_text(EXCERPT, NAGPUR_DESIGNED, DAY)
    assert parsed["problems"] == []
    rows = _codes(parsed)
    assert sorted(rows) == ["khindsi", "nand", "navegaon_khairi", "totladoh", "wadgaon"]
    t = rows["totladoh"]
    assert (t["date"], t["storage_mcum"], t["printed_pct_live"]) == (
        "2026-10-15",
        454.92,
        44.73,
    )
    assert t["storage_pct_live"] == 44.7 and t["storage_tmc"] == 16.065
    assert rows["navegaon_khairi"]["storage_mcum"] == 101.06


def test_a_file_serving_another_date_yields_nothing():
    parsed = parse_archive_text(EXCERPT, NAGPUR_DESIGNED, date(2026, 10, 16))
    assert parsed["rows"] == [] and "header date" in parsed["problems"][0]


def test_a_designed_triple_seen_twice_is_not_trusted():
    text = EXCERPT + TOTLADOH + "\n"
    rows = _codes(parse_archive_text(text, NAGPUR_DESIGNED, DAY))
    assert "totladoh" not in rows and len(rows) == 4


def test_rows_far_apart_are_not_one_district_block():
    text = EXCERPT.replace(TOTLADOH + "\n", "") + "\n" * 30 + TOTLADOH + "\n"
    parsed = parse_archive_text(text, NAGPUR_DESIGNED, DAY)
    assert parsed["rows"] == [] and "district block" in parsed["problems"][-1]


def test_a_percentage_that_does_not_add_up_drops_the_dam():
    text = EXCERPT.replace("44.73 %", "47.73 %", 1)
    rows = _codes(parse_archive_text(text, NAGPUR_DESIGNED, DAY))
    assert "totladoh" not in rows and len(rows) == 4


def test_rows_take_the_file_date_and_keep_the_reading_date():
    text = EXCERPT.replace("15/10/2026   06:49", "14/10/2026   06:49", 1)
    parsed = parse_archive_text(text, NAGPUR_DESIGNED, DAY)
    rows = _codes(parsed)
    # Stored under the file (report) date, as the live scraper stores it.
    assert {r["date"] for r in rows.values()} == {"2026-10-15"}
    assert rows["navegaon_khairi"]["reading_date"] == "2026-10-14"
    assert rows["totladoh"]["reading_date"] == "2026-10-15"
    assert parsed["problems"] == []


def test_a_file_whose_newest_reading_is_older_is_reported():
    # Every row a day behind the header (the header line has no trailing spaces).
    text = EXCERPT.replace("15/10/2026   ", "14/10/2026   ")
    parsed = parse_archive_text(text, NAGPUR_DESIGNED, DAY)
    assert {r["date"] for r in parsed["rows"]} == {"2026-10-15"}
    assert parsed["problems"] == [
        "newest reading 2026-10-14 is not the file date 2026-10-15"
    ]


def test_a_stale_dam_row_is_dropped():
    stale = EXCERPT.replace("15/10/2026   06:49", "01/10/2026   06:49", 1)
    assert "navegaon_khairi" not in _codes(
        parse_archive_text(stale, NAGPUR_DESIGNED, DAY)
    )


WHOLE = b"%PDF-1.5\n" + b"x" * 2000 + b"\nstartxref\n9\n%%EOF\n"


class _Resp:
    def __init__(self, body: bytes, length: int | None = None):
        self.body = body
        self.headers = {"Content-Length": str(len(body) if length is None else length)}

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self):
        return self.body


@pytest.fixture
def server(monkeypatch):
    """Queue of responses (bytes, _Resp) or exceptions for successive requests."""
    queue, sleeps = [], []

    def urlopen(req, timeout):
        step = queue.pop(0)
        if isinstance(step, BaseException):
            raise step
        return step if isinstance(step, _Resp) else _Resp(step)

    monkeypatch.setattr(archive.urllib.request, "urlopen", urlopen)
    monkeypatch.setattr(archive.time, "sleep", sleeps.append)
    return queue, sleeps


def _404():
    return urllib.error.HTTPError("u", 404, "Not Found", {}, None)


def test_a_dropped_read_is_retried_and_the_whole_file_cached(server, tmp_path):
    queue, sleeps = server
    queue += [http.client.IncompleteRead(WHOLE[:900], len(WHOLE) - 900), WHOLE]
    status, pdf = fetch(DAY, tmp_path, 5)
    assert (status, pdf.read_bytes()) == ("ok", WHOLE)
    assert sleeps == [archive.RETRY_BACKOFF_S] and queue == []
    assert sorted(p.name for p in tmp_path.iterdir()) == ["mr_15-10-2026.pdf"]


@pytest.mark.parametrize(
    "fail",
    [
        lambda: http.client.IncompleteRead(b"%PDF-1.5", 99),
        lambda: ConnectionResetError(54, "Connection reset by peer"),
        lambda: TimeoutError("timed out"),
        lambda: urllib.error.URLError("nodename nor servname provided"),
        lambda: urllib.error.HTTPError("u", 503, "Unavailable", {}, None),
    ],
)
def test_three_failures_cache_nothing(server, tmp_path, fail):
    queue, sleeps = server
    queue += [fail() for _ in range(archive.RETRIES)]
    status, pdf = fetch(DAY, tmp_path, 5)
    assert status.startswith("error:") and pdf is None and queue == []
    assert len(sleeps) == archive.RETRIES - 1
    assert list(tmp_path.iterdir()) == []


def test_a_short_body_under_its_content_length_is_retried(server, tmp_path):
    queue, _ = server
    queue += [_Resp(WHOLE[:-40], length=len(WHOLE)), WHOLE]
    assert fetch(DAY, tmp_path, 5)[0] == "ok"
    assert (tmp_path / "mr_15-10-2026.pdf").read_bytes() == WHOLE


def test_a_pdf_without_its_end_marker_is_not_cached(server, tmp_path):
    queue, _ = server
    queue += [WHOLE[:1500]]
    assert fetch(DAY, tmp_path, 5) == ("error: PDF has no %%EOF (cut short)", None)
    assert list(tmp_path.iterdir()) == []


def test_a_404_is_remembered_without_retrying(server, tmp_path):
    queue, sleeps = server
    queue += [_404()]
    assert fetch(DAY, tmp_path, 5) == ("404", None)
    assert fetch(DAY, tmp_path, 5) == ("404", None)
    assert sleeps == [] and (tmp_path / "mr_15-10-2026.404").exists()


def test_a_cut_short_cached_file_is_fetched_again(server, tmp_path):
    queue, _ = server
    (tmp_path / "mr_15-10-2026.pdf").write_bytes(WHOLE[:1500])
    queue += [WHOLE]
    status, pdf = fetch(DAY, tmp_path, 5)
    assert (status, pdf.read_bytes(), queue) == ("ok", WHOLE, [])
    assert fetch(DAY, tmp_path, 5)[0] == "ok"  # now served from the cache
