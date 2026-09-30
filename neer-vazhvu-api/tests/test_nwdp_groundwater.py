"""NWDP groundwater fallback: daily means and the join to known stations.

The fetch is not tested here. What can go wrong silently is the transform:
NWDP rows have no station code, carry placeholder values, and repeat station
names across manual and telemetric wells.
"""

from datetime import date

from app.scrapers.nwdp import daily_means, join_to_stations, station_key
from app.scrapers.wris import _deduplicate_daily

LEVEL = "Groundwater Level Telemetry 6 Hourly (meter)"
WINDOW = (date(2026, 9, 1), date(2026, 9, 30))


def _row(station, when, level, agency="CGWB"):
    # Field order as the portal returns it: the level is the last 'Level' field.
    return {
        "Station": station,
        "Agency": agency,
        "State LGD Code": "33",
        "Data Acquisition Time": when,
        LEVEL: level,
    }


def test_daily_mean_keeps_sign_and_drops_placeholders():
    rows = [
        _row("Singasandra_1", "25-09-2026 00:00", "-19.80"),
        _row("Singasandra_1", "25-09-2026 06:00", "-19.70"),
        _row("Singasandra_1", "25-09-2026 12:00", "1.0"),
        _row("Singasandra_1", "25-09-2026 18:00", "0.0"),
        _row("Singasandra_1", "26-09-2026 00:00", "660.2"),
        _row("Singasandra_1", "27-09-2026 00:00", "-"),
    ]
    assert daily_means(rows, *WINDOW) == {
        (("singasandra1", "CGWB"), date(2026, 9, 25)): -19.75
    }


def test_daily_mean_respects_the_window():
    rows = [
        _row("A", "31-08-2026 18:00", "-4.0"),
        _row("A", "01-09-2026 00:00", "-5.0"),
    ]
    assert list(daily_means(rows, *WINDOW)) == [(("a", "CGWB"), date(2026, 9, 1))]


def test_join_by_name_and_agency():
    stations = [
        {
            "station_code": "TNGW1",
            "station_name": "M.Rajakkapatti",
            "agency": "Tamil Nadu SW GW",
        },
        {"station_code": "CHEN8", "station_name": "Guindy (CLRI)", "agency": "CGWB"},
        {"station_code": "V1", "station_name": "Valayankulam", "agency": "CGWB"},
        {"station_code": "V2", "station_name": "Valayankulam", "agency": "CGWB"},
    ]
    day = date(2026, 9, 28)
    daily = {
        (station_key("M. Rajakkapatti", "Tamil Nadu SW GW"), day): -7.5,
        (station_key("Guindy (CLRI)", "CGWB"), day): -3.2,
        (station_key("Valayankulam", "CGWB"), day): -9.0,
        (station_key("Mathipanur", "Tamil Nadu SW GW"), day): -2.0,
    }
    rows, unjoined = join_to_stations(daily, stations, have={("CHEN8", "2026-09-28")})
    assert rows == [
        {
            "station_code": "TNGW1",
            "station_name": "M.Rajakkapatti",
            "agency": "Tamil Nadu SW GW",
            "reading_date": "2026-09-28",
            "depth_to_water_m": -7.5,
            "acquisition_mode": "Telemetric",
        }
    ]
    assert unjoined == {"valayankulam", "mathipanur"}


def test_wris_daily_mean_drops_placeholders():
    # Kallandri1_1 on 2026-04-27: stored as 17.053 when the 1.0s were averaged in.
    raw = [
        {"stationCode": "K1", "dataTime": f"2026-04-27T{h}:00:00", "dataValue": v}
        for h, v in [("00", 1.0), ("06", 49.16), ("12", 1.0), ("18", 51.87)]
    ]
    assert [r.depth_to_water_m for r in _deduplicate_daily(raw)] == [49.16]
