#!/usr/bin/env python3
"""
Dam storage for Jaipur from the Rajasthan Water Resources Department's
"Water Storage Data" reports (water.rajasthan.gov.in/wr, Data Room > Water
Storage).

WHERE THE FILES ARE. The portal is an Angular app over one list API:

    POST https://medicalportal.rajasthan.gov.in/webapi/api/OrderPortal/GetList
         {DepartmentCode 142, Type "23", SubTypeCode 2776,
          LookupCode 30902 "Water Storage" | 30898 "Monsoon Rainfall"}

It wants two static headers, x-api-key and client-id, which the portal's own
public JS bundle (main-es2015.<hash>.js, the HTTP interceptor's constructor:
this.apiKey=..., this.clientId=...) sends on every page load. They are read
from the bundle on every run, not stored here. No login, cookie or captcha.
Each entry carries one PDF on jankalyanfile.rajasthan.gov.in (a 301 to
/WebMyWayFiles/...); file names carry a random UUID, so the list comes first.

WHAT IS IN THEM. One Excel-made PDF per report: daily from mid-June to
mid-October, the 1st and 16th of the month otherwise (posted in batches up
to ~70 days late). Storage files run from 01.05.2025. For each of the state's
693 dams: designed gauge or RL (m) and capacity (Mcum), the previous report's
and today's gauge or RL, today's capacity, its % and a last-year capacity
(the date is in the column header); major dams add an inflow line. The Daily
Rainfall Bulletins under "Monsoon Rainfall" (from 16.06.2023) embed the same
tables: the only daily history before May 2025. The 2023 bulletins print
them in the Kruti Dev legacy Hindi font, which pdftotext returns as Latin
glyph codes ("fclyiqj Mse" is Bisalpur Dam). Those rows are matched on the
glyph strings in DAMS (read against the page images, 15.09.2023 pp15, 47, 48,
55); a row whose name is not one of them is skipped, never guessed.

STORAGE IS GROSS. The department prints present gross storage and its % of
designed gross capacity (8 Oct 2026: Bisalpur 781.410 of 1095.840 Mcum =
71.31%). It prints no live or dead storage, so unlike the platform's
live-storage convention (Pune, Ahmedabad, Visakhapatnam) storage_tmc here is
GROSS and storage_pct_frl is the department's % of designed gross. CWC's
weekly bulletin is live storage (Bisalpur 1.076 BCM): never splice the two
percentages.

TRAPS (feeds research, 2026-10-20). The data date is the report's own
"Date :" line and table headers, never the list's Date field (an upload or
edit date, once null). Titles carry tabs, newlines and typos; the lists
misfile (a Gang canal rotation titled "Morning Rainfall Bulletin" in the
storage list, storage files under Monsoon Rainfall). Designed values drift
(Ramgarh 75.022 Mcum in 2025, 75.040 in 2026): stored per report and warned,
never failed. The "*" / superscript-1 "filled" marker is unreliable and
ignored. District labels lag (Kanota "Jaipur-Rural" in 2025), so rows are
matched by dam NAME, never by district or row number. Names repeat: a
6.600 Mcum "Bisalpur" in Jodhpur, a Tonk "Mansagar", two "Chandlai"; each
target carries its designed capacity, and a same-name row with a capacity
more than 25% away is another dam.

SELF-CHECKING PARSE. A row is kept only if its printed % equals capacity over
designed capacity, to the rounding of the printed figures, and its level and
storage sit inside the dam's bounds. A gauge printed 0.00 beside a positive
storage is a blank cell (Ramsagar Newta, Jun 2025 to Jun 2026): the level is
dropped, the storage kept. A figure the department's own neighbouring reports
contradict goes in MISPRINTS and is withheld, never corrected. A day with two
readings keeps the storage file's; a listed storage file that is gone (05.08.2025
answers 404) is read from that day's bulletin instead.

THE BACKFILL OF 2026-10-21 (270 requests; its output is not committed):
265 dates per dam from 16.06.2023 to 08.10.2026, every storage file plus every
14th pre-May-2025 bulletin; two withheld (Isarda's first row, 10.07.2025, an
RL of 0.00; Chhaparwara 18.06.2026, MISPRINTS). Last-year columns agree with
the measured reading on 966 of 967 dates (24.07.2026 prints Bisalpur full for
24.07.2025, measured 1089.87 Mcum).

DATABASE. --supabase upserts reservoir_daily_v2 for DB_SOURCES only (the
table has a foreign key on water_sources): storage_tmc = gross Mcum / 28.3168,
storage_pct_frl = the printed %, level_ft = gauge or RL x 3.2808. Readings
rebuilt from a report's last-year column are insert-only, so a measured
reading is never replaced by one.

Run (from the repo root; -I because the PDFs are untrusted downloads):
  python3 -I neer-vazhvu-api/scripts/scrape_rajasthan_wrd_dams.py
      latest report, print what would be written (dry run, the default)
  ... --artifact                 also write public/data/jaipur-dam-storage.json
  ... --backfill-from 2023-06-16 [--to YYYY-MM-DD] [--bulletin-stride 7]
      --cache DIR --out rows.json  every report and bulletin in the window
  ... --supabase                 upsert instead of printing (needs
                                 SUPABASE_URL + SUPABASE_SERVICE_KEY)
  ... --lists saved.json --max-requests 0   re-parse a cache, no network
Exit 1 when a file in the window could not be read or dated, or the newest
report lacks a DB_SOURCES dam; a backfill window with no new file exits 0.
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

PORTAL_URL = "https://water.rajasthan.gov.in/wr/"
LIST_URL = "https://medicalportal.rajasthan.gov.in/webapi/api/OrderPortal/GetList"
# The portal's own order-filter model with its defaults; a body with only the
# four codes returns an empty list.
LIST_BODY = {
    "AttachmentList": [],
    "IsLatest": -1,
    "DeptSectionCode": "0",
    "Id": 0,
    "Type": "23",
    "Title": "",
    "IndividualBeneficiaryScheme": "",
    "OrderNo": "",
    "Date": "",
    "BeneficiaryCategory": 0,
    "AdmDepartmentCode": 0,
    "DepartmentCode": "142",
    "OfficeCode": 0,
    "SectorIds": 0,
    "Search": "",
    "FromDate": "",
    "ToDate": "",
    "SubTypeCode": "2776",
    "EntryFromDate": "",
    "EntryToDate": "",
    "Status": 1,
    "IsNotJankalyan": -1,
    "SchemeCode": 0,
    "DistrictCode": 0,
    "DesignationCode": 0,
    "OfficeCatCode": "0",
    "IsImagesRequired": False,
}
LOOKUP_STORAGE = 30902
LOOKUP_MONSOON = 30898
SOURCE_ID = "rajasthan-wrd-dam-storage"
SOURCE_LABEL = "Rajasthan WRD Water Storage Data"
PUBLISHER = "Water Resources Department, Government of Rajasthan"
ARTIFACT = REPO_ROOT / "public/data/jaipur-dam-storage.json"
CITY = "jaipur"
UA = "Mozilla/5.0 neervazhvu-rajasthan-wrd (water-data platform; one request at a time)"
IST = timezone(timedelta(hours=5, minutes=30))
MCUM_PER_TMC = 28.3168
FT_PER_M = 3.280839895
PAUSE_S = 1.0

# source_code -> how the reports print it. names: English, lower case;
# kruti: Kruti Dev glyph strings as pdftotext returns them (case matters).
# designed_mcum / designed_m: 08.10.2026 report (Kruti Dev rows: 15.09.2023).
# level "rl" is metres above sea level; "gauge" is a gauge reading in metres.
DAMS = {
    "bisalpur": {
        "display_name": "Bisalpur",
        "names": ("bisalpur dam",),
        "kruti": ("fclyiqj Mse",),
        "designed_mcum": 1095.84,
        "designed_m": 315.50,
        "level": "rl",
        "role": "supply",
    },
    "isarda": {
        "display_name": "Isarda",
        "names": ("isarda dam", "isarda"),
        "kruti": (),
        "designed_mcum": 91.76,
        "designed_m": 256.00,
        "level": "rl",
        "role": "context",
    },
    "ramgarh": {
        "display_name": "Ramgarh",
        "names": ("ramgarh",),
        "kruti": ("jkex<",),
        "designed_mcum": 75.04,
        "designed_m": 19.82,
        "level": "gauge",
        "role": "former-supply",
    },
    "chhaparwara": {
        "display_name": "Chhaparwara",
        "names": ("chhaparwara",),
        "kruti": ("NkijokMk",),
        "designed_mcum": 34.991,
        "designed_m": 5.18,
        "level": "gauge",
        "role": "district",
    },
    "kalakhsagar": {
        "display_name": "Kalakh Sagar",
        "names": ("kalakhsagar", "kalakh sagar"),
        "kruti": ("dky[k lkxj",),
        "designed_mcum": 16.448,
        "designed_m": 7.93,
        "level": "gauge",
        "role": "district",
    },
    "kanota": {
        "display_name": "Kanota",
        "names": ("kanota",),
        "kruti": ("dkuksrk",),
        "designed_mcum": 14.13,
        "designed_m": 5.18,
        "level": "gauge",
        "role": "near-city",
    },
    "ramsagar_newta": {
        "display_name": "Ramsagar (Nevta)",
        "names": ("ramsagar newta", "ramsagar nevta"),
        "kruti": ("jkelkxj usoVk",),
        "designed_mcum": 6.703,
        "designed_m": 4.88,
        "level": "gauge",
        "role": "near-city",
    },
    # Two rows print "Chandlai". Which one is the lake at 26.695 N, 75.878 E
    # (OSM way 481368169, Chaksu tehsil) is not settled, so both are kept.
    "chandlai_tonk": {
        "display_name": "Chandlai (Tonk row)",
        "names": ("chandlai",),
        "kruti": ("panykbZ",),
        "designed_mcum": 4.53,
        "designed_m": 2.74,
        "level": "gauge",
        "role": "identity-unsettled",
    },
    "chandlai_jaipur": {
        "display_name": "Chandlai (Jaipur row)",
        "names": ("chandlai",),
        "kruti": ("panykbZ",),
        "designed_mcum": 2.04,
        "designed_m": 3.05,
        "level": "gauge",
        "role": "identity-unsettled",
    },
    "kukas": {
        "display_name": "Kukas",
        "names": ("kookas", "kukas"),
        "kruti": ("dwdl",),
        "designed_mcum": 1.926,
        "designed_m": 6.10,
        "level": "gauge",
        "role": "near-city",
    },
    "mansagar_jalmahal": {
        "display_name": "Mansagar (Jal Mahal)",
        "names": ("mansagar (jalmahal)", "mansagar (jal mahal)"),
        "kruti": ("ekulkxj ¼tyegy½",),
        "designed_mcum": 1.136,
        "designed_m": 3.66,
        "level": "gauge",
        "role": "city-lake",
    },
}

# Codes with a water_sources row (supabase/migrations/066_jaipur_water_sources.sql):
# reservoir_daily_v2 has a foreign key on it, so the two lists must match. The
# other dams are kept in the artifact for the water-bodies pages.
DB_SOURCES = ("bisalpur", "ramgarh")

# (source_code, YYYY-MM-DD) -> "row" (the reading is withheld) or "level" (the
# storage is kept, the level dropped), found in the 2023-06-16 to 2026-10-08
# backfill. Nothing is corrected. Comment: printed value, then the reports
# either side.
MISPRINTS: dict[tuple[str, str], str] = {
    # 1.57 m, 0.010 Mcum: Kalakhsagar's figures on the row below; 1.83 m and
    # 5.097 Mcum on 17 Jun, 1.85 m and 5.227 Mcum on 19 Jun.
    ("chhaparwara", "2026-06-18"): "row",
}

_N = r"-?\d+(?:\.\d+)?"
_ROW = re.compile(
    rf"^\s*(?P<sno>\d+)\s+(?:(?P<head>.*?\S)\s+)?(?P<drl>{_N})\s+(?P<dcap>{_N})\s+"
    rf"(?P<prev>{_N}|-)\s+(?P<lvl>{_N}|-)\s+(?P<cap>{_N}|-)\s+(?P<pct>{_N})\s*%"
    rf"(?:\s+(?P<ly>{_N}|-))?\s*$"
)
_INFLOW = re.compile(rf"^\s*(?:Inflow|vkod)\s+(?P<q>{_N}|-)\s+(?:Cusec|D;wlsd)")
_MONTHS = {
    m: i
    for i, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split(), 1)
}
_DATE_LINES = (
    re.compile(r"Date\s*:\s*(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})"),
    re.compile(r"Date\s*:-\s*(\d{1,2})/([A-Za-z]{3})/(\d{4})"),
    # Kruti Dev "date :-" in its two spellings: 15-Sep-2023, 14/Jul/2023,
    # 14 July 2023 or 14/07/23.
    re.compile(
        r"fnu(?:akd|kad)\s*:-\s*(\d{1,2})[\s/-]+([A-Za-z]{3})[a-z]*[\s/-]+(\d{4})"
    ),
    re.compile(r"fnu(?:akd|kad)\s*:-\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})\b"),
)
# Table header: previous report, "Today Data", this report (dd/mm/yy).
_HDR = re.compile(
    r"(\d{2})[/-](\d{2})[/-](\d{2})\s+(?:Today Data|orZeku\s+Hkjko)\s+(\d{2})[/-](\d{2})[/-](\d{2})\b"
)
# Units line ending in the last-year column's date (dd/mm/yyyy).
_LY_HDR = re.compile(r"(?:Mcum|,e-D;w,e)\s+(\d{2})[/-](\d{2})[/-](\d{4})\s*$")

_requests = 0


# ---------------------------------------------------------------- network


def _http(
    url: str, body: dict | None = None, headers: dict | None = None, tries: int = 3
) -> bytes:
    global _requests
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"User-Agent": UA, **(headers or {})}
    if data is not None:
        hdrs["Content-Type"] = "application/json"
    for attempt in range(tries):
        _requests += 1
        try:
            req = urllib.request.Request(url, data=data, headers=hdrs)
            with urllib.request.urlopen(req, timeout=120) as r:
                out = r.read()
            time.sleep(PAUSE_S)
            return out
        except Exception as exc:
            # A 4xx (a listed file that is gone) will not heal on a retry.
            gone = isinstance(exc, urllib.error.HTTPError) and exc.code < 500
            if gone or attempt == tries - 1:
                raise
            print(f"  retry {attempt + 1} {url}: {exc}", file=sys.stderr)
            time.sleep(5 * (attempt + 1))
    raise AssertionError


def api_headers() -> dict:
    """x-api-key and client-id, read from the portal's public bundle."""
    page = _http(PORTAL_URL).decode("utf-8", "replace")
    m = re.search(r'src="(main-es2015\.[0-9a-f]+\.js)"', page)
    if not m:
        raise SystemExit("portal page names no main-es2015 bundle; the site changed")
    js = _http(PORTAL_URL + m.group(1)).decode("utf-8", "replace")
    k = re.search(r'this\.apiKey="([^"]+)",this\.clientId="([^"]+)"', js)
    if not k:
        raise SystemExit(f"{m.group(1)} sets no apiKey/clientId; the site changed")
    return {"x-api-key": k.group(1), "client-id": k.group(2)}


