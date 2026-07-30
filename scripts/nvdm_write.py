"""Envelope-preserving artifact writer for Python producers.

The decay bug (review 2026-07-30): scheduled producers rewrote served
artifacts with bare payloads, stripping NVDM envelopes on cron - and their
workflows push directly to main where PR conformance cannot object. Every
Python producer that writes under public/data or public/geojson MUST write
through this helper.

Semantics: preserve-if-present. If the existing artifact carries an NVDM
envelope, its envelope keys are kept ahead of the fresh payload and
provenance.produced_at is advanced to today (the artifact IS being produced
now). If there is no existing envelope (city not yet migrated), the payload
is written as-is - migration will envelope it later, and from then on the
envelope survives every regeneration.

Usage (root scripts/ producers):        from nvdm_write import write_artifact
Usage (neer-vazhvu-api/scripts):        sys.path.insert(0, str(REPO_ROOT / "scripts"))
                                        from nvdm_write import write_artifact
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

ENVELOPE_KEYS = ("nvdm", "dataset", "scope", "provenance", "projection", "ext")


def write_artifact(
    path: Path,
    payload: dict,
    *,
    compact: bool = False,
    envelope_from: Path | None = None,
    indent: int = 2,
) -> None:
    """Write payload to path, preserving any existing NVDM envelope.

    envelope_from: inherit the envelope from ANOTHER artifact - for candidate/
    sidecar files that a reviewer later renames over the canonical path
    (round-2 review: a bare candidate strips governance on acceptance).

    indent: pretty-print width when not compact (default 2). Producers whose
    artifacts are stored indent=1 (the Mumbai scrapers) pass 1 so a scheduled
    regeneration does not reformat the whole file."""
    envelope: dict = {}
    src = envelope_from if envelope_from is not None else path
    if src.exists():
        try:
            existing = json.loads(src.read_text())
        except (json.JSONDecodeError, OSError):
            existing = None
        if isinstance(existing, dict) and "nvdm" in existing:
            envelope = {k: existing[k] for k in ENVELOPE_KEYS if k in existing}
            prov = envelope.get("provenance")
            if isinstance(prov, dict):
                prov["produced_at"] = date.today().isoformat()
    out = {**envelope, **{k: v for k, v in payload.items() if k not in envelope}}
    if compact:
        text = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    else:
        text = json.dumps(out, ensure_ascii=False, indent=indent)
    path.write_text(text)
