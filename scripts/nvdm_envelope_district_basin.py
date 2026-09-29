#!/usr/bin/env python3
"""Stamp NVDM v1 envelopes on a district basin's artifacts from its config
module, so a new district needs no enveloper of its own.

    python3 scripts/nvdm_envelope_district_basin.py scripts/build_palakkad_rivers_basin.py

Run after the build; the builder writes through nvdm_write.write_artifact, so
the envelopes survive later re-runs and this is re-run only when the source
list changes. The config names:

  ENVELOPE_SOURCES    name -> (registry id, title, publisher, extra fields), or a
                      closed document's source dict as it is cited
  ENVELOPE_ARTIFACTS  family (or a .json file name) -> source names (every served
                      file, inventory included)
  ENVELOPE_READINGS   readings/ file prefix -> source names (first match; "" is a catch-all)
  ENVELOPE_NOTE       the note every artifact carries
  ENVELOPE_INPUTS     optional: family -> internal_inputs (catalogued artifacts it reads)
  ENVELOPE_AUTHORED   optional: file name -> produced_by text of a hand-authored file

Tamil Nadu districts take the shared families from lib/tn_district_basin.tn_envelope.

Licence text comes from the Headwaters registry, never inline; every registry
id named must list the artifact in its dependsOn.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
from registry_license import registry_license  # noqa: E402

ENVELOPE_KEYS = ("nvdm", "dataset", "scope", "projection", "provenance", "ext")


def load_config(path: str):
    spec = importlib.util.spec_from_file_location("district_basin_config", REPO / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def stamp(fp: Path, cfg, dataset: str, sources: list[dict], produced_at: str, compact: bool, inputs=(), authored=None) -> None:
    payload = {k: v for k, v in json.loads(fp.read_text()).items() if k not in ENVELOPE_KEYS}
    prov = {"sources": sources, "method": "manual" if authored else "derived", "produced_at": produced_at,
            "produced_by": authored or f"scripts/{cfg.GENERATED_FROM}"}
    if inputs:
        prov["internal_inputs"] = list(inputs)
    prov["note"] = cfg.ENVELOPE_NOTE
    doc = {"nvdm": "1.0", "dataset": dataset, "scope": {"kind": "basin", "id": cfg.BASIN_ID}, "provenance": prov, **payload}
    fp.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) if compact else json.dumps(doc, ensure_ascii=False, indent=2) + "\n")


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        raise SystemExit(__doc__)
    cfg = load_config(argv[0])
    sources = {  # a closed document is cited as its dict; the rest take their licence from the registry
        name: src if isinstance(src, dict) else {"id": src[0], "title": src[1], "publisher": src[2], "license": registry_license(src[0]), "role": "input", **src[3]}
        for name, src in cfg.ENVELOPE_SOURCES.items()
    }
    inputs, authored = getattr(cfg, "ENVELOPE_INPUTS", {}), getattr(cfg, "ENVELOPE_AUTHORED", {})
    basin = REPO / "public/data/basins" / cfg.BASIN_ID
    today = date.today().isoformat()
    files = {key: key if key.endswith(".json") else f"{key}.json" if key == "inventory" else f"{key}.geojson" for key in cfg.ENVELOPE_ARTIFACTS}
    for key, names in cfg.ENVELOPE_ARTIFACTS.items():
        fp = basin / files[key]
        if not fp.exists():
            raise SystemExit(f"missing {fp.name}: run scripts/{cfg.GENERATED_FROM} first")
        cited, dataset = [sources[n] for n in names], f"basins/{fp.stem}"
        stamp(fp, cfg, dataset, cited, today, fp.suffix == ".geojson", inputs.get(key, ()), authored.get(fp.name))
        shards = sorted((basin / fp.stem).glob("*.geojson")) if (basin / fp.stem).is_dir() else []
        for shard in shards:  # a heavy family is sliced per catchment; every shard carries the family's envelope
            stamp(shard, cfg, dataset, cited, today, True, inputs.get(key, ()))
        print(f"  enveloped {fp.name:32}" + (f" + {len(shards)} shards" if shards else ""))
    packs = sorted((basin / "readings").glob("*.json"))
    for pack in packs:
        prefix = next((p for p in cfg.ENVELOPE_READINGS if pack.name.startswith(p)), None)
        if prefix is None:
            raise SystemExit(f"readings/{pack.name} has no envelope rule in ENVELOPE_READINGS")
        stamp(pack, cfg, "basins/readings", [sources[n] for n in cfg.ENVELOPE_READINGS[prefix]], today, compact=True)
    print(f"  enveloped {len(packs)} station packs")
    unruled = sorted({p.name for p in basin.glob("*.*json")} - set(files.values()))
    if unruled:
        raise SystemExit(f"artifacts with no envelope rule: {unruled}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
