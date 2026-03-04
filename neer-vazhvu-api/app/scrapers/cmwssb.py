"""
CMWSSB Lake Level Scraper.

Ported from src/lib/scrapers/cmwssb.ts.
Scrapes https://cmwssb.tn.gov.in/lake-level for daily reservoir data.
"""

import re

import httpx
from bs4 import BeautifulSoup

from app.etl.constants import RESERVOIR_NAME_MAP
from app.models.reservoir import ScrapedReservoir, ScrapeResult

CMWSSB_URL = "https://cmwssb.tn.gov.in/lake-level"
# The CMWSSB site (Drupal) drops connections from non-browser user agents.
# A standard browser UA is required to get a response.
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


def _parse_num(value: str) -> float | None:
    """Parse a number from a table cell, stripping non-numeric chars."""
    cleaned = re.sub(r"[^0-9.\-]", "", value)
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None


async def scrape_cmwssb_date(target_date: str) -> ScrapeResult:
    """Scrape CMWSSB lake level page for a specific date (YYYY-MM-DD format)."""
    url = f"{CMWSSB_URL}?date={target_date}"
    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(url, headers=HEADERS, timeout=30.0)
        response.raise_for_status()

    return _parse_cmwssb_html(response.text)


def _parse_cmwssb_html(html: str) -> ScrapeResult:
    """Parse CMWSSB HTML and return structured reservoir data."""
    soup = BeautifulSoup(html, "html.parser")

    # Extract date — looks for DD/MM/YYYY pattern anywhere in the page
    page_text = soup.get_text()
    date_match = re.search(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})", page_text)
    if not date_match:
        raise ValueError("Could not parse date from CMWSSB page")

    day, month, year = date_match.group(1), date_match.group(2), date_match.group(3)
    date_str = f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    # Parse table rows
    readings: list[ScrapedReservoir] = []
    for row in soup.find_all("tr"):
        cells = [td.get_text(strip=True) for td in row.find_all("td")]
        if len(cells) < 9:
            continue

        name_raw = cells[0].lower()
        reservoir_key: str | None = None
        for key, canonical in RESERVOIR_NAME_MAP.items():
            if key in name_raw:
                reservoir_key = canonical
                break

        if reservoir_key is None:
            continue

        readings.append(
            ScrapedReservoir(
                reservoir=reservoir_key,
                date=date_str,
                current_level_ft=_parse_num(cells[3]),
                current_storage_mcft=_parse_num(cells[4]) or 0,
                capacity_mcft=_parse_num(cells[2]) or 0,
                storage_pct=_parse_num(cells[5]) or 0,
                inflow_cusecs=_parse_num(cells[6]) or 0,
                outflow_cusecs=_parse_num(cells[7]) or 0,
                rainfall_mm=_parse_num(cells[8]) or 0,
            )
        )

    if not readings:
        raise ValueError(
            "No reservoir data found in CMWSSB page — HTML structure may have changed"
        )

    return ScrapeResult(date=date_str, readings=readings)


async def scrape_cmwssb() -> ScrapeResult:
    """Scrape the CMWSSB lake level page for current reservoir data."""
    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(CMWSSB_URL, headers=HEADERS, timeout=30.0)
        response.raise_for_status()

    return _parse_cmwssb_html(response.text)
