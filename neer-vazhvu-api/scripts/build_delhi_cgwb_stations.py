#!/usr/bin/env python3
"""Entry point named by delhi-cgwb-stations.json's produced_by; the build is build_cgwb_stations.py --city delhi.

Usage:  python scripts/build_delhi_cgwb_stations.py [--refresh]
"""

import sys

from build_cgwb_stations import main

sys.exit(main(["--city", "delhi", *sys.argv[1:]]))
