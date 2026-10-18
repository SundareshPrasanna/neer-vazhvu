#!/usr/bin/env python3
"""Entry point named by commitments-nagpur.json's produced_by. The rows live in
src/cities/nagpur/commitments.json; build_curated.py builds every city.

Usage:  python3 neer-vazhvu-api/scripts/build_nagpur_commitments.py [--check]
"""

import sys

from build_curated import main

sys.exit(main(["commitments", "--city", "nagpur", *sys.argv[1:]]))
