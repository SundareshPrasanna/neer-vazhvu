#!/usr/bin/env python3
"""Entry point named by hyderabad-cgwb-stations.json's produced_by; the build is build_cgwb_stations.py --city hyderabad.

Usage:  python scripts/build_hyderabad_cgwb_stations.py [--refresh]
"""

import sys

from build_cgwb_stations import main

sys.exit(main(["--city", "hyderabad", *sys.argv[1:]]))
