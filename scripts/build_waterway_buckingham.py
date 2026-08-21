#!/usr/bin/env python3
"""Buckingham Canal entry point for the generic waterway build.

The build itself is scripts/build_waterway.py (generalized 19 Aug 2026 when
the Cooum became waterway 2; per-waterway parameters in
scripts/waterways/buckingham-canal.json). This shim stays because the
canal's served artifacts name it in provenance.produced_by, and
scripts/check-generator-drift.py resolves producers by that path.

Companion gates: scripts/verify_waterway_buckingham.py (run after) and
scripts/audit_waterway_numbers.py.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_waterway import main  # noqa: E402

if __name__ == "__main__":
    main("buckingham-canal")
