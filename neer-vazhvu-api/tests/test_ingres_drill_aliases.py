"""Drill-to-unit behaviour of build_ingres_gwr.py that a Nagpur run depends on.

Offline: the API and the GeoServer are replaced by rows in the shape IN-GRES
serves. What can go wrong silently is the join: a spelling that changes between
editions splits one taluka into short blocks, and a WFS name that does not
reach the same display name leaves a polygon with no assessment.
"""

import io
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import build_ingres_gwr as gwr  # noqa: E402

YEARS = ["2022-2023", "2023-2024", "2025-2026"]
SPELLING = {  # edition -> the portal's spelling of the same two units
    "2022-2023": ("HINGANA", "NAGPUR"),
    "2023-2024": ("Hingana", "Nagpur Rural"),
    "2025-2026": ("Hingna", "Nagpur (Rural)"),
}


def _row(name, stage, cat="safe"):
    v = {"total": 1.0, "command": 0.5, "non_command": 0.5}
    return {
        "locationName": name,
        "category": {"total": cat},
        "stageOfExtraction": {"total": stage},
        "totalGWAvailability": {"total": 100.0, "command": 60.0, "non_command": 40.0},
        "draftData": {"total": v, "agriculture": v, "domestic": v, "industry": v},
        "area": {"recharge_worthy": {"totalArea": 10.0, "poorQualityArea": 0.0}},
        "rainfall": {"total": 1100.0},
    }


def _units(drill, year):
    hingna, rural = SPELLING[year]
    rows = [_row(hingna, 40.0), _row(rural, 45.0), {"locationName": "total"}]
    if year != "2022-2023":
        rows.insert(
            2, _row("Nagpur Urban" if year == "2023-2024" else "Nagpur (Urban)", 30.0)
        )
    return rows


def _state(state, year):
    return [{**_row("Nagpur", 47.0), "locationName": "Nagpur"}]


WFS = {
    "features": [
        {
            "properties": {"name": n, "ext_id": n},
            "geometry": {"type": "Polygon", "coordinates": []},
        }
        for n in ("HINGANA", "NAGPUR", "NAGPUR CITY")
    ]
}


class _Shim:
    parse = gwr.urllib.parse

    class request:
        @staticmethod
        def Request(url, headers=None):
            return url

        @staticmethod
        def urlopen(req, timeout=None):
            return io.BytesIO(json.dumps(WFS).encode())


def _cfg(**drill_extra):
    drill = {
        "state": "MAHARASHTRA",
        "district": "NAGPUR",
        "district_uuid": "x",
        "unit_label": "taluka",
        "keep_district_total": True,
        "aliases": {
            "HINGANA": "HINGNA",
            "NAGPUR": "NAGPUR (RURAL)",
            "NAGPUR RURAL": "NAGPUR (RURAL)",
            "NAGPUR URBAN": "NAGPUR (URBAN)",
            "NAGPUR CITY": "NAGPUR (URBAN)",
        },
        "names": {
            "HINGNA": "Hingna",
            "NAGPUR (RURAL)": "Nagpur (Rural)",
            "NAGPUR (URBAN)": "Nagpur (Urban)",
        },
        "wfs": {"layer": "gec:indgec_ver_mahar", "year": 2021},
        **drill_extra,
    }
    return {
        "state_label": "Maharashtra",
        "source_id": "ingres-groundwater-maharashtra",
        "drill": drill,
        "years": YEARS,
        "notes": [],
    }


