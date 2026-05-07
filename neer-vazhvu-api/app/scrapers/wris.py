"""
India WRIS (Water Resources Information System) Client.

Fetches station-level groundwater depth data from the India WRIS public API.
Covers both manual (seasonal, ~16 stations) and telemetric/DWLR (near-daily,
~6 stations) readings for Chennai district.

API docs: https://indiawris.gov.in/swagger-ui/index.html
"""

import logging
from datetime import date, datetime

import httpx

from app.models.groundwater import WrisGroundwaterRecord

logger = logging.getLogger(__name__)

WRIS_API_BASE = "https://indiawris.gov.in/Dataset/Ground%20Water%20Level"
PAGE_SIZE = 1000
MAX_PAGES = 50  # safety cap


async def fetch_wris_groundwater(
    start_date: date,
    end_date: date,
    state: str = "Tamil Nadu",
    district: str = "Chennai",
    agency: str = "CGWB",
    agencies: list[str] | None = None,
) -> list[WrisGroundwaterRecord]:
    """
    Fetch groundwater level readings from India WRIS API.

    Returns both manual (seasonal) and telemetric (DWLR) readings across
    one or more agencies (CGWB + state SW GW boards). For telemetric
    stations with multiple readings per day, the daily average is kept
    to reduce noise and storage.

    Pass either `agency=` (single) for backward compatibility, or
    `agencies=` (list) to fan out across multiple data publishers - e.g.
    `agencies=["CGWB", "Tamil Nadu SW GW"]` doubles Madurai station
    coverage by adding the 70+ state-board stations the WRIS inventory
    exposes alongside CGWB's 124.
    """
    agency_list = agencies if agencies else [agency]
    all_records: list[dict] = []

    async with httpx.AsyncClient(timeout=60.0) as client:
        for current_agency in agency_list:
            agency_count = 0
            for page in range(MAX_PAGES):
                url = (
                    f"{WRIS_API_BASE}"
                    f"?stateName={state}"
                    f"&districtName={district}"
                    f"&agencyName={current_agency}"
                    f"&startdate={start_date.isoformat()}"
                    f"&enddate={end_date.isoformat()}"
                    f"&download=false"
                    f"&page={page}"
                    f"&size={PAGE_SIZE}"
                )
                response = await client.post(url, headers={"Accept": "application/json"})
                response.raise_for_status()

                data = response.json()
                if data.get("statusCode") != 200:
                    raise ValueError(
                        f"WRIS API error ({current_agency}): {data.get('message')}"
                    )

                records = data.get("data", [])
                if not records:
                    break

                all_records.extend(records)
                agency_count += len(records)
                logger.info(
                    "WRIS %s page %d: %d records (agency cum: %d, total: %d)",
                    current_agency,
                    page,
                    len(records),
                    agency_count,
                    len(all_records),
                )

                if len(records) < PAGE_SIZE:
                    break
            logger.info(
                "WRIS %s done: %d raw records",
                current_agency,
                agency_count,
            )

    logger.info(
        "WRIS total raw records across %d agencies: %d",
        len(agency_list),
        len(all_records),
    )

    # Deduplicate: for telemetric stations with multiple readings per day,
    # keep the daily average. Station codes are unique across agencies, so
    # cross-agency records do not collide.
    return _deduplicate_daily(all_records)


def _deduplicate_daily(raw: list[dict]) -> list[WrisGroundwaterRecord]:
    """
    Group by (station_code, date) and average the values.
    Filters out obvious outliers (e.g. positive values > 50m which are sensor errors).
    """
    from collections import defaultdict

    # Group: (station_code, date_str) -> list of values + metadata
    groups: dict[tuple[str, str], dict] = defaultdict(
        lambda: {"values": [], "meta": None}
    )

    for r in raw:
        station_code = r.get("stationCode", "")
        data_time = r.get("dataTime", "")
        value = r.get("dataValue")

        if not station_code or not data_time or value is None:
            continue

        # Filter obvious sensor errors
        if abs(value) > 50:
            continue

        date_str = data_time[:10]  # YYYY-MM-DD
        key = (station_code, date_str)
        groups[key]["values"].append(value)

        if groups[key]["meta"] is None:
            groups[key]["meta"] = r

    results: list[WrisGroundwaterRecord] = []
    for (station_code, date_str), group in groups.items():
        meta = group["meta"]
        values = group["values"]
        if not values or meta is None:
            continue

        avg_value = sum(values) / len(values)

        try:
            reading_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            continue

        well_depth_raw = meta.get("wellDepth")
        try:
            well_depth_m = float(well_depth_raw) if well_depth_raw is not None else None
        except (TypeError, ValueError):
            well_depth_m = None

        results.append(
            WrisGroundwaterRecord(
                station_code=station_code,
                station_name=meta.get("stationName", ""),
                latitude=meta.get("latitude"),
                longitude=meta.get("longitude"),
                reading_date=reading_date,
                depth_to_water_m=round(avg_value, 3),
                acquisition_mode=meta.get("dataAcquisitionMode", "Manual"),
                agency=meta.get("agencyName", "CGWB"),
                state=meta.get("state", "Tamil Nadu"),
                district=meta.get("district", "Chennai"),
                well_type=meta.get("wellType"),
                well_depth_m=well_depth_m,
                well_aquifer_type=meta.get("wellAquiferType"),
            )
        )

    logger.info(
        "WRIS deduplicated: %d daily readings from %d raw records",
        len(results),
        len(raw),
    )
    return results
