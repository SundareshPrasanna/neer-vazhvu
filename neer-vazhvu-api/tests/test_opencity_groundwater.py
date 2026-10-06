"""OpenCity ward groundwater: every ward keeps its number, and GL is a reading."""

import asyncio

from app.scrapers import opencity


def _rec(sno, dept, location, **months):
    return {
        "S.No.": sno,
        "Area No.": "XIV",
        "Dept No.": dept,
        "Location": location,
        **months,
    }


def test_wards_without_a_serial_number_keep_their_depot_number(monkeypatch):
    # 2021 prints ward 81's depot as 86; the serial number is the ward.
    rows = [
        _rec("81", "86", "Vijayalakshmipuram", Jan="13.34"),
        _rec(None, "168", "Ullagaram", Jan="6.1"),
        _rec(None, "169", "Puzhuthivakkam", Jan="5.4"),
        _rec(None, None, "Average", Jan="5.0"),
        _rec("13", "13", "Thilagar Nagar", Nov="GL", Dec="1.2"),
    ]

    async def fake(_resource_id):
        return rows

    monkeypatch.setattr(opencity, "fetch_ckan_resource", fake)
    got = {
        (r.ward_number, r.month): r.depth_to_water_m
        for r in asyncio.run(opencity.fetch_groundwater(2021))
    }
    assert got == {
        (81, 1): 13.34,
        (168, 1): 6.1,
        (169, 1): 5.4,
        (13, 11): 0.0,
        (13, 12): 1.2,
    }
