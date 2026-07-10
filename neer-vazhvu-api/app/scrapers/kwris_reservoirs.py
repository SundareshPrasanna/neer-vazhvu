"""
Karnataka WRIS (KWRIS) reservoir scraper - Bengaluru's Cauvery source dams.

Reads the KWRIS open GeoServer WFS layer `KA:reservoir_landing`, which serves
daily storage / level / inflow / outflow for ~35 Karnataka reservoirs as GeoJSON
(no auth). We extract the 4 upstream Cauvery basin dams that gate Bengaluru's
water security - Krishnaraja Sagar, Hemavathy, Kabini, Harangi - and tag each
reading with source_code + city_id='bangalore'.

Why this and not the TN Agriculture page (tn_pwd_reservoirs.py): those are
Tamil Nadu's figures for Karnataka's dams, published for downstream Cauvery
release-monitoring; they run ~12-30% below Karnataka's own numbers and the
archive endpoint serves a stale page for missing dates (fake flatlines). KWRIS
is Karnataka's native authority for its own reservoirs, and it stamps each
reservoir with its own observation Date - so we record that date verbatim rather
than assuming "today", which structurally avoids stamping stale values as fresh.

Each KWRIS reservoir carries its own Date; a dam whose feed has gone stale simply
writes its real (older) date, never a fake current one.
"""

import re
from dataclasses import dataclass
from datetime import datetime

import httpx

# Open WFS, GeoJSON output, no auth. WFS 1.0.0 keeps lon,lat axis order (not that
# we need geometry here - we key on ReservoirID).
URL = (
    "https://water.karnataka.gov.in/geoserver/KA/ows"
    "?service=WFS&version=1.0.0&request=GetFeature"
    "&typeName=KA:reservoir_landing&outputFormat=application/json"
)

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
HEADERS = {"User-Agent": USER_AGENT, "Accept": "application/json"}

CITY_ID = "bangalore"

# KWRIS ReservoirID -> our source_code. Keyed on the stable numeric id rather
# than the display name (KWRIS spells it "K.R.Sagara Dam" / "Hemavathy Dam").
RESERVOIR_ID_MAP: dict[int, str] = {
    6: "krs",
    5: "hemavathi",
    7: "kabini",
    4: "harangi",
}

EXPECTED_CITY_IDS: tuple[str, ...] = (CITY_ID,)


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


def _num(value) -> float | None:
    if value is None:
        return None
    try:
        return float(re.sub(r"[^0-9.\-]", "", str(value)))
    except (ValueError, TypeError):
        return None


def _parse_kwris_date(value) -> str | None:
    """KWRIS serves 'DD Mon YYYY' (e.g. '09 Jul 2026'). Return YYYY-MM-DD."""
    if not value:
        return None
    for fmt in ("%d %b %Y", "%d %B %Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(str(value).strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _parse_geojson(payload: dict) -> ScrapeResult:
    features = payload.get("features") or []
    readings: list[ReservoirReading] = []
    latest_date: str | None = None

    for feat in features:
        props = feat.get("properties") or {}
        rid = props.get("ReservoirID")
        source_code = RESERVOIR_ID_MAP.get(rid)
        if source_code is None:
            continue

        date_str = _parse_kwris_date(props.get("Date"))
        if date_str is None:
            # No usable observation date -> skip rather than guess "today".
            continue

        storage_tmc = _num(props.get("TMC_GrossCapacity"))  # current gross storage
        design_tmc = _num(props.get("StorageCapacity_AsPerDesign"))
        pct = _num(props.get("PercentFull"))
        # Prefer computing % from storage/design for precision; fall back to the
        # source's own PercentFull.
        if storage_tmc is not None and design_tmc and design_tmc > 0:
            storage_pct_frl = round(storage_tmc / design_tmc * 100, 2)
        else:
            storage_pct_frl = round(pct, 2) if pct is not None else None

        inflow = _num(props.get("Flow_Inflow"))
        outflow = _num(props.get("Flow_OutFlow"))

        readings.append(
            ReservoirReading(
                city_id=CITY_ID,
                source_code=source_code,
                date=date_str,
                storage_tmc=round(storage_tmc, 3) if storage_tmc is not None else None,
                storage_pct_frl=storage_pct_frl,
                level_ft=_num(props.get("Reservior_Level")),
                inflow_cusecs=int(inflow) if inflow is not None else None,
                outflow_cusecs=int(outflow) if outflow is not None else None,
                source="kwris_scrape",
                scraped_from=URL,
            )
        )
        if latest_date is None or date_str > latest_date:
            latest_date = date_str

    if not readings:
        raise ValueError(
            "No mapped Cauvery reservoirs found in KWRIS reservoir_landing "
            f"(expected ReservoirIDs {sorted(RESERVOIR_ID_MAP)}); "
            "layer or ID scheme may have changed"
        )

    return ScrapeResult(date=latest_date or "", readings=readings)


async def scrape_kwris_reservoirs() -> ScrapeResult:
    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(URL, headers=HEADERS, timeout=45.0)
        response.raise_for_status()
        payload = response.json()
    return _parse_geojson(payload)
