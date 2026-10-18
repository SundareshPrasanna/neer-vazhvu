#!/usr/bin/env python3
"""Entry point named by restoration-projects-ahmedabad.json's and
water-bodies-flagship-ahmedabad.json's produced_by. The rows live in
src/cities/ahmedabad/{restoration-projects,water-bodies-flagship}.json;
build_curated.py builds every city.

Usage:  python3 neer-vazhvu-api/scripts/build_ahmedabad_lakes.py [--check]
"""

import sys

from build_curated import main

sys.exit(
    main(
        [
            "restoration-projects",
            "water-bodies-flagship",
            "--city",
            "ahmedabad",
            *sys.argv[1:],
        ]
    )
)
