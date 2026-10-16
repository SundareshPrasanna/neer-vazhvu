"""Checks on Nagpur's river-quality producer (build_nagpur_river_quality.py).

The producer reads only the reviewed CSVs in pipeline-inputs/nagpur/, so these
run offline against the committed inputs.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import build_nagpur_river_quality as b  # noqa: E402


def test_dry_month_is_a_reading_with_no_values():
    row = {
        "year": "2024",
        "month": "2024-06",
        "ph": "",
        "do_mgl": "",
        "bod_mgl": "",
        "fc_mpn100ml": "",
        "tc_mpn100ml": "",
        "bathing_criteria_as_printed": "Dry",
    }
    rd = b.mpcb_reading(row)
    assert rd["condition"] == "Dry" and rd["do_mgl"] is None and rd["bod_mgl"] is None
    assert "bathing_criteria" not in rd


def test_below_detection_coliform_is_not_a_number():
    row = {
        "year": "2021",
        "month": "2021-08",
        "ph": "8.6",
        "do_mgl": "4.4",
        "bod_mgl": "8.6",
        "fc_mpn100ml": "<1.8",
        "tc_mpn100ml": "170.0",
        "bathing_criteria_as_printed": "Non Complying",
    }
    rd = b.mpcb_reading(row)
    assert rd["fecal_coliform_mpn"] is None
    assert rd["below_detection"] == ["fecal_coliform_mpn"]
    assert rd["bod_mgl"] == 8.6 and rd["total_coliform_mpn"] == 170


def test_months_reproduce_cpcb_2021_2024_and_record_earlier_years():
    monthly = b.rows("river-mpcb-monthly-2017-2024.csv")
    annual = b.rows("river-cpcb-nwmp-annual-2018-2024.csv")
    fails, recorded = b.cross_check(monthly, annual)
    assert fails == []
    assert any(r.startswith("1908 2018 bod") and "60.0" in r for r in recorded)


def test_cross_check_catches_a_mistyped_month():
    monthly = b.rows("river-mpcb-monthly-2017-2024.csv")
    annual = b.rows("river-cpcb-nwmp-annual-2018-2024.csv")
    for r in monthly:
        if r["station_code"] == "1909" and r["month"] == "2023-03":
            r["bod_mgl"] = "19.8"  # printed 9.8, the 2023 maximum
    fails, _ = b.cross_check(monthly, annual)
    assert any(f.startswith("1909 2023 bod") for f in fails)


def test_artifact_shape():
    quality, stps, _ = b.build({})
    assert [r["id"] for r in quality["rivers"]] == b.RIVERS
    stations = [s for r in quality["rivers"] for s in r["stations"]]
    assert len(stations) == 28
    for s in stations:
        # One time resolution per station: the chart keys on month ?? year.
        assert len({r.get("month") is None for r in s["readings"]}) == 1
        months = [r.get("month") or str(r["year"]) for r in s["readings"]]
        assert months == sorted(months)
    ambhora = next(s for s in stations if s["id"] == "nwmp-1910")
    assert (
        ambhora["lat"] is None
        and ambhora["lng"] is None
        and len(ambhora["readings"]) == 96
    )
    agargaon = next(s for s in stations if s["id"] == "nwmp-1909")
    assert agargaon["coord_source"].startswith("CPCB WQMN_list.pdf")
    swapped = [
        s["site_code"]
        for s in stations
        if "cannot both be right" in (s["readings"][0].get("fecal_coliform_note") or "")
    ]
    assert swapped == ["Pilli-5", "Pilli-6"]
    nag = quality["rivers"][0]
    assert all(s["readings"][0]["bod_mgl"] is None for s in nag["stations"])
    assert quality["last_updated"] == "2024-12"
    assert stps["summary"]["operational_capacity_mld"] == 403.5
    assert stps["summary"]["mpcb_non_comply_jan_2026"] == 12
    assert len(stps["features"]) == 13


def test_no_em_dashes_in_page_text():
    quality, stps, _ = b.build({})
    text = quality["_headline"] + "".join(
        r["description"] + r["notes"] + r["cpcb_class"] for r in quality["rivers"]
    )
    assert "—" not in text and "–" not in text
