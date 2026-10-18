#!/usr/bin/env python3
"""Entry point named by commitments-kolkata.json's produced_by. The rows live in
src/cities/kolkata/commitments.json; build_commitments.py builds every city.

Usage:  python3 neer-vazhvu-api/scripts/build_kolkata_kmcsharp_commitments.py [--check]
"""

import sys

from build_commitments import main

sys.exit(main(["--city", "kolkata", *sys.argv[1:]]))