@pytest.fixture
def run(tmp_path, monkeypatch):
    monkeypatch.setattr(gwr, "fetch_units", _units)
    monkeypatch.setattr(gwr, "fetch", _state)
    monkeypatch.setattr(gwr, "urllib", _Shim)
    monkeypatch.setattr(gwr, "DATA_DIR", tmp_path / "public" / "data")
    monkeypatch.setattr(gwr, "REPO_ROOT", tmp_path)
    (tmp_path / "public" / "data").mkdir(parents=True)
    (tmp_path / "public" / "geojson").mkdir(parents=True)

    def go(cfg):
        rc = gwr.build_drilled("nagpur", cfg)
        out = tmp_path / "public" / "data" / "gwr-blocks-nagpur.json"
        geo = tmp_path / "public" / "geojson" / "nagpur-gwr-blocks.geojson"
        return (
            rc,
            json.loads(out.read_text()) if out.exists() else None,
            json.loads(geo.read_text()) if geo.exists() else None,
        )

    return go


def test_spellings_join_into_one_unit_each(run):
    rc, doc, geo = run(_cfg())
    assert rc == 0
    by = {b["name"]: b for b in doc["blocks"]}
    assert sorted(by) == ["Hingna", "Nagpur (Rural)", "Nagpur (Urban)"]
    assert [h["year_label"] for h in by["Hingna"]["history"]] == YEARS
    assert [h["year_label"] for h in by["Nagpur (Rural)"]["history"]] == YEARS
    # Only the unit that is genuinely new carries the short-series caveat.
    assert "history_caveat" in by["Nagpur (Urban)"]
    assert "history_caveat" not in by["Hingna"]
    # Every WFS spelling reaches the same display name as the assessment.
    assert sorted(f["properties"]["block"] for f in geo["features"]) == sorted(by)


def test_configured_caveat_replaces_the_generic_one(run):
    cfg = _cfg()
    cfg["block_caveats"] = {
        "Nagpur (Urban)": "Read the category.",
        "Hingna": "Gave 99 ha.",
    }
    rc, doc, _ = run(cfg)
    assert rc == 0
    by = {b["name"]: b for b in doc["blocks"]}
    assert by["Nagpur (Urban)"]["history_caveat"] == "Read the category."
    assert by["Hingna"]["history_caveat"] == "Gave 99 ha."
    assert "history_caveat" not in by["Nagpur (Rural)"]


def test_city_caveat_leads_each_unit_caveat(run):
    """The Visakhapatnam form: one city line on every unit, then the unit's own."""
    cfg = _cfg()
    cfg["history_caveat"] = "Editions start at 2022-2023."
    cfg["block_caveats"] = {"Hingna": "Gave 99 ha."}
    rc, doc, _ = run(cfg)
    by = {b["name"]: b for b in doc["blocks"]}
    assert by["Hingna"]["history_caveat"] == "Editions start at 2022-2023. Gave 99 ha."
    assert by["Nagpur (Urban)"]["history_caveat"] == "Editions start at 2022-2023."


def test_caveat_for_no_unit_is_refused(run):
    cfg = _cfg()
    cfg["block_caveats"] = {"HINGNA": "Keyed by the upper-case key, not the name."}
    rc, doc, _ = run(cfg)
    assert rc == 1 and doc is None


def test_published_mismatch_stops_before_writing(run):
    rc, doc, _ = run(_cfg(published={"2023-2024": {"development_pct": 47.01}}))
    assert rc == 1 and doc is None
    rc, doc, _ = run(
        _cfg(published={"2023-2024": {"development_pct": 47.0, "class": "Safe"}})
    )
    assert rc == 0 and doc is not None


def test_alias_target_without_a_display_name_is_refused(run):
    cfg = _cfg()
    del cfg["drill"]["names"]["HINGNA"]
    rc, doc, _ = run(cfg)
    assert rc == 1 and doc is None


def test_without_aliases_spellings_stay_separate(run):
    """The pre-alias behaviour, which every other drilled city still gets."""
    cfg = _cfg()
    del cfg["drill"]["aliases"]
    del cfg["drill"]["wfs"]
    rc, doc, _ = run(cfg)
    names = sorted(b["name"] for b in doc["blocks"])
    assert "Hingana" in names and "Hingna" in names and "Nagpur" in names
