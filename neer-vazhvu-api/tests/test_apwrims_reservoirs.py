"""Parser tests for the APWRIMS reservoir feed (Visakhapatnam's dams).

The fetch half is not tested here. What matters is the parse: dates come
from each reading's own timestamp, bad rows are counted rather than dropped
silently, and live storage is gross minus the design dead storage.
"""

import sys
from datetime import date, datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from scrape_apwrims_reservoirs import (  # noqa: E402
    IST,
    VISAKHAPATNAM_DAMS,
    check_attrs,
    db_rows,
    held_back,
    parse_timeseries,
)

YELERU = VISAKHAPATNAM_DAMS["yeleru"]
RAIWADA = VISAKHAPATNAM_DAMS["raiwada"]


def ms(day: str, hour: int = 6) -> int:
    d = date.fromisoformat(day)
    return int(datetime(d.year, d.month, d.day, hour, tzinfo=IST).timestamp() * 1000)


def reading(level, storage, ts, inflow=1400.0, outflow=625.0):
    return {
        "level": level,
        "storage": storage,
        "levelStorageEventGenTS": ts,
        "inflow": inflow,
        "outflow": outflow,
    }


def payload(yeleru: dict, raiwada: dict | None = None) -> dict:
    out = {YELERU["uuid"]: {"reservoirName": "YELERU RESERVOIR", **yeleru}}
    if raiwada is not None:
        out[RAIWADA["uuid"]] = {"reservoirName": "RAIWADA RESERVOIR", **raiwada}
    return out


WINDOW = (date(2026, 10, 1), date(2026, 10, 31))


def parse(p):
    return parse_timeseries(p, VISAKHAPATNAM_DAMS, *WINDOW)


def test_live_storage_is_gross_minus_design_dead():
    readings, counts, _ = parse(
        payload({"20261014": reading(82.997, 17.4, ms("2026-10-14"))})
    )
    r = readings["yeleru"]["2026-10-14"]
    assert r["gross_storage_tmc"] == 17.4
    assert r["storage_tmc"] == 11.24  # 17.4 - 6.16
    assert r["storage_pct_live"] == 62.62  # of 17.95 live
    assert r["level_ft"] == 272.3
    assert counts["accepted"] == 1


def test_below_dead_storage_floors_live_at_zero_and_flags_it():
    readings, counts, _ = parse(
        payload({"20261014": reading(71.5, 5.4, ms("2026-10-14"))})
    )
    r = readings["yeleru"]["2026-10-14"]
    assert r["storage_tmc"] == 0.0
    assert r["below_dead_storage"] is True
    assert counts["below_dead_storage"] == 1


def test_reading_is_dated_by_its_timestamp_not_its_key():
    """A single-day request returns the next morning's reading under the
    requested key; the timestamp is the truth."""
    readings, counts, _ = parse(
        payload({"20261014": reading(82.997, 17.4, ms("2026-10-15"))})
    )
    assert list(readings["yeleru"]) == ["2026-10-15"]
    assert counts["redated_to_timestamp"] == 1


def test_two_keys_with_one_timestamp_collapse_to_one_reading():
    ts = ms("2026-10-14")
    readings, counts, _ = parse(
        payload(
            {
                "20261014": reading(82.997, 17.4, ts),
                "20261015": reading(82.997, 17.4, ts),
            }
        )
    )
    assert list(readings["yeleru"]) == ["2026-10-14"]
    assert counts["duplicate_reading_date"] == 1


@pytest.mark.parametrize(
    "level,storage,reason",
    [
        (0.0, 23.35, "zero_level_with_storage"),  # Nov 2015 rows
        (280.4462, 21.93, "level_out_of_range"),  # Jan 2020, feet in a metre field
        (82.0, 25.0, "storage_out_of_range"),  # above 24.11 x 1.02
        (71.53, 0.0, "zero_storage"),  # a blank filed as zero
    ],
)
def test_bad_readings_are_counted_not_kept(level, storage, reason):
    readings, counts, rejected = parse(
        payload({"20261014": reading(level, storage, ms("2026-10-14"))})
    )
    assert readings["yeleru"] == {}
    assert counts[f"rejected_{reason}"] == 1
    assert rejected[0]["reason"] == reason


def test_readings_outside_the_window_are_trimmed():
    readings, _, _ = parse(payload({"20260930": reading(82.0, 16.0, ms("2026-09-30"))}))
    assert readings["yeleru"] == {}


def test_a_renamed_uuid_stops_the_run():
    p = payload({"20261014": reading(82.997, 17.4, ms("2026-10-14"))})
    p[YELERU["uuid"]]["reservoirName"] = "SOME OTHER RESERVOIR"
    with pytest.raises(SystemExit):
        parse(p)


def test_attribute_drift_is_reported():
    meta = {
        "locationName": "YELERU RESERVOIR",
        "reservoirAttrs": {
            "fullreservoirlevel": "86.56",
            "designcapacity": "24.00",
            "deadstorage": "6.16",
            "deadstoragelevel": "72.561",
        },
    }
    errs = check_attrs("yeleru", YELERU, meta)
    assert errs == ["yeleru: designcapacity is 24.0, expected 24.11"]
    meta["reservoirAttrs"]["designcapacity"] = "24.11"
    assert check_attrs("yeleru", YELERU, meta) == []


def test_newest_partial_day_is_held_back_until_every_dam_reports():
    readings, _, _ = parse(
        payload(
            {
                "20261013": reading(82.9, 17.3, ms("2026-10-13")),
                "20261014": reading(82.997, 17.4, ms("2026-10-14")),
            },
            {"20261013": reading(105.9, 1.32, ms("2026-10-13"), 140.4, 139.6)},
        )
    )
    hold = held_back(readings, date(2026, 10, 14))
    assert hold == {"2026-10-14"}
    rows = db_rows("visakhapatnam", readings, {"2026-10-13", "2026-10-14"} - hold)
    assert {(r["source_code"], r["date"]) for r in rows} == {
        ("raiwada", "2026-10-13"),
        ("yeleru", "2026-10-13"),
    }
    raiwada = next(r for r in rows if r["source_code"] == "raiwada")
    # inflow/outflow are INTEGER columns in reservoir_daily_v2.
    assert (raiwada["inflow_cusecs"], raiwada["outflow_cusecs"]) == (140, 140)
    assert raiwada["storage_tmc"] == 0.99
