"""
OpenCity Chennai CKAN Client.

Ported from src/lib/api-clients/opencity.ts.
Fetches ward-level groundwater data from OpenCity CKAN API.
"""

from typing import Any

import httpx

from app.models.groundwater import GroundwaterRecord

CKAN_BASE = "https://data.opencity.in/api/3/action/datastore_search"

# Known OpenCity CKAN resource IDs for Chennai groundwater data
GROUNDWATER_RESOURCES: dict[int, str] = {
    2021: "61ef9b4e-feae-4e73-b503-aa2cba9eda50",
    2022: "0e44c0a9-4965-4385-8988-ff4ed6f7534c",
    2023: "2ccf989b-a340-4c49-8264-80a0b60717aa",
    2024: "3a41ca9e-dbe1-495a-9ee3-c14aeaa988c6",
}

# Lake resource IDs
LAKE_RESOURCES: dict[str, str] = {
    "poondi": "8b0c0edc-4204-4f0f-8dc7-2db4817af04f",
    "cholavaram": "20dc9876-ef1d-4cf1-9c42-f9d6c1f137db",
    "redhills": "febf2951-71eb-4807-9a06-246dadc1ef04",
    "chembarambakkam": "db41b1a4-5746-46d0-a006-e8fe2b1545a9",
    "veeranam": "a2f9aaad-7ac2-4a01-90d6-801eeef7d4b6",
    "kannankottai": "e0355257-d2d9-48be-a31e-6596a5fcdc07",
}


async def fetch_ckan_resource(
    resource_id: str, limit: int = 5000, offset: int = 0
) -> list[dict[str, Any]]:
    """
    Fetch records from an OpenCity CKAN datastore resource.
    Handles pagination automatically (recursive).
    """
    url = f"{CKAN_BASE}?resource_id={resource_id}&limit={limit}&offset={offset}"

    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=30.0)
        response.raise_for_status()

    data = response.json()
    if not data.get("success"):
        raise ValueError("OpenCity CKAN returned success=false")

    records = data["result"]["records"]

    # If we got a full page, there might be more
    if len(records) == limit:
        more = await fetch_ckan_resource(resource_id, limit, offset + limit)
        return records + more

    return records


def _find_column(record: dict, candidates: list[str]) -> Any:
    """Find a value from a record using multiple possible column names."""
    for col in candidates:
        if col in record and record[col] is not None and record[col] != "":
            return record[col]
    return None


def _parse_ward_number(value: Any) -> int | None:
    """Parse a ward number, handling string and numeric inputs."""
    if value is None:
        return None
    try:
        num = int(float(str(value)))
        return num if 1 <= num <= 200 else None
    except (ValueError, TypeError):
        return None


def _parse_depth(value: Any) -> float | None:
    """Parse a depth measurement."""
    if value is None or value == "" or value == "NA" or value == "N/A":
        return None
    try:
        return float(str(value))
    except (ValueError, TypeError):
        return None


async def fetch_groundwater(year: int) -> list[GroundwaterRecord]:
    """Fetch groundwater data for a given year from OpenCity."""
    resource_id = GROUNDWATER_RESOURCES.get(year)
    if not resource_id:
        raise ValueError(f"No OpenCity resource ID for year {year}")

    raw_records = await fetch_ckan_resource(resource_id)
    results: list[GroundwaterRecord] = []

    # Month column names to search for
    month_names = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ]

    for record in raw_records:
        # Try multiple column name patterns for ward number
        ward_num = _parse_ward_number(
            _find_column(
                record,
                [
                    "Ward No",
                    "Ward_No",
                    "ward_no",
                    "WARD_NO",
                    "Ward Number",
                    "S.No.",
                    "S.No",
                    "S. No.",
                    "S. No",
                    "Sl.No.",
                ],
            )
        )
        if ward_num is None:
            continue

        ward_name = _find_column(
            record,
            ["Ward Name", "Ward_Name", "ward_name", "WARD_NAME", "Location"],
        )
        zone_name = _find_column(
            record,
            ["Zone", "zone", "ZONE", "Zone Name", "zone_name", "Area No.", "Area No"],
        )

        for month_idx, month_name in enumerate(month_names, start=1):
            depth = _parse_depth(
                _find_column(
                    record,
                    [
                        month_name,
                        month_name.upper(),
                        month_name.lower(),
                        f"{month_name}.",
                    ],
                )
            )
            if depth is not None:
                results.append(
                    GroundwaterRecord(
                        ward_number=ward_num,
                        ward_name=str(ward_name) if ward_name else None,
                        zone_name=str(zone_name) if zone_name else None,
                        year=year,
                        month=month_idx,
                        depth_to_water_m=depth,
                    )
                )

    return results
