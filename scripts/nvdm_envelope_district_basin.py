#!/usr/bin/env python3
"""Stamp NVDM v1 envelopes on a district basin's artifacts from its config
module, so a new district needs no enveloper of its own.

    python3 scripts/nvdm_envelope_district_basin.py scripts/build_palakkad_rivers_basin.py

Run after the build; the builder writes through nvdm_write.write_artifact, so
the envelopes survive later re-runs and this is re-run only when the source
list changes. The config names:

  ENVELOPE_SOURCES    name -> (registry id, title, publisher, extra fields)
  ENVELOPE_ARTIFACTS  family -> source names (every served family, inventory included)
  ENVELOPE_READINGS   readings/ file prefix -> source names
  ENVELOPE_NOTE       the note every artifact carries

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


def stamp(fp: Path, cfg, dataset: str, sources: list[dict], produced_at: str, compact: bool) -> None:
    payload = {k: v for k, v in json.loads(fp.read_text()).items() if k not in ENVELOPE_KEYS}
    prov = {"sources": sources, "method": "derived", "produced_at": produced_at, "produced_by": f"scripts/{cfg.GENERATED_FROM}", "note": cfg.ENVELOPE_NOTE}
    doc = {"nvdm": "1.0", "dataset": dataset, "scope": {"kind": "basin", "id": cfg.BASIN_ID}, "provenance": prov, **payload}
    fp.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) if compact else json.dumps(doc, ensure_ascii=False, indent=2) + "\n")


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        raise SystemExit(__doc__)
    cfg = load_config(argv[0])
    sources = {
        name: {"id": sid, "title": title, "publisher": publisher, "license": registry_license(sid), "role": "input", **extra}
        for name, (sid, title, publisher, extra) in cfg.ENVELOPE_SOURCES.items()
    }
    basin = REPO / "public/data/basins" / cfg.BASIN_ID
    today = date.today().isoformat()
    for family, names in cfg.ENVELOPE_ARTIFACTS.items():
        fp = basin / (f"{family}.json" if family == "inventory" else f"{family}.geojson")
        if not fp.exists():
            raise SystemExit(f"missing {fp.name}: run scripts/{cfg.GENERATED_FROM} first")
        cited = [sources[n] for n in names]
        stamp(fp, cfg, f"basins/{family}", cited, today, compact=family != "inventory")
        shards = sorted((basin / family).glob("*.geojson")) if (basin / family).is_dir() else []
        for shard in shards:  # a heavy family is sliced per catchment; every shard carries the family's envelope
            stamp(shard, cfg, f"basins/{family}", cited, today, compact=True)
        print(f"  enveloped {fp.name:32}" + (f" + {len(shards)} shards" if shards else ""))
    packs = sorted((basin / "readings").glob("*.json"))
    for pack in packs:
        prefix = next((p for p in cfg.ENVELOPE_READINGS if pack.name.startswith(p)), None)
        if prefix is None:
            raise SystemExit(f"readings/{pack.name} has no envelope rule in ENVELOPE_READINGS")
        stamp(pack, cfg, "basins/readings", [sources[n] for n in cfg.ENVELOPE_READINGS[prefix]], today, compact=True)
    print(f"  enveloped {len(packs)} station packs")
    served = {p.stem for p in basin.glob("*.geojson")} | {"inventory"}
    unruled = sorted(served - set(cfg.ENVELOPE_ARTIFACTS))
    if unruled:
        raise SystemExit(f"artifacts with no envelope rule: {unruled}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
