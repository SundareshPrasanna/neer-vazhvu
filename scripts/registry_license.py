#!/usr/bin/env python3
"""Single source of truth for a registered source's licence string.

WHY THIS EXISTS. Envelope generators used to carry their own hardcoded copy of
each source's licence next to its registry id. The copies drifted: by the time
PR #227 corrected the registry, 32 source ids disagreed with the envelopes that
named them, and DATA-LICENSE.md was simultaneously telling readers that
`provenance.sources[].license` is the authoritative record. The repository
contradicted itself at exactly the point it told people to look.

THE CONTRACT, enforced by scripts/validate_nvdm.py:

  * a provenance source that carries an `id` is registered, and the REGISTRY
    owns its licence. The envelope mirrors that string verbatim so an artifact
    is readable on its own, but the registry is what a correction updates.
  * a provenance source with NO id is a one-off (a closed dataset, a paper, a
    single scraped page). Its inline `license` is the record, because there is
    nothing upstream of it.

Import this instead of writing a licence literal beside an id.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_DIR = ROOT / "scripts/source-registry"


@lru_cache(maxsize=1)
def registry_licenses() -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    for f in sorted(REGISTRY_DIR.glob("*.json")):
        for s in json.loads(f.read_text()).get("sources", []):
            if s.get("id"):
                out[s["id"]] = s.get("license")
    return out


def registry_license(source_id: str) -> str:
    """The registered licence for `source_id`. Raises if unregistered."""
    lic = registry_licenses().get(source_id)
    if lic is None:
        raise KeyError(
            f"source id '{source_id}' is not in scripts/source-registry/, or has "
            f"no licence recorded - register it before writing an envelope that "
            f"cites it"
        )
    return lic
