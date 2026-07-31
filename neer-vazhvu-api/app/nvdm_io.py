"""Bridge to the repo-root NVDM envelope helper (scripts/nvdm_write.py).

The cascade / GEE / elevation pipelines are app modules that write served
artifacts under public/. Review of #220 reproduced the decay bug here:
`run_cascade.py --district mumbai stats` rewrote an enveloped artifact as a
bare payload (L2 -> L1). Every canonical artifact write in app code must
merge the existing envelope back in - import `merge_envelope` from here and
wrap the payload just before json.dumps; each writer keeps its own byte
style (one-line spaced, compact, indent=2, trailing newline or not).

Single source of truth stays scripts/nvdm_write.py; this module only makes
it importable from the app package without per-file sys.path noise.
"""

from __future__ import annotations

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO_ROOT / "scripts"))

from nvdm_write import merge_envelope, write_artifact  # noqa: E402,F401

__all__ = ["merge_envelope", "write_artifact"]
