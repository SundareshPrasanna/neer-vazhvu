"""
data.gov.in Water Bodies Census Client.

Fetches Chennai water body records from the First Census of Water Bodies
(2018-19), published by the Ministry of Jal Shakti on the Open Government
Data Platform.

305 water bodies with ownership, storage capacity, encroachment status,
coordinates, and basin information.  This is static census data — fetched
once and stored, not part of the daily pipeline.
"""

import asyncio
import logging
from typing import Any

import httpx

from app.models.water_body_census import WaterBodyCensusRecord

logger = logging.getLogger(__name__)

DATA_GOV_IN_API = (
    "https://api.data.gov.in/resource/f252ddd7-3858-4bd1-93ca-473d84a1f0ee"
)
PAGE_SIZE = 10  # data.gov.in silently caps at 10 records per page


def _safe_float(value: Any) -> float | None:
    if value is None or value == "" or value == "NA" or value == "N/A":
        return None
    try:
        return float(str(value))
    except (ValueError, TypeError):
        return None


def _safe_int(value: Any) -> int | None:
    if value is None or value == "" or value == "NA":
        return None
    try:
        return int(float(str(value)))
    except (ValueError, TypeError):
        return None


def _parse_bool(value: Any) -> bool | None:
    if value is None or value == "":
        return None
    s = str(value).strip().lower()
    if s in ("yes", "in use"):
        return True
    if s in ("no", "not in use"):
        return False
    return None


def _parse_encroachment(value: Any) -> str | None:
    if value is None or value == "":
        return None
    s = str(value).strip().lower()
    if s in ("yes", "encroached"):
        return "yes"
    if s in ("no", "not encroached"):
        return "no"
    return s


def _parse_record(raw: dict[str, Any]) -> WaterBodyCensusRecord | None:
    """Parse a single API record into a WaterBodyCensusRecord."""
    lat = _safe_float(raw.get("latitude_dec"))
    lng = _safe_float(raw.get("longitude_dec"))

    # Skip records with no usable location
    if lat is None or lng is None:
        return None

    # Basic Chennai bounding box sanity check
    if not (12.5 <= lat <= 13.5 and 79.5 <= lng <= 80.8):
        return None

    return WaterBodyCensusRecord(
        census_code=raw.get("unique_id"),
        name=raw.get("water_body_name"),
        district=str(raw.get("district_name", "CHENNAI")).upper(),
        taluk=raw.get("block_tehsil_name"),
        block=raw.get("block_tehsil_name"),
        village=raw.get("village_name"),
        ward_name=raw.get("ward_name"),
        water_body_type=raw.get("ref_water_body_type_id_name"),
        nature=raw.get("water_body_nature_name"),
        ownership=raw.get("water_body_ownership_name"),
        latitude=lat,
        longitude=lng,
        storage_capacity_original=_safe_float(
            raw.get("storage_capacity_water_body_original")
        ),
        storage_capacity_present=_safe_float(
            raw.get("storage_capacity_water_body_present")
        ),
        max_depth_m=_safe_float(raw.get("max_depth_water_body_fully_filled")),
        water_spread_area=_safe_float(raw.get("water_spread_area_of_water_body")),
        construction_year=_safe_int(raw.get("construcion_year")),
        renovation_year=_safe_int(raw.get("renovation_year")),
        basin=raw.get("basin_name"),
        sub_basin=raw.get("sub_basin_name"),
        is_in_use=_parse_bool(raw.get("ref_water_body_in_use_id_name")),
        encroachment_status=_parse_encroachment(
            raw.get("ref_selection_id_water_body_encroached_name")
        ),
        encroachment_pct=_safe_float(raw.get("area_encroached_percentage")),
    )


async def fetch_water_bodies_census(
    api_key: str,
) -> list[WaterBodyCensusRecord]:
    """
    Fetch all Chennai water body records from the First Census of Water Bodies.

    Paginates through the data.gov.in API (10 records/page) and filters
    to district_name=CHENNAI at the API level.

    Args:
        api_key: data.gov.in API key (free registration).

    Returns:
        List of parsed water body census records with valid coordinates.
    """
    results: list[WaterBodyCensusRecord] = []
    offset = 0

    timeout = httpx.Timeout(connect=30.0, read=120.0, write=30.0, pool=30.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        while True:
            params = {
                "api-key": api_key,
                "format": "json",
                "filters[district_name]": "CHENNAI",
                "offset": str(offset),
                "limit": str(PAGE_SIZE),
            }

            # Retry up to 3 times for transient failures
            for attempt in range(3):
                try:
                    response = await client.get(DATA_GOV_IN_API, params=params)
                    response.raise_for_status()
                    break
                except (httpx.ReadTimeout, httpx.ConnectTimeout) as exc:
                    if attempt == 2:
                        raise
                    logger.warning(
                        "data.gov.in timeout (attempt %d/3, offset=%d): %s",
                        attempt + 1,
                        offset,
                        exc,
                    )
                    await asyncio.sleep(2**attempt)

            data = response.json()
            records = data.get("records", [])

            if not records:
                break

            for raw in records:
                parsed = _parse_record(raw)
                if parsed is not None:
                    results.append(parsed)

            total = int(data.get("total", 0))
            offset += PAGE_SIZE

            logger.info(
                "Fetched %d/%d records from data.gov.in", min(offset, total), total
            )

            if offset >= total:
                break

            # Be polite to the government API
            await asyncio.sleep(0.5)

    logger.info(
        "Water bodies census: %d records with valid coordinates out of %d total",
        len(results),
        total,
    )
    return results
