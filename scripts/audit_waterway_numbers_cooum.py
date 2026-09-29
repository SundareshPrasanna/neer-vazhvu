#!/usr/bin/env python3
"""Cooum entry point for the numeric audit, scripts/audit_waterway_numbers.py.

Kept because the Cooum methods text names it (and the audit checks that it does).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from audit_waterway_numbers import main  # noqa: E402

if __name__ == "__main__":
    main("cooum")
