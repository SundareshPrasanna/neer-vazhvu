#!/usr/bin/env python3
"""Buckingham Canal entry point for the waterway publication gate, scripts/verify_waterway.py.

Kept because the buckingham-canal artifacts and scripts/waterways/buckingham-canal.json name it.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from verify_waterway import main  # noqa: E402

if __name__ == "__main__":
    main("buckingham-canal")
