"""
TN Agriculture / PWD reservoir page scraper.

Scrapes https://tnagriculture.in/ARS/home/reservoir which serves daily storage,
level, inflow, and outflow for ~20 reservoirs across TN, KA, and KL. We extract
the Madurai (Vaigai + Mullaperiyar) rows and tag each reading with its city_id.

Note the URL is the bare hostname (no www) - the www subdomain has a TLS cert
that does not include tnagriculture.in as an alt name.
"""

import re
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx
from bs4 import BeautifulSoup

URL = "https://tnagriculture.in/ARS/home/reservoir"

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# Per-city: substring -> canonical source_code. Match is case-insensitive on
# the first table cell. Order matters within a city: more specific keys first.
# Place-aliasing (e.g. TN Agri's "Periyar" -> our 'mullaperiyar') happens here,
# not in the DB-side aliases table, because this is the scrape-time mapping.
NAME_MAPS: dict[str, list[tuple[str, str]]] = {
    "madurai": [
        ("vaigai", "vaigai"),
        # TN Agri lists Mullaperiyar as "Periyar**" with a footnote. We canonical
        # to 'mullaperiyar' to disambiguate from the Periyar river.
        ("periyar", "mullaperiyar"),
    ],
}

# Cities expected to receive at least one reading on every successful scrape.
EXPECTED_CITY_IDS: tuple[str, ...] = ("madurai",)


@dataclass(frozen=True)
class ReservoirReading:
    city_id: str
    source_code: str
    date: str  # YYYY-MM-DD
    storage_tmc: float | None
    storage_pct_frl: float | None
    level_ft: float | None
    inflow_cusecs: int | None
    outflow_cusecs: int | None
    source: str
    scraped_from: str


@dataclass(frozen=True)
class ScrapeResult:
    date: str
    readings: list[ReservoirReading]


def _parse_num(value: str) -> float | None:
    cleaned = re.sub(r"[^0-9.\-]", "", value or "")
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def _today_ist_iso() -> str:
    return datetime.now(ZoneInfo("Asia/Kolkata")).date().isoformat()


def _parse_date(page_text: str) -> str:
    """Find a DD-MM-YYYY or DD/MM/YYYY date and return YYYY-MM-DD.

    Falls back to today (IST) if nothing parses — the page sometimes drops the
    date heading during refreshes; better to record today's date than to fail.
    """
    match = re.search(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})", page_text)
    if not match:
        return _today_ist_iso()
    day, month, year = match.group(1), match.group(2), match.group(3)
    return f"{year}-{month.zfill(2)}-{day.zfill(2)}"


def _match_source_code(name_cell: str) -> tuple[str, str] | None:
    """Return (city_id, source_code) for the first matching needle, or None."""
    name_lower = name_cell.strip().lower()
    for city_id, name_map in NAME_MAPS.items():
        for needle, code in name_map:
            if needle in name_lower:
                return city_id, code
    return None


def _parse_html(html: str) -> ScrapeResult:
    soup = BeautifulSoup(html, "html.parser")
    page_text = soup.get_text()
    date_str = _parse_date(page_text)

    readings: list[ReservoirReading] = []
    seen: set[tuple[str, str]] = set()

    for row in soup.find_all("tr"):
        cells = [td.get_text(strip=True) for td in row.find_all("td")]
        if len(cells) < 9:
            continue

        match = _match_source_code(cells[0])
        if match is None or match in seen:
            continue
        city_id, source_code = match
        seen.add(match)

        capacity_mcft = _parse_num(cells[2])
        storage_mcft = _parse_num(cells[4])
        storage_tmc = (
            round(storage_mcft / 1000, 3) if storage_mcft is not None else None
        )
        storage_pct_frl = (
            round((storage_mcft / capacity_mcft) * 100, 2)
            if storage_mcft is not None and capacity_mcft and capacity_mcft > 0
            else None
        )
        level_ft = _parse_num(cells[3])
        inflow = _parse_num(cells[5])
        outflow = _parse_num(cells[6])

        readings.append(
            ReservoirReading(
                city_id=city_id,
                source_code=source_code,
                date=date_str,
                storage_tmc=storage_tmc,
                storage_pct_frl=storage_pct_frl,
                level_ft=level_ft,
                inflow_cusecs=int(inflow) if inflow is not None else None,
                outflow_cusecs=int(outflow) if outflow is not None else None,
                source="tn_pwd_scrape",
                scraped_from=URL,
            )
        )

    if not readings:
        raise ValueError(
            "No relevant reservoir rows found in tnagriculture.in page; "
            "HTML structure may have changed"
        )

    return ScrapeResult(date=date_str, readings=readings)


async def scrape_tn_pwd_reservoirs() -> ScrapeResult:
    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(URL, headers=HEADERS, timeout=30.0)
        response.raise_for_status()
    return _parse_html(response.text)
