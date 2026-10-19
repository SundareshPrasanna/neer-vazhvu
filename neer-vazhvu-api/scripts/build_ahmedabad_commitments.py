#!/usr/bin/env python3
"""Entry point named by commitments-ahmedabad.json's produced_by. The rows live in
src/cities/ahmedabad/commitments.json; build_curated.py builds every city.

Usage:  python3 neer-vazhvu-api/scripts/build_ahmedabad_commitments.py [--check]
"""

import sys

from build_curated import main

sys.exit(main(["commitments", "--city", "ahmedabad", *sys.argv[1:]]))
