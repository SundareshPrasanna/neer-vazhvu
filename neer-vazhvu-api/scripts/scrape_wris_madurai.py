#!/usr/bin/env python3
"""Daily WRIS groundwater ingest for madurai. The local launchd job runs this name."""

import asyncio
import sys

from scrape_wris_groundwater import main

if __name__ == "__main__":
    sys.exit(asyncio.run(main("madurai")))
