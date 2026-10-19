"""Every city's curated input builds, and builds the artifact that is committed.

src/cities/<city>/<family>.json is the source of each curated artifact. A change
to the artifact without its input (or the reverse) fails here, as does any row
that breaks a hard check in build_curated.py.
"""

import json
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "neer-vazhvu-api" / "scripts"))

import build_curated as engine  # noqa: E402

CASES = [(f, c) for f in engine.FAMILIES for c in engine.cities_with_input(f)]
PRODUCED_AT = re.compile(r'"produced_at": "[^"]*"')


@pytest.mark.parametrize("family", list(engine.FAMILIES))
def test_every_artifact_has_an_input_or_a_named_builder(family):
    on_disk = {
        p.stem[len(family) + 1 :]
        for p in (ROOT / "public/data").glob(f"{family}-*.json")
    }
    covered = set(engine.cities_with_input(family)) | set(
        engine.FAMILIES[family].scripted
    )
    assert sorted(on_disk - covered) == []
    assert not set(engine.cities_with_input(family)) & set(
        engine.FAMILIES[family].scripted
    )


@pytest.mark.parametrize("family,city", CASES)
def test_input_passes_the_hard_checks(family, city):
    problems, _ = engine.check(family, city, engine.load(family, city), "2026-10-18")
    assert problems == []


@pytest.mark.parametrize("family,city", CASES)
def test_input_builds_the_committed_artifact(family, city):
    path = engine.output_path(family, city)
    built = engine.render(family, city, engine.load(family, city), path=path)
    # The writer advances produced_at to today; everything else must match byte for byte.
    assert PRODUCED_AT.sub("", built) == PRODUCED_AT.sub("", path.read_text()), (
        f"{path.name} does not match src/cities/{city}/{family}.json. Edit the input and run: "
        f"python3 neer-vazhvu-api/scripts/build_curated.py {family} --city {city}"
    )


def test_a_new_city_gets_its_envelope_from_the_seed(tmp_path):
    spec = engine.load("commitments", "nagpur")
    built = json.loads(
        engine.render("commitments", "nagpur", spec, path=tmp_path / "missing.json")
    )
    assert built["nvdm"] == "1.0" and built["scope"] == {"kind": "city", "id": "nagpur"}
    assert all(s.get("license") for s in built["provenance"]["sources"])


def test_crore_splits_must_add_up():
    assert (
        engine.split_sums(
            "Rs 1,926.99 crore (Centre 1,115.22, State 507.36, NMC 304.41)"
        )
        == []
    )
    assert engine.split_sums("Rs 237.20 crore (167.44 + 69.76, our sum)") == []
    assert engine.split_sums("Rs 12.95 crore (Centre 3.24, State 3.24, NMC 6.48)") == []
    assert engine.split_sums("Rs 381.85 crore (Centre 25%, State 25%, NMC 50%)") == []
    assert engine.split_sums("Rs 118 crore (2023-24 budget)") == []
    assert engine.split_sums("Rs 100 crore (Centre 40, State 50)") != []
