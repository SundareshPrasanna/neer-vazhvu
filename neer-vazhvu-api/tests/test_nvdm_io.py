"""Envelope-preservation regression for the app-side NVDM bridge.

Review of #220 reproduced the decay bug in the cascade pipeline:
`run_cascade.py --district mumbai stats` rewrote an enveloped artifact as a
bare payload (L2 -> L1). Every canonical write in app code now goes through
app.nvdm_io.merge_envelope; these tests pin (a) the bridge import, (b) the
preserve-and-advance semantics, and (c) the exact serialization expressions
the three writer families use (publish/catchments one-line spaced with
trailing newline; coastline/elevation compact without; stats/quality
indent=2 with) - the offline proxy for the GEE-gated coastline/elevation
stages, which cannot run in CI.
"""

from __future__ import annotations

import json
from datetime import date

from app.nvdm_io import merge_envelope

ENVELOPE = {
    "nvdm": "1.0",
    "dataset": "cascade/cascade-stats",
    "scope": {"kind": "region", "id": "mumbai"},
    "provenance": {
        "sources": [],
        "method": "derived",
        "produced_at": "2026-01-01",
        "internal_inputs": ["public/geojson/mumbai-water-bodies-current.geojson"],
        "produced_by": "x",
        "note": "n",
    },
}


def _seed(tmp_path, payload_extra):
    p = tmp_path / "artifact.json"
    p.write_text(json.dumps({**ENVELOPE, **payload_extra}, ensure_ascii=False))
    return p


def test_merge_envelope_preserves_and_advances(tmp_path):
    p = _seed(tmp_path, {"node_count": 1})
    merged = merge_envelope(p, {"node_count": 2, "edge_count": 3})
    assert merged["nvdm"] == "1.0"
    assert merged["dataset"] == "cascade/cascade-stats"
    assert merged["scope"] == {"kind": "region", "id": "mumbai"}
    assert merged["provenance"]["internal_inputs"] == [
        "public/geojson/mumbai-water-bodies-current.geojson"
    ]
    assert merged["provenance"]["produced_at"] == date.today().isoformat()
    assert merged["node_count"] == 2 and merged["edge_count"] == 3
    # Envelope keys come FIRST (spec: envelope ahead of payload).
    assert list(merged)[:4] == ["nvdm", "dataset", "scope", "provenance"]


def test_merge_envelope_noop_on_bare_payload(tmp_path):
    p = tmp_path / "naked.json"
    p.write_text(json.dumps({"123": {"a": 1}}))
    assert merge_envelope(p, {"123": {"a": 2}}) == {"123": {"a": 2}}


def test_merge_envelope_noop_on_missing_file(tmp_path):
    p = tmp_path / "new.json"
    assert merge_envelope(p, {"x": 1}) == {"x": 1}


def test_writer_family_styles_keep_envelope(tmp_path):
    """The exact json.dumps expressions used by the three writer families,
    round-tripped: the rewritten file must still open at L2 shape."""
    fc = {"type": "FeatureCollection", "features": [{"type": "Feature"}]}
    expressions = [
        # publish.write_geojson / catchments (one-line spaced, trailing \n)
        lambda path, doc: path.write_text(
            json.dumps(merge_envelope(path, doc), ensure_ascii=False) + "\n",
            encoding="utf-8",
        ),
        # coastline.run / build_elevation_bands (compact, no trailing \n)
        lambda path, doc: path.write_text(
            json.dumps(merge_envelope(path, doc), separators=(",", ":")),
            encoding="utf-8",
        ),
        # stats / quality / systems manifests (indent=2, trailing \n)
        lambda path, doc: path.write_text(
            json.dumps(merge_envelope(path, doc), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        ),
    ]
    for i, write in enumerate(expressions):
        d = tmp_path / f"s{i}"
        d.mkdir()
        p = _seed(d, {"type": "FeatureCollection", "features": []})
        write(p, fc)
        out = json.loads(p.read_text())
        assert out["nvdm"] == "1.0", f"style {i} stripped the envelope"
        assert out["features"] == [{"type": "Feature"}]
        assert out["provenance"]["produced_at"] == date.today().isoformat()