def fetch_list(headers: dict, lookup: int, page_size: int = 1000) -> list[dict]:
    out, page = [], 1
    while True:
        body = {
            **LIST_BODY,
            "LookupCode": str(lookup),
            "IndexModel": {
                "Page": page,
                "PageSize": page_size,
                "IsPostBack": False,
                "OrderByAsc": 0,
                "Search": None,
                "OrderBy": None,
                "AdvanceSearchModel": {},
            },
        }
        resp = json.loads(_http(LIST_URL, body, headers))
        if not resp.get("IsSuccess"):
            raise SystemExit(f"list {lookup}: {resp.get('Message')!r}")
        d = resp["Data"]
        out += d["Data"]
        if len(out) >= d["TotalRecords"] or not d["Data"]:
            return out
        page += 1


def _stem(url: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", url.rsplit("/", 1)[-1].removesuffix(".pdf"))


def pdf_text(url: str, cache: Path | None) -> tuple[str, str]:
    """(pdftotext -layout output, sha256 of the PDF). Cached as text only."""
    stem = _stem(url)
    if cache:
        txt, sha = cache / f"{stem}.txt", cache / f"{stem}.sha256"
        if txt.exists() and sha.exists():
            return txt.read_text(encoding="utf-8"), sha.read_text().strip()
    data = _http(url)
    if not data.startswith(b"%PDF"):
        raise RuntimeError(f"not a PDF: {url}")
    digest = hashlib.sha256(data).hexdigest()
    with tempfile.NamedTemporaryFile(suffix=".pdf") as fh:
        fh.write(data)
        fh.flush()
        text = subprocess.run(
            ["pdftotext", "-layout", fh.name, "-"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    if cache:
        txt.write_text(text, encoding="utf-8")
        sha.write_text(digest + "\n")
    return text, digest


# ---------------------------------------------------------------- the list


def _dmy(d: str, m: str, y: str) -> date | None:
    y = int(y) + (2000 if len(y) == 2 else 0)
    try:
        return (
            date(y, int(m), int(d))
            if m.isdigit()
            else date(y, _MONTHS[m.lower()], int(d))
        )
    except (ValueError, KeyError):
        return None


def title_date(title: str) -> date | None:
    m = re.search(r"(\d{1,2})[./-](\d{1,2})[./-](\d{4})", title)
    return _dmy(*m.groups()) if m else None


def posted_date(url: str) -> date | None:
    """Upload date from the file name, O_<ddmmyy>_<uuid>.pdf."""
    m = re.search(r"/O_(\d{2})(\d{2})(\d{2})_", url)
    return _dmy(*m.groups()) if m else None


def catalogue(
    storage: list[dict], monsoon: list[dict]
) -> tuple[list[dict], list[dict]]:
    """(report files, skipped entries). A storage file filed under Monsoon
    Rainfall counts as a storage file; a bulletin is a Daily Rainfall
    Bulletin; anything else (a canal rotation, a fortnight report) is skipped."""
    items, skipped = [], []
    for lookup, entries in ((LOOKUP_STORAGE, storage), (LOOKUP_MONSOON, monsoon)):
        for e in entries:
            title = " ".join((e.get("Title") or "").split())
            low = title.lower()
            kind = (
                "storage"
                if "water storage" in low
                else "bulletin"
                if low.startswith("daily rainfall bulletin")
                else None
            )
            paths = [
                a.get("Path") for a in e.get("AttachmentList") or [] if a.get("Path")
            ]
            td = title_date(title)
            if kind is None or not paths or td is None:
                if lookup == LOOKUP_STORAGE or kind:
                    skipped.append(
                        {
                            "id": e.get("Id"),
                            "title": title,
                            "why": "not a dam report"
                            if kind is None
                            else "no file or no date",
                        }
                    )
                continue
            items.append(
                {
                    "id": e.get("Id"),
                    "kind": kind,
                    "lookup": lookup,
                    "title": title,
                    "title_date": td,
                    "list_date": (e.get("Date") or "")[:10] or None,
                    "posted": posted_date(paths[0]),
                    "url": paths[0],
                }
            )
    return items, skipped


def select(
    items: list[dict], since: date, until: date, bulletins: str, stride: int
) -> list[dict]:
    """Storage files dated or posted in [since, until], and bulletins for the
    dates no storage file covers (bulletins="gaps"; "all" takes every one).
    stride thins only the bulletins dated before the first storage file."""

    def in_window(it):
        posted = it["posted"] is not None and since <= it["posted"] <= until
        return it["title_date"] <= until and (since <= it["title_date"] or posted)

    storage = [it for it in items if it["kind"] == "storage"]
    chosen = [it for it in storage if in_window(it)]
    if bulletins == "none" or not storage:
        return chosen
    covered = {it["title_date"] for it in storage}
    first = min(covered)
    pool = sorted(
        (
            it
            for it in items
            if it["kind"] == "bulletin" and since <= it["title_date"] <= until
        ),
        key=lambda it: it["title_date"],
    )
    if bulletins == "gaps":
        pool = [it for it in pool if it["title_date"] not in covered]
    early = [it for it in pool if it["title_date"] < first]
    return (
        chosen
        + early[:: max(1, stride)]
        + [it for it in pool if it["title_date"] >= first]
    )


# ---------------------------------------------------------------- parsing


def report_dates(text: str) -> set[date]:
    out = set()
    for rx in _DATE_LINES:
        for m in rx.finditer(text):
            d = _dmy(*m.groups())
            if d:
                out.add(d)
    for m in _HDR.finditer(text):
        d = _dmy(*m.groups()[3:])
        if d:
            out.add(d)
    return out


def _decimals(s: str) -> int:
    return len(s.split(".")[1]) if "." in s else 0


def _match(head: str, spec: dict) -> bool:
    h = " ".join(re.sub(r"[*¹²³]", " ", head).split())
    hl = h.lower()
    return any(hl == n or hl.endswith(" " + n) for n in spec["names"]) or any(
        h == k or h.endswith(" " + k) for k in spec["kruti"]
    )


def _plain(line: str) -> str:
    """A line with no digits (a wrapped dam name), else ''."""
    s = line.strip()
    return s if s and not re.search(r"\d", s) and len(s) < 40 else ""


def parse_tables(text: str, dams: dict = DAMS) -> tuple[dict[str, dict], list[dict]]:
    """Target-dam rows found in one report: ({code: reading}, issues)."""
    found: dict[str, list[dict]] = defaultdict(list)
    issues: list[dict] = []
    lines = text.split("\n")
    page, prev_d, today_d, ly_d = 1, None, None, None
    for i, line in enumerate(lines):
        page += line.count("\f")
        if h := _HDR.search(line):
            prev_d, today_d, ly_d = _dmy(*h.groups()[:3]), _dmy(*h.groups()[3:]), None
        if lm := _LY_HDR.search(line):
            ly_d = _dmy(*lm.groups())
        m = _ROW.match(line.replace("\f", ""))
        if not m:
            continue
        head = m.group("head") or ""
        drl, dcap = float(m.group("drl")), float(m.group("dcap"))
        # A name wrapped onto its own line sits just above or below the row.
        wrapped = [_plain(lines[j]) for j in (i - 1, i + 1) if 0 <= j < len(lines)]
        for code, spec in dams.items():
            name = (
                head
                if _match(head, spec)
                else next((w for w in wrapped if w and _match(w, spec)), None)
            )
            if name is None:
                continue
            if (
                abs(dcap - spec["designed_mcum"]) > 0.25 * spec["designed_mcum"]
                or abs(drl - spec["designed_m"]) > 1.0
            ):
                continue  # same name, another dam (Jodhpur's Bisalpur, Tonk's Mansagar)
            num = lambda g: None if m.group(g) in (None, "-") else float(m.group(g))  # noqa: E731
            inflow = None
            for j in (i + 1, i + 2):
                if j < len(lines) and (q := _INFLOW.match(lines[j])):
                    inflow = None if q.group("q") == "-" else float(q.group("q"))
                    break
                if j < len(lines) and _ROW.match(lines[j]):
                    break
            r = {
                "printed_name": " ".join(name.split())
                if name == head
                else f"{' '.join(head.split())} | {name}",
                "page": page,
                "font": "kruti-dev"
                if any(k in name for k in spec["kruti"])
                else "unicode",
                "table_date": today_d,
                "designed_level_m": drl,
                "designed_mcum": dcap,
                "prev_date": prev_d,
                "prev_level_m": num("prev"),
                "level_m": num("lvl"),
                "gross_mcum": num("cap"),
                "pct_designed": float(m.group("pct")),
                "last_year_mcum": num("ly"),
                "last_year_date": ly_d if m.group("ly") not in (None, "-") else None,
                "inflow_cusecs": inflow,
                "_dec": (_decimals(m.group("cap") or "0"), _decimals(m.group("dcap"))),
            }
            found[code].append(r)
    out = {}
    for code, rows in found.items():
        key = lambda r: (r["level_m"], r["gross_mcum"], r["pct_designed"])  # noqa: E731
        if len({key(r) for r in rows}) > 1:
            issues.append(
                {
                    "source_code": code,
                    "reason": "conflicting_rows_in_file",
                    "rows": [key(r) for r in rows],
                }
            )
            continue
        out[code] = rows[0]
    return out, issues


def check(code: str, r: dict, spec: dict) -> tuple[str | None, list[str]]:
    """(withhold reason or None, warnings) for one parsed row."""
    warns = []
    dcap, gross, pct, lvl = (
        r["designed_mcum"],
        r["gross_mcum"],
        r["pct_designed"],
        r["level_m"],
    )
    # Drift beyond the printed precision warns; it never fails (Ramgarh 75.022 -> 75.040).
    if abs(dcap - spec["designed_mcum"]) > 0.5 * 10.0 ** -r["_dec"][1] + 1e-9:
        warns.append(f"designed capacity {dcap} (expected {spec['designed_mcum']})")
    if abs(r["designed_level_m"] - spec["designed_m"]) > 0.005 + 1e-9:
        warns.append(
            f"designed level {r['designed_level_m']} (expected {spec['designed_m']})"
        )
    if gross is None:
        return "blank_cell", warns
    if dcap <= 0:
        return "no_designed_capacity", warns
    # Printed %, against capacity / designed capacity at the printed precision.
    dg, dd = (0.5 * 10.0**-d for d in r["_dec"])
    tol = 0.02 + 100 * (dg / dcap + gross * dd / dcap**2)
    if abs(gross / dcap * 100 - pct) > tol:
        return "pct_arithmetic", warns
    floor = 0.0 if spec["level"] == "gauge" else r["designed_level_m"] - 40
    if lvl is not None and not floor <= lvl <= r["designed_level_m"] + 2:
        return "level_out_of_range", warns
    if not 0 <= gross <= dcap * 1.05:
        return "storage_out_of_range", warns
    return None, warns


def parse_report(text: str, dams: dict = DAMS) -> dict:
    """One file: its data date, accepted readings, withheld rows, warnings."""
    dates = report_dates(text)
    rows, issues = parse_tables(text, dams)
    out = {
        "dates": sorted(d.isoformat() for d in dates),
        "date": None,
        "readings": {},
        "withheld": [],
        "warnings": [],
    }
    if len(dates) != 1:
        # An early-season bulletin carries rainfall only: no table, no failure.
        why = "no_report_date" if not dates else "report_date_conflict"
        out["withheld"].append({"reason": why if rows else "no_dam_table"})
        return out
    (day,) = dates
    out["date"] = day.isoformat()
    out["withheld"] += issues
    for code, r in rows.items():
        if r["table_date"] not in (None, day):
            out["withheld"].append(
                {
                    "source_code": code,
                    "reason": "table_date_conflict",
                    "table_date": str(r["table_date"]),
                }
            )
            continue
        # A gauge printed 0.00 beside a positive storage is a blank cell
        # (Ramsagar Newta, Jun 2025 to Jun 2026): the level is dropped, the
        # storage kept.
        if r["level_m"] == 0 and (r["gross_mcum"] or 0) > 0:
            r["level_m"] = None
            out["warnings"].append(
                {
                    "source_code": code,
                    "warning": "level 0.00 beside storage; level dropped",
                }
            )
        reason, warns = check(code, r, dams[code])
        for w in warns:
            out["warnings"].append({"source_code": code, "warning": w})
        kind = MISPRINTS.get((code, out["date"]))
        if kind == "level":
            r["level_m"] = None
        elif kind and not reason:
            reason = f"misprint: {kind}"
        r = {
            k: (v.isoformat() if isinstance(v, date) else v)
            for k, v in r.items()
            if not k.startswith("_")
        }
        r.pop("table_date")
        if reason:
            out["withheld"].append({"source_code": code, "reason": reason, **r})
            continue
        out["readings"][code] = {"source_code": code, "date": out["date"], **r}
    return out


# ---------------------------------------------------------------- the run


def run(
    items: list[dict],
    cache: Path | None,
    max_requests: int,
    dams: dict = DAMS,
    backup: dict | None = None,
) -> dict:
    """Parse every file; one reading per (dam, date), storage files first.
    backup: {date: bulletin}, read in place of a storage file that fails."""
    files, by_key, log = [], defaultdict(list), Counter()
    queue = sorted(items, key=lambda it: (it["title_date"], it["kind"] != "storage"))
    for n, it in enumerate(queue, 1):
        storage = it["kind"] == "storage"
        alt = (backup or {}).get(it["title_date"]) if storage else None
        if _requests >= max_requests and not (
            cache and (cache / f"{_stem(it['url'])}.txt").exists()
        ):
            log["not_fetched_request_budget"] += 1
            if alt and alt not in queue:
                queue.append(alt)  # read only if it is already cached
            continue
        try:
            text, sha = pdf_text(it["url"], cache)
        except Exception as exc:  # noqa: BLE001 - log and keep walking the list
            files.append(
                {**_meta(it), "error": str(exc), "read_instead": alt and alt["title"]}
            )
            log["fetch_failed"] += 1
            if alt and alt not in queue:
                queue.append(alt)
            continue
        rep = parse_report(text, dams)
        meta = {
            **_meta(it),
            "sha256": sha,
            "date": rep["date"],
            "dates_in_file": rep["dates"],
        }
        if rep["date"] and rep["date"] != it["title_date"].isoformat():
            meta["title_date_mismatch"] = True
        files.append(
            {
                **meta,
                "found": sorted(rep["readings"]),
                "withheld": rep["withheld"],
                "warnings": rep["warnings"],
            }
        )
        for code, r in rep["readings"].items():
            by_key[(code, r["date"])].append(
                {
                    **r,
                    "file_kind": it["kind"],
                    "file_title": it["title"],
                    "file_url": it["url"],
                    "_rank": (
                        it["kind"] == "storage",
                        it["posted"] or date.min,
                        it["id"] or 0,
                    ),
                }
            )
        if n % 25 == 0:
            print(f"  {n}/{len(items)} files, {_requests} requests", file=sys.stderr)
    readings, disagree = {}, []
    for key, rs in by_key.items():
        rs.sort(key=lambda r: r["_rank"], reverse=True)
        vals = {(r["level_m"], r["gross_mcum"], r["pct_designed"]) for r in rs}
        if len(vals) > 1:
            disagree.append(
                {
                    "source_code": key[0],
                    "date": key[1],
                    "kept": rs[0]["file_title"],
                    "values": sorted(vals),
                }
            )
        readings[key] = {k: v for k, v in rs[0].items() if k != "_rank"}
    return {"files": files, "readings": readings, "disagree": disagree, "log": log}


def _meta(it: dict) -> dict:
    return {
        k: (v.isoformat() if isinstance(v, date) else v)
        for k, v in it.items()
        if k in ("id", "kind", "title", "title_date", "list_date", "posted", "url")
    }


def last_year_readings(readings: dict) -> tuple[dict, Counter]:
    """{(code, date): storage} from the last-year columns, where no measured
    reading exists; and how often the column agrees with a measured one."""
    out, agree = {}, Counter()
    for (code, _), r in sorted(readings.items(), key=lambda kv: kv[0][1]):
        ly, lyd = r.get("last_year_mcum"), r.get("last_year_date")
        if ly is None or lyd is None:
            continue
        measured = readings.get((code, lyd))
        if measured is not None:
            agree[
                "agree"
                if abs(measured["gross_mcum"] - ly) <= 0.006 + 0.0005 * ly
                else "differ"
            ] += 1
            continue
        if not 0 <= ly <= r["designed_mcum"] * 1.05:
            agree["out_of_range"] += 1
            continue
        out[(code, lyd)] = {
            "source_code": code,
            "date": lyd,
            "gross_mcum": ly,
            "designed_mcum": r["designed_mcum"],
            "from": r["date"],
            "file_url": r["file_url"],
        }
    return out, agree


def series_flags(readings: dict, dams: dict = DAMS) -> list[dict]:
    """Days a dam's storage jumps away and comes straight back (a misprint
    candidate for review, never withheld automatically)."""
    flags = []
    by_dam = defaultdict(list)
    for (code, d), r in readings.items():
        by_dam[code].append(r)
    for code, rs in by_dam.items():
        rs.sort(key=lambda r: r["date"])
        t = max(0.02 * dams[code]["designed_mcum"], 0.05)
        for a, b, c in zip(rs, rs[1:], rs[2:]):
            span = (date.fromisoformat(c["date"]) - date.fromisoformat(a["date"])).days
            up, down = (
                b["gross_mcum"] - a["gross_mcum"],
                b["gross_mcum"] - c["gross_mcum"],
            )
            if span <= 6 and abs(up) > t and abs(down) > t and (up > 0) == (down > 0):
                flags.append(
                    {
                        "source_code": code,
                        "date": b["date"],
                        "gross_mcum": [
                            a["gross_mcum"],
                            b["gross_mcum"],
                            c["gross_mcum"],
                        ],
                        "level_m": [a["level_m"], b["level_m"], c["level_m"]],
                    }
                )
            if None in (a["level_m"], b["level_m"], c["level_m"]):
                continue
            lv = (b["level_m"] - a["level_m"], b["level_m"] - c["level_m"])
            if span <= 6 and min(map(abs, lv)) > 1.0 and (lv[0] > 0) == (lv[1] > 0):
                flags.append(
                    {
                        "source_code": code,
                        "date": b["date"],
                        "level_spike": [a["level_m"], b["level_m"], c["level_m"]],
                    }
                )
    return sorted(flags, key=lambda f: (f["source_code"], f["date"]))


def db_rows(readings: dict, ly: dict | None = None) -> tuple[list[dict], list[dict]]:
    """(measured rows to upsert, last-year rows to insert only)."""

    def row(code, iso, gross, pct, level, inflow, url):
        return {
            "city_id": CITY,
            "source_code": code,
            "date": iso,
            "storage_tmc": round(gross / MCUM_PER_TMC, 3),
            "storage_pct_frl": pct,
            "level_ft": None if level is None else round(level * FT_PER_M, 2),
            "inflow_cusecs": None if inflow is None else round(inflow),
            "outflow_cusecs": None,
            "source": SOURCE_LABEL,
            "scraped_from": url,
        }

    measured = [
        row(
            c,
            d,
            r["gross_mcum"],
            r["pct_designed"],
            r["level_m"],
            r["inflow_cusecs"],
            r["file_url"],
        )
        for (c, d), r in sorted(readings.items())
        if c in DB_SOURCES
    ]
    back = [
        row(
            c,
            d,
            r["gross_mcum"],
            round(r["gross_mcum"] / r["designed_mcum"] * 100, 2),
            None,
            None,
            r["file_url"],
        )
        for (c, d), r in sorted((ly or {}).items())
        if c in DB_SOURCES
    ]
    return measured, back


def upsert(measured: list[dict], back: list[dict]) -> None:
    from supabase import create_client

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    key = "city_id,source_code,date"
    for i in range(0, len(measured), 500):
        sb.table("reservoir_daily_v2").upsert(
            measured[i : i + 500], on_conflict=key
        ).execute()
    for i in range(0, len(back), 500):
        sb.table("reservoir_daily_v2").upsert(
            back[i : i + 500], on_conflict=key, ignore_duplicates=True
        ).execute()


# ---------------------------------------------------------------- artifact


def build_artifact(report: dict, readings: dict) -> dict:
    day = report["date"]
    dams_out = []
    for code, spec in DAMS.items():
        r = readings.get((code, day))
        entry = {
            "source_code": code,
            "display_name": spec["display_name"],
            "role": spec["role"],
            "level_kind": spec["level"],
        }
        keys = (
            "printed_name",
            "page",
            "designed_level_m",
            "designed_mcum",
            "prev_date",
            "prev_level_m",
            "level_m",
            "gross_mcum",
            "pct_designed",
            "last_year_date",
            "last_year_mcum",
            "inflow_cusecs",
        )
        entry.update({k: (r or {}).get(k) for k in keys})
        entry["date"] = day if r else None
        dams_out.append(entry)
    d = date.fromisoformat(day)
    return {
        "nvdm": "1.0",
        "dataset": "data-root/dam-storage",
        "scope": {"kind": "city", "id": CITY},
        "provenance": {
            "sources": [
                {
                    "id": SOURCE_ID,
                    "title": f"Water Storage Data, {d:%d.%m.%Y}",
                    "publisher": PUBLISHER,
                    "license": registry_license(SOURCE_ID),
                }
            ],
            "method": "pdf-extract",
            "produced_at": datetime.now(IST).date().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/scrape_rajasthan_wrd_dams.py",
            "note": "Parsed from the department's report PDF; each row checked against its own percentage arithmetic.",
        },
        "report_date": day,
        "report_title": report["title"],
        "report_url": report["url"],
        "storage_note": (
            "gross_mcum is the water held at the gauge or level read that morning; "
            "pct_designed is it as a share of the dam's designed capacity, the "
            "department's own figure. The department publishes no live (usable) "
            "storage, so these are not comparable with CWC's live-storage percentages. "
            "Bisalpur's storage is shared by Jaipur, Ajmer, Tonk and irrigation. "
            "Two rows in the report are named Chandlai; which one is the lake near "
            "Chaksu is not settled."
        ),
        "dams": dams_out,
    }


# ---------------------------------------------------------------- main


def _print_rows(rows: list[dict], label: str) -> None:
    show = rows if len(rows) <= 40 else rows[:5] + rows[-5:]
    for r in show:
        print(
            json.dumps(
                {
                    k: v
                    for k, v in r.items()
                    if k not in ("scraped_from", "city_id", "source")
                }
            )
        )
    if len(rows) > 40:
        print(f"... {len(rows) - 10} more {label} rows not shown")


def coverage(readings: dict) -> dict:
    by = defaultdict(list)
    for code, d in readings:
        by[code].append(d)
    out = {}
    for code, ds in sorted(by.items()):
        ds.sort()
        years = Counter(d[:4] for d in ds)
        gaps = [
            (a, b)
            for a, b in zip(ds, ds[1:])
            if (date.fromisoformat(b) - date.fromisoformat(a)).days > 20
        ]
        out[code] = {
            "n": len(ds),
            "first": ds[0],
            "last": ds[-1],
            "by_year": dict(sorted(years.items())),
            "gaps_over_20_days": gaps,
        }
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument(
        "--backfill-from", help="YYYY-MM-DD: every file dated or posted from here"
    )
    ap.add_argument("--to", help="YYYY-MM-DD: backfill end (default today, IST)")
    ap.add_argument(
        "--bulletins",
        choices=("gaps", "all", "none"),
        default="gaps",
        help="backfill: Daily Rainfall Bulletins for dates no storage file covers (default), all, or none",
    )
    ap.add_argument(
        "--bulletin-stride",
        type=int,
        default=1,
        help="backfill: every n-th bulletin date (politeness)",
    )
    ap.add_argument(
        "--max-requests",
        type=int,
        default=290,
        help="stop fetching new files after this many requests",
    )
    ap.add_argument(
        "--cache", help="directory for PDF text extracts (re-runs fetch only the lists)"
    )
    ap.add_argument(
        "--lists",
        help='a saved {"storage": [...], "monsoon": [...]} instead of calling the list API',
    )
    ap.add_argument(
        "--out",
        help="write readings, withheld rows and the database rows to this JSON file",
    )
    ap.add_argument(
        "--artifact",
        nargs="?",
        const=str(ARTIFACT),
        help=f"write the latest report as the NVDM artifact (default {ARTIFACT.relative_to(REPO_ROOT)})",
    )
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="print what would be written (the default)",
    )
    mode.add_argument(
        "--supabase", action="store_true", help="upsert reservoir_daily_v2"
    )
    args = ap.parse_args()
    cache = Path(args.cache) if args.cache else None
    if cache:
        cache.mkdir(parents=True, exist_ok=True)
    today = datetime.now(IST).date()

    if args.lists:
        saved = json.loads(Path(args.lists).read_text())
        lists = saved["storage"], saved["monsoon"]
    else:
        headers = api_headers()
        lists = fetch_list(headers, LOOKUP_STORAGE), fetch_list(headers, LOOKUP_MONSOON)
    items, skipped = catalogue(*lists)
    storage = [it for it in items if it["kind"] == "storage"]
    print(
        f"list: {len(storage)} storage files, {len(items) - len(storage)} bulletins, {len(skipped)} skipped",
        file=sys.stderr,
    )
    if not storage:
        print("no storage files listed", file=sys.stderr)
        return 1

    if args.backfill_from:
        since = date.fromisoformat(args.backfill_from)
        until = date.fromisoformat(args.to) if args.to else today
        chosen = select(items, since, until, args.bulletins, args.bulletin_stride)
    else:
        newest = max(it["title_date"] for it in storage)
        chosen = [it for it in storage if it["title_date"] == newest]
    print(f"reading {len(chosen)} files", file=sys.stderr)
    backup = {it["title_date"]: it for it in items if it["kind"] == "bulletin"}
    res = run(chosen, cache, args.max_requests, backup=backup)
    readings = res["readings"]
    ly, agree = last_year_readings(readings)
    measured, back = db_rows(readings, ly)
    flags = series_flags(readings)
    withheld = [
        {"file": f["title"], "date": f.get("date"), **w}
        for f in res["files"]
        for w in f.get("withheld", [])
    ]
    warnings = Counter(
        (w["source_code"], w["warning"])
        for f in res["files"]
        for w in f.get("warnings", [])
    )
    cov = coverage(readings)

    print(
        f"{len(readings)} readings from {len(res['files'])} files; {len(withheld)} withheld; {sum(res['log'].values())} not read {dict(res['log'])}; {_requests} requests",
        file=sys.stderr,
    )
    for code, c in cov.items():
        print(
            f"  {code:18} {c['n']:4} days {c['first']} .. {c['last']}  {c['by_year']}",
            file=sys.stderr,
        )
    for w in withheld:
        print(
            f"  WITHHELD {w.get('date')} {w.get('source_code', '-')}: {w['reason']}",
            file=sys.stderr,
        )
    for (code, w), n in sorted(warnings.items()):
        print(f"  warn {code}: {w} ({n} files)", file=sys.stderr)
    for f in flags:
        print(f"  REVIEW {f}", file=sys.stderr)
    if agree:
        print(f"  last-year column vs measured: {dict(agree)}", file=sys.stderr)

    # A layout change shows as a database dam missing from the newest report.
    newest_files = [f for f in res["files"] if f.get("date") and f["kind"] == "storage"]
    latest = max(newest_files, key=lambda f: f["date"]) if newest_files else None
    missing = [c for c in DB_SOURCES if latest and (c, latest["date"]) not in readings]
    if missing:
        print(f"MISSING from {latest['title']}: {missing}", file=sys.stderr)
    if args.artifact and latest:
        out = Path(args.artifact)
        write_artifact(out, build_artifact(latest, readings))
        print(f"wrote {out}", file=sys.stderr)
    if args.out:

        def enc(o):
            return o.isoformat() if isinstance(o, date) else str(o)

        payload = {
            "_source": f"{PUBLISHER}, {SOURCE_LABEL}",
            "_note": "Backfill output for review; nothing here has been written to the database.",
            "_produced": datetime.now(IST).isoformat(timespec="seconds"),
            "requests": _requests,
            "coverage": cov,
            "readings": sorted(
                readings.values(), key=lambda r: (r["source_code"], r["date"])
            ),
            "last_year_readings": sorted(
                ly.values(), key=lambda r: (r["source_code"], r["date"])
            ),
            "last_year_check": dict(agree),
            "withheld": withheld,
            "warnings": [
                {"source_code": c, "warning": w, "files": n}
                for (c, w), n in sorted(warnings.items())
            ],
            "review": flags,
            "disagree": res["disagree"],
            "skipped_list_entries": skipped,
            "files": res["files"],
            "db_rows": measured,
            "db_rows_insert_only": back,
        }
        Path(args.out).write_text(
            json.dumps(payload, ensure_ascii=False, indent=1, default=enc)
        )
        print(f"wrote {args.out}", file=sys.stderr)
    if args.supabase:
        upsert(measured, back)
        print(
            f"upserted {len(measured)} rows, inserted up to {len(back)} last-year rows",
            file=sys.stderr,
        )
    else:
        _print_rows(measured, "measured")
        _print_rows(back, "last-year (insert-only)")
    # Nothing new in a backfill window (the off-season) is not a failure.
    unread = [
        f
        for f in res["files"]
        if ("error" in f and not f.get("read_instead"))
        or any(
            w["reason"] in ("no_report_date", "report_date_conflict")
            for w in f.get("withheld", [])
        )
    ]
    return 1 if (chosen and not readings) or unread or missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
