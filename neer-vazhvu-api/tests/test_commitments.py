"""Every city's commitments input builds, and builds the artifact that is committed.

src/cities/<city>/commitments.json is the source of each commitments file. A
change to the artifact without its input (or the reverse) fails here, as does
any row that breaks a hard check in build_commitments.py.
"""

import json
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "neer-vazhvu-api" / "scripts"))

import build_commitments as engine  # noqa: E402

CITIES = engine.cities_with_input()
PRODUCED_AT = re.compile(r'"produced_at": "[^"]*"')


def test_every_city_with_commitments_has_an_input():
    on_disk = sorted(
        p.stem.split("commitments-", 1)[1]
        for p in (ROOT / "public/data").glob("commitments-*.json")
    )
    assert sorted(CITIES) == on_disk


@pytest.mark.parametrize("city", CITIES)
def test_input_passes_the_hard_checks(city):
    problems, _ = engine.check(city, engine.load(city), "2026-10-15")
    assert problems == []


@pytest.mark.parametrize("city", CITIES)
def test_input_builds_the_committed_artifact(city):
    path = engine.output_path(city)
    committed = path.read_text()
    built = engine.render(city, engine.load(city), path=path)
    # The writer advances produced_at to today; everything else must match byte for byte.
    assert PRODUCED_AT.sub("", built) == PRODUCED_AT.sub("", committed), (
        f"{path.name} does not match src/cities/{city}/commitments.json. "
        f"Edit the input and run: python3 neer-vazhvu-api/scripts/build_commitments.py --city {city}"
    )


def test_a_new_city_gets_its_envelope_from_the_seed(tmp_path):
    spec = engine.load("nagpur")
    built = json.loads(engine.render("nagpur", spec, path=tmp_path / "missing.json"))
    assert built["nvdm"] == "1.0" and built["scope"] == {"kind": "city", "id": "nagpur"}
    assert all(s.get("license") for s in built["provenance"]["sources"])
